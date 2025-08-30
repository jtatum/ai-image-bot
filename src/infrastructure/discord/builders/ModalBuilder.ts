import {
  ModalBuilder as DiscordModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js'

export interface TextInputConfig {
  customId: string
  label: string
  style: TextInputStyle
  placeholder?: string
  value?: string
  required?: boolean
  minLength?: number
  maxLength?: number
}

export interface ModalConfig {
  customId: string
  title: string
  inputs: TextInputConfig[]
}

export interface ImageModalOptions {
  userId: string
  timestamp?: number
  originalPrompt?: string
  maxPromptLength?: number
  maxEditLength?: number
}

/**
 * Enhanced builder for Discord modals with improved flexibility and type safety
 * Enhances the existing utils/modalHelpers.ts functionality while maintaining compatibility
 */
export class EnhancedModalBuilder {
  private customId: string = ''
  private title: string = ''
  private inputs: TextInputConfig[] = []

  /**
   * Set the modal's custom ID
   */
  setCustomId(customId: string): this {
    this.customId = customId
    return this
  }

  /**
   * Set the modal's title
   */
  setTitle(title: string): this {
    this.title = title
    return this
  }

  /**
   * Add a text input to the modal
   */
  addTextInput(config: TextInputConfig): this {
    if (this.inputs.length >= 5) {
      throw new Error('Maximum 5 text inputs per modal')
    }
    this.inputs.push(config)
    return this
  }

  /**
   * Add multiple text inputs at once
   */
  addTextInputs(configs: TextInputConfig[]): this {
    if (this.inputs.length + configs.length > 5) {
      throw new Error('Maximum 5 text inputs per modal')
    }
    this.inputs.push(...configs)
    return this
  }

  /**
   * Create a standardized text input modal
   * Enhanced version of createTextInputModal from utils/modalHelpers.ts
   */
  createTextInputModal(
    customId: string,
    title: string,
    inputId: string,
    inputLabel: string,
    inputStyle: TextInputStyle,
    options: {
      placeholder?: string
      value?: string
      required?: boolean
      minLength?: number
      maxLength?: number
    } = {}
  ): DiscordModalBuilder {
    const modal = new DiscordModalBuilder().setCustomId(customId).setTitle(title)

    const textInput = new TextInputBuilder()
      .setCustomId(inputId)
      .setLabel(inputLabel)
      .setStyle(inputStyle)
      .setRequired(options.required ?? true)

    if (options.placeholder) {
      textInput.setPlaceholder(options.placeholder)
    }

    if (options.value) {
      textInput.setValue(options.value)
    }

    if (options.minLength !== undefined) {
      textInput.setMinLength(options.minLength)
    }

    if (options.maxLength !== undefined) {
      textInput.setMaxLength(options.maxLength)
    }

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
    modal.addComponents(actionRow)

    return modal
  }

  /**
   * Create a regenerate prompt modal with pre-filled content
   * Enhanced version of createRegenerateModal from utils/modalHelpers.ts
   */
  createRegenerateModal(options: ImageModalOptions): DiscordModalBuilder {
    const { userId, timestamp = Date.now(), originalPrompt = '', maxPromptLength = 1000 } = options

    return this.createTextInputModal(
      `new_regenerate_modal_${userId}_${timestamp}`,
      'Edit Prompt and Regenerate',
      'prompt',
      'Image Prompt',
      TextInputStyle.Paragraph,
      {
        placeholder: 'Describe the image you want to generate...',
        value: originalPrompt,
        maxLength: maxPromptLength,
        required: true,
      }
    )
  }

  /**
   * Create an edit image modal
   * Enhanced version of createEditModal from utils/modalHelpers.ts
   */
  createEditModal(options: ImageModalOptions): DiscordModalBuilder {
    const { userId, timestamp = Date.now(), maxEditLength = 500 } = options

    return this.createTextInputModal(
      `new_edit_modal_${userId}_${timestamp}`,
      'Describe Your Image Edit',
      'edit_description',
      'What changes would you like?',
      TextInputStyle.Paragraph,
      {
        placeholder:
          'e.g., "Add a sunset in the background", "Make the robot blue", "Remove the skateboard"',
        maxLength: maxEditLength,
        required: true,
      }
    )
  }

  /**
   * Create a custom modal with multiple inputs
   */
  createCustomModal(options: {
    customId: string
    title: string
    inputs: Array<{
      id: string
      label: string
      style?: TextInputStyle
      placeholder?: string
      value?: string
      required?: boolean
      minLength?: number
      maxLength?: number
    }>
  }): DiscordModalBuilder {
    const modal = new DiscordModalBuilder().setCustomId(options.customId).setTitle(options.title)

    const actionRows: ActionRowBuilder<TextInputBuilder>[] = []

    for (const input of options.inputs) {
      if (actionRows.length >= 5) {
        throw new Error('Maximum 5 action rows per modal')
      }

      const textInput = new TextInputBuilder()
        .setCustomId(input.id)
        .setLabel(input.label)
        .setStyle(input.style || TextInputStyle.Short)
        .setRequired(input.required ?? true)

      if (input.placeholder) {
        textInput.setPlaceholder(input.placeholder)
      }

      if (input.value) {
        textInput.setValue(input.value)
      }

      if (input.minLength !== undefined) {
        textInput.setMinLength(input.minLength)
      }

      if (input.maxLength !== undefined) {
        textInput.setMaxLength(input.maxLength)
      }

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
      actionRows.push(actionRow)
    }

    modal.addComponents(...actionRows)
    return modal
  }

  /**
   * Build the modal from current configuration
   */
  build(): DiscordModalBuilder {
    if (!this.customId || !this.title) {
      throw new Error('Modal customId and title are required')
    }

    if (this.inputs.length === 0) {
      throw new Error('At least one text input is required')
    }

    const modal = new DiscordModalBuilder().setCustomId(this.customId).setTitle(this.title)

    const actionRows: ActionRowBuilder<TextInputBuilder>[] = []

    for (const inputConfig of this.inputs) {
      const textInput = new TextInputBuilder()
        .setCustomId(inputConfig.customId)
        .setLabel(inputConfig.label)
        .setStyle(inputConfig.style)
        .setRequired(inputConfig.required ?? true)

      if (inputConfig.placeholder) {
        textInput.setPlaceholder(inputConfig.placeholder)
      }

      if (inputConfig.value) {
        textInput.setValue(inputConfig.value)
      }

      if (inputConfig.minLength !== undefined) {
        textInput.setMinLength(inputConfig.minLength)
      }

      if (inputConfig.maxLength !== undefined) {
        textInput.setMaxLength(inputConfig.maxLength)
      }

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
      actionRows.push(actionRow)
    }

    modal.addComponents(...actionRows)
    return modal
  }

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.customId = ''
    this.title = ''
    this.inputs = []
    return this
  }

  /**
   * Get current input count
   */
  get inputCount(): number {
    return this.inputs.length
  }

  /**
   * Validate modal interaction matches expected pattern
   */
  static validateModalInteraction(
    interaction: ModalSubmitInteraction,
    expectedPrefix: string
  ): boolean {
    return interaction.customId.startsWith(expectedPrefix)
  }

  /**
   * Parse userId from modal customId (for image modals)
   */
  static parseUserIdFromCustomId(customId: string): string | null {
    const match = customId.match(/^(?:new_)?(regenerate_modal|edit_modal)_(\d+)_\d+$/)
    return match ? match[2] : null
  }

  /**
   * Parse modal type from customId
   */
  static parseModalTypeFromCustomId(customId: string): 'regenerate' | 'edit' | null {
    if (customId.includes('regenerate_modal_')) return 'regenerate'
    if (customId.includes('edit_modal_')) return 'edit'
    return null
  }

  /**
   * Extract field value from modal interaction
   */
  static getFieldValue(interaction: ModalSubmitInteraction, fieldId: string): string | null {
    try {
      return interaction.fields.getTextInputValue(fieldId)
    } catch {
      return null
    }
  }

  /**
   * Validate required fields are present in modal submission
   */
  static validateRequiredFields(
    interaction: ModalSubmitInteraction,
    requiredFields: string[]
  ): boolean {
    return requiredFields.every(fieldId => {
      const value = this.getFieldValue(interaction, fieldId)
      return value !== null && value.trim().length > 0
    })
  }
}

