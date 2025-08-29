import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
// import { Events } from 'discord.js' // Not used, keep as comment for reference
import { BaseEvent } from '@/presentation/events/base/BaseEvent.js'
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

// Create concrete test implementation of BaseEvent
class TestEvent extends BaseEvent {
  readonly name = 'messageCreate'
  readonly once = false
  
  public executionDelay = 0
  public shouldThrowError = false
  public errorToThrow: Error | null = null
  public validateShouldThrow = false
  
  protected async handleEvent(...args: any[]): Promise<void> {
    // Use args parameter to avoid TypeScript warnings
    void args
    
    if (this.validateShouldThrow) {
      throw new Error('Validation failed')
    }
    
    if (this.executionDelay > 0) {
      // Mock delay for testing - avoid real timeouts
      await Promise.resolve()
    }
    
    if (this.shouldThrowError) {
      throw this.errorToThrow || new Error('Test error')
    }
    
    // Simulate event processing
  }
  
  // Expose protected methods for testing
  public async testValidateEvent(...args: any[]) {
    return this.validateEvent(...args)
  }
  
  public testCreateExecutionContext(args: any[]) {
    return this.createExecutionContext(args)
  }
  
  public async testHandleError(error: unknown, ...args: any[]) {
    return this.handleError(error, ...args)
  }
  
  public testIsCriticalEvent() {
    return this.isCriticalEvent()
  }
  
  public testShouldProcessEvent(...args: any[]) {
    return this.shouldProcessEvent(...args)
  }
}

// Create a critical event for testing
class CriticalTestEvent extends BaseEvent {
  readonly name = 'ready'
  readonly once = true
  
  public shouldThrowError = false
  public errorToThrow: Error | null = null
  
  protected async handleEvent(...args: any[]): Promise<void> {
    // Use args parameter
    void args
    
    if (this.shouldThrowError) {
      throw this.errorToThrow || new Error('Critical test error')
    }
  }
  
  // Expose protected method for testing
  public testIsCriticalEvent() {
    return this.isCriticalEvent()
  }
}

// Create an event with error suppression
class SuppressedErrorEvent extends BaseEvent {
  readonly name = 'messageUpdate'
  readonly once = false
  protected readonly suppressErrors = true
  
  protected async handleEvent(...args: any[]): Promise<void> {
    // Use args parameter 
    void args
    throw new Error('This error should be suppressed')
  }
}

// Create minimal event
class MinimalEvent extends BaseEvent {
  readonly name = 'custom'
  readonly once = false
  protected readonly enableEventLogging = false
  protected readonly enablePerformanceLogging = false
  
  protected async handleEvent(...args: any[]): Promise<void> {
    // Use args parameter
    void args
  }
}

