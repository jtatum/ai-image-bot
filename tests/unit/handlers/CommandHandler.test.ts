import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { Collection } from 'discord.js'
import { CommandHandler } from '@/infrastructure/discord/handlers/CommandHandler.js'
import { CooldownHandler } from '@/infrastructure/discord/handlers/CooldownHandler.js'
import { Command, ExtendedClient } from '@/bot/types.js'
import { createMockChatInputInteraction } from '../../helpers/mockInteractions.js'
import { mockCommand } from '../../fixtures/mockCommand.js'

jest.mock('@/infrastructure/monitoring/Logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

import logger from '@/infrastructure/monitoring/Logger.js'
const mockLogger = logger as jest.Mocked<typeof logger>

describe('CommandHandler', () => {
  let commandHandler: CommandHandler
  let mockClient: ExtendedClient
  let mockCooldownHandler: jest.Mocked<CooldownHandler>
  let mockCommands: Collection<string, Command>
  let mockCooldowns: Collection<string, Collection<string, number>>

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock collections
    mockCommands = new Collection()
    mockCooldowns = new Collection()

    // Collections should work as expected, no mocking needed

    // Create mock client
    mockClient = {
      commands: mockCommands,
      cooldowns: mockCooldowns,
    } as ExtendedClient

    // Create mock cooldown handler
    mockCooldownHandler = {
      checkCooldown: jest.fn(),
      setCooldown: jest.fn(),
      clearCooldown: jest.fn(),
      getActiveCooldowns: jest.fn(),
      clearExpiredCooldowns: jest.fn(),
      getStats: jest.fn(),
    } as any

    // Setup default cooldown handler responses
    mockCooldownHandler.checkCooldown.mockReturnValue({ isOnCooldown: false })
    mockCooldownHandler.getStats.mockReturnValue({
      totalCommands: 1,
      totalActiveCooldowns: 0,
      commandsWithActiveCooldowns: 0,
    })
    mockCooldownHandler.getActiveCooldowns.mockReturnValue([])

    commandHandler = new CommandHandler(mockClient, mockCooldownHandler)
  })

  describe('handleCommand', () => {
    it('should execute command successfully with no cooldown', async () => {
      // Setup command
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn() as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction({
        commandName: 'test',
      })

      await commandHandler.handleCommand(interaction)

      expect(mockCooldownHandler.checkCooldown).toHaveBeenCalledWith('user123', 'test', 5)
      expect(mockCooldownHandler.setCooldown).toHaveBeenCalledWith('user123', 'test', 5)
      expect(testCommand.execute).toHaveBeenCalledWith(interaction)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Command executed: test by TestUser#1234 in TestGuild'
      )
    })

    it('should use default cooldown of 3 seconds when command cooldown is undefined', async () => {
      // Setup command without cooldown
      const testCommand = {
        ...mockCommand,
        cooldown: undefined,
        execute: jest.fn() as any,
      }
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()

      await commandHandler.handleCommand(interaction)

      expect(mockCooldownHandler.checkCooldown).toHaveBeenCalledWith('user123', 'test', 3)
      expect(mockCooldownHandler.setCooldown).toHaveBeenCalledWith('user123', 'test', 3)
    })

    it('should handle unknown command gracefully', async () => {
      const interaction = createMockChatInputInteraction({
        commandName: 'unknowncommand',
      })

      await commandHandler.handleCommand(interaction)

      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown command: unknowncommand')
      expect(mockCooldownHandler.checkCooldown).not.toHaveBeenCalled()
    })

    it('should block command execution when on cooldown', async () => {
      // Setup cooldown handler to return on cooldown
      mockCooldownHandler.checkCooldown.mockReturnValue({
        isOnCooldown: true,
        timeRemaining: 2.5,
      })

      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn() as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()

      await commandHandler.handleCommand(interaction)

      expect(interaction.reply).toHaveBeenCalledWith({
        content: '⏳ Please wait 2.5 more seconds before using `test` again.',
        ephemeral: true,
      })
      expect(testCommand.execute).not.toHaveBeenCalled()
      expect(mockCooldownHandler.setCooldown).not.toHaveBeenCalled()
    })

    it('should handle command execution errors', async () => {
      const error = new Error('Test command error')
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(error)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()

      await commandHandler.handleCommand(interaction)

      expect(mockLogger.error).toHaveBeenCalledWith('Error executing command test:', error)
      expect(interaction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      })
    })

    it('should handle DM commands (no guild)', async () => {
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn() as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction({
        guild: null,
      })

      await commandHandler.handleCommand(interaction)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Command executed: test by TestUser#1234 in DM'
      )
      expect(testCommand.execute).toHaveBeenCalledWith(interaction)
    })

    it('should handle commands with 0 cooldown (disabled)', async () => {
      const testCommand = {
        ...mockCommand,
        cooldown: 0,
        execute: jest.fn() as any,
      }
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()

      await commandHandler.handleCommand(interaction)

      expect(mockCooldownHandler.checkCooldown).toHaveBeenCalledWith('user123', 'test', 0)
      expect(mockCooldownHandler.setCooldown).toHaveBeenCalledWith('user123', 'test', 0)
      expect(testCommand.execute).toHaveBeenCalledWith(interaction)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      mockCommands.set('test1', mockCommand)
      mockCommands.set('test2', mockCommand)

      mockCooldownHandler.getStats.mockReturnValue({
        totalCommands: 2,
        totalActiveCooldowns: 3,
        commandsWithActiveCooldowns: 2,
      })

      const stats = commandHandler.getStats()

      expect(stats).toEqual({
        totalCommands: 2,
        activeCooldowns: 3,
      })
    })

    it('should handle empty command collection', () => {
      mockCooldownHandler.getStats.mockReturnValue({
        totalCommands: 0,
        totalActiveCooldowns: 0,
        commandsWithActiveCooldowns: 0,
      })

      const stats = commandHandler.getStats()

      expect(stats).toEqual({
        totalCommands: 0,
        activeCooldowns: 0,
      })
    })
  })

  describe('hasCommand', () => {
    it('should return true when command exists', () => {
      mockCommands.set('test', mockCommand)

      expect(commandHandler.hasCommand('test')).toBe(true)
    })

    it('should return false when command does not exist', () => {
      expect(commandHandler.hasCommand('nonexistent')).toBe(false)
    })
  })

  describe('getCommandNames', () => {
    it('should return array of command names', () => {
      mockCommands.set('test1', mockCommand)
      mockCommands.set('test2', mockCommand)
      mockCommands.set('test3', mockCommand)

      const names = commandHandler.getCommandNames()

      expect(names).toEqual(['test1', 'test2', 'test3'])
    })

    it('should return empty array when no commands exist', () => {
      const names = commandHandler.getCommandNames()

      expect(names).toEqual([])
    })
  })

  describe('getCommandInfo', () => {
    it('should return command information when command exists', () => {
      mockCommands.set('test', mockCommand)

      const info = commandHandler.getCommandInfo('test')

      expect(info?.name).toBe('test')
      expect(info?.cooldown).toBe(5)
      // TODO: Fix SlashCommandBuilder description access
      // expect(typeof info?.description).toBe('string')
    })

    it('should return undefined when command does not exist', () => {
      const info = commandHandler.getCommandInfo('nonexistent')

      expect(info).toBeUndefined()
    })

    it('should handle command with undefined cooldown', () => {
      const commandWithoutCooldown = {
        ...mockCommand,
        cooldown: undefined,
      }
      mockCommands.set('nocooldown', commandWithoutCooldown)

      const info = commandHandler.getCommandInfo('nocooldown')

      expect(info?.name).toBe('test')
      expect(info?.cooldown).toBeUndefined()
      // TODO: Fix SlashCommandBuilder description access
      // expect(typeof info?.description).toBe('string')
    })
  })

  describe('clearUserCooldown', () => {
    it('should delegate to cooldown handler', () => {
      commandHandler.clearUserCooldown('user123', 'test')

      expect(mockCooldownHandler.clearCooldown).toHaveBeenCalledWith('user123', 'test')
    })
  })

  describe('getActiveCooldowns', () => {
    it('should delegate to cooldown handler and return active cooldowns', () => {
      const mockActiveCooldowns = [
        {
          userId: 'user123',
          commandName: 'test1',
          expiresAt: new Date(Date.now() + 5000),
        },
        {
          userId: 'user456',
          commandName: 'test2',
          expiresAt: new Date(Date.now() + 3000),
        },
      ]

      mockCooldownHandler.getActiveCooldowns.mockReturnValue(mockActiveCooldowns)

      const activeCooldowns = commandHandler.getActiveCooldowns()

      expect(mockCooldownHandler.getActiveCooldowns).toHaveBeenCalled()
      expect(activeCooldowns).toEqual(mockActiveCooldowns)
    })

    it('should return empty array when no cooldowns are active', () => {
      mockCooldownHandler.getActiveCooldowns.mockReturnValue([])

      const activeCooldowns = commandHandler.getActiveCooldowns()

      expect(activeCooldowns).toEqual([])
    })
  })

  describe('safeReply behavior', () => {
    it('should call editReply when interaction is already replied', async () => {
      const error = new Error('Test error')
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(error)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.replied = true
      interaction.deferred = false
      interaction.editReply = jest.fn() as any

      await commandHandler.handleCommand(interaction)

      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      }))
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('should call editReply when interaction is deferred', async () => {
      const error = new Error('Test error')
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(error)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.replied = false
      interaction.deferred = true
      interaction.editReply = jest.fn() as any

      await commandHandler.handleCommand(interaction)

      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      }))
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('should call editReply when interaction is both replied and deferred', async () => {
      const error = new Error('Test error')
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(error)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.replied = true
      interaction.deferred = true
      interaction.editReply = jest.fn() as any

      await commandHandler.handleCommand(interaction)

      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      }))
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('should call reply when interaction is neither replied nor deferred', async () => {
      const error = new Error('Test error')
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(error)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.replied = false
      interaction.deferred = false

      await commandHandler.handleCommand(interaction)

      expect(interaction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
    })

    it('should handle reply errors gracefully and log them', async () => {
      const commandError = new Error('Command execution failed')
      const replyError = new Error('Discord API error')

      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(commandError)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.reply = jest.fn().mockImplementation(() => Promise.reject(replyError)) as any

      // safeReply should catch the error and not let it bubble up
      await expect(commandHandler.handleCommand(interaction)).resolves.not.toThrow()

      expect(mockLogger.error).toHaveBeenCalledWith('Error executing command test:', commandError)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to reply to interaction:', replyError)
      expect(interaction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      })
    })

    it('should handle editReply errors gracefully when interaction is replied', async () => {
      const commandError = new Error('Command execution failed')
      const editReplyError = new Error('Edit reply failed')

      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn().mockImplementation(() => Promise.reject(commandError)) as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.replied = true
      interaction.editReply = jest.fn().mockImplementation(() => Promise.reject(editReplyError)) as any

      // safeReply should catch the error and not let it bubble up
      await expect(commandHandler.handleCommand(interaction)).resolves.not.toThrow()

      expect(mockLogger.error).toHaveBeenCalledWith('Error executing command test:', commandError)
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to reply to interaction:', editReplyError)
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      }))
    })
  })

  describe('error handling edge cases', () => {
    it('should handle interaction.reply failure during cooldown response', async () => {
      const replyError = new Error('Reply failed')

      mockCooldownHandler.checkCooldown.mockReturnValue({
        isOnCooldown: true,
        timeRemaining: 2.5,
      })

      const testCommand = { ...mockCommand }
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()
      interaction.reply = jest.fn().mockImplementation(() => Promise.reject(replyError)) as any

      // Should throw the reply error
      await expect(commandHandler.handleCommand(interaction)).rejects.toThrow(replyError)
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete command lifecycle with cooldown', async () => {
      const testCommand = { ...mockCommand }
      testCommand.execute = jest.fn() as any
      mockCommands.set('test', testCommand)

      const interaction = createMockChatInputInteraction()

      // First execution - should succeed
      await commandHandler.handleCommand(interaction)
      expect(testCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mocks for second call
      jest.clearAllMocks()
      testCommand.execute = jest.fn() as any

      // Mock cooldown handler to simulate user on cooldown
      mockCooldownHandler.checkCooldown.mockReturnValue({
        isOnCooldown: true,
        timeRemaining: 3.2,
      })

      // Second execution - should be blocked
      const interaction2 = createMockChatInputInteraction()
      await commandHandler.handleCommand(interaction2)

      expect(interaction2.reply).toHaveBeenCalledWith({
        content: '⏳ Please wait 3.2 more seconds before using `test` again.',
        ephemeral: true,
      })
      expect(testCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle multiple different commands for same user', async () => {
      const testCommand1 = {
        ...mockCommand,
        data: { name: 'test1', description: 'Test command 1' },
        execute: jest.fn() as any,
      } as any
      const testCommand2 = {
        ...mockCommand,
        data: { name: 'test2', description: 'Test command 2' },
        execute: jest.fn() as any,
      } as any

      mockCommands.set('test1', testCommand1)
      mockCommands.set('test2', testCommand2)

      const interaction1 = createMockChatInputInteraction({ commandName: 'test1' })
      const interaction2 = createMockChatInputInteraction({ commandName: 'test2' })

      await commandHandler.handleCommand(interaction1)
      await commandHandler.handleCommand(interaction2)

      expect(testCommand1.execute).toHaveBeenCalledWith(interaction1)
      expect(testCommand2.execute).toHaveBeenCalledWith(interaction2)
      expect(mockCooldownHandler.setCooldown).toHaveBeenCalledWith('user123', 'test1', 5)
      expect(mockCooldownHandler.setCooldown).toHaveBeenCalledWith('user123', 'test2', 5)
    })
  })
})