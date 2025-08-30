import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import { BaseCommand } from '../base/BaseCommand.js'
import { GenerateImageUseCase } from '../../../application/use-cases/GenerateImageUseCase.js'
import { GeminiAdapter } from '../../../infrastructure/google/GeminiAdapter.js'
import { ImageRequest } from '../../../domain/entities/ImageRequest.js'
import { config } from '../../../config/environment.js'

/**
 * Discord command for generating AI images using Google Gemini
 * Uses the new architecture with use cases and clean separation of concerns
 */
export class GeminiCommand extends BaseCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('gemini')
    .setDescription('Generate an image using Google Gemini AI')
    .addStringOption(option =>
      option
        .setName('prompt')
        .setDescription('Description of the image you want to generate')
        .setRequired(true)
        .setMaxLength(1000)
    ) as SlashCommandBuilder

  public readonly cooldown = config.COMMAND_COOLDOWN_SECONDS

  private readonly generateImageUseCase: GenerateImageUseCase

  constructor() {
    super()

    // Initialize the use case with its dependencies
    const geminiAdapter = new GeminiAdapter()
    this.generateImageUseCase = new GenerateImageUseCase(geminiAdapter)
  }

  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const prompt = interaction.options.getString('prompt', true)

    // Check if the service is available
    if (!this.generateImageUseCase.isAvailable()) {
      await this.safeReply(interaction, {
        content:
          '⚠️ Image generation is currently unavailable. The Google API key might not be configured.',
        ephemeral: true,
      })
      return
    }

    // Defer the reply since image generation takes time
    await this.deferReply(interaction)

    // Create the image request
    const imageRequest = new ImageRequest(
      prompt,
      interaction.user.id,
      interaction.inGuild() ? interaction.guild!.id : undefined,
      new Date(),
      {
        messageId: interaction.id,
        channelId: interaction.channelId,
        type: 'generate',
        source: 'command',
      }
    )

    try {
      this.logger.info('Processing image generation request', {
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        userId: interaction.user.id,
        guildId: interaction.guildId,
      })

      // Execute the use case
      const result = await this.generateImageUseCase.execute(imageRequest)

      if (!result.success) {
        await this.handleGenerationError(
          interaction,
          result.error || 'Unknown error occurred',
          prompt
        )
        return
      }

      if (!result.imageResult?.buffer) {
        await this.handleGenerationError(interaction, 'No image data received', prompt)
        return
      }

      // Create Discord attachment
      const attachment = new AttachmentBuilder(result.imageResult.buffer, {
        name: `gemini-${Date.now()}.png`,
        description: `AI generated image: ${prompt.substring(0, 100)}`,
      })

      // Build success response
      const successMessage = this.buildSuccessMessage(
        interaction.user.username,
        prompt,
        result.imageResult.metadata?.processingTime
      )

      await this.safeReply(interaction, {
        content: successMessage,
        files: [attachment],
        components: this.buildActionButtons(prompt, interaction.user.id),
      })

      this.logger.info('Image generation completed successfully', {
        userId: interaction.user.id,
        guildId: interaction.guildId,
        processingTime: result.imageResult.metadata?.processingTime,
      })
    } catch (error) {
      this.logger.error('Unexpected error in gemini command', {
        error: error instanceof Error ? error.message : String(error),
        userId: interaction.user.id,
        guildId: interaction.guildId,
      })

      await this.handleGenerationError(
        interaction,
        'An unexpected error occurred while generating the image',
        prompt
      )
    }
  }

  /**
   * Handle generation errors with user-friendly messages and retry options
   */
  private async handleGenerationError(
    interaction: ChatInputCommandInteraction,
    error: string,
    prompt: string
  ): Promise<void> {
    const errorMessage = this.buildErrorMessage(error)

    await this.safeReply(interaction, {
      content: errorMessage,
      components: this.buildRetryButton(prompt, interaction.user.id),
      ephemeral: false,
    })
  }

  /**
   * Build a success message for the image generation
   */
  private buildSuccessMessage(username: string, prompt: string, processingTime?: number): string {
    const timeText = processingTime ? ` (${(processingTime / 1000).toFixed(1)}s)` : ''
    return `🎨 **${username}** generated an image${timeText}\n> ${prompt}`
  }

  /**
   * Build an error message with appropriate emoji and context
   */
  private buildErrorMessage(error: string): string {
    // Customize error messages based on error type
    if (error.includes('Content blocked')) {
      return `🚫 **Content Blocked**\n${error}\n\nPlease try a different prompt that follows our content guidelines.`
    }

    if (error.includes('Generation stopped')) {
      return `⚠️ **Generation Incomplete**\n${error}\n\nThe AI couldn't complete your request. Try simplifying your prompt.`
    }

    return `❌ **Generation Failed**\n${error}\n\nPlease try again or contact support if the issue persists.`
  }

  /**
   * Build action buttons for successful image generation
   * Using new architecture prefixes for testing
   */
  private buildActionButtons(_prompt: string, userId: string) {
    const regenerateButton = new ButtonBuilder()
      .setCustomId(`new_regenerate_${userId}_${Date.now()}`)
      .setLabel('🔄')
      .setStyle(ButtonStyle.Secondary)

    const editButton = new ButtonBuilder()
      .setCustomId(`new_edit_${userId}_${Date.now()}`)
      .setLabel('✏️')
      .setStyle(ButtonStyle.Secondary)

    return [new ActionRowBuilder().addComponents(regenerateButton, editButton)]
  }

  /**
   * Build retry button for failed generation
   * Using new architecture prefix for testing
   */
  private buildRetryButton(_prompt: string, userId: string) {
    const retryButton = new ButtonBuilder()
      .setCustomId(`new_regenerate_${userId}_${Date.now()}`)
      .setLabel('🔄')
      .setStyle(ButtonStyle.Primary)

    return [new ActionRowBuilder().addComponents(retryButton)]
  }

  /**
   * Override error handling for more specific Gemini-related errors
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // Handle specific Gemini errors
      if (error.message.includes('API key')) {
        return 'Image generation service is not properly configured. Please contact an administrator.'
      }

      if (error.message.includes('quota') || error.message.includes('limit')) {
        return 'Service quota exceeded. Please try again later.'
      }

      if (error.message.includes('safety') || error.message.includes('blocked')) {
        return 'Your request was blocked by content safety filters. Please try a different prompt.'
      }
    }

    return super.getErrorMessage(error)
  }
}
