import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import { geminiService } from '@/services/gemini.js'
import { createImageFilename } from '@/utils/filename.js'
import logger from '@/config/logger.js'

export async function handleRegenerateButton(interaction: ButtonInteraction): Promise<void> {
  // Extract original prompt from the message content
  const messageContent = interaction.message.content
  const promptMatch = messageContent.match(/\*\*Prompt:\*\* (.+)/)
  const originalPrompt = promptMatch?.[1] || ''

  // Create modal for prompt editing
  const modal = new ModalBuilder()
    .setCustomId(`regenerate_modal_${interaction.user.id}_${Date.now()}`)
    .setTitle('Edit Prompt and Regenerate')

  const promptInput = new TextInputBuilder()
    .setCustomId('prompt')
    .setLabel('Image Prompt')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe the image you want to generate...')
    .setValue(originalPrompt)
    .setRequired(true)
    .setMaxLength(1000)

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput)
  modal.addComponents(firstActionRow)

  await interaction.showModal(modal)
}

export async function handleRegenerateModal(interaction: any): Promise<void> {
  const prompt = interaction.fields.getTextInputValue('prompt')

  // Check if Gemini service is available
  if (!geminiService.isAvailable()) {
    await interaction.reply({
      content: '❌ Image generation is currently unavailable. Please try again later.',
      ephemeral: true,
    })
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
      await interaction.editReply({
        content: `❌ ${result.error || 'Failed to generate image'}\n**Prompt:** ${prompt}`,
      })
      return
    }

    // Create Discord attachment with user-specific filename
    const filename = createImageFilename(interaction.user.username, prompt)
    const attachment = new AttachmentBuilder(result.buffer!, {
      name: filename,
      description: `Generated image: ${prompt.substring(0, 100)}`,
    })

    // Create edit and regenerate buttons for the new image
    const editButton = new ButtonBuilder()
      .setCustomId(`edit_${interaction.user.id}_${Date.now()}`)
      .setLabel('✏️ Edit')
      .setStyle(ButtonStyle.Primary)

    const regenerateButton = new ButtonBuilder()
      .setCustomId(`regenerate_${interaction.user.id}_${Date.now()}`)
      .setLabel('🔄 Regenerate')
      .setStyle(ButtonStyle.Secondary)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(editButton, regenerateButton)

    // Send the regenerated image
    await interaction.editReply({
      content: `🎨 **Image regenerated successfully!**\n**Prompt:** ${prompt}`,
      files: [attachment],
      components: [row],
    })

    logger.info(`✅ Image regenerated and sent for prompt: "${prompt.substring(0, 50)}..."`)
  } catch (error) {
    logger.error('Error in regenerate modal:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    await interaction.editReply({
      content: `❌ Failed to regenerate image: ${errorMessage}`,
    })
  }
}
