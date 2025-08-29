import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { IValidationResult } from '@/domain/interfaces/IImageRequest.js'
import { Buffer } from 'node:buffer'

/**
 * Input parameters for the Edit Image use case
 */
export interface EditImageInput {
  /** The image request containing the edit prompt */
  request: ImageRequest

  /** Buffer containing the original image to edit */
  imageBuffer: Buffer

  /** MIME type of the original image (defaults to 'image/png') */
  mimeType?: string
}

/**
 * Result of the Edit Image use case
 */
export interface EditImageUseCaseResult {
  /** Whether the edit was successful */
  success: boolean

  /** The edited image result if successful */
  imageResult?: IImageResult

  /** Validation result from the request */
  validationResult: IValidationResult

  /** Error message if edit failed */
  error?: string

  /** The processed request that was used for editing */
  processedRequest: ImageRequest

  /** Information about the original image */
  originalImageInfo: {
    bufferSize: number
    mimeType: string
  }
}

/**
 * Use case for editing existing images based on text prompts
 * Handles the complete business workflow including validation, sanitization, and editing
 */
export class EditImageUseCase {
  constructor(private readonly imageGenerator: IImageGenerator) {}

  /**
   * Execute the image editing use case
   * @param input The edit input containing request and image data
   * @returns Promise resolving to the use case result
   */
  async execute(input: EditImageInput): Promise<EditImageUseCaseResult> {
    const { request, imageBuffer, mimeType = 'image/png' } = input

    // Step 1: Validate the request
    const validationResult = request.validate()

    if (!validationResult.isValid) {
      return {
        success: false,
        validationResult,
        error: `Request validation failed: ${validationResult.errors.join(', ')}`,
        processedRequest: request,
        originalImageInfo: {
          bufferSize: imageBuffer.length,
          mimeType,
        },
      }
    }

    // Step 2: Validate the image buffer
    const imageValidationError = this.validateImageBuffer(imageBuffer, mimeType)
    if (imageValidationError) {
      return {
        success: false,
        validationResult,
        error: imageValidationError,
        processedRequest: request,
        originalImageInfo: {
          bufferSize: imageBuffer.length,
          mimeType,
        },
      }
    }

    // Step 3: Check if image generator is available
    if (!this.imageGenerator.isAvailable()) {
      return {
        success: false,
        validationResult,
        error: 'Image generation service is not available',
        processedRequest: request,
        originalImageInfo: {
          bufferSize: imageBuffer.length,
          mimeType,
        },
      }
    }

    // Step 4: Sanitize the request
    const sanitizedRequest = request.withSanitizedPrompt()

    // Step 5: Update metadata to reflect this is an edit operation
    const processedRequest = sanitizedRequest.withMetadata({
      type: 'edit',
    })

    try {
      // Step 6: Edit the image
      const imageResult = await this.imageGenerator.editImage(
        processedRequest.prompt,
        imageBuffer,
        mimeType
      )

      // Step 7: Return the result
      return {
        success: imageResult.success,
        imageResult,
        validationResult,
        error: imageResult.success ? undefined : imageResult.error,
        processedRequest,
        originalImageInfo: {
          bufferSize: imageBuffer.length,
          mimeType,
        },
      }
    } catch (error) {
      // Step 8: Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        success: false,
        validationResult,
        error: `Image editing failed: ${errorMessage}`,
        processedRequest,
        originalImageInfo: {
          bufferSize: imageBuffer.length,
          mimeType,
        },
      }
    }
  }

  /**
   * Validate the image buffer and MIME type
   * @param buffer The image buffer to validate
   * @param mimeType The MIME type to validate
   * @returns Error message if validation fails, undefined if valid
   */
  private validateImageBuffer(buffer: Buffer, mimeType: string): string | undefined {
    // Check if buffer is valid
    if (!Buffer.isBuffer(buffer)) {
      return 'Invalid image buffer: not a Buffer instance'
    }

    if (buffer.length === 0) {
      return 'Invalid image buffer: buffer is empty'
    }

    // Check buffer size limits (e.g., Discord has file size limits)
    const maxSizeBytes = 25 * 1024 * 1024 // 25MB limit
    if (buffer.length > maxSizeBytes) {
      return `Image too large: ${buffer.length} bytes exceeds ${maxSizeBytes} bytes limit`
    }

    // Validate MIME type
    const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']

    if (!supportedMimeTypes.includes(mimeType.toLowerCase())) {
      return `Unsupported MIME type: ${mimeType}. Supported types: ${supportedMimeTypes.join(', ')}`
    }

    // Basic buffer header validation
    const validationError = this.validateImageHeaders(buffer, mimeType)
    if (validationError) {
      return validationError
    }

    return undefined
  }

  /**
   * Validate image buffer headers to ensure the buffer matches the claimed MIME type
   * @param buffer The image buffer
   * @param mimeType The claimed MIME type
   * @returns Error message if validation fails, undefined if valid
   */
  private validateImageHeaders(buffer: Buffer, mimeType: string): string | undefined {
    if (buffer.length < 8) {
      return 'Image buffer too small to contain valid image headers'
    }

    const header = buffer.subarray(0, 8)

    switch (mimeType.toLowerCase()) {
      case 'image/png':
        // PNG header: 89 50 4E 47 0D 0A 1A 0A
        if (!header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
          return 'Buffer does not contain a valid PNG header'
        }
        break

      case 'image/jpeg':
      case 'image/jpg':
        // JPEG header starts with FF D8
        if (header[0] !== 0xff || header[1] !== 0xd8) {
          return 'Buffer does not contain a valid JPEG header'
        }
        break

      case 'image/webp':
        // WebP header: "RIFF" followed by "WEBP" at offset 8
        if (
          !header.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) ||
          (buffer.length >= 12 && !buffer.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii')))
        ) {
          return 'Buffer does not contain a valid WebP header'
        }
        break

      case 'image/gif': {
        // GIF header: "GIF87a" or "GIF89a"
        const gifHeader87 = Buffer.from('GIF87a', 'ascii')
        const gifHeader89 = Buffer.from('GIF89a', 'ascii')
        if (
          !header.subarray(0, 6).equals(gifHeader87) &&
          !header.subarray(0, 6).equals(gifHeader89)
        ) {
          return 'Buffer does not contain a valid GIF header'
        }
        break
      }
    }

    return undefined
  }

  /**
   * Get information about the underlying image generator
   */
  getGeneratorInfo() {
    return this.imageGenerator.getInfo()
  }

  /**
   * Check if the image generator is available
   */
  isAvailable(): boolean {
    return this.imageGenerator.isAvailable()
  }
}
