import { ModalSubmitInteraction, ModalBuilder } from 'discord.js'
import logger from '@/config/logger.js'
import {
  EnhancedModalBuilder,
  ImageModalOptions,
} from '@/infrastructure/discord/builders/ModalBuilder.js'

/**
 * Function signature for modal submit interaction handlers
 */
export type ModalHandlerFunction = (interaction: ModalSubmitInteraction) => Promise<void>

/**
 * Configuration for modal handler registration
 */
export interface ModalHandlerConfig {
  /** The prefix that modal custom IDs must start with */
  prefix: string
  /** The handler function to execute */
  handler: ModalHandlerFunction
  /** Optional description for debugging/monitoring */
  description?: string
}

/**
 * Handles Discord modal submit interactions with a registry pattern
 * Extracted from interactionCreate.ts for better separation of concerns
 */
export class ModalHandler {
  private handlers: Map<string, ModalHandlerConfig> = new Map()
  private modalBuilder: EnhancedModalBuilder

  constructor() {
    this.modalBuilder = new EnhancedModalBuilder()
  }

  /**
   * Register a modal handler for a specific prefix
   * @param config Handler configuration
   */
  registerHandler(config: ModalHandlerConfig): void {
    if (this.handlers.has(config.prefix)) {
      logger.warn(`Modal handler for prefix '${config.prefix}' is being overridden`)
    }

    this.handlers.set(config.prefix, config)
    logger.debug(`Registered modal handler for prefix: ${config.prefix}`, {
      description: config.description || 'No description provided',
    })
  }

  /**
   * Register multiple modal handlers at once
   * @param configs Array of handler configurations
   */
  registerHandlers(configs: ModalHandlerConfig[]): void {
    configs.forEach(config => this.registerHandler(config))
  }

  /**
   * Handle a modal submit interaction by routing to the appropriate handler
   * @param interaction The Discord modal submit interaction
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const handler = this.findHandler(interaction.customId)

    if (!handler) {
      logger.warn(`No handler found for modal: ${interaction.customId}`)
      await interaction.reply({
        content: '❌ This modal submission is not recognized.',
        ephemeral: true,
      })
      return
    }

    try {
      logger.debug(`Handling modal submission: ${interaction.customId}`, {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        handlerPrefix: handler.prefix,
        fieldCount: interaction.fields.fields?.size || 0,
      })

      await handler.handler(interaction)

      logger.debug(`Modal submission handled successfully: ${interaction.customId}`)
    } catch (error) {
      await this.handleModalError(interaction, error, handler)
    }
  }

  /**
   * Find the appropriate handler for a modal custom ID
   * @param customId The modal's custom ID
   * @returns Handler configuration or undefined if not found
   */
  private findHandler(customId: string): ModalHandlerConfig | undefined {
    // Find handler by checking if customId starts with any registered prefix
    for (const [prefix, config] of this.handlers.entries()) {
      if (customId.startsWith(prefix)) {
        return config
      }
    }
    return undefined
  }

