import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js'

/**
 * Creates standardized edit and regenerate buttons for image operations
 */
export function createImageActionButtons(userId: string): ActionRowBuilder<ButtonBuilder> {
  const timestamp = Date.now()

  const editButton = new ButtonBuilder()
    .setCustomId(`edit_${userId}_${timestamp}`)
    .setLabel('✏️')
    .setStyle(ButtonStyle.Secondary)

  const regenerateButton = new ButtonBuilder()
    .setCustomId(`regenerate_${userId}_${timestamp}`)
    .setLabel('🔄')
    .setStyle(ButtonStyle.Secondary)

  return new ActionRowBuilder<ButtonBuilder>().addComponents(editButton, regenerateButton)
}
