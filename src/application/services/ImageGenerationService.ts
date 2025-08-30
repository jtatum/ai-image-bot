import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import logger from '@/infrastructure/monitoring/Logger.js'
import { Buffer } from 'node:buffer'

/**
 * Application service for handling image generation workflows
 * This service is Discord-agnostic and focuses purely on business logic
 */
export class ImageGenerationService {
  private imageGenerator: IImageGenerator

  constructor(imageGenerator: IImageGenerator) {
    this.imageGenerator = imageGenerator
  }

  /**
   * Check if the image generation service is available
   */
  public isAvailable(): boolean {
    return this.imageGenerator.isAvailable()
  }

  /**
   * Generate an image from a request
   * Handles validation, sanitization, and logging
   */
  public async generateImage(request: ImageRequest): Promise<IImageResult> {
    const startTime = Date.now()

    try {
      // Validate the request
      const validation = request.validate()
      if (!validation.isValid) {
        logger.warn('Image generation request validation failed:', {
          userId: request.userId,
          guildId: request.guildId,
          errors: validation.errors,
        })

        return {
          success: false,
          error: `Invalid request: ${validation.errors.join(', ')}`,
        }
      }

      // Log validation warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        logger.warn('Image generation request has warnings:', {
          userId: request.userId,
          guildId: request.guildId,
          warnings: validation.warnings,
        })
      }

      // Sanitize the prompt
      const sanitizedRequest = request.withSanitizedPrompt()
      const prompt = sanitizedRequest.prompt

      logger.info('Processing image generation request:', {
        userId: request.userId,
        guildId: request.guildId,
        promptLength: prompt.length,
        requestType: request.metadata?.type || 'generate',
        source: request.metadata?.source || 'unknown',
      })

      // Generate the image using the provider
      const result = await this.imageGenerator.generateImage(prompt)

      const processingTime = Date.now() - startTime

      // Add metadata to the result
      const enrichedResult: IImageResult = {
        ...result,
        metadata: {
          ...result.metadata,
          generatedAt: new Date(),
          processingTime,
          model: this.imageGenerator.getInfo().name,
        },
      }

      if (result.success) {
        logger.info('Image generation completed successfully:', {
          userId: request.userId,
          guildId: request.guildId,
          processingTime,
          bufferSize: result.buffer?.length,
        })
      } else {
        logger.warn('Image generation failed:', {
          userId: request.userId,
          guildId: request.guildId,
          error: result.error,
          processingTime,
        })
      }

      return enrichedResult
    } catch (error) {
      const processingTime = Date.now() - startTime

      logger.error('Image generation service error:', {
        userId: request.userId,
        guildId: request.guildId,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      })

      return {
        success: false,
        error: 'An unexpected error occurred during image generation',
        metadata: {
          generatedAt: new Date(),
          processingTime,
          model: this.imageGenerator.getInfo().name,
        },
      }
    }
  }

  /**
   * Edit an existing image based on a request
   * Handles validation, sanitization, and logging
   */
  public async editImage(
    request: ImageRequest,
    originalImageBuffer: Buffer,
    mimeType: string = 'image/png'
  ): Promise<IImageResult> {
    const startTime = Date.now()

    try {
      // Validate the request
      const validation = request.validate()
      if (!validation.isValid) {
        logger.warn('Image edit request validation failed:', {
          userId: request.userId,
          guildId: request.guildId,
          errors: validation.errors,
        })

        return {
          success: false,
          error: `Invalid request: ${validation.errors.join(', ')}`,
        }
      }

      // Validate image buffer
      if (!originalImageBuffer || originalImageBuffer.length === 0) {
        return {
          success: false,
          error: 'Original image buffer is required for editing',
        }
      }

      // Log validation warnings if any
      if (validation.warnings && validation.warnings.length > 0) {
        logger.warn('Image edit request has warnings:', {
          userId: request.userId,
          guildId: request.guildId,
          warnings: validation.warnings,
        })
      }

      // Sanitize the prompt
      const sanitizedRequest = request.withSanitizedPrompt()
      const prompt = sanitizedRequest.prompt

      logger.info('Processing image edit request:', {
        userId: request.userId,
        guildId: request.guildId,
        promptLength: prompt.length,
        originalImageSize: originalImageBuffer.length,
        mimeType,
        requestType: request.metadata?.type || 'edit',
        source: request.metadata?.source || 'unknown',
      })

      // Edit the image using the provider
      const result = await this.imageGenerator.editImage(prompt, originalImageBuffer, mimeType)

      const processingTime = Date.now() - startTime

      // Add metadata to the result
      const enrichedResult: IImageResult = {
        ...result,
        metadata: {
          ...result.metadata,
          generatedAt: new Date(),
          processingTime,
          model: this.imageGenerator.getInfo().name,
        },
      }

      if (result.success) {
        logger.info('Image editing completed successfully:', {
          userId: request.userId,
          guildId: request.guildId,
          processingTime,
          originalImageSize: originalImageBuffer.length,
          resultBufferSize: result.buffer?.length,
        })
      } else {
        logger.warn('Image editing failed:', {
          userId: request.userId,
          guildId: request.guildId,
          error: result.error,
          processingTime,
        })
      }

      return enrichedResult
    } catch (error) {
      const processingTime = Date.now() - startTime

      logger.error('Image editing service error:', {
        userId: request.userId,
        guildId: request.guildId,
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      })

      return {
        success: false,
        error: 'An unexpected error occurred during image editing',
        metadata: {
          generatedAt: new Date(),
          processingTime,
          model: this.imageGenerator.getInfo().name,
        },
      }
    }
  }

  /**
   * Get information about the image generation service
   */
  public getGeneratorInfo(): {
    name: string
    version?: string
    supportedFormats?: string[]
    maxPromptLength?: number
  } {
    return this.imageGenerator.getInfo()
  }

  /**
   * Create a new ImageRequest from basic parameters
   * Helper method to simplify request creation
   */
  public createRequest(
    prompt: string,
    userId: string,
    guildId?: string,
    metadata?: {
      messageId?: string
      channelId?: string
      type?: 'generate' | 'edit' | 'regenerate'
      source?: 'command' | 'button' | 'modal'
    }
  ): ImageRequest {
    return new ImageRequest(prompt, userId, guildId, new Date(), metadata)
  }
}
