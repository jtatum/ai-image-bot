import { describe, it, expect, beforeEach } from '@jest/globals'
import { RateLimiter } from '@/shared/utils/rateLimiter'

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter

  beforeEach(() => {
    rateLimiter = new RateLimiter()
  })

  describe('Global Rate Limiting', () => {
    it('should allow requests within global limits', async () => {
      const userId = 'test-user-1'
      const result = await rateLimiter.checkGlobalLimit(userId)
      
      expect(result.allowed).toBe(true)
      expect(result.msBeforeNext).toBeUndefined()
    })

    it('should return stats correctly', () => {
      rateLimiter.createCommandLimiter('test', 5, 60)
      const stats = rateLimiter.getStats()
      
      expect(stats).toHaveProperty('global')
      expect(stats).toHaveProperty('commands')
      expect(stats.commands).toHaveProperty('test')
      expect(stats.global.points).toBeDefined()
      expect(stats.commands.test.points).toBe(5)
      expect(stats.commands.test.duration).toBe(60)
    })
  })

  describe('Command Rate Limiting', () => {
    beforeEach(() => {
      rateLimiter.createCommandLimiter('test-command', 2, 10) // 2 uses per 10 seconds
    })

    it('should allow requests within command limits', async () => {
      const userId = 'test-user-2'
      const commandName = 'test-command'
      
      const result = await rateLimiter.checkCommandLimit(commandName, userId)
      expect(result.allowed).toBe(true)
    })

    it('should return true for commands without specific limits', async () => {
      const userId = 'test-user-3'
      const commandName = 'unlimited-command'
      
      const result = await rateLimiter.checkCommandLimit(commandName, userId)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Combined Rate Limiting', () => {
    beforeEach(() => {
      rateLimiter.createCommandLimiter('limited-command', 1, 5) // 1 use per 5 seconds
    })

    it('should check both global and command limits', async () => {
      const userId = 'test-user-4'
      const commandName = 'limited-command'
      
      const result = await rateLimiter.checkAllLimits(commandName, userId)
      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })
  })
})