import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { Buffer } from 'node:buffer'
import logger from '@/config/logger.js'
import { GenerateImageUseCase } from '@/application/use-cases/GenerateImageUseCase.js'
import { EditImageUseCase } from '@/application/use-cases/EditImageUseCase.js'
import { RegenerateImageUseCase } from '@/application/use-cases/RegenerateImageUseCase.js'
import { GeminiAdapter } from '@/infrastructure/google/GeminiAdapter.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { EnhancedResponseBuilder } from '@/infrastructure/discord/builders/ResponseBuilder.js'
import { EnhancedModalBuilder } from '@/infrastructure/discord/builders/ModalBuilder.js'

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

  constructor() {
    // Initialize dependencies using clean architecture
    const geminiAdapter = new GeminiAdapter()
    this.generateImageUseCase = new GenerateImageUseCase(geminiAdapter)
    this.editImageUseCase = new EditImageUseCase(geminiAdapter)
    this.regenerateImageUseCase = new RegenerateImageUseCase(geminiAdapter)
    this.responseBuilder = new EnhancedResponseBuilder()
    this.modalBuilder = new EnhancedModalBuilder()
  }

  /**
   * Handle regenerate button interactions
   */
  async handleRegenerateButton(interaction: ButtonInteraction): Promise<void> {
    try {
      // Extract original prompt from the message content
      const messageContent = interaction.message.content
      const promptMatch = messageContent.match(/\*\*(?:Prompt|Edit Request):\*\* (.+)/)
      const originalPrompt = promptMatch?.[1] || ''

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

      // Build success response using new builder
      const successResponse = this.responseBuilder.buildImageSuccessResponse(result.imageResult, {
        type: 'regenerated',
        username: interaction.user.username,
        prompt,
        userId: interaction.user.id,
        contextLabel: 'Prompt',
      })

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

      // Build success response using new builder
      const successResponse = this.responseBuilder.buildImageSuccessResponse(result.imageResult, {
        type: 'edited',
        username: interaction.user.username,
        prompt: editDescription,
        userId: interaction.user.id,
        contextLabel: 'Edit Request',
      })

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
