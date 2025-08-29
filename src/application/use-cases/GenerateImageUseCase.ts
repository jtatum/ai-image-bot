import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { IValidationResult } from '@/domain/interfaces/IImageRequest.js'

/**
 * Result of the Generate Image use case
 */
export interface GenerateImageUseCaseResult {
  /** Whether the generation was successful */
  success: boolean

  /** The generated image result if successful */
  imageResult?: IImageResult

  /** Validation result from the request */
  validationResult: IValidationResult

  /** Error message if generation failed */
  error?: string

  /** The processed request that was used for generation */
  processedRequest: ImageRequest
}

/**
 * Use case for generating images from text prompts
 * Handles the complete business workflow including validation, sanitization, and generation
 */
export class GenerateImageUseCase {
  constructor(private readonly imageGenerator: IImageGenerator) {}

  /**
   * Execute the image generation use case
   * @param request The image request to process
   * @returns Promise resolving to the use case result
   */
  async execute(request: ImageRequest): Promise<GenerateImageUseCaseResult> {
    // Step 1: Validate the request
    const validationResult = request.validate()

    if (!validationResult.isValid) {
      return {
        success: false,
        validationResult,
        error: `Request validation failed: ${validationResult.errors.join(', ')}`,
        processedRequest: request,
      }
    }

    // Step 2: Check if image generator is available
    if (!this.imageGenerator.isAvailable()) {
      return {
        success: false,
        validationResult,
        error: 'Image generation service is not available',
        processedRequest: request,
      }
    }

    // Step 3: Sanitize the request
    const sanitizedRequest = request.withSanitizedPrompt()

    // Step 4: Update metadata to reflect this is a generate operation
    const processedRequest = sanitizedRequest.withMetadata({
      type: 'generate',
    })

    try {
      // Step 5: Generate the image
      const imageResult = await this.imageGenerator.generateImage(processedRequest.prompt)

      // Step 6: Return the result
      return {
        success: imageResult.success,
        imageResult,
        validationResult,
        error: imageResult.success ? undefined : imageResult.error,
        processedRequest,
      }
    } catch (error) {
      // Step 7: Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        success: false,
        validationResult,
        error: `Image generation failed: ${errorMessage}`,
        processedRequest,
      }
    }
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