  /**
   * Handle modal execution errors
   * @param interaction The Discord modal submit interaction
   * @param error The error that occurred
   * @param handler The handler that failed
   */
  private async handleModalError(
    interaction: ModalSubmitInteraction,
    error: unknown,
    handler: ModalHandlerConfig
  ): Promise<void> {
    logger.error(`Error in modal handler for prefix '${handler.prefix}':`, error)

    const errorMessage = {
      content: '❌ There was an error processing your modal submission!',
      ephemeral: true,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (replyError) {
      logger.error('Failed to send modal error message to user:', {
        originalError: error,
        replyError,
        customId: interaction.customId,
        userId: interaction.user.id,
        fieldValues: this.extractFieldValues(interaction),
      })
    }
  }

  /**
   * Extract field values from modal for logging (without sensitive data)
   * @param interaction The modal submit interaction
   * @returns Object with field IDs and value lengths
   */
  private extractFieldValues(interaction: ModalSubmitInteraction): Record<string, number> {
    const fieldSummary: Record<string, number> = {}

    interaction.fields.fields.forEach((field, fieldId) => {
      fieldSummary[fieldId] = field.value.length
    })

    return fieldSummary
  }

  /**
   * Unregister a modal handler
   * @param prefix The prefix to unregister
   * @returns True if handler was removed, false if not found
   */
  unregisterHandler(prefix: string): boolean {
    const removed = this.handlers.delete(prefix)
    if (removed) {
      logger.debug(`Unregistered modal handler for prefix: ${prefix}`)
    } else {
      logger.warn(`Attempted to unregister non-existent modal handler: ${prefix}`)
    }
    return removed
  }

  /**
   * Clear all registered handlers
   */
  clearHandlers(): void {
    const count = this.handlers.size
    this.handlers.clear()
    logger.debug(`Cleared ${count} modal handlers`)
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
  getHandlerInfo(prefix: string): ModalHandlerConfig | undefined {
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

  /**
   * Validate modal field structure for debugging
   * @param interaction The modal submit interaction
   * @returns Field validation summary
   */
  validateModalFields(interaction: ModalSubmitInteraction): {
    totalFields: number
    emptyFields: string[]
    fieldSummary: Array<{
      id: string
      type: string
      length: number
    }>
  } {
    const emptyFields: string[] = []
    const fieldSummary: Array<{ id: string; type: string; length: number }> = []

    interaction.fields.fields.forEach((field, fieldId) => {
      if (!field.value.trim()) {
        emptyFields.push(fieldId)
      }

      fieldSummary.push({
        id: fieldId,
        type: field.type.toString(),
        length: field.value.length,
      })
    })

    return {
      totalFields: interaction.fields.fields.size,
      emptyFields,
      fieldSummary,
    }
  }

  /**
   * Get a specific field value from modal safely
   * @param interaction The modal submit interaction
   * @param fieldId The field ID to get
   * @returns Field value or undefined if not found
   */
  getFieldValue(interaction: ModalSubmitInteraction, fieldId: string): string | undefined {
    try {
      return interaction.fields.getTextInputValue(fieldId)
    } catch (error) {
      logger.warn(`Failed to get field value for ${fieldId}:`, error)
      return undefined
    }
  }

  // ===== Modal Builder Integration =====

  /**
   * Create a regenerate modal with pre-filled content using the enhanced builder
   * @param options Modal creation options
   * @returns Discord modal builder
   */
  createRegenerateModal(options: ImageModalOptions): ModalBuilder {
    return this.modalBuilder.createRegenerateModal(options)
  }

  /**
   * Create an edit image modal using the enhanced builder
   * @param options Modal creation options
   * @returns Discord modal builder
   */
  createEditModal(options: ImageModalOptions): ModalBuilder {
    return this.modalBuilder.createEditModal(options)
  }

  /**
   * Create a custom modal with multiple inputs using the enhanced builder
   * @param options Custom modal configuration
   * @returns Discord modal builder
   */
  createCustomModal(options: {
    customId: string
    title: string
    inputs: Array<{
      id: string
      label: string
      style?: import('discord.js').TextInputStyle
      placeholder?: string
      value?: string
      required?: boolean
      minLength?: number
      maxLength?: number
    }>
  }): ModalBuilder {
    return this.modalBuilder.createCustomModal(options)
  }

  /**
   * Parse user ID from a modal custom ID using the builder's utility
   * @param customId The modal's custom ID
   * @returns User ID or null if not found
   */
  parseUserIdFromCustomId(customId: string): string | null {
    return EnhancedModalBuilder.parseUserIdFromCustomId(customId)
  }

  /**
   * Parse modal type from custom ID using the builder's utility
   * @param customId The modal's custom ID
   * @returns Modal type ('regenerate' | 'edit') or null if not found
   */
  parseModalTypeFromCustomId(customId: string): 'regenerate' | 'edit' | null {
    return EnhancedModalBuilder.parseModalTypeFromCustomId(customId)
  }

  /**
   * Validate that a modal interaction matches expected pattern using the builder's utility
   * @param interaction The modal interaction
   * @param expectedPrefix The expected prefix
   * @returns True if interaction matches pattern
   */
  validateModalInteraction(interaction: ModalSubmitInteraction, expectedPrefix: string): boolean {
    return EnhancedModalBuilder.validateModalInteraction(interaction, expectedPrefix)
  }

  /**
   * Get field value from modal safely using the builder's utility
   * @param interaction The modal submit interaction
   * @param fieldId The field ID to get
   * @returns Field value or null if not found
   */
  getFieldValueSafe(interaction: ModalSubmitInteraction, fieldId: string): string | null {
    return EnhancedModalBuilder.getFieldValue(interaction, fieldId)
  }

  /**
   * Validate required fields are present using the builder's utility
   * @param interaction The modal submit interaction
   * @param requiredFields Array of required field IDs
   * @returns True if all required fields have values
   */
  validateRequiredFields(interaction: ModalSubmitInteraction, requiredFields: string[]): boolean {
    return EnhancedModalBuilder.validateRequiredFields(interaction, requiredFields)
  }
}
