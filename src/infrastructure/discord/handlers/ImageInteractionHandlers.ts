import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { Buffer } from 'node:buffer'
import logger from '@/infrastructure/monitoring/Logger.js'
import { GenerateImageUseCase } from '@/application/use-cases/GenerateImageUseCase.js'
import { EditImageUseCase } from '@/application/use-cases/EditImageUseCase.js'
import { RegenerateImageUseCase } from '@/application/use-cases/RegenerateImageUseCase.js'
import { GeminiAdapter } from '@/infrastructure/google/GeminiAdapter.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { EnhancedResponseBuilder } from '@/infrastructure/discord/builders/ResponseBuilder.js'
import { EnhancedModalBuilder } from '@/infrastructure/discord/builders/ModalBuilder.js'
import { EnhancedButtonBuilder } from '@/infrastructure/discord/builders/ButtonBuilder.js'

/**
 * Handlers for image-related interactions using the new clean architecture
 * These handlers use use cases and are Discord-agnostic in their business logic
 */
export class ImageInteractionHandlers {
  private readonly generateImageUseCase: GenerateImageUseCase
  private readonly editImageUseCase: EditImageUseCase
  private readonly regenerateImageUseCase: RegenerateImageUseCase
  private readonly responseBuilder: EnhancedResponseBuilder
  private readonly modalBuilder: EnhancedModalBuilder
  private readonly buttonBuilder: EnhancedButtonBuilder

  constructor() {
    // Initialize dependencies using clean architecture
    const geminiAdapter = new GeminiAdapter()
    this.generateImageUseCase = new GenerateImageUseCase(geminiAdapter)
    this.editImageUseCase = new EditImageUseCase(geminiAdapter)
    this.regenerateImageUseCase = new RegenerateImageUseCase(geminiAdapter)
    this.responseBuilder = new EnhancedResponseBuilder()
    this.modalBuilder = new EnhancedModalBuilder()
    this.buttonBuilder = new EnhancedButtonBuilder()
  }

  /**
   * Handle regenerate button interactions
   */
  async handleRegenerateButton(interaction: ButtonInteraction): Promise<void> {
    try {
      // Extract original prompt from the message content
      const messageContent = interaction.message.content
      // Try new format first (> prompt), then fall back to old format (**Label:** prompt)
      const newFormatMatch = messageContent.match(/^> (.+)$/m)
      const oldFormatMatch = messageContent.match(/\*\*[^:]+:\*\* (.+)/)
      const originalPrompt = newFormatMatch?.[1] || oldFormatMatch?.[1] || ''

      logger.debug('Regenerate button clicked', {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        originalPromptLength: originalPrompt.length,
      })

      // Create and show regenerate modal using new builder with new prefix
      const modal = this.modalBuilder.createRegenerateModal({
        userId: interaction.user.id,
        originalPrompt,
        timestamp: Date.now(),
      })
      // Update the custom ID to use the new prefix for routing
      modal.setCustomId(`new_regenerate_modal_${interaction.user.id}_${Date.now()}`)

      await interaction.showModal(modal)
    } catch (error) {
      logger.error('Error in regenerate button handler:', error)
      await interaction.reply({
        content: '❌ There was an error showing the regenerate modal.',
        ephemeral: true,
      })
    }
  }

  /**
   * Handle regenerate modal submissions
   */
  async handleRegenerateModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const prompt = interaction.fields.getTextInputValue('prompt')

      // Check if service is available
      if (!this.regenerateImageUseCase.isAvailable()) {
        await interaction.reply({
          content:
            '⚠️ Image generation is currently unavailable. The Google API key might not be configured.',
          ephemeral: true,
        })
        return
      }

      // Defer reply since image generation takes time
      await interaction.deferReply({ ephemeral: false })

      logger.info('Image regeneration requested using new architecture', {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        promptLength: prompt.length,
      })

      // Create image request using domain entity
      const imageRequest = new ImageRequest(
        prompt,
        interaction.user.id,
        interaction.inGuild() ? interaction.guild!.id : undefined,
        new Date(),
        {
          messageId: interaction.id,
          channelId: interaction.channelId ?? undefined,
          type: 'regenerate',
          source: 'modal',
        }
      )

      // Execute use case with proper input format
      const regenerateInput = {
        type: 'generate' as const,
        request: imageRequest,
      }
      const result = await this.regenerateImageUseCase.execute(regenerateInput)

      if (!result.success) {
        const errorResponse = this.responseBuilder.buildImageErrorResponse({
          errorMessage: result.error || 'Failed to regenerate image',
          contextLabel: 'Prompt',
          prompt,
          userId: interaction.user.id,
        })

        await interaction.editReply(errorResponse)
        return
      }

      if (!result.imageResult?.buffer) {
        const errorResponse = this.responseBuilder.buildImageErrorResponse({
          errorMessage: 'No image data received',
          contextLabel: 'Prompt',
          prompt,
          userId: interaction.user.id,
        })

        await interaction.editReply(errorResponse)
        return
      }

      // Build success response using helper method
      const successResponse = this.buildSuccessResponse('regenerated', result, interaction, prompt)

      await interaction.editReply(successResponse)