describe('BaseEvent', () => {
  let event: TestEvent
  let mockLogger: any
  let mockArgs: any[]

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Setup logger mock BEFORE creating event instance
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }
    ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockLogger)
    
    event = new TestEvent()
    
    // Reset event state
    event.executionDelay = 0
    event.shouldThrowError = false
    event.errorToThrow = null
    event.validateShouldThrow = false
    
    // Mock event arguments
    mockArgs = [
      { // Mock message
        id: 'msg123',
        content: 'test message',
        author: {
          id: 'user123',
          tag: 'testuser#1234'
        },
        guild: {
          id: 'guild123',
          name: 'Test Guild'
        },
        channel: {
          id: 'channel123',
          type: 0
        }
      }
    ]
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Constructor and Properties', () => {
    it('should create instance with required properties', () => {
      expect(event.name).toBe('messageCreate')
      expect(event.once).toBe(false)
      expect(event.getEventInfo()).toEqual({
        name: 'messageCreate',
        once: false,
        className: 'TestEvent',
        isCritical: false
      })
    })

    it('should create logger child with component name', () => {
      new TestEvent()
      expect(logger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'test'
        })
      )
    })

    it('should handle once events', () => {
      const criticalEvent = new CriticalTestEvent()
      expect(criticalEvent.once).toBe(true)
      expect(criticalEvent.getEventInfo().once).toBe(true)
    })
  })

  describe('Event Execution Flow', () => {
    it('should execute event successfully', async () => {
      await event.execute(...mockArgs)
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Event handling started', expect.objectContaining({
        event: 'messageCreate'
      }))
      expect(mockLogger.debug).toHaveBeenCalledWith('Event handling completed', expect.objectContaining({
        event: 'messageCreate',
        duration: expect.any(Number)
      }))
    })

    it('should log execution context for message events', async () => {
      await event.execute(...mockArgs)
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Event handling started', expect.objectContaining({
        event: 'messageCreate',
        argumentCount: 1,
        once: false,
        message: {
          id: 'msg123',
          author: {
            id: 'user123',
            tag: 'testuser#1234'
          },
          guild: {
            id: 'guild123',
            name: 'Test Guild'
          },
          channel: {
            id: 'channel123',
            type: 0
          }
        }
      }))
    })

    it('should handle client context', async () => {
      const clientArg = {
        user: {
          id: 'bot123',
          tag: 'TestBot#1234'
        }
      }
      
      const context = event.testCreateExecutionContext([clientArg])
      
      expect(context).toEqual({
        argumentCount: 1,
        once: false,
        client: {
          id: 'bot123',
          tag: 'TestBot#1234'
        }
      })
    })

    it('should handle interaction context', async () => {
      const interactionArg = {
        isCommand: () => true,
        commandName: 'test',
        user: {
          id: 'user123',
          tag: 'testuser#1234'
        },
        guild: {
          id: 'guild123',
          name: 'Test Guild'
        }
      }
      
      const context = event.testCreateExecutionContext([interactionArg])
      
      expect(context).toEqual(expect.objectContaining({
        argumentCount: 1,
        once: false,
        interaction: expect.objectContaining({
          type: 'command',
          commandName: 'test',
          user: {
            id: 'user123',
            tag: 'testuser#1234'
          },
          guild: {
            id: 'guild123',
            name: 'Test Guild'
          }
        })
      }))
    })

    it('should handle guild context', async () => {
      const guildArg = {
        id: 'guild123',
        name: 'Test Guild',
        memberCount: 100
      }
      
      const context = event.testCreateExecutionContext([guildArg])
      
      expect(context).toEqual({
        argumentCount: 1,
        once: false,
        guild: {
          id: 'guild123',
          name: 'Test Guild',
          memberCount: 100
        }
      })
    })

    it('should measure and log execution duration', async () => {
      event.executionDelay = 100
      
      jest.advanceTimersByTime(0)
      const promise = event.execute(...mockArgs)
      jest.advanceTimersByTime(100)
      await promise
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Event handling completed', expect.objectContaining({
        duration: expect.any(Number)
      }))
    })
  })

  describe('Performance Monitoring', () => {
    it('should warn about slow execution', async () => {
      event.executionDelay = 4000 // Exceeds maxExecutionTimeMs (3000)
      
      jest.advanceTimersByTime(0)
      const promise = event.execute(...mockArgs)
      jest.advanceTimersByTime(4000)
      await promise
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Event handling exceeded time limit',
        expect.objectContaining({
          event: 'messageCreate',
          duration: expect.any(Number),
          maxExecutionTime: 3000,
          performanceCategory: 'very_slow'
        })
      )
    })

    it('should warn when approaching time limit', async () => {
      event.executionDelay = 2500 // 70%+ of maxExecutionTimeMs (3000)
      
      jest.advanceTimersByTime(0)
      const promise = event.execute(...mockArgs)
      jest.advanceTimersByTime(2500)
      await promise
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Event handling approaching time limit',
        expect.objectContaining({
          performanceCategory: 'very_slow'
        })
      )
    })

    it('should categorize performance correctly', async () => {
      const testCases = [
        { delay: 25, category: 'excellent' },
        { delay: 75, category: 'good' },
        { delay: 150, category: 'acceptable' },
        { delay: 500, category: 'slow' },
        { delay: 2000, category: 'very_slow' }
      ]
      
      for (const { delay, category } of testCases) {
        jest.clearAllMocks()
        event.executionDelay = delay
        
        jest.advanceTimersByTime(0)
        const promise = event.execute(...mockArgs)
        jest.advanceTimersByTime(delay)
        await promise
        
        // Check that the performance category is logged
        const logCalls = [...mockLogger.warn.mock.calls, ...mockLogger.debug.mock.calls]
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
      event.shouldThrowError = true
      event.errorToThrow = testError
      
      await expect(event.execute(...mockArgs)).rejects.toThrow('Test execution error')
      
      expect(mockLogger.error).toHaveBeenCalledWith('Event handling failed', expect.objectContaining({
        event: 'messageCreate',
        error: {
          name: 'Error',
          message: 'Test execution error',
          stack: expect.any(String)
        }
      }))
    })

    it('should handle non-Error objects', async () => {
      event.shouldThrowError = true
      event.errorToThrow = 'String error' as any
      
      await expect(event.execute(...mockArgs)).rejects.toBe('String error')
      
      expect(mockLogger.error).toHaveBeenCalledWith('Event handling failed', expect.objectContaining({
        error: 'String error'
      }))
    })

    it('should suppress errors when configured', async () => {
      const mockSuppressedLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockSuppressedLogger)
      
      const suppressedEvent = new SuppressedErrorEvent()
      
      // Should not throw because errors are suppressed
      await expect(suppressedEvent.execute(...mockArgs)).resolves.not.toThrow()
      
      // Should still log the error details
      expect(mockSuppressedLogger.error).toHaveBeenCalledWith('Event handling failed', expect.any(Object))
    })

    it('should identify critical events', () => {
      const criticalEvent = new CriticalTestEvent()
      expect(criticalEvent.testIsCriticalEvent()).toBe(true)
      
      const nonCriticalEvent = new TestEvent()
      expect(nonCriticalEvent.testIsCriticalEvent()).toBe(false)
    })

    it('should log critical event failures with higher severity', async () => {
      const mockCriticalLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockCriticalLogger)
      
      const criticalEvent = new CriticalTestEvent()
      
      // Force error in critical event
      criticalEvent.shouldThrowError = true
      
      await expect(criticalEvent.execute(...mockArgs)).rejects.toThrow()
      
      expect(mockCriticalLogger.error).toHaveBeenCalledWith('Critical event failed', expect.objectContaining({
        severity: 'critical'
      }))
    })
  })

  describe('Validation', () => {
    it('should validate arguments are provided', async () => {
      await expect(event.testValidateEvent()).rejects.toThrow('No event arguments provided')
    })

    it('should validate first argument is not null/undefined', async () => {
      await expect(event.testValidateEvent(null)).rejects.toThrow('Invalid event context')
      await expect(event.testValidateEvent(undefined)).rejects.toThrow('Invalid event context')
    })

    it('should pass validation for valid arguments', async () => {
      await expect(event.testValidateEvent({ valid: true })).resolves.not.toThrow()
    })
  })

  describe('Helper Methods', () => {
    describe('safeAsyncOperation', () => {
      it('should execute operation successfully', async () => {
        const operation = () => Promise.resolve('success')
        const result = await event['safeAsyncOperation'](operation, 'fallback', 'test op')
        
        expect(result).toBe('success')
      })

      it('should return fallback on error', async () => {
        const operation = () => Promise.reject(new Error('Operation failed'))
        const result = await event['safeAsyncOperation'](operation, 'fallback', 'test op')
        
        expect(result).toBe('fallback')
        expect(mockLogger.warn).toHaveBeenCalledWith('Failed to execute test op', expect.any(Object))
      })

      it('should return undefined when no fallback provided', async () => {
        const operation = () => Promise.reject(new Error('Operation failed'))
        const result = await event['safeAsyncOperation'](operation, undefined, 'test op')
        
        expect(result).toBeUndefined()
      })
    })

    describe('delay', () => {
      it('should delay for specified time', async () => {
        const delayPromise = event['delay'](100)
        
        jest.advanceTimersByTime(50)
        expect(delayPromise).toEqual(expect.any(Promise))
        
        jest.advanceTimersByTime(50)
        await delayPromise // Should resolve now
      })
    })

    describe('shouldProcessEvent', () => {
      it('should return true by default', () => {
        expect(event.testShouldProcessEvent(...mockArgs)).toBe(true)
      })
    })
  })

  describe('Configuration Options', () => {
    it('should respect logging configuration', async () => {
      const minimalEvent = new MinimalEvent()
      const mockMinimalLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
      ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockMinimalLogger)
      
      await minimalEvent.execute(...mockArgs)
      
      expect(mockMinimalLogger.debug).not.toHaveBeenCalledWith('Event handling started', expect.any(Object))
      expect(mockMinimalLogger.debug).not.toHaveBeenCalledWith('Event performance metrics', expect.any(Object))
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty argument arrays gracefully', () => {
      const context = event.testCreateExecutionContext([])
      
      expect(context).toEqual({
        argumentCount: 0,
        once: false
      })
    })

    it('should handle unknown object types in context creation', () => {
      const unknownArg = { someProperty: 'value' }
      const context = event.testCreateExecutionContext([unknownArg])
      
      expect(context).toEqual({
        argumentCount: 1,
        once: false
      })
    })

    it('should handle multiple arguments', () => {
      const context = event.testCreateExecutionContext([...mockArgs, 'second arg', { third: 'arg' }])
      
      expect(context.argumentCount).toBe(3)
      expect(context.message).toBeDefined() // First arg should still be processed
    })

    it('should handle error during context creation gracefully', () => {
      // Create an arg that will cause errors when accessed, but only during property access
      const problematicArg = {
        get user() {
          throw new Error('Context creation error')
        }
      }
      
      // Should not throw during context creation due to improved type guards
      expect(() => event.testCreateExecutionContext([problematicArg])).not.toThrow()
      
      // Should return a basic context
      const result = event.testCreateExecutionContext([problematicArg])
      expect(result).toEqual({
        argumentCount: 1,
        once: false
      })
    })
  })

  describe('Event Types', () => {
    it('should correctly identify critical events', () => {
      const criticalEventNames = [
        'ready',
        'error', 
        'disconnect',
        'reconnecting',
        'shardError',
        'shardDisconnect'
      ]
      
      for (const eventName of criticalEventNames) {
        class TestCriticalEvent extends BaseEvent {
          readonly name = eventName
          readonly once = false
          protected async handleEvent(): Promise<void> {}
          public testIsCriticalEvent() { return this.isCriticalEvent() }
        }
        
        const criticalEvent = new TestCriticalEvent()
        expect(criticalEvent.testIsCriticalEvent()).toBe(true)
      }
    })

    it('should correctly identify non-critical events', () => {
      const nonCriticalEvents = ['messageCreate', 'messageUpdate', 'custom']
      
      for (const eventName of nonCriticalEvents) {
        class TestNonCriticalEvent extends BaseEvent {
          readonly name = eventName
          readonly once = false
          protected async handleEvent(): Promise<void> {}
        }
        
        const nonCriticalEvent = new TestNonCriticalEvent()
        expect(nonCriticalEvent['isCriticalEvent']()).toBe(false)
      }
    })
  })
})