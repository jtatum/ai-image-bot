import { Event } from '../../../bot/types.js'
import logger from '@/infrastructure/monitoring/Logger.js'

/**
 * Abstract base class for all Discord event handlers
 * Provides common functionality like logging, error handling, and metrics
 */
export abstract class BaseEvent implements Event {
  /**
   * The Discord event name (must be implemented by subclasses)
   */
  abstract readonly name: string

  /**
   * Whether this event should only be handled once (can be overridden by subclasses)
   */
  abstract readonly once?: boolean

  /**
   * Logger instance for this event handler
   */
  protected readonly logger = logger.child({
    component: this.constructor.name.replace('Event', '').toLowerCase(),
  })

  /**
   * Whether to log event handling details (can be overridden)
   */
  protected readonly enableEventLogging: boolean = true

  /**
   * Whether to log performance metrics (can be overridden)
   */
  protected readonly enablePerformanceLogging: boolean = true

  /**
   * Maximum execution time in milliseconds before warning (can be overridden)
   */
  protected readonly maxExecutionTimeMs: number = 3000

  /**
   * Whether to suppress errors (useful for non-critical events)
   */
  protected readonly suppressErrors: boolean = false

  /**
   * Main execution method called by Discord.js
   * Handles common concerns like logging, timing, and error handling
   */
  public async execute(...args: unknown[]): Promise<void> {
    const startTime = Date.now()
    const executionContext = this.createExecutionContext(args)

    try {
      if (this.enableEventLogging) {
        this.logger.debug('Event handling started', {
          event: this.name,
          ...executionContext,
        })
      }

      // Validate event can be handled
      await this.validateEvent(...args)

      // Execute the actual event handling logic
      await this.handleEvent(...args)

      const duration = Date.now() - startTime

      if (this.enablePerformanceLogging) {
        this.logPerformanceMetrics(duration, executionContext)
      }

      if (this.enableEventLogging) {
        this.logger.debug('Event handling completed', {
          event: this.name,
          duration,
          ...executionContext,
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime

      this.logger.error('Event handling failed', {
        event: this.name,
        duration,
        ...executionContext,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })

      // Handle the error
      await this.handleError(error, ...args)

      // Re-throw unless error suppression is enabled
      if (!this.suppressErrors) {
        throw error
      }
    }
  }

  /**
   * Abstract method that subclasses must implement
   * Contains the actual event handling logic
   */
  protected abstract handleEvent(...args: unknown[]): Promise<void>

  /**
   * Validates whether the event can be handled
   * Can be overridden by subclasses for custom validation
   */
  protected async validateEvent(...args: unknown[]): Promise<void> {
    // Default validation - check if we have valid arguments
    if (!args || args.length === 0) {
      throw new Error('No event arguments provided')
    }

    // For Discord events, the first argument is usually the client or relevant object
    if (args[0] === null || args[0] === undefined) {
      throw new Error('Invalid event context')
    }

    // Subclasses can override this method to add specific validation
  }

  /**
   * Creates execution context for logging based on event arguments
   * Can be overridden by subclasses for more specific context
   */
  protected createExecutionContext(args: unknown[]): Record<string, unknown> {
    const context: Record<string, unknown> = {
      argumentCount: args.length,
      once: this.once || false,
    }

    // Try to extract common Discord.js objects for context
    if (args.length > 0) {
      const firstArg = args[0]

      // Check if it's a Client
      if (firstArg && typeof firstArg === 'object' && 'user' in firstArg) {
        try {
          const clientArg = firstArg as { user: { id: string; tag: string } }
          if (clientArg.user) {
            context.client = {
              id: clientArg.user.id,
              tag: clientArg.user.tag,
            }
          }
        } catch {
          // Ignore errors during property access
        }
      }

      // Check if it's an Interaction
      if (
        firstArg &&
        typeof firstArg === 'object' &&
        'isCommand' in firstArg &&
        typeof firstArg.isCommand === 'function' &&
        firstArg.isCommand()
      ) {
        const interactionArg = firstArg as unknown as {
          commandName: string
          user?: { id: string; tag: string }
          guild?: { id: string; name: string }
        }
        context.interaction = {
          type: 'command',
          commandName: interactionArg.commandName,
          user: interactionArg.user
            ? {
                id: interactionArg.user.id,
                tag: interactionArg.user.tag,
              }
            : null,
          guild: interactionArg.guild
            ? {
                id: interactionArg.guild.id,
                name: interactionArg.guild.name,
              }
            : null,
        }
      }

      // Check if it's a Message
      if (firstArg && typeof firstArg === 'object' && 'content' in firstArg) {
        const messageArg = firstArg as unknown as {
          id: string
          author?: { id: string; tag: string }
          guild?: { id: string; name: string }
          channel?: { id: string; type: number }
        }
        context.message = {
          id: messageArg.id,
          author: messageArg.author
            ? {
                id: messageArg.author.id,
                tag: messageArg.author.tag,
              }
            : null,
          guild: messageArg.guild
            ? {
                id: messageArg.guild.id,
                name: messageArg.guild.name,
              }
            : null,
          channel: messageArg.channel
            ? {
                id: messageArg.channel.id,
                type: messageArg.channel.type,
              }
            : null,
        }
      }

      // Check if it's a Guild
      if (firstArg && typeof firstArg === 'object' && 'memberCount' in firstArg) {
        const guildArg = firstArg as { id: string; name: string; memberCount: number }
        context.guild = {
          id: guildArg.id,
          name: guildArg.name,
          memberCount: guildArg.memberCount,
        }
      }
    }

    return context
  }

  /**
   * Logs performance metrics and warnings
   */
  private logPerformanceMetrics(duration: number, context: Record<string, unknown>): void {
    const metrics = {
      event: this.name,
      duration,
      performanceCategory: this.getPerformanceCategory(duration),
      ...context,
    }

    if (duration > this.maxExecutionTimeMs) {
      this.logger.warn('Event handling exceeded time limit', {
        ...metrics,
        maxExecutionTime: this.maxExecutionTimeMs,
      })
    } else if (duration > this.maxExecutionTimeMs * 0.7) {
      this.logger.warn('Event handling approaching time limit', metrics)
    } else {
      this.logger.debug('Event performance metrics', metrics)
    }
  }

  /**
   * Categorizes event handling performance
   */
  private getPerformanceCategory(duration: number): string {
    if (duration < 50) return 'excellent'
    if (duration < 100) return 'good'
    if (duration < 250) return 'acceptable'
    if (duration < 1000) return 'slow'
    return 'very_slow'
  }

  /**
   * Handles event processing errors
   * Can be overridden by subclasses for custom error handling
   */
  protected async handleError(error: unknown, ...args: unknown[]): Promise<void> {
    // Default error handling - just log the error
    // Subclasses can override to implement specific error recovery

    const errorInfo = {
      event: this.name,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      argumentTypes: args.map(arg => typeof arg),
      context: this.createExecutionContext(args),
    }

    this.logger.error('Event error details', errorInfo)

    // For critical events, you might want to notify administrators
    if (this.isCriticalEvent()) {
      this.logger.error('Critical event failed', {
        ...errorInfo,
        severity: 'critical',
      })
    }
  }

  /**
   * Determines if this is a critical event that requires special attention
   * Can be overridden by subclasses
   */
  protected isCriticalEvent(): boolean {
    // Events that are critical for bot operation
    const criticalEvents = [
      'ready',
      'error',
      'disconnect',
      'reconnecting',
      'sharderror',
      'sharddisconnect',
    ]

    return criticalEvents.includes(this.name.toLowerCase())
  }

  /**
   * Gets event information for debugging and monitoring
   */
  public getEventInfo(): {
    name: string
    once: boolean | undefined
    className: string
    isCritical: boolean
  } {
    return {
      name: this.name,
      once: this.once,
      className: this.constructor.name,
      isCritical: this.isCriticalEvent(),
    }
  }

  /**
   * Helper method to safely handle async operations without blocking event processing
   */
  protected async safeAsyncOperation<T>(
    operation: () => Promise<T>,
    fallbackValue?: T,
    operationName: string = 'async operation'
  ): Promise<T | undefined> {
    try {
      return await operation()
    } catch (error) {
      this.logger.warn(`Failed to execute ${operationName}`, {
        event: this.name,
        error: error instanceof Error ? error.message : error,
      })
      return fallbackValue
    }
  }

  /**
   * Helper method to delay processing (useful for rate limiting)
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Helper method to check if event should be processed based on conditions
   * Can be used for filtering, rate limiting, etc.
   */
  protected shouldProcessEvent(...args: unknown[]): boolean {
    // Default implementation always processes the event
    // Subclasses can override for custom filtering logic
    // Using args parameter to avoid TypeScript warning
    return args.length >= 0
  }
}