      logger.info('✅ Image regenerated successfully using new architecture', {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        processingTime: result.imageResult.metadata?.processingTime,
      })
    } catch (error) {
      logger.error('Error in regenerate modal handler:', error)
      await this.handleInteractionError(interaction, error, 'Failed to regenerate image')
    }
  }

  /**
   * Handle edit button interactions
   */
  async handleEditButton(interaction: ButtonInteraction): Promise<void> {
    try {
      logger.debug('Edit button clicked', {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
      })

      // Create and show edit modal using new builder with new prefix
      const modal = this.modalBuilder.createEditModal({
        userId: interaction.user.id,
        timestamp: Date.now(),
      })
      // Update the custom ID to use the new prefix for routing
      modal.setCustomId(`new_edit_modal_${interaction.user.id}_${Date.now()}`)

      await interaction.showModal(modal)
    } catch (error) {
      logger.error('Error in edit button handler:', error)
      await interaction.reply({
        content: '❌ There was an error showing the edit modal.',
        ephemeral: true,
      })
    }
  }

  /**
   * Handle edit modal submissions
   */
  async handleEditModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const editDescription = interaction.fields.getTextInputValue('edit_description')

      // Check if service is available
      if (!this.editImageUseCase.isAvailable()) {
        await interaction.reply({
          content:
            '⚠️ Image editing is currently unavailable. The Google API key might not be configured.',
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

      logger.info('Image edit requested using new architecture', {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        editDescriptionLength: editDescription.length,
        originalImageSize: originalAttachment.size,
      })

      // Download the original image
      // eslint-disable-next-line no-undef
      const fetchResponse = await fetch(originalAttachment.url)
      const imageBuffer = Buffer.from(await fetchResponse.arrayBuffer())
      const mimeType = originalAttachment.contentType || 'image/png'

      // Create image request using domain entity
      const imageRequest = new ImageRequest(
        editDescription,
        interaction.user.id,
        interaction.inGuild() ? interaction.guild!.id : undefined,
        new Date(),
        {
          messageId: interaction.id,
          channelId: interaction.channelId ?? undefined,
          type: 'edit',
          source: 'modal',
        }
      )

      // Execute use case with proper input format
      const editInput = {
        request: imageRequest,
        imageBuffer,
        mimeType,
      }
      const result = await this.editImageUseCase.execute(editInput)

      if (!result.success) {
        const errorResponse = this.responseBuilder.buildImageErrorResponse({
          errorMessage: result.error || 'Failed to edit image',
          contextLabel: 'Edit Request',
          prompt: editDescription,
          userId: interaction.user.id,
        })

        await interaction.editReply(errorResponse)
        return
      }

      if (!result.imageResult?.buffer) {
        const errorResponse = this.responseBuilder.buildImageErrorResponse({
          errorMessage: 'No image data received',
          contextLabel: 'Edit Request',
          prompt: editDescription,
          userId: interaction.user.id,
        })

        await interaction.editReply(errorResponse)
        return
      }

      // Build success response using helper method
      const successResponse = this.buildSuccessResponse(
        'edited',
        result,
        interaction,
        editDescription
      )

      await interaction.editReply(successResponse)

      logger.info('✅ Image edited successfully using new architecture', {
        userId: interaction.user.id,
        guildId: interaction.guild?.id,
        processingTime: result.imageResult.metadata?.processingTime,
      })
    } catch (error) {
      logger.error('Error in edit modal handler:', error)
      await this.handleInteractionError(interaction, error, 'Failed to edit image')
    }
  }

  /**
   * Build success response using GeminiCommand format
   */
  private buildSuccessResponse(
    type: 'regenerated' | 'edited',
    result: any,
    interaction: any,
    prompt: string
  ) {
    const typeEmojis = { regenerated: '🎨', edited: '✏️' }
    const typeLabels = { regenerated: 'regenerated', edited: 'edited' }

    const timeText = result.imageResult.metadata?.processingTime
      ? ` (${(result.imageResult.metadata.processingTime / 1000).toFixed(1)}s)`
      : ''
    const content = `${typeEmojis[type]} **${interaction.user.username}** ${typeLabels[type]} an image${timeText}\n> ${prompt}`

    const attachment = this.responseBuilder.createImageAttachment(
      result.imageResult,
      interaction.user.username,
      prompt,
      { prefix: type === 'edited' ? 'edited' : '' }
    )

    const buttons = this.buttonBuilder.createImageActionButtons({ userId: interaction.user.id })

    return {
      content,
      files: [attachment],
      components: [buttons],
    }
  }

  /**
   * Generic error handler for interactions
   */
  private async handleInteractionError(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    error: unknown,
    defaultMessage: string
  ): Promise<void> {
    const errorMessage = {
      content: `❌ ${defaultMessage}`,
      ephemeral: true,
    }

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    } catch (replyError) {
      logger.error('Failed to send error message to user:', {
        originalError: error instanceof Error ? error.message : String(error),
        replyError: replyError instanceof Error ? replyError.message : String(replyError),
        interactionType: interaction.constructor.name,
        userId: interaction.user.id,
      })
    }
  }

  /**
   * Check if image generation services are available
   */
  public isGenerationAvailable(): boolean {
    return this.generateImageUseCase.isAvailable()
  }

  /**
   * Check if image editing services are available
   */
  public isEditingAvailable(): boolean {
    return this.editImageUseCase.isAvailable()
  }

  /**
   * Get information about the underlying services
   */
  public getServiceInfo() {
    return {
      generator: this.generateImageUseCase.getGeneratorInfo(),
      editor: this.editImageUseCase.getGeneratorInfo(),
      regenerator: this.regenerateImageUseCase.getGeneratorInfo(),
    }
  }
}
