import { ButtonInteraction } from 'discord.js'
import { geminiService } from '@/services/gemini.js'
import logger from '@/config/logger.js'
import {
  checkGeminiAvailability,
  handleGeminiErrorWithButton,
  handleGeminiResultErrorWithButton,
  safeReply,
} from '@/utils/interactionHelpers.js'
import { buildImageSuccessResponse } from '@/utils/imageHelpers.js'
import { createRegenerateModal } from '@/utils/modalHelpers.js'

export async function handleRegenerateButton(interaction: ButtonInteraction): Promise<void> {
  // Extract original prompt from the message content
  const messageContent = interaction.message.content
  const promptMatch = messageContent.match(/\*\*Prompt:\*\* (.+)/)
  const originalPrompt = promptMatch?.[1] || ''

  // Create and show regenerate modal
  const modal = createRegenerateModal(interaction.user.id, originalPrompt)
  await interaction.showModal(modal)
}

export async function handleRegenerateModal(interaction: any): Promise<void> {
  const prompt = interaction.fields.getTextInputValue('prompt')

  // Check if Gemini service is available
  if (!(await checkGeminiAvailability(interaction, 'Image generation'))) {
    return
  }

  // Defer reply since image generation takes time
  await interaction.deferReply({ ephemeral: false })

  try {
    logger.info(
      `Image regeneration requested by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}: "${prompt}"`
    )

    // Generate the image
    const result = await geminiService.generateImage(prompt)

    if (!result.success) {
      await handleGeminiResultErrorWithButton(
        interaction,
        result.error || 'Failed to generate image',
        'Prompt',
        prompt,
        interaction.user.id
      )
      return
    }

    // Build and send success response
    const response = buildImageSuccessResponse(
      result,
      interaction.user.username,
      prompt,
      interaction.user.id,
      'regenerated'
    )

    await safeReply(interaction, response)

    logger.info(`✅ Image regenerated and sent for prompt: "${prompt.substring(0, 50)}..."`)
  } catch (error) {
    logger.error('Error in regenerate modal:', error)
    await handleGeminiErrorWithButton(
      interaction,
      error,
      'Failed to regenerate image',
      prompt,
      interaction.user.id
    )
  }
}
