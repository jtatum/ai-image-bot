import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { Collection } from 'discord.js'
import { CooldownHandler } from '@/infrastructure/discord/handlers/CooldownHandler.js'

describe('CooldownHandler', () => {
  let cooldownHandler: CooldownHandler
  let mockCooldowns: Collection<string, Collection<string, number>>

  beforeEach(() => {
    jest.useFakeTimers()
    mockCooldowns = new Collection()
    cooldownHandler = new CooldownHandler(mockCooldowns)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('checkCooldown', () => {
    it('should return not on cooldown when cooldown is 0 (disabled)', () => {
      const result = cooldownHandler.checkCooldown('user123', 'testcommand', 0)

      expect(result.isOnCooldown).toBe(false)
      expect(result.timeRemaining).toBeUndefined()
    })

    it('should return not on cooldown when cooldown is negative (disabled)', () => {
      const result = cooldownHandler.checkCooldown('user123', 'testcommand', -5)

      expect(result.isOnCooldown).toBe(false)
      expect(result.timeRemaining).toBeUndefined()
    })

    it('should return not on cooldown when user has never used the command', () => {
      const result = cooldownHandler.checkCooldown('user123', 'testcommand', 5)

      expect(result.isOnCooldown).toBe(false)
      expect(result.timeRemaining).toBeUndefined()
    })

    it('should return not on cooldown when cooldown has expired', () => {
      // Set up initial cooldown
      const commandTimestamps = new Collection<string, number>()
      commandTimestamps.set('user123', Date.now() - 6000) // 6 seconds ago
      mockCooldowns.set('testcommand', commandTimestamps)

      const result = cooldownHandler.checkCooldown('user123', 'testcommand', 5)

      expect(result.isOnCooldown).toBe(false)
      expect(result.timeRemaining).toBeUndefined()
    })

    it('should return on cooldown when user is still on cooldown', () => {
      // Set up recent command usage
      const commandTimestamps = new Collection<string, number>()
      commandTimestamps.set('user123', Date.now() - 2000) // 2 seconds ago
      mockCooldowns.set('testcommand', commandTimestamps)

      const result = cooldownHandler.checkCooldown('user123', 'testcommand', 5)

      expect(result.isOnCooldown).toBe(true)
      expect(result.timeRemaining).toBeCloseTo(3, 0) // ~3 seconds remaining
    })

    it('should create command cooldown collection if it does not exist', () => {
      expect(mockCooldowns.has('newcommand')).toBe(false)

      cooldownHandler.checkCooldown('user123', 'newcommand', 3)

      expect(mockCooldowns.has('newcommand')).toBe(true)
      expect(mockCooldowns.get('newcommand')).toBeDefined()
      expect(mockCooldowns.get('newcommand')?.size).toBe(0)
    })

    it('should handle multiple users on the same command', () => {
      // Set up user1 on cooldown, user2 not on cooldown
      const commandTimestamps = new Collection<string, number>()
      commandTimestamps.set('user1', Date.now() - 1000) // 1 second ago
      mockCooldowns.set('testcommand', commandTimestamps)

      const result1 = cooldownHandler.checkCooldown('user1', 'testcommand', 5)
      const result2 = cooldownHandler.checkCooldown('user2', 'testcommand', 5)

      expect(result1.isOnCooldown).toBe(true)
      expect(result1.timeRemaining).toBeCloseTo(4, 0)
      expect(result2.isOnCooldown).toBe(false)
    })

    it('should handle multiple commands for the same user', () => {
      // Set up user on cooldown for command1 but not command2
      const command1Timestamps = new Collection<string, number>()
      command1Timestamps.set('user123', Date.now() - 1000) // 1 second ago
      mockCooldowns.set('command1', command1Timestamps)

      const result1 = cooldownHandler.checkCooldown('user123', 'command1', 5)
      const result2 = cooldownHandler.checkCooldown('user123', 'command2', 5)

      expect(result1.isOnCooldown).toBe(true)
      expect(result2.isOnCooldown).toBe(false)
    })

    it('should round time remaining to 1 decimal place', () => {
      const commandTimestamps = new Collection<string, number>()
      commandTimestamps.set('user123', Date.now() - 2567) // Specific time for testing
      mockCooldowns.set('testcommand', commandTimestamps)

      const result = cooldownHandler.checkCooldown('user123', 'testcommand', 5)

      expect(result.isOnCooldown).toBe(true)
      expect(result.timeRemaining).toBeDefined()
      expect(result.timeRemaining!.toString()).toMatch(/^\d+\.\d$/) // Should have 1 decimal place
    })
  })

  describe('setCooldown', () => {
    it('should not set cooldown when cooldown is 0 (disabled)', () => {
      cooldownHandler.setCooldown('user123', 'testcommand', 0)

      expect(mockCooldowns.has('testcommand')).toBe(false)
    })

    it('should not set cooldown when cooldown is negative', () => {
      cooldownHandler.setCooldown('user123', 'testcommand', -5)

      expect(mockCooldowns.has('testcommand')).toBe(false)
    })

    it('should create command collection and set timestamp', () => {
      const beforeTime = Date.now()
      cooldownHandler.setCooldown('user123', 'testcommand', 5)
      const afterTime = Date.now()

      expect(mockCooldowns.has('testcommand')).toBe(true)
      
      const commandTimestamps = mockCooldowns.get('testcommand')!
      expect(commandTimestamps.has('user123')).toBe(true)
      
      const timestamp = commandTimestamps.get('user123')!
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(timestamp).toBeLessThanOrEqual(afterTime)
    })

    it('should use existing command collection if it already exists', () => {
      // Set up existing collection
      const existingTimestamps = new Collection<string, number>()
      existingTimestamps.set('user456', Date.now() - 1000)
      mockCooldowns.set('testcommand', existingTimestamps)

      cooldownHandler.setCooldown('user123', 'testcommand', 5)

      const commandTimestamps = mockCooldowns.get('testcommand')!
      expect(commandTimestamps.has('user456')).toBe(true) // Original user still there
      expect(commandTimestamps.has('user123')).toBe(true) // New user added
    })

    it('should schedule automatic cleanup after cooldown expires', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

      cooldownHandler.setCooldown('user123', 'testcommand', 5)

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)

      // Verify cleanup function works
      const commandTimestamps = mockCooldowns.get('testcommand')!
      expect(commandTimestamps.has('user123')).toBe(true)

      // Fast-forward time and execute cleanup
      jest.advanceTimersByTime(5000)

      expect(commandTimestamps.has('user123')).toBe(false)
    })

    it('should handle multiple users with different cooldown times', () => {
      cooldownHandler.setCooldown('user1', 'testcommand', 3)
      cooldownHandler.setCooldown('user2', 'testcommand', 7)

      const commandTimestamps = mockCooldowns.get('testcommand')!
      expect(commandTimestamps.has('user1')).toBe(true)
      expect(commandTimestamps.has('user2')).toBe(true)

      // Advance past user1's cooldown but not user2's
      jest.advanceTimersByTime(3500)

      expect(commandTimestamps.has('user1')).toBe(false)
      expect(commandTimestamps.has('user2')).toBe(true)

      // Advance past user2's cooldown
      jest.advanceTimersByTime(4000)

      expect(commandTimestamps.has('user2')).toBe(false)
    })
  })

  describe('clearCooldown', () => {
    it('should clear specific user cooldown for a command', () => {
      // Set up cooldowns
      cooldownHandler.setCooldown('user1', 'testcommand', 5)
      cooldownHandler.setCooldown('user2', 'testcommand', 5)

      const commandTimestamps = mockCooldowns.get('testcommand')!
      expect(commandTimestamps.has('user1')).toBe(true)
      expect(commandTimestamps.has('user2')).toBe(true)

      // Clear user1's cooldown
      cooldownHandler.clearCooldown('user1', 'testcommand')

      expect(commandTimestamps.has('user1')).toBe(false)
      expect(commandTimestamps.has('user2')).toBe(true) // user2 should remain
    })

    it('should handle clearing cooldown for non-existent command', () => {
      // Should not throw error
      expect(() => {
        cooldownHandler.clearCooldown('user123', 'nonexistent')
      }).not.toThrow()
    })

    it('should handle clearing cooldown for non-existent user', () => {
      cooldownHandler.setCooldown('user1', 'testcommand', 5)

      // Should not throw error
      expect(() => {
        cooldownHandler.clearCooldown('user2', 'testcommand')
      }).not.toThrow()

      // user1 should still be there
      const commandTimestamps = mockCooldowns.get('testcommand')!
      expect(commandTimestamps.has('user1')).toBe(true)
    })
  })

  describe('getActiveCooldowns', () => {
    it('should return empty array when no cooldowns are active', () => {
      const activeCooldowns = cooldownHandler.getActiveCooldowns()

      expect(activeCooldowns).toEqual([])
    })

    it('should return active cooldowns with correct information', () => {
      // Set up some cooldowns
      const now = Date.now()
      const commandTimestamps1 = new Collection<string, number>()
      const commandTimestamps2 = new Collection<string, number>()
      
      commandTimestamps1.set('user1', now - 1000) // 1 second ago
      commandTimestamps1.set('user2', now - 2000) // 2 seconds ago
      commandTimestamps2.set('user3', now - 500)  // 0.5 seconds ago
      
      mockCooldowns.set('command1', commandTimestamps1)
      mockCooldowns.set('command2', commandTimestamps2)

      const activeCooldowns = cooldownHandler.getActiveCooldowns()

      expect(activeCooldowns).toHaveLength(3)
      
      const userIds = activeCooldowns.map(c => c.userId)
      const commandNames = activeCooldowns.map(c => c.commandName)
      
      expect(userIds).toContain('user1')
      expect(userIds).toContain('user2')
      expect(userIds).toContain('user3')
      expect(commandNames).toContain('command1')
      expect(commandNames).toContain('command2')

      // Check expiration times are in the future
      activeCooldowns.forEach(cooldown => {
        expect(cooldown.expiresAt.getTime()).toBeGreaterThan(now)
      })
    })

    it('should not return expired cooldowns', () => {
      const now = Date.now()
      const commandTimestamps = new Collection<string, number>()
      
      // Add expired cooldown (older than default 3 seconds)
      commandTimestamps.set('user1', now - 4000) // 4 seconds ago
      // Add active cooldown
      commandTimestamps.set('user2', now - 1000) // 1 second ago
      
      mockCooldowns.set('testcommand', commandTimestamps)

      const activeCooldowns = cooldownHandler.getActiveCooldowns()

      expect(activeCooldowns).toHaveLength(1)
      expect(activeCooldowns[0].userId).toBe('user2')
    })
  })

  describe('clearExpiredCooldowns', () => {
    it('should remove expired cooldowns', () => {
      const now = Date.now()
      const commandTimestamps = new Collection<string, number>()
      
      // Add expired cooldown
      commandTimestamps.set('user1', now - 4000) // 4 seconds ago (expired)
      // Add active cooldown  
      commandTimestamps.set('user2', now - 1000) // 1 second ago (active)
      
      mockCooldowns.set('testcommand', commandTimestamps)

      cooldownHandler.clearExpiredCooldowns()

      expect(commandTimestamps.has('user1')).toBe(false) // Should be removed
      expect(commandTimestamps.has('user2')).toBe(true)  // Should remain
    })

    it('should remove empty command collections', () => {
      const now = Date.now()
      const commandTimestamps = new Collection<string, number>()
      
      // Add only expired cooldowns
      commandTimestamps.set('user1', now - 4000)
      commandTimestamps.set('user2', now - 5000)
      
      mockCooldowns.set('testcommand', commandTimestamps)

      expect(mockCooldowns.has('testcommand')).toBe(true)

      cooldownHandler.clearExpiredCooldowns()

      expect(mockCooldowns.has('testcommand')).toBe(false) // Collection should be removed
    })

    it('should handle multiple commands with mixed expired/active cooldowns', () => {
      const now = Date.now()
      
      // Command 1: mixed expired and active
      const commandTimestamps1 = new Collection<string, number>()
      commandTimestamps1.set('user1', now - 4000) // expired
      commandTimestamps1.set('user2', now - 1000) // active
      
      // Command 2: all expired
      const commandTimestamps2 = new Collection<string, number>()
      commandTimestamps2.set('user3', now - 5000) // expired
      
      // Command 3: all active
      const commandTimestamps3 = new Collection<string, number>()
      commandTimestamps3.set('user4', now - 1000) // active
      
      mockCooldowns.set('command1', commandTimestamps1)
      mockCooldowns.set('command2', commandTimestamps2)
      mockCooldowns.set('command3', commandTimestamps3)

      cooldownHandler.clearExpiredCooldowns()

      expect(mockCooldowns.has('command1')).toBe(true)  // Should remain (has active)
      expect(mockCooldowns.has('command2')).toBe(false) // Should be removed (all expired)
      expect(mockCooldowns.has('command3')).toBe(true)  // Should remain (all active)
      
      expect(commandTimestamps1.has('user1')).toBe(false) // expired removed
      expect(commandTimestamps1.has('user2')).toBe(true)  // active remains
      expect(commandTimestamps3.has('user4')).toBe(true)  // active remains
    })
  })

  describe('getStats', () => {
    it('should return correct stats when no cooldowns exist', () => {
      const stats = cooldownHandler.getStats()

      expect(stats).toEqual({
        totalCommands: 0,
        totalActiveCooldowns: 0,
        commandsWithActiveCooldowns: 0,
      })
    })

    it('should return correct stats with active cooldowns', () => {
      // Set up cooldowns for multiple commands
      const commandTimestamps1 = new Collection<string, number>()
      commandTimestamps1.set('user1', Date.now())
      commandTimestamps1.set('user2', Date.now())
      
      const commandTimestamps2 = new Collection<string, number>()
      commandTimestamps2.set('user3', Date.now())
      
      // Empty command (no active cooldowns)
      const commandTimestamps3 = new Collection<string, number>()
      
      mockCooldowns.set('command1', commandTimestamps1)
      mockCooldowns.set('command2', commandTimestamps2)
      mockCooldowns.set('command3', commandTimestamps3)

      const stats = cooldownHandler.getStats()

      expect(stats).toEqual({
        totalCommands: 3,
        totalActiveCooldowns: 3, // user1, user2, user3
        commandsWithActiveCooldowns: 2, // command1, command2
      })
    })

    it('should handle commands with no active users', () => {
      const emptyCommandTimestamps = new Collection<string, number>()
      mockCooldowns.set('emptycommand', emptyCommandTimestamps)

      const stats = cooldownHandler.getStats()

      expect(stats).toEqual({
        totalCommands: 1,
        totalActiveCooldowns: 0,
        commandsWithActiveCooldowns: 0,
      })
    })
  })

  describe('integration tests', () => {
    it('should handle complete cooldown lifecycle', () => {
      const userId = 'user123'
      const commandName = 'testcommand'
      const cooldownSeconds = 5

      // Initial check - should not be on cooldown
      let result = cooldownHandler.checkCooldown(userId, commandName, cooldownSeconds)
      expect(result.isOnCooldown).toBe(false)

      // Set cooldown
      cooldownHandler.setCooldown(userId, commandName, cooldownSeconds)

      // Check immediately - should be on cooldown
      result = cooldownHandler.checkCooldown(userId, commandName, cooldownSeconds)
      expect(result.isOnCooldown).toBe(true)
      expect(result.timeRemaining).toBeCloseTo(5, 0)

      // Advance time partially
      jest.advanceTimersByTime(2000)
      result = cooldownHandler.checkCooldown(userId, commandName, cooldownSeconds)
      expect(result.isOnCooldown).toBe(true)
      expect(result.timeRemaining).toBeCloseTo(3, 0)

      // Advance time to expiration
      jest.advanceTimersByTime(3000)
      result = cooldownHandler.checkCooldown(userId, commandName, cooldownSeconds)
      expect(result.isOnCooldown).toBe(false)
    })

    it('should handle disabled cooldown correctly throughout lifecycle', () => {
      const userId = 'user123'
      const commandName = 'testcommand'
      const cooldownSeconds = 0

      // Set cooldown (should be ignored)
      cooldownHandler.setCooldown(userId, commandName, cooldownSeconds)

      // Check cooldown (should always be false)
      let result = cooldownHandler.checkCooldown(userId, commandName, cooldownSeconds)
      expect(result.isOnCooldown).toBe(false)

      // Even after time passes, should still be false
      jest.advanceTimersByTime(10000)
      result = cooldownHandler.checkCooldown(userId, commandName, cooldownSeconds)
      expect(result.isOnCooldown).toBe(false)
    })
  })
})