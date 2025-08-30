import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder as DiscordButtonBuilder,
} from 'discord.js'
import { Buffer } from 'node:buffer'
// Legacy types for backward compatibility
interface GenerateImageResult {
  success: boolean
  buffer?: Buffer
  error?: string
}

interface EditImageResult {
  success: boolean
  buffer?: Buffer
  error?: string
}
import { IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { createImageFilename } from '@/utils/filename.js'
import { EnhancedButtonBuilder } from './ButtonBuilder.js'

export type ImageOperationType = 'generated' | 'edited' | 'regenerated'

export interface AttachmentOptions {
  filename?: string
  description?: string
  prefix?: string
}

export interface SuccessResponseOptions {
  type: ImageOperationType
  username: string
  prompt: string
  userId: string
  contextLabel?: string
  includeButtons?: boolean
  customMessage?: string
  attachmentOptions?: AttachmentOptions
}

export interface ErrorResponseOptions {
  errorMessage: string
  contextLabel: string
  prompt: string
  userId: string
  ephemeral?: boolean
  includeRetryButton?: boolean
  customMessage?: string
}

export interface ImageSuccessResponse {
  content: string
  files: AttachmentBuilder[]
  components: ActionRowBuilder<DiscordButtonBuilder>[]
}

export interface ImageErrorResponse {
  content: string
  ephemeral: boolean
  components: ActionRowBuilder<DiscordButtonBuilder>[]
}

/**
 * Enhanced builder for Discord responses with improved flexibility and type safety
 * Consolidates and enhances the existing utils/imageHelpers.ts functionality
 */
export class EnhancedResponseBuilder {
  private readonly buttonBuilder: EnhancedButtonBuilder

  constructor() {
    this.buttonBuilder = new EnhancedButtonBuilder()
  }

  /**
   * Creates a Discord attachment from image generation result
   * Enhanced version of createImageAttachment from utils/imageHelpers.ts
   */
  createImageAttachment(
    result: GenerateImageResult | EditImageResult | IImageResult,
    username: string,
    prompt: string,
    options: AttachmentOptions = {}
  ): AttachmentBuilder {
    if (!result.success || !result.buffer) {
      throw new Error('Cannot create attachment from failed result')
    }

    const { prefix = '', filename, description } = options

    const finalPrompt = prefix ? `${prefix}_${prompt}` : prompt
    const finalFilename = filename || createImageFilename(username, finalPrompt)
    const finalDescription =
      description || `${prefix ? 'Edited' : 'Generated'} image: ${prompt.substring(0, 100)}`

    return new AttachmentBuilder(result.buffer, {
      name: finalFilename,
      description: finalDescription,
    })
  }

  /**
   * Builds a complete success response for image operations
   * Enhanced version of buildImageSuccessResponse from utils/imageHelpers.ts
   */
  buildImageSuccessResponse(
    result: GenerateImageResult | EditImageResult | IImageResult,
    options: SuccessResponseOptions
  ): ImageSuccessResponse {
    const {
      type,
      username,
      prompt,
      userId,
      contextLabel = 'Prompt',
      includeButtons = true,
      customMessage,
      attachmentOptions = {},
    } = options

    // Create attachment with enhanced options
    const attachmentPrefix = type === 'edited' ? 'edited' : ''
    const attachment = this.createImageAttachment(result, username, prompt, {
      prefix: attachmentPrefix,
      ...attachmentOptions,
    })

    // Create buttons if requested
    const components: ActionRowBuilder<DiscordButtonBuilder>[] = []
    if (includeButtons) {
      const buttons = this.buttonBuilder.createImageActionButtons({ userId })
      components.push(buttons)
    }

    // Build content message
    const processingTime = 'metadata' in result ? result.metadata?.processingTime : undefined
    const content =
      customMessage || this.buildSuccessMessage(type, userId, contextLabel, prompt, processingTime)

    return {
      content,
      files: [attachment],
      components,
    }
  }

  /**
   * Builds an error response for image operations with optional retry button
   * Enhanced version of buildImageErrorResponse from utils/imageHelpers.ts
   */
  buildImageErrorResponse(options: ErrorResponseOptions): ImageErrorResponse {
    const {
      errorMessage,
      contextLabel,
      prompt,
      userId,
      ephemeral = false,
      includeRetryButton = true,
      customMessage,
    } = options

    // Create retry button if requested
    const components: ActionRowBuilder<DiscordButtonBuilder>[] = []
    if (includeRetryButton) {
      const retryButton = this.buttonBuilder.createRegenerateOnlyButton({ userId })
      components.push(retryButton)
    }

    // Build content message
    const content =
      customMessage || this.buildErrorMessage(userId, errorMessage, contextLabel, prompt)

    return {
      content,
      ephemeral,
      components,
    }
  }

  /**
   * Create a simple text response with optional buttons
   */
  buildTextResponse(options: {
    content: string
    userId?: string
    includeImageButtons?: boolean
    includeRetryButton?: boolean
    ephemeral?: boolean
  }): {
    content: string
    ephemeral: boolean
    components: ActionRowBuilder<DiscordButtonBuilder>[]
  } {
    const {
      content,
      userId,
      includeImageButtons = false,
      includeRetryButton = false,
      ephemeral = false,
    } = options

    const components: ActionRowBuilder<DiscordButtonBuilder>[] = []

    if (userId) {
      if (includeImageButtons) {
        const imageButtons = this.buttonBuilder.createImageActionButtons({ userId })
        components.push(imageButtons)
      } else if (includeRetryButton) {
        const retryButton = this.buttonBuilder.createRegenerateOnlyButton({ userId })
        components.push(retryButton)
      }
    }

    return {
      content,
      ephemeral,
      components,
    }
  }

  /**
   * Create a progress/loading response
   */
  buildProgressResponse(options: {
    userId: string
    operation: 'generating' | 'editing' | 'processing'
    prompt?: string
    ephemeral?: boolean
  }): {
    content: string
    ephemeral: boolean
    components: ActionRowBuilder<DiscordButtonBuilder>[]
  } {
    const { userId, operation, prompt, ephemeral = false } = options

    const operationEmojis = {
      generating: '🎨',
      editing: '✏️',
      processing: '⚙️',
    }

    const operationTexts = {
      generating: 'Generating your image',
      editing: 'Editing your image',
      processing: 'Processing your request',
    }

    const content = `<@${userId}> ${operationEmojis[operation]} **${operationTexts[operation]}...**${
      prompt ? `\n**Prompt:** ${prompt}` : ''
    }\n*This may take a few moments.*`

    return {
      content,
      ephemeral,
      components: [], // No buttons during progress
    }
  }

  /**
   * Validate that a result can be used to create an attachment
   */
  static validateImageResult(
    result: GenerateImageResult | EditImageResult | IImageResult
  ): boolean {
    return result.success && !!result.buffer && result.buffer.length > 0
  }

  /**
   * Get file size in a human-readable format
   */
  static getFileSizeString(buffer: Buffer): string {
    const bytes = buffer.length
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Build success message with type-specific emojis and labels
   */
  private buildSuccessMessage(
    type: ImageOperationType,
    userId: string,
    contextLabel: string,
    prompt: string,
    processingTime?: number
  ): string {
    const typeEmojis: Record<ImageOperationType, string> = {
      generated: '🎨',
      edited: '✏️',
      regenerated: '🎨',
    }

    const typeLabels: Record<ImageOperationType, string> = {
      generated: 'generated',
      edited: 'edited',
      regenerated: 'regenerated',
    }

    const timeText = processingTime ? ` (${(processingTime / 1000).toFixed(1)}s)` : ''
    return `<@${userId}> ${typeEmojis[type]} **Image ${typeLabels[type]} successfully!**${timeText}\n**${contextLabel}:** ${prompt}`
  }

  /**
   * Build error message
   */
  private buildErrorMessage(
    userId: string,
    errorMessage: string,
    contextLabel: string,
    prompt: string
  ): string {
    return `<@${userId}> ❌ ${errorMessage}\n**${contextLabel}:** ${prompt}`
  }
}

/**
 * Factory functions for backward compatibility with existing utils/imageHelpers.ts
 */
export class ResponseBuilderFactory {
  /**
   * Creates a Discord attachment from image generation result
   * Maintains compatibility with createImageAttachment from utils/imageHelpers.ts
   */
  static createImageAttachment(
    result: GenerateImageResult,
    username: string,
    prompt: string,
    prefix: string = ''
  ): AttachmentBuilder {
    const builder = new EnhancedResponseBuilder()
    return builder.createImageAttachment(result, username, prompt, { prefix })
  }

  /**
   * Builds a complete success response for image operations
   * Maintains compatibility with buildImageSuccessResponse from utils/imageHelpers.ts
   */
  static buildImageSuccessResponse(
    result: GenerateImageResult,
    username: string,
    prompt: string,
    userId: string,
    type: ImageOperationType,
    contextLabel: string = 'Prompt'
  ): ImageSuccessResponse {
    const builder = new EnhancedResponseBuilder()
    return builder.buildImageSuccessResponse(result, {
      type,
      username,
      prompt,
      userId,
      contextLabel,
    })
  }

  /**
   * Builds an error response for image operations with regenerate button
   * Maintains compatibility with buildImageErrorResponse from utils/imageHelpers.ts
   */
  static buildImageErrorResponse(
    errorMessage: string,
    contextLabel: string,
    prompt: string,
    userId: string
  ): ImageErrorResponse {
    const builder = new EnhancedResponseBuilder()
    return builder.buildImageErrorResponse({
      errorMessage,
      contextLabel,
      prompt,
      userId,
    })
  }
}

// Export the factory functions for easy migration
export const { createImageAttachment, buildImageSuccessResponse, buildImageErrorResponse } =
  ResponseBuilderFactory
