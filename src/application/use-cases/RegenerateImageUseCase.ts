import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { IValidationResult } from '@/domain/interfaces/IImageRequest.js'
import { GenerateImageUseCase, GenerateImageUseCaseResult } from './GenerateImageUseCase.js'
import { EditImageUseCase, EditImageUseCaseResult, EditImageInput } from './EditImageUseCase.js'
import { Buffer } from 'node:buffer'

/**
 * Input for regenerating an image (either generate or edit)
 */
export type RegenerateImageInput =
  | {
      type: 'generate'
      request: ImageRequest
    }
  | {
      type: 'edit'
      request: ImageRequest
      imageBuffer: Buffer
      mimeType?: string
    }

/**
 * Result of the Regenerate Image use case
 */
export interface RegenerateImageUseCaseResult {
  /** Whether the regeneration was successful */
  success: boolean

  /** The regenerated image result if successful */
  imageResult?: IImageResult

  /** Validation result from the request */
  validationResult: IValidationResult

  /** Error message if regeneration failed */
  error?: string

  /** The processed request that was used for regeneration */
  processedRequest: ImageRequest

  /** Type of operation that was regenerated */
  operationType: 'generate' | 'edit'

  /** Attempt number for this regeneration */
  attemptNumber: number

  /** History of previous attempts (error messages) */
  previousAttempts: string[]

  /** Additional metadata about the regeneration */
  regenerationMetadata?: {
    /** Original image info for edit operations */
    originalImageInfo?: {
      bufferSize: number
      mimeType: string
    }
    /** Whether this was triggered by a user action or automatic retry */
    trigger: 'user' | 'automatic'
    /** Maximum number of retries allowed */
    maxRetries: number
  }
}

/**
 * Configuration for regeneration behavior
 */
export interface RegenerateImageConfig {
  /** Maximum number of retry attempts */
  maxRetries: number

  /** Whether to automatically retry on certain types of failures */
  enableAutoRetry: boolean

  /** Types of errors that should trigger automatic retry */
  autoRetryErrorTypes: string[]

  /** Delay between retry attempts in milliseconds */
  retryDelayMs: number
}

/**
 * Default configuration for image regeneration
 */
export const DEFAULT_REGENERATE_CONFIG: RegenerateImageConfig = {
  maxRetries: 3,
  enableAutoRetry: true,
  autoRetryErrorTypes: [
    'timeout',
    'network',
    'rate_limit',
    'service_unavailable',
    'internal_error',
  ],
  retryDelayMs: 1000,
}

/**
 * Use case for regenerating images (retry mechanism for failed generations/edits)
 * Handles retry logic, attempt tracking, and failure analysis
 */
export class RegenerateImageUseCase {
  private readonly generateUseCase: GenerateImageUseCase
  private readonly editUseCase: EditImageUseCase
  private readonly config: RegenerateImageConfig

  constructor(
    imageGenerator: IImageGenerator,
    config: RegenerateImageConfig = DEFAULT_REGENERATE_CONFIG
  ) {
    this.generateUseCase = new GenerateImageUseCase(imageGenerator)
    this.editUseCase = new EditImageUseCase(imageGenerator)
    this.config = config
  }

