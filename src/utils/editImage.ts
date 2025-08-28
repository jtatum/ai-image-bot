import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
} from 'discord.js'
import { geminiService } from '@/services/gemini.js'
import { createImageFilename } from '@/utils/filename.js'
import logger from '@/config/logger.js'
import { Buffer } from 'node:buffer'

export async function handleEditButton(interaction: ButtonInteraction): Promise<void> {
  // Create modal for edit description
  const modal = new ModalBuilder()
    .setCustomId(`edit_modal_${interaction.user.id}_${Date.now()}`)
    .setTitle('Describe Your Image Edit')

  const editInput = new TextInputBuilder()
    .setCustomId('edit_description')
    .setLabel('What changes would you like?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(
      'e.g., "Add a sunset in the background", "Make the robot blue", "Remove the skateboard"'
    )
    .setRequired(true)
    .setMaxLength(500)

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(editInput)
  modal.addComponents(firstActionRow)

  await interaction.showModal(modal)
}

export async function handleEditModal(interaction: ModalSubmitInteraction): Promise<void> {
  const editDescription = interaction.fields.getTextInputValue('edit_description')

  // Check if Gemini service is available
  if (!geminiService.isAvailable()) {
    await interaction.reply({
      content: '❌ Image editing is currently unavailable. Please try again later.',
      ephemeral: true,
    })
    return
  }

  // Get the original image from the message
  const originalMessage = interaction.message
  if (!originalMessage || !originalMessage.attachments.first()) {
    await interaction.reply({
      content: '❌ Could not find the original image to edit.',
      ephemeral: true,
    })
    return
  }

  const originalAttachment = originalMessage.attachments.first()!

  // Defer reply since image editing takes time
  await interaction.deferReply({ ephemeral: false })

  try {
    logger.info(
      `Image edit requested by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}: "${editDescription}"`
    )

    // Download the original image
    // eslint-disable-next-line no-undef
    const response = await fetch(originalAttachment.url)
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    const mimeType = originalAttachment.contentType || 'image/png'

    // Edit the image
    const result = await geminiService.editImage(editDescription, imageBuffer, mimeType)

    if (!result.success) {
      await interaction.editReply({
        content: `❌ ${result.error || 'Failed to edit image'}\n**Edit Request:** ${editDescription}`,
      })
      return
    }

    // Create Discord attachment with user-specific filename
    const filename = createImageFilename(interaction.user.username, `edited_${editDescription}`)
    const attachment = new AttachmentBuilder(result.buffer!, {
      name: filename,
      description: `Edited image: ${editDescription.substring(0, 100)}`,
    })

    // Create both edit and regenerate buttons for the edited image
    const editButton = new ButtonBuilder()
      .setCustomId(`edit_${interaction.user.id}_${Date.now()}`)
      .setLabel('✏️')
      .setStyle(ButtonStyle.Secondary)

    const regenerateButton = new ButtonBuilder()
      .setCustomId(`regenerate_${interaction.user.id}_${Date.now()}`)
      .setLabel('🔄')
      .setStyle(ButtonStyle.Secondary)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(editButton, regenerateButton)

    // Send the edited image
    await interaction.editReply({
      content: `✏️ **Image edited successfully!**\n**Edit Request:** ${editDescription}`,
      files: [attachment],
      components: [row],
    })

    logger.info(`✅ Image edited and sent for request: "${editDescription.substring(0, 50)}..."`)
  } catch (error) {
    logger.error('Error in edit modal:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    await interaction.editReply({
      content: `❌ Failed to edit image: ${errorMessage}`,
    })
  }
}
