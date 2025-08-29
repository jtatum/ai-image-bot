import {
  IImageRequest,
  IValidationResult,
  IImageRequestValidationConfig,
} from '@/domain/interfaces/IImageRequest.js'

/**
 * Default validation configuration for image requests
 */
export const DEFAULT_VALIDATION_CONFIG: IImageRequestValidationConfig = {
  maxPromptLength: 1000,
  minPromptLength: 1,
  allowDMs: true,
  bannedPatterns: [
    /(<script[^>]*>.*?<\/script>)/gi, // Script tags
    /(javascript:|data:)/gi, // JavaScript/data URLs
    /(on\w+\s*=)/gi, // Event handlers
  ],
}

/**
 * Domain entity representing an image generation request
 */
export class ImageRequest implements IImageRequest {
  public prompt: string
  public userId: string
  public guildId?: string
  public requestedAt: Date
  public metadata?: {
    messageId?: string
    channelId?: string
    type?: 'generate' | 'edit' | 'regenerate'
    source?: 'command' | 'button' | 'modal'
  }

  private validationConfig: IImageRequestValidationConfig

  constructor(
    prompt: string,
    userId: string,
    guildId?: string,
    requestedAt: Date = new Date(),
    metadata?: {
      messageId?: string
      channelId?: string
      type?: 'generate' | 'edit' | 'regenerate'
      source?: 'command' | 'button' | 'modal'
    },
    validationConfig: IImageRequestValidationConfig = DEFAULT_VALIDATION_CONFIG
  ) {
    this.prompt = prompt
    this.userId = userId
    this.guildId = guildId
    this.requestedAt = requestedAt
    this.metadata = metadata
    this.validationConfig = validationConfig
  }

  /**
   * Validates the image request against business rules
   */
  validate(): IValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate prompt
    this.validatePrompt(errors, warnings)

    // Validate user ID
    this.validateUserId(errors)

    // Validate guild context
    this.validateGuildContext(errors, warnings)

    // Validate timestamp
    this.validateTimestamp(warnings)

