import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { Command } from '../../../bot/types.js'
import logger from '../../../config/logger.js'

/**
 * Abstract base class for all Discord slash commands
 * Provides common functionality like logging, error handling, and metrics
 */
export abstract class BaseCommand implements Command {
  /**
   * The slash command data (must be implemented by subclasses)
   */
  abstract readonly data: SlashCommandBuilder

  /**
   * Command cooldown in seconds (can be overridden by subclasses)
   * Set to 0 to disable cooldown entirely
   */
  abstract readonly cooldown?: number

  /**
   * Logger instance for this command
   */
  protected readonly logger = logger.child({
    component: this.constructor.name.replace('Command', '').toLowerCase(),
  })

  /**
   * Whether to log command execution details (can be overridden)
   */
  protected readonly enableExecutionLogging: boolean = true

  /**
   * Whether to log performance metrics (can be overridden)
   */
  protected readonly enablePerformanceLogging: boolean = true

  /**
   * Maximum execution time in milliseconds before warning (can be overridden)
   */
  protected readonly maxExecutionTimeMs: number = 5000

  /**
   * Main execution method called by Discord.js
   * Handles common concerns like logging, timing, and error handling
   */
  public async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now()
    const executionContext = this.createExecutionContext(interaction)

    try {
      if (this.enableExecutionLogging) {
        this.logger.info('Command execution started', executionContext)
      }

      // Validate command can be executed
      await this.validateExecution(interaction)

      // Execute the actual command logic
      await this.executeCommand(interaction)

      const duration = Date.now() - startTime

      if (this.enablePerformanceLogging) {
        this.logPerformanceMetrics(duration, executionContext)
      }

      if (this.enableExecutionLogging) {
        this.logger.info('Command execution completed', {
          ...executionContext,
          duration,
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime

      this.logger.error('Command execution failed', {
        ...executionContext,
        duration,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
      })

      // Handle the error (send user-friendly message)
      await this.handleError(interaction, error)

      // Re-throw so the global error handler can also process it if needed
      throw error
    }
  }

  /**
   * Abstract method that subclasses must implement
   * Contains the actual command logic
   */
  protected abstract executeCommand(interaction: ChatInputCommandInteraction): Promise<void>

  /**
   * Validates whether the command can be executed
   * Can be overridden by subclasses for custom validation
   */
  protected async validateExecution(interaction: ChatInputCommandInteraction): Promise<void> {
    // Default validation - check if user and command are valid
    if (!interaction.user) {
      throw new Error('Invalid user context')
    }

    if (!interaction.commandName) {
      throw new Error('Invalid command context')
    }

    // Check if bot has necessary permissions
    if (interaction.inGuild() && interaction.guild) {
      const botMember = await interaction.guild.members.fetchMe().catch(() => null)
      if (!botMember) {
        throw new Error('Bot not found in guild')
      }

      // Subclasses can override this method to add specific permission checks
    }
  }

  /**
   * Creates execution context for logging
   */
  private createExecutionContext(interaction: ChatInputCommandInteraction) {
    return {
      command: this.data.name,
      user: {
        id: interaction.user.id,
        tag: interaction.user.tag,
      },
      guild: interaction.inGuild()
        ? {
            id: interaction.guild!.id,
            name: interaction.guild!.name,
          }
        : null,
      channel: {
        id: interaction.channel?.id,
        type: interaction.channel?.type,
      },
    }
  }

  /**
   * Logs performance metrics and warnings
   */
  private logPerformanceMetrics(duration: number, context: Record<string, unknown>): void {
    const metrics = {
      ...context,
      duration,
      performanceCategory: this.getPerformanceCategory(duration),
    }

    if (duration > this.maxExecutionTimeMs) {
      this.logger.warn('Command execution exceeded time limit', {
        ...metrics,
        maxExecutionTime: this.maxExecutionTimeMs,
      })
    } else if (duration > this.maxExecutionTimeMs * 0.7) {
      this.logger.warn('Command execution approaching time limit', metrics)
    } else {
      this.logger.debug('Command performance metrics', metrics)
    }
  }

  /**
   * Categorizes command performance
   */
  private getPerformanceCategory(duration: number): string {
    if (duration < 100) return 'excellent'
    if (duration < 500) return 'good'
    if (duration < 1000) return 'acceptable'
    if (duration < 3000) return 'slow'
    return 'very_slow'
  }

  /**
   * Handles command execution errors
   * Can be overridden by subclasses for custom error handling
   */
  protected async handleError(
    interaction: ChatInputCommandInteraction,
    error: unknown
  ): Promise<void> {
    const errorMessage = this.getErrorMessage(error)

    try {
      // Determine if interaction was already replied to
      const replyOptions = {
        content: `❌ ${errorMessage}`,
        ephemeral: true,
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(replyOptions)
      } else {
        await interaction.reply(replyOptions)
      }
    } catch (replyError) {
      this.logger.error('Failed to send error message to user', {
        originalError: error,
        replyError,
      })
    }
  }

  /**
   * Extracts user-friendly error message from error object
   * Can be overridden by subclasses for custom error messages
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Map common error types to user-friendly messages
      switch (error.name) {
        case 'ValidationError':
          return 'Invalid input provided. Please check your parameters and try again.'
        case 'PermissionError':
          return "I don't have the necessary permissions to execute this command."
        case 'RateLimitError':
          return "You're using commands too quickly. Please wait a moment and try again."
        case 'ServiceUnavailableError':
          return 'This service is currently unavailable. Please try again later.'
        case 'TimeoutError':
          return 'The command took too long to execute. Please try again.'
        default:
          // For unknown errors, provide a generic message
          return 'An unexpected error occurred while executing this command.'
      }
    }

    return 'An unknown error occurred while executing this command.'
  }

  /**
   * Helper method to safely defer reply
   * Useful for commands that take time to process
   */
  protected async deferReply(
    interaction: ChatInputCommandInteraction,
    ephemeral: boolean = false
  ): Promise<void> {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply({ ephemeral })
    }
  }

  /**
   * Helper method to safely reply to interaction
   */
  protected async safeReply(
    interaction: ChatInputCommandInteraction,
    options: string | { content?: string; ephemeral?: boolean; [key: string]: unknown }
  ): Promise<void> {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(options)
      } else {
        await interaction.reply(options)
      }
    } catch (error) {
      this.logger.error('Failed to send reply', { error, options })
      throw error
    }
  }

  /**
   * Gets command information for debugging and monitoring
   */
  public getCommandInfo(): {
    name: string
    cooldown: number | undefined
    className: string
  } {
    return {
      name: this.data.name,
      cooldown: this.cooldown,
      className: this.constructor.name,
    }
  }
}
