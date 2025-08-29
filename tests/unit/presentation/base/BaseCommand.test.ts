import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { BaseCommand } from '@/presentation/commands/base/BaseCommand.js'
import { createMockChatInputInteraction } from '../../../helpers/mockInteractions.js'
import logger from '@/config/logger.js'

// Mock the logger
jest.mock('@/config/logger.js', () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Create concrete test implementation of BaseCommand
class TestCommand extends BaseCommand {
  readonly data = new SlashCommandBuilder()
    .setName('test')
    .setDescription('A test command')
  
  readonly cooldown = 5
  
  public executionDelay = 0
  public shouldThrowError = false
  public errorToThrow: Error | null = null
  public validateShouldThrow = false
  
  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.validateShouldThrow) {
      throw new Error('Validation failed')
    }
    
    if (this.executionDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.executionDelay))
    }
    
    if (this.shouldThrowError) {
      throw this.errorToThrow || new Error('Test error')
    }
    
    await interaction.reply({ content: 'Test response' })
  }
  
  // Expose protected methods for testing
  public async testValidateExecution(interaction: ChatInputCommandInteraction) {
    return this.validateExecution(interaction)
  }
  
  public testGetErrorMessage(error: unknown) {
    return this.getErrorMessage(error)
  }
  
  public async testHandleError(interaction: ChatInputCommandInteraction, error: unknown) {
    return this.handleError(interaction, error)
  }
}

// Create minimal test command for basic functionality
class MinimalCommand extends BaseCommand {
  readonly data = new SlashCommandBuilder()
    .setName('minimal')
    .setDescription('Minimal test command')
  
  readonly cooldown = 0 // No cooldown
  
  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply('Minimal response')
  }
}

