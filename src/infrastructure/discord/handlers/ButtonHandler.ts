import { ButtonInteraction, ActionRowBuilder, ButtonBuilder } from 'discord.js'
import logger from '@/config/logger.js'
import {
  EnhancedButtonBuilder,
  ActionButtonOptions,
} from '@/infrastructure/discord/builders/ButtonBuilder.js'

/**
 * Function signature for button interaction handlers
 */
export type ButtonHandlerFunction = (interaction: ButtonInteraction) => Promise<void>

/**
 * Configuration for button handler registration
 */
export interface ButtonHandlerConfig {
  /** The prefix that button custom IDs must start with */
  prefix: string
  /** The handler function to execute */
  handler: ButtonHandlerFunction
  /** Optional description for debugging/monitoring */
  description?: string
}

/**
 * Handles Discord button interactions with a registry pattern
 * Extracted from interactionCreate.ts for better separation of concerns
 */
export class ButtonHandler {
  private handlers: Map<string, ButtonHandlerConfig> = new Map()
  private buttonBuilder: EnhancedButtonBuilder

  constructor() {
    this.buttonBuilder = new EnhancedButtonBuilder()
  }

  /**
   * Register a button handler for a specific prefix
   * @param config Handler configuration
   */
  registerHandler(config: ButtonHandlerConfig): void {
    if (this.handlers.has(config.prefix)) {
      logger.warn(`Button handler for prefix '${config.prefix}' is being overridden`)
    }

    this.handlers.set(config.prefix, config)
    logger.debug(`Registered button handler for prefix: ${config.prefix}`, {
      description: config.description || 'No description provided',
    })
  }

  /**
   * Register multiple button handlers at once
   * @param configs Array of handler configurations
   */
  registerHandlers(configs: ButtonHandlerConfig[]): void {
    configs.forEach(config => this.registerHandler(config))
  }

  /**
   * Handle a button interaction by routing to the appropriate handler
   * @param interaction The Discord button interaction
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const handler = this.findHandler(interaction.customId)

    if (!handler) {
      logger.warn(`No handler found for button: ${interaction.customId}`)
      await interaction.reply({
        content: '❌ This button action is not recognized.',
        ephemeral: true,
      })
      return
    }

    try {
      logger.debug(`Handling button interaction: ${interaction.customId}`, {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        handlerPrefix: handler.prefix,
      })

      await handler.handler(interaction)

      logger.debug(`Button interaction handled successfully: ${interaction.customId}`)
    } catch (error) {
      await this.handleButtonError(interaction, error, handler)
    }
  }

  /**
   * Find the appropriate handler for a button custom ID
   * @param customId The button's custom ID
   * @returns Handler configuration or undefined if not found
   */
  private findHandler(customId: string): ButtonHandlerConfig | undefined {
    // Find handler by checking if customId starts with any registered prefix
    for (const [prefix, config] of this.handlers.entries()) {
      if (customId.startsWith(prefix)) {
        return config
      }
    }
    return undefined
  }

  /**
   * Handle button execution errors
   * @param interaction The Discord button interaction
   * @param error The error that occurred
   * @param handler The handler that failed
   */
  private async handleButtonError(
    interaction: ButtonInteraction,
    error: unknown,
    handler: ButtonHandlerConfig
  ): Promise<void> {
    logger.error(`Error in button handler for prefix '${handler.prefix}':`, error)

    const errorMessage = {
      content: '❌ There was an error processing your button action!',
      ephemeral: true,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (replyError) {
      logger.error('Failed to send button error message to user:', {
        originalError: error,
        replyError,
        customId: interaction.customId,
        userId: interaction.user.id,
      })
    }
  }

  /**
   * Unregister a button handler
   * @param prefix The prefix to unregister
   * @returns True if handler was removed, false if not found
   */
  unregisterHandler(prefix: string): boolean {
    const removed = this.handlers.delete(prefix)
    if (removed) {
      logger.debug(`Unregistered button handler for prefix: ${prefix}`)
    } else {
      logger.warn(`Attempted to unregister non-existent button handler: ${prefix}`)
    }
    return removed
  }

  /**
   * Clear all registered handlers
   */
  clearHandlers(): void {
    const count = this.handlers.size
    this.handlers.clear()
    logger.debug(`Cleared ${count} button handlers`)
  }

  /**
   * Get all registered handler prefixes
   * @returns Array of registered prefixes
   */
  getRegisteredPrefixes(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Check if a handler is registered for a specific prefix
   * @param prefix The prefix to check
   * @returns True if handler exists
   */
  hasHandler(prefix: string): boolean {
    return this.handlers.has(prefix)
  }

  /**
   * Get handler configuration for a specific prefix
   * @param prefix The prefix to get info for
   * @returns Handler configuration or undefined if not found
   */
  getHandlerInfo(prefix: string): ButtonHandlerConfig | undefined {
    return this.handlers.get(prefix)
  }

  /**
   * Get statistics about registered handlers
   * @returns Statistics object
   */
  getStats(): {
    totalHandlers: number
    registeredPrefixes: string[]
  } {
    return {
      totalHandlers: this.handlers.size,
      registeredPrefixes: this.getRegisteredPrefixes(),
    }
  }

  /**
   * Check if a custom ID would be handled by any registered handler
   * @param customId The custom ID to test
   * @returns True if a handler would handle this custom ID
   */
  canHandle(customId: string): boolean {
    return this.findHandler(customId) !== undefined
  }

  /**
   * Get the handler prefix that would handle a specific custom ID
   * @param customId The custom ID to check
   * @returns The matching prefix or undefined if not found
   */
  getMatchingPrefix(customId: string): string | undefined {
    const handler = this.findHandler(customId)
    return handler?.prefix
  }

  // ===== Button Builder Integration =====

  /**
   * Create standardized image action buttons using the enhanced builder
   * @param options Button creation options
   * @returns Action row with buttons
   */
  createImageActionButtons(options: ActionButtonOptions): ActionRowBuilder<ButtonBuilder> {
    return this.buttonBuilder.createImageActionButtons(options)
  }

  /**
   * Create regenerate-only button for error cases using the enhanced builder
   * @param options Button creation options (excludes includeEdit)
   * @returns Action row with regenerate button only
   */
  createRegenerateOnlyButton(
    options: Omit<ActionButtonOptions, 'includeEdit'>
  ): ActionRowBuilder<ButtonBuilder> {
    return this.buttonBuilder.createRegenerateOnlyButton(options)
  }

  /**
   * Parse user ID from a button custom ID using the builder's utility
   * @param customId The button's custom ID
   * @returns User ID or null if not found
   */
  parseUserIdFromCustomId(customId: string): string | null {
    return EnhancedButtonBuilder.parseUserIdFromCustomId(customId)
  }

  /**
   * Parse action type from a button custom ID using the builder's utility
   * @param customId The button's custom ID
   * @returns Action type ('edit' | 'regenerate') or null if not found
   */
  parseActionFromCustomId(customId: string): 'edit' | 'regenerate' | null {
    return EnhancedButtonBuilder.parseActionFromCustomId(customId)
  }

  /**
   * Validate that a button interaction matches expected pattern using the builder's utility
   * @param interaction The button interaction
   * @param expectedPrefix The expected prefix
   * @returns True if interaction matches pattern
   */
  validateButtonInteraction(interaction: ButtonInteraction, expectedPrefix: string): boolean {
    return EnhancedButtonBuilder.validateButtonInteraction(interaction, expectedPrefix)
  }
}