  /**
   * Execute the image regeneration use case
   * @param input The regeneration input
   * @param attemptNumber Current attempt number (starts at 1)
   * @param previousAttempts Array of previous error messages
   * @returns Promise resolving to the regeneration result
   */
  async execute(
    input: RegenerateImageInput,
    attemptNumber: number = 1,
    previousAttempts: string[] = []
  ): Promise<RegenerateImageUseCaseResult> {
    // Step 1: Validate attempt number
    if (attemptNumber > this.config.maxRetries + 1) {
      return this.createFailureResult(
        input,
        `Maximum retry attempts exceeded (${this.config.maxRetries})`,
        attemptNumber,
        previousAttempts
      )
    }

    // Step 2: Update request metadata for regeneration
    const updatedRequest = input.request.withMetadata({
      type: 'regenerate',
      source: attemptNumber === 1 ? 'button' : 'button', // Retries are still from button interaction
    })

    let result: GenerateImageUseCaseResult | EditImageUseCaseResult

    try {
      // Step 3: Execute the appropriate operation
      if (input.type === 'generate') {
        result = await this.generateUseCase.execute(updatedRequest)
      } else {
        const editInput: EditImageInput = {
          request: updatedRequest,
          imageBuffer: input.imageBuffer,
          mimeType: input.mimeType,
        }
        result = await this.editUseCase.execute(editInput)
      }

      // Step 4: Check if the operation was successful
      if (result.success) {
        return {
          success: true,
          imageResult: result.imageResult,
          validationResult: result.validationResult,
          processedRequest: result.processedRequest,
          operationType: input.type,
          attemptNumber,
          previousAttempts,
          regenerationMetadata: {
            originalImageInfo:
              input.type === 'edit'
                ? {
                    bufferSize: input.imageBuffer.length,
                    mimeType: input.mimeType || 'image/png',
                  }
                : undefined,
            trigger: attemptNumber === 1 ? 'user' : 'automatic',
            maxRetries: this.config.maxRetries,
          },
        }
      }

      // Step 5: Handle failure - decide whether to retry
      const errorMessage = result.error || 'Unknown error occurred'
      const newPreviousAttempts = [...previousAttempts, errorMessage]

      const shouldRetry = this.shouldRetry(errorMessage, attemptNumber)

      if (shouldRetry) {
        // Step 6: Wait before retrying
        if (this.config.retryDelayMs > 0) {
          await this.delay(this.config.retryDelayMs)
        }

        // Step 7: Recursive retry
        return await this.execute(input, attemptNumber + 1, newPreviousAttempts)
      }

      // Step 8: No more retries, return final failure
      return this.createFailureResult(
        input,
        errorMessage,
        attemptNumber,
        newPreviousAttempts,
        result.validationResult,
        result.processedRequest
      )
    } catch (error) {
      // Step 9: Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred'
      const newPreviousAttempts = [...previousAttempts, errorMessage]

      const shouldRetry = this.shouldRetry(errorMessage, attemptNumber)

      if (shouldRetry) {
        if (this.config.retryDelayMs > 0) {
          await this.delay(this.config.retryDelayMs)
        }
        return await this.execute(input, attemptNumber + 1, newPreviousAttempts)
      }

      return this.createFailureResult(input, errorMessage, attemptNumber, newPreviousAttempts)
    }
  }

  /**
   * Determine whether to retry based on error type and attempt number
   */
  private shouldRetry(errorMessage: string, attemptNumber: number): boolean {
    // Don't retry if we've exceeded the maximum attempts
    if (attemptNumber >= this.config.maxRetries + 1) {
      return false
    }

    // Don't retry if auto-retry is disabled
    if (!this.config.enableAutoRetry) {
      return false
    }

    // Check if this error type should trigger a retry
    const errorLower = errorMessage.toLowerCase()
    return this.config.autoRetryErrorTypes.some(errorType =>
      errorLower.includes(errorType.toLowerCase())
    )
  }

  /**
   * Create a failure result object
   */
  private createFailureResult(
    input: RegenerateImageInput,
    errorMessage: string,
    attemptNumber: number,
    previousAttempts: string[],
    validationResult?: IValidationResult,
    processedRequest?: ImageRequest
  ): RegenerateImageUseCaseResult {
    return {
      success: false,
      validationResult: validationResult || {
        isValid: true,
        errors: [],
      },
      error: errorMessage,
      processedRequest: processedRequest || input.request,
      operationType: input.type,
      attemptNumber,
      previousAttempts,
      regenerationMetadata: {
        originalImageInfo:
          input.type === 'edit'
            ? {
                bufferSize: input.imageBuffer.length,
                mimeType: input.mimeType || 'image/png',
              }
            : undefined,
        trigger: attemptNumber === 1 ? 'user' : 'automatic',
        maxRetries: this.config.maxRetries,
      },
    }
  }

  /**
   * Delay execution for the specified number of milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get the current configuration
   */
  getConfig(): RegenerateImageConfig {
    return { ...this.config }
  }

  /**
   * Update the configuration
   */
  updateConfig(newConfig: Partial<RegenerateImageConfig>): void {
    Object.assign(this.config, newConfig)
  }

  /**
   * Check if the underlying services are available
   */
  isAvailable(): boolean {
    return this.generateUseCase.isAvailable()
  }

  /**
   * Get information about the underlying image generator
   */
  getGeneratorInfo() {
    return this.generateUseCase.getGeneratorInfo()
  }
}
