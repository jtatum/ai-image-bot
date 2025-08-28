import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import { Command } from '@/bot/types.js'
import { geminiService } from '@/services/gemini.js'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import { createImageFilename } from '@/utils/filename.js'

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
    if (!geminiService.isAvailable()) {
      await interaction.reply({
        content: '❌ Image generation is currently unavailable. Please try again later.',
        ephemeral: true,
      })
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

      // Create refresh button
      const refreshButton = new ButtonBuilder()
        .setCustomId(`regenerate_${interaction.user.id}_${Date.now()}`)
        .setLabel('🔄')
        .setStyle(ButtonStyle.Secondary)

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton)

      // Send the generated image with refresh button
      await interaction.editReply({
        content: `🎨 **Image generated successfully!**\n**Prompt:** ${prompt}`,
        files: [attachment],
        components: [row],
      })

      logger.info(`✅ Image generated and sent for prompt: "${prompt.substring(0, 50)}..."`)
    } catch (error) {
      logger.error('Error in gemini command:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      await interaction.editReply({
        content: `❌ Failed to generate image: ${errorMessage}`,
      })
    }
  },
}

export default gemini