    // Validate metadata
    this.validateMetadata(warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Sanitizes the prompt by removing potentially harmful content
   */
  sanitizePrompt(): string {
    let sanitized = this.prompt.trim()

    // Remove banned patterns
    for (const pattern of this.validationConfig.bannedPatterns || []) {
      sanitized = sanitized.replace(pattern, '')
    }

    // Remove/escape HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '')

    // Remove remaining angle brackets
    sanitized = sanitized.replace(/[<>]/g, '')

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim()

    // Remove control characters except newlines, tabs, and carriage returns
    // Using allowed escape sequences to avoid ESLint no-control-regex rule
    sanitized = sanitized.replace(/[^\x20-\x7E\t\n\r]/g, '')

    return sanitized
  }

  /**
   * Creates a copy of the request with a sanitized prompt
   */
  withSanitizedPrompt(): ImageRequest {
    return new ImageRequest(
      this.sanitizePrompt(),
      this.userId,
      this.guildId,
      this.requestedAt,
      this.metadata,
      this.validationConfig
    )
  }

  /**
   * Creates a copy of the request with updated metadata
   */
  withMetadata(metadata: Partial<NonNullable<ImageRequest['metadata']>>): ImageRequest {
    return new ImageRequest(
      this.prompt,
      this.userId,
      this.guildId,
      this.requestedAt,
      { ...this.metadata, ...metadata },
      this.validationConfig
    )
  }

  private validatePrompt(errors: string[], warnings: string[]): void {
    if (!this.prompt || typeof this.prompt !== 'string') {
      errors.push('Prompt must be a non-empty string')
      return
    }

    const trimmedPrompt = this.prompt.trim()

    if (trimmedPrompt.length === 0) {
      errors.push('Prompt cannot be empty')
      return
    }

    if (trimmedPrompt.length < this.validationConfig.minPromptLength) {
      errors.push(
        `Prompt must be at least ${this.validationConfig.minPromptLength} characters long`
      )
    }

    if (trimmedPrompt.length > this.validationConfig.maxPromptLength) {
      errors.push(`Prompt cannot exceed ${this.validationConfig.maxPromptLength} characters`)
    }

    // Check for banned patterns
    const bannedPatterns = this.validationConfig.bannedPatterns || []
    for (const pattern of bannedPatterns) {
      if (pattern.test(trimmedPrompt)) {
        errors.push('Prompt contains prohibited content')
        break
      }
    }

    // Warnings for potentially problematic content
    if (trimmedPrompt.length < 10) {
      warnings.push('Very short prompts may produce unexpected results')
    }

    if (trimmedPrompt.length > 500) {
      warnings.push('Very long prompts may be truncated by the AI service')
    }

    // Check for excessive repetition
    const words = trimmedPrompt.toLowerCase().split(/\s+/)
    const wordCount = words.reduce(
      (acc, word) => {
        acc[word] = (acc[word] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const maxWordCount = Math.max(...Object.values(wordCount))
    if (maxWordCount > 5) {
      warnings.push('Prompt contains excessive word repetition')
    }
  }

  private validateUserId(errors: string[]): void {
    if (!this.userId || typeof this.userId !== 'string') {
      errors.push('User ID must be a non-empty string')
      return
    }

    const trimmedUserId = this.userId.trim()
    if (trimmedUserId.length === 0) {
      errors.push('User ID cannot be empty')
    }

    // Discord user IDs should be numeric strings
    if (!/^\d+$/.test(trimmedUserId)) {
      errors.push('User ID must be a valid Discord user ID (numeric string)')
    }

    // Discord IDs are typically 17-19 characters long
    if (trimmedUserId.length < 17 || trimmedUserId.length > 19) {
      errors.push('User ID must be a valid Discord user ID length')
    }
  }

  private validateGuildContext(errors: string[], warnings: string[]): void {
    if (!this.validationConfig.allowDMs && !this.guildId) {
      errors.push('Guild ID is required (DM requests not allowed)')
      return
    }

    if (this.guildId) {
      if (typeof this.guildId !== 'string') {
        errors.push('Guild ID must be a string')
        return
      }

      const trimmedGuildId = this.guildId.trim()
      if (trimmedGuildId.length === 0) {
        errors.push('Guild ID cannot be empty when provided')
      }

      // Discord guild IDs should be numeric strings
      if (!/^\d+$/.test(trimmedGuildId)) {
        errors.push('Guild ID must be a valid Discord guild ID (numeric string)')
      }

      // Discord IDs are typically 17-19 characters long
      if (trimmedGuildId.length < 17 || trimmedGuildId.length > 19) {
        errors.push('Guild ID must be a valid Discord guild ID length')
      }
    } else {
      warnings.push('Request is from direct message (no guild context)')
    }
  }

  private validateTimestamp(warnings: string[]): void {
    if (!this.requestedAt || !(this.requestedAt instanceof Date)) {
      // This would be a programming error, but we'll handle it gracefully
      return
    }

    const now = new Date()
    const timeDiff = this.requestedAt.getTime() - now.getTime()

    // Warn if timestamp is more than 1 minute in the future (clock skew)
    if (timeDiff > 60000) {
      warnings.push('Request timestamp is significantly in the future')
    }

    // Warn if timestamp is very old (more than 1 hour)
    if (timeDiff < -3600000) {
      warnings.push('Request timestamp is very old')
    }
  }

  private validateMetadata(warnings: string[]): void {
    if (!this.metadata) {
      return
    }

    const { messageId, channelId, type, source } = this.metadata

    if (messageId && (typeof messageId !== 'string' || messageId.trim().length === 0)) {
      warnings.push('Invalid message ID in metadata')
    }

    if (channelId && (typeof channelId !== 'string' || channelId.trim().length === 0)) {
      warnings.push('Invalid channel ID in metadata')
    }

    if (type && !['generate', 'edit', 'regenerate'].includes(type)) {
      warnings.push('Invalid request type in metadata')
    }

    if (source && !['command', 'button', 'modal'].includes(source)) {
      warnings.push('Invalid request source in metadata')
    }
  }
}