/**
 * Factory functions for backward compatibility with existing utils/modalHelpers.ts
 */
export class ModalBuilderFactory {
  /**
   * Creates a standardized text input modal
   * Maintains compatibility with createTextInputModal from utils/modalHelpers.ts
   */
  static createTextInputModal(
    customId: string,
    title: string,
    inputId: string,
    inputLabel: string,
    inputStyle: TextInputStyle,
    options: {
      placeholder?: string
      value?: string
      required?: boolean
      maxLength?: number
    } = {}
  ): DiscordModalBuilder {
    const builder = new EnhancedModalBuilder()
    return builder.createTextInputModal(customId, title, inputId, inputLabel, inputStyle, options)
  }

  /**
   * Creates a regenerate prompt modal with pre-filled content
   * Maintains compatibility with createRegenerateModal from utils/modalHelpers.ts
   */
  static createRegenerateModal(userId: string, originalPrompt: string): DiscordModalBuilder {
    const builder = new EnhancedModalBuilder()
    return builder.createRegenerateModal({ userId, originalPrompt })
  }

  /**
   * Creates an edit image modal
   * Maintains compatibility with createEditModal from utils/modalHelpers.ts
   */
  static createEditModal(userId: string): DiscordModalBuilder {
    const builder = new EnhancedModalBuilder()
    return builder.createEditModal({ userId })
  }
}

// Export the factory functions for easy migration
export const { createTextInputModal, createRegenerateModal, createEditModal } = ModalBuilderFactory