describe('BaseCommand', () => {
  let command: TestCommand
  let mockInteraction: ChatInputCommandInteraction
  let mockLogger: any

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Setup logger mock BEFORE creating command instance
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }
    ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockLogger)
    
    command = new TestCommand()
    mockInteraction = createMockChatInputInteraction()
    
    // Reset command state
    command.executionDelay = 0
    command.shouldThrowError = false
    command.errorToThrow = null
    command.validateShouldThrow = false
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Constructor and Properties', () => {
    it('should create instance with required properties', () => {
      expect(command.data).toBeDefined()
      expect(command.data.name).toBe('test')
      expect(command.cooldown).toBe(5)
      expect(command.getCommandInfo()).toEqual({
        name: 'test',
        cooldown: 5,
        className: 'TestCommand'
      })
    })

    it('should create logger child with component name', () => {
      new TestCommand()
      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'test'
        })
      )
    })

    it('should handle zero cooldown', () => {
      const minimalCommand = new MinimalCommand()
      expect(minimalCommand.cooldown).toBe(0)
    })
  })

  describe('Command Execution Flow', () => {
    it('should execute command successfully', async () => {
      await command.execute(mockInteraction)
      
      expect(mockLogger.info).toHaveBeenCalledWith('Command execution started', expect.any(Object))
      expect(mockLogger.info).toHaveBeenCalledWith('Command execution completed', expect.objectContaining({
        duration: expect.any(Number)
      }))
      expect(mockInteraction.reply).toHaveBeenCalledWith({ content: 'Test response' })
    })

    it('should log execution context', async () => {
      // Skip guild validation by overriding the method
      const originalValidateExecution = command['validateExecution']
      command['validateExecution'] = async () => {}
      
      Object.assign(mockInteraction, {
        user: { id: '123', tag: 'testuser#1234' },
        guild: { 
          id: '456', 
          name: 'Test Guild'
        },
        channel: { id: '789', type: 0 },
        inGuild: jest.fn().mockReturnValue(true)
      })
      
      await command.execute(mockInteraction)
      
      // Restore original method
      command['validateExecution'] = originalValidateExecution
      
      expect(mockLogger.info).toHaveBeenCalledWith('Command execution started', expect.objectContaining({
        command: 'test',
        user: {
          id: '123',
          tag: 'testuser#1234'
        },
        guild: {
          id: '456',
          name: 'Test Guild'
        },
        channel: {
          id: '789',
          type: 0
        }
      }))
    })

    it('should handle DM context (no guild)', async () => {
      Object.assign(mockInteraction, {
        inGuild: jest.fn().mockReturnValue(false),
        guild: null
      })
      
      await command.execute(mockInteraction)
      
      expect(mockLogger.info).toHaveBeenCalledWith('Command execution started', expect.objectContaining({
        guild: null
      }))
    })

    it('should measure and log execution duration', async () => {
      command.executionDelay = 0 // No delay to avoid timeout issues
      
      await command.execute(mockInteraction)
      
      expect(mockLogger.info).toHaveBeenCalledWith('Command execution completed', expect.objectContaining({
        duration: expect.any(Number)
      }))
    })
  })

  describe('Performance Monitoring', () => {
    beforeEach(() => {
      // Use fake timers including Date so jest.setSystemTime works
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should warn about slow execution', async () => {
      // Set initial system time
      jest.setSystemTime(1000000)
      
      command.executionDelay = 0 // No actual delay
      
      const promise = command.execute(mockInteraction)
      
      // Advance time by 6000ms to simulate slow execution
      jest.setSystemTime(1006000)
      
      await promise
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Command execution exceeded time limit',
        expect.objectContaining({
          duration: 6000,
          maxExecutionTime: 5000,
          performanceCategory: 'very_slow'
        })
      )
    })

    it('should warn when approaching time limit', async () => {
      // Set initial system time
      jest.setSystemTime(1000000)
      
      command.executionDelay = 0 // No actual delay
      
      const promise = command.execute(mockInteraction)
      
      // Advance time by 4000ms (70% of 5000ms limit)
      jest.setSystemTime(1004000)
      
      await promise
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Command execution approaching time limit',
        expect.objectContaining({
          duration: 4000,
          performanceCategory: 'very_slow'
        })
      )
    })

    it('should categorize performance correctly', async () => {
      const testCases = [
        { delay: 50, category: 'excellent' },
        { delay: 200, category: 'good' },
        { delay: 700, category: 'acceptable' },
        { delay: 2000, category: 'slow' },
        { delay: 6000, category: 'very_slow' }
      ]
      
      for (const { delay, category } of testCases) {
        jest.clearAllMocks()
        
        // Set initial system time
        jest.setSystemTime(1000000)
        
        command.executionDelay = 0 // No actual delay
        
        const promise = command.execute(mockInteraction)
        
        // Advance time by the specified delay
        jest.setSystemTime(1000000 + delay)
        
        await promise
        
        // Check that the performance category is logged somewhere
        const logCalls = [...mockLogger.info.mock.calls, ...mockLogger.warn.mock.calls, ...mockLogger.debug.mock.calls]
        const performanceLog = logCalls.find(call => 
          call[1] && typeof call[1] === 'object' && call[1].performanceCategory === category
        )
        
        expect(performanceLog).toBeDefined()
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle and log execution errors', async () => {
      const testError = new Error('Test execution error')
      command.shouldThrowError = true
      command.errorToThrow = testError
      
      await expect(command.execute(mockInteraction)).rejects.toThrow('Test execution error')
      
      expect(mockLogger.error).toHaveBeenCalledWith('Command execution failed', expect.objectContaining({
        error: {
          name: 'Error',
          message: 'Test execution error',
          stack: expect.any(String)
        }
      }))
    })

    it('should send error message to user when execution fails', async () => {
      command.shouldThrowError = true
      command.errorToThrow = new Error('Test error')
      
      await expect(command.execute(mockInteraction)).rejects.toThrow()
      
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ An unexpected error occurred while executing this command.'
        })
      )
    })

    it('should edit reply if already replied', async () => {
      Object.assign(mockInteraction, { replied: true })
      command.shouldThrowError = true
      
      await expect(command.execute(mockInteraction)).rejects.toThrow()
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ An unexpected error occurred while executing this command.'
        })
      )
    })

    it('should handle reply failures gracefully', async () => {
      const mockReply = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('Reply failed'))
      Object.assign(mockInteraction, { reply: mockReply })
      command.shouldThrowError = true
      
      await expect(command.execute(mockInteraction)).rejects.toThrow()
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send error message to user',
        expect.objectContaining({
          originalError: expect.any(Error),
          replyError: expect.any(Error)
        })
      )
    })
  })

  describe('Error Message Mapping', () => {
    const errorTestCases = [
      {
        error: new class ValidationError extends Error { name = 'ValidationError' }('Invalid input'),
        expected: 'Invalid input provided. Please check your parameters and try again.'
      },
      {
        error: new class PermissionError extends Error { name = 'PermissionError' }('No permissions'),
        expected: 'I don\'t have the necessary permissions to execute this command.'
      },
      {
        error: new class RateLimitError extends Error { name = 'RateLimitError' }('Rate limited'),
        expected: 'You\'re using commands too quickly. Please wait a moment and try again.'
      },
      {
        error: new class ServiceUnavailableError extends Error { name = 'ServiceUnavailableError' }('Service down'),
        expected: 'This service is currently unavailable. Please try again later.'
      },
      {
        error: new class TimeoutError extends Error { name = 'TimeoutError' }('Timed out'),
        expected: 'The command took too long to execute. Please try again.'
      },
      {
        error: new Error('Generic error'),
        expected: 'An unexpected error occurred while executing this command.'
      },
      {
        error: 'String error',
        expected: 'An unknown error occurred while executing this command.'
      }
    ]

    errorTestCases.forEach(({ error, expected }) => {
      it(`should map ${error.constructor?.name || typeof error} to appropriate message`, () => {
        const message = command.testGetErrorMessage(error)
        expect(message).toBe(expected)
      })
    })
  })

  describe('Validation', () => {
    it('should validate interaction has user', async () => {
      mockInteraction.user = null as any
      
      await expect(command.testValidateExecution(mockInteraction)).rejects.toThrow('Invalid user context')
    })

    it('should validate interaction has command name', async () => {
      mockInteraction.commandName = ''
      
      await expect(command.testValidateExecution(mockInteraction)).rejects.toThrow('Invalid command context')
    })

    it('should validate bot exists in guild', async () => {
      const mockFetchMe = jest.fn<() => Promise<any>>().mockResolvedValue(null)
      Object.assign(mockInteraction, {
        inGuild: jest.fn().mockReturnValue(true),
        guild: {
          members: {
            fetchMe: mockFetchMe
          }
        }
      })
      
      await expect(command.testValidateExecution(mockInteraction)).rejects.toThrow('Bot not found in guild')
    })

    it('should handle guild fetch errors gracefully', async () => {
      const mockFetchMe = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('Fetch failed'))
      Object.assign(mockInteraction, {
        inGuild: jest.fn().mockReturnValue(true),
        guild: {
          members: {
            fetchMe: mockFetchMe
          }
        }
      })
      
      await expect(command.testValidateExecution(mockInteraction)).rejects.toThrow('Bot not found in guild')
    })
  })

  describe('Helper Methods', () => {
    describe('deferReply', () => {
      it('should defer reply when not already replied or deferred', async () => {
        const baseCommand = new TestCommand()
        await baseCommand['deferReply'](mockInteraction)
        
        expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false })
      })

      it('should not defer if already replied', async () => {
        mockInteraction.replied = true
        const baseCommand = new TestCommand()
        await baseCommand['deferReply'](mockInteraction)
        
        expect(mockInteraction.deferReply).not.toHaveBeenCalled()
      })

      it('should not defer if already deferred', async () => {
        mockInteraction.deferred = true
        const baseCommand = new TestCommand()
        await baseCommand['deferReply'](mockInteraction)
        
        expect(mockInteraction.deferReply).not.toHaveBeenCalled()
      })

      it('should support ephemeral option', async () => {
        const baseCommand = new TestCommand()
        await baseCommand['deferReply'](mockInteraction, true)
        
        expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true })
      })
    })

    describe('safeReply', () => {
      it('should reply when not already replied or deferred', async () => {
        const baseCommand = new TestCommand()
        const options = { content: 'test' }
        
        await baseCommand['safeReply'](mockInteraction, options)
        
        expect(mockInteraction.reply).toHaveBeenCalledWith(options)
      })

      it('should edit reply when already replied', async () => {
        mockInteraction.replied = true
        const baseCommand = new TestCommand()
        const options = { content: 'test' }
        
        await baseCommand['safeReply'](mockInteraction, options)
        
        expect(mockInteraction.editReply).toHaveBeenCalledWith(options)
      })

      it('should edit reply when deferred', async () => {
        mockInteraction.deferred = true
        const baseCommand = new TestCommand()
        const options = { content: 'test' }
        
        await baseCommand['safeReply'](mockInteraction, options)
        
        expect(mockInteraction.editReply).toHaveBeenCalledWith(options)
      })

      it('should handle reply errors', async () => {
        const mockFailingReply = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('Reply failed'))
        Object.assign(mockInteraction, { reply: mockFailingReply })
        const baseCommand = new TestCommand()
        
        await expect(baseCommand['safeReply'](mockInteraction, { content: 'test' })).rejects.toThrow('Reply failed')
        
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to send reply', expect.any(Object))
      })
    })
  })

  describe('Configuration Options', () => {
    class ConfigurableCommand extends BaseCommand {
      readonly data = new SlashCommandBuilder().setName('config').setDescription('Configurable command')
      readonly cooldown = 0
      protected readonly enableExecutionLogging = false
      protected readonly enablePerformanceLogging = false
      protected readonly maxExecutionTimeMs = 1000
      
      protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
        // No actual delay - timing is controlled by Date.now mocks
        await interaction.reply('Done')
      }
    }

    it('should respect logging configuration', async () => {
      const configCommand = new ConfigurableCommand()
      const mockConfigLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockConfigLogger)
      
      // Use fake timers for this test too
      jest.useFakeTimers()
      jest.setSystemTime(1000000)
      
      const promise = configCommand.execute(mockInteraction)
      
      // Advance time by 100ms
      jest.setSystemTime(1000100)
      
      await promise
      
      expect(mockConfigLogger.info).not.toHaveBeenCalledWith('Command execution started', expect.any(Object))
      expect(mockConfigLogger.debug).not.toHaveBeenCalledWith('Command performance metrics', expect.any(Object))
      
      jest.useRealTimers()
    })
  })
})