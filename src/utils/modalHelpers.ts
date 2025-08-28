import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js'

/**
 * Creates a standardized text input modal
 */
export function createTextInputModal(
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
): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title)

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

  if (options.maxLength) {
    textInput.setMaxLength(options.maxLength)
  }

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput)
  modal.addComponents(actionRow)

  return modal
}

/**
 * Creates a regenerate prompt modal with pre-filled content
 */
export function createRegenerateModal(userId: string, originalPrompt: string): ModalBuilder {
  return createTextInputModal(
    `regenerate_modal_${userId}_${Date.now()}`,
    'Edit Prompt and Regenerate',
    'prompt',
    'Image Prompt',
    TextInputStyle.Paragraph,
    {
      placeholder: 'Describe the image you want to generate...',
      value: originalPrompt,
      maxLength: 1000,
    }
  )
}

/**
 * Creates an edit image modal
 */
export function createEditModal(userId: string): ModalBuilder {
  return createTextInputModal(
    `edit_modal_${userId}_${Date.now()}`,
    'Describe Your Image Edit',
    'edit_description',
    'What changes would you like?',
    TextInputStyle.Paragraph,
    {
      placeholder:
        'e.g., "Add a sunset in the background", "Make the robot blue", "Remove the skateboard"',
      maxLength: 500,
    }
  )
}
