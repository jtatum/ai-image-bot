import {
  ButtonBuilder as DiscordButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ButtonInteraction,
} from 'discord.js'

export interface ButtonConfig {
  customId: string
  label?: string
  emoji?: string
  style: ButtonStyle
  disabled?: boolean
  url?: string
}

export interface ActionButtonOptions {
  userId: string
  timestamp?: number
  includeEdit?: boolean
  includeRegenerate?: boolean
  customLabels?: {
    edit?: string
    regenerate?: string
  }
  customEmojis?: {
    edit?: string
    regenerate?: string
  }
  style?: ButtonStyle
}

/**
 * Enhanced builder for Discord buttons with improved flexibility and type safety
 * Enhances the existing utils/buttons.ts functionality while maintaining compatibility
 */
export class EnhancedButtonBuilder {
  private buttons: ButtonConfig[] = []

  /**
   * Add a button to the builder
   */
  addButton(config: ButtonConfig): this {
    this.buttons.push(config)
    return this
  }

  /**
   * Add multiple buttons at once
   */
  addButtons(configs: ButtonConfig[]): this {
    this.buttons.push(...configs)
    return this
  }

  /**
   * Create standardized image action buttons (edit + regenerate)
   * Enhanced version of createImageActionButtons from utils/buttons.ts
   */
  createImageActionButtons(options: ActionButtonOptions): ActionRowBuilder<DiscordButtonBuilder> {
    const {
      userId,
      timestamp = Date.now(),
      includeEdit = true,
      includeRegenerate = true,
      customLabels = {},
      customEmojis = {},
      style = ButtonStyle.Secondary,
    } = options

    const buttons: DiscordButtonBuilder[] = []

    if (includeEdit) {
      const editButton = new DiscordButtonBuilder()
        .setCustomId(`new_edit_${userId}_${timestamp}`)
        .setLabel(customLabels.edit || customEmojis.edit || '✏️')
        .setStyle(style)

      buttons.push(editButton)
    }

    if (includeRegenerate) {
      const regenerateButton = new DiscordButtonBuilder()
        .setCustomId(`new_regenerate_${userId}_${timestamp}`)
        .setLabel(customLabels.regenerate || customEmojis.regenerate || '🔄')
        .setStyle(style)

      buttons.push(regenerateButton)
    }

    return new ActionRowBuilder<DiscordButtonBuilder>().addComponents(...buttons)
  }

  /**
   * Create regenerate-only button for error cases
   * Enhanced version of createRegenerateOnlyButton from utils/buttons.ts
   */
  createRegenerateOnlyButton(
    options: Omit<ActionButtonOptions, 'includeEdit'>
  ): ActionRowBuilder<DiscordButtonBuilder> {
    return this.createImageActionButtons({
      ...options,
      includeEdit: false,
      includeRegenerate: true,
    })
  }

  /**
   * Create a single button with full customization
   */
  createCustomButton(config: ButtonConfig): DiscordButtonBuilder {
    const button = new DiscordButtonBuilder().setCustomId(config.customId).setStyle(config.style)

    if (config.label) {
      button.setLabel(config.label)
    }

    if (config.emoji) {
      button.setEmoji(config.emoji)
    }

    if (config.disabled !== undefined) {
      button.setDisabled(config.disabled)
    }

    if (config.url && config.style === ButtonStyle.Link) {
      button.setURL(config.url)
    }

    return button
  }

  /**
   * Create an action row from current buttons
   */
  buildActionRow(): ActionRowBuilder<DiscordButtonBuilder> {
    if (this.buttons.length === 0) {
      throw new Error('No buttons added to builder')
    }

    if (this.buttons.length > 5) {
      throw new Error('Maximum 5 buttons per action row')
    }

    const discordButtons = this.buttons.map(config => this.createCustomButton(config))
    return new ActionRowBuilder<DiscordButtonBuilder>().addComponents(...discordButtons)
  }

  /**
   * Create multiple action rows if needed (handles >5 buttons)
   */
  buildActionRows(): ActionRowBuilder<DiscordButtonBuilder>[] {
    if (this.buttons.length === 0) {
      throw new Error('No buttons added to builder')
    }

    const rows: ActionRowBuilder<DiscordButtonBuilder>[] = []
    const chunks = this.chunkArray(this.buttons, 5)

    for (const chunk of chunks) {
      const discordButtons = chunk.map(config => this.createCustomButton(config))
      rows.push(new ActionRowBuilder<DiscordButtonBuilder>().addComponents(...discordButtons))
    }

    return rows
  }

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.buttons = []
    return this
  }

  /**
   * Get current button count
   */
  get buttonCount(): number {
    return this.buttons.length
  }

  /**
   * Validate button interaction matches expected pattern
   */
  static validateButtonInteraction(
    interaction: ButtonInteraction,
    expectedPrefix: string
  ): boolean {
    return interaction.customId.startsWith(expectedPrefix)
  }

  /**
   * Parse userId from button customId (for image action buttons)
   */
  static parseUserIdFromCustomId(customId: string): string | null {
    const match = customId.match(/^(?:new_)?(edit|regenerate)_(\d+)_\d+$/)
    return match ? match[2] : null
  }

  /**
   * Parse action type from button customId
   */
  static parseActionFromCustomId(customId: string): 'edit' | 'regenerate' | null {
    const match = customId.match(/^(?:new_)?(edit|regenerate)_\d+_\d+$/)
    return match ? (match[1] as 'edit' | 'regenerate') : null
  }

  /**
   * Utility method to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
}

/**
 * Factory functions for backward compatibility with existing utils/buttons.ts
 */
export class ButtonBuilderFactory {
  /**
   * Creates standardized edit and regenerate buttons for image operations
   * Maintains compatibility with createImageActionButtons from utils/buttons.ts
   */
  static createImageActionButtons(userId: string): ActionRowBuilder<DiscordButtonBuilder> {
    const builder = new EnhancedButtonBuilder()
    return builder.createImageActionButtons({ userId })
  }

  /**
   * Creates regenerate-only button for error cases when there's no image to edit
   * Maintains compatibility with createRegenerateOnlyButton from utils/buttons.ts
   */
  static createRegenerateOnlyButton(userId: string): ActionRowBuilder<DiscordButtonBuilder> {
    const builder = new EnhancedButtonBuilder()
    return builder.createRegenerateOnlyButton({ userId })
  }
}

// Export the factory functions for easy migration
export const { createImageActionButtons, createRegenerateOnlyButton } = ButtonBuilderFactory
