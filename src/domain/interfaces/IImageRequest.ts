/**
 * Result of domain validation operations
 */
export interface IValidationResult {
  /** Whether the validation passed */
  isValid: boolean

  /** Array of validation error messages */
  errors: string[]

  /** Array of validation warnings (non-blocking) */
  warnings?: string[]
}

/**
 * Interface for image generation requests
 */
export interface IImageRequest {
  /** Text prompt describing the desired image */
  prompt: string

  /** ID of the user making the request */
  userId: string

  /** Optional guild/server ID where request was made */
  guildId?: string

  /** Timestamp when the request was created */
  requestedAt: Date

  /** Optional metadata about the request */
  metadata?: {
    /** Original message ID if applicable */
    messageId?: string

    /** Channel ID where request was made */
    channelId?: string

    /** Request type (generate, edit, regenerate) */
    type?: 'generate' | 'edit' | 'regenerate'

    /** Source of the request (command, button, modal) */
    source?: 'command' | 'button' | 'modal'
  }

  /**
   * Validate the image request
   * @returns Validation result with any errors or warnings
   */
  validate(): IValidationResult

  /**
   * Sanitize the prompt by removing potentially harmful content
   * @returns Sanitized version of the prompt
   */
  sanitizePrompt(): string
}

/**
 * Configuration for image request validation
 */
export interface IImageRequestValidationConfig {
  /** Maximum allowed prompt length */
  maxPromptLength: number

  /** Minimum required prompt length */
  minPromptLength: number

  /** Patterns to reject in prompts */
  bannedPatterns?: RegExp[]

  /** Whether to allow empty guild ID (DM requests) */
  allowDMs: boolean
}
