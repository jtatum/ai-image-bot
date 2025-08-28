import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { Command } from '@/bot/types.js'
import { geminiService } from '@/services/gemini.js'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import {
  checkGeminiAvailability,
  handleGeminiErrorWithButton,
  handleGeminiResultErrorWithButton,
  safeReply,
} from '@/utils/interactionHelpers.js'
import { buildImageSuccessResponse } from '@/utils/imageHelpers.js'

const gemini: Command = {
  data: new SlashCommandBuilder()
    .setName('gemini')
    .setDescription('Generate an image using Google Gemini AI')
    .addStringOption(option =>
      option
        .setName('prompt')
        .setDescription('Description of the image you want to generate')
        .setRequired(true)
        .setMaxLength(1000)
    ) as SlashCommandBuilder,

  cooldown: config.COMMAND_COOLDOWN_SECONDS,

  async execute(interaction: ChatInputCommandInteraction) {
    const prompt = interaction.options.getString('prompt', true)

    // Check if Gemini service is available
    if (!(await checkGeminiAvailability(interaction, 'Image generation'))) {
      return
    }

    // Defer reply since image generation takes time
    await interaction.deferReply()

    try {
      logger.info(
        `Image generation requested by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}: "${prompt}"`
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
        'generated'
      )

      await safeReply(interaction, response)

      logger.info(`✅ Image generated and sent for prompt: "${prompt.substring(0, 50)}..."`)
    } catch (error) {
      logger.error('Error in gemini command:', error)
      await handleGeminiErrorWithButton(
        interaction,
        error,
        'Failed to generate image',
        prompt,
        interaction.user.id
      )
    }
  },
}

export default gemini
