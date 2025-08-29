import { Buffer } from 'node:buffer'

/**
 * Result of an image generation or editing operation
 */
export interface IImageResult {
  /** Whether the operation was successful */
  success: boolean

  /** The generated/edited image buffer */
  buffer?: Buffer

  /** Error message if operation failed */
  error?: string

  /** Additional metadata about the operation */
  metadata?: {
    /** AI model used for generation */
    model?: string

    /** When the image was generated */
    generatedAt?: Date

    /** Time taken to process the request in milliseconds */
    processingTime?: number

    /** Safety filtering results, if applicable */
    safetyFiltering?: {
      blocked: boolean
      reason?: string
      categories?: string[]
    }
  }
}

/**
 * Interface for AI image generation providers
 */
export interface IImageGenerator {
  /**
   * Check if the image generator is available and configured
   */
  isAvailable(): boolean

  /**
   * Generate a new image from a text prompt
   * @param prompt Text description of the desired image
   * @returns Promise resolving to image result
   */
  generateImage(prompt: string): Promise<IImageResult>

  /**
   * Edit an existing image based on a text prompt
   * @param prompt Text description of desired changes
   * @param imageBuffer Buffer containing the original image
   * @param mimeType MIME type of the original image (defaults to 'image/png')
   * @returns Promise resolving to edited image result
   */
  editImage(prompt: string, imageBuffer: Buffer, mimeType?: string): Promise<IImageResult>

  /**
   * Get information about the image generator
   */
  getInfo(): {
    name: string
    version?: string
    supportedFormats?: string[]
    maxPromptLength?: number
  }
}
