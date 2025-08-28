import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { geminiService } from '@/services/gemini.js'
import logger from '@/config/logger.js'
import { Buffer } from 'node:buffer'
import {
  checkGeminiAvailability,
  handleGeminiError,
  handleGeminiResultError,
  safeReply,
} from '@/utils/interactionHelpers.js'
import { buildImageSuccessResponse } from '@/utils/imageHelpers.js'
import { createEditModal } from '@/utils/modalHelpers.js'

export async function handleEditButton(interaction: ButtonInteraction): Promise<void> {
  // Create and show edit modal
  const modal = createEditModal(interaction.user.id)
  await interaction.showModal(modal)
}

export async function handleEditModal(interaction: ModalSubmitInteraction): Promise<void> {
  const editDescription = interaction.fields.getTextInputValue('edit_description')

  // Check if Gemini service is available
  if (!(await checkGeminiAvailability(interaction, 'Image editing'))) {
    return
  }

  // Get the original image from the message
  const originalMessage = interaction.message
  if (!originalMessage || !originalMessage.attachments.first()) {
    await safeReply(interaction, {
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
    const fetchResponse = await fetch(originalAttachment.url)
    const imageBuffer = Buffer.from(await fetchResponse.arrayBuffer())
    const mimeType = originalAttachment.contentType || 'image/png'

    // Edit the image
    const result = await geminiService.editImage(editDescription, imageBuffer, mimeType)

    if (!result.success) {
      await handleGeminiResultError(
        interaction,
        result.error || 'Failed to edit image',
        'Edit Request',
        editDescription
      )
      return
    }

    // Build and send success response
    const successResponse = buildImageSuccessResponse(
      result,
      interaction.user.username,
      editDescription,
      interaction.user.id,
      'edited',
      'Edit Request'
    )

    await safeReply(interaction, successResponse)

    logger.info(`✅ Image edited and sent for request: "${editDescription.substring(0, 50)}..."`)
  } catch (error) {
    logger.error('Error in edit modal:', error)
    await handleGeminiError(interaction, error, 'Failed to edit image')
  }
}
