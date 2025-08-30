import { z } from 'zod'
import logger from '@/infrastructure/monitoring/Logger.js'

export class ValidationUtils {
  // Discord-specific validation schemas
  static readonly discordId = z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID format')
  static readonly discordTag = z.string().regex(/^.{1,32}#\d{4}$/, 'Invalid Discord tag format')
  static readonly channelMention = z
    .string()
    .regex(/^<#\d{17,19}>$/, 'Invalid channel mention format')
  static readonly userMention = z.string().regex(/^<@!?\d{17,19}>$/, 'Invalid user mention format')
  static readonly roleMention = z.string().regex(/^<@&\d{17,19}>$/, 'Invalid role mention format')

  // Content validation schemas
  static readonly safeString = z
    .string()
    .min(1, 'String cannot be empty')
    .max(2000, 'String too long (max 2000 characters)')
    .refine(
      str => !this.containsMaliciousContent(str),
      'Content contains potentially harmful elements'
    )

  static readonly embedTitle = z
    .string()
    .min(1)
    .max(256, 'Embed title too long (max 256 characters)')
  static readonly embedDescription = z
    .string()
    .min(1)
    .max(4096, 'Embed description too long (max 4096 characters)')
  static readonly embedFieldName = z
    .string()
    .min(1)
    .max(256, 'Embed field name too long (max 256 characters)')
  static readonly embedFieldValue = z
    .string()
    .min(1)
    .max(1024, 'Embed field value too long (max 1024 characters)')

  // URL validation
  static readonly httpUrl = z
    .string()
    .url()
    .refine(
      url => url.startsWith('https://') || url.startsWith('http://'),
      'URL must use HTTP or HTTPS protocol'
    )

  static readonly httpsUrl = z
    .string()
    .url()
    .refine(url => url.startsWith('https://'), 'URL must use HTTPS protocol')

  // Numeric validations
  static readonly positiveInteger = z.number().int().positive()
  static readonly nonNegativeInteger = z.number().int().min(0)
  static readonly percentage = z.number().min(0).max(100)

  static containsMaliciousContent(content: string): boolean {
    const suspiciousPatterns = [
      // JavaScript injection patterns
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,

      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,

      // XSS patterns
      /<iframe\b[^>]*>/i,
      /<object\b[^>]*>/i,
      /<embed\b[^>]*>/i,
      /<form\b[^>]*>/i,

      // Discord token patterns
      /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/,
      /mfa\.[\w-]{84}/,

      // Common malicious URLs
      /bit\.ly|tinyurl|shorturl|t\.co|goo\.gl/i,

      // Potential phishing indicators
      /discord\.gg\/[a-zA-Z0-9]+/i, // Discord invite links (might want to allow these)
      /free.*nitro/i,
    ]

    return suspiciousPatterns.some(pattern => pattern.test(content))
  }

  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .slice(0, 2000) // Truncate to safe length
  }

  static validateAndSanitize<T>(
    data: unknown,
    schema: z.ZodSchema<T>,
    sanitize: boolean = true
  ): { success: boolean; data?: T; error?: string } {
    try {
      let processedData = data

      // Apply sanitization if requested and data is a string
      if (sanitize && typeof data === 'string') {
        processedData = this.sanitizeInput(data)
      }

      const result = schema.parse(processedData)
      return { success: true, data: result }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.issues
          .map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
          .join(', ')
        logger.warn('Validation error:', errorMessage)
        return { success: false, error: errorMessage }
      }

      logger.error('Unexpected validation error:', error)
      return { success: false, error: 'Validation failed' }
    }
  }

  static isValidDiscordSnowflake(id: string): boolean {
    return /^\d{17,19}$/.test(id)
  }

  static extractDiscordId(mention: string): string | null {
    const match = mention.match(/\d{17,19}/)
    return match ? match[0] : null
  }

  static validateCommandInput(input: {
    content?: string
    userId?: string
    channelId?: string
    guildId?: string
    url?: string
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (input.content && this.containsMaliciousContent(input.content)) {
      errors.push('Content contains potentially harmful elements')
    }

    if (input.userId && !this.isValidDiscordSnowflake(input.userId)) {
      errors.push('Invalid user ID format')
    }

    if (input.channelId && !this.isValidDiscordSnowflake(input.channelId)) {
      errors.push('Invalid channel ID format')
    }

    if (input.guildId && !this.isValidDiscordSnowflake(input.guildId)) {
      errors.push('Invalid guild ID format')
    }

    if (input.url) {
      try {
        new URL(input.url)
        if (!input.url.startsWith('https://')) {
          errors.push('URL must use HTTPS protocol')
        }
      } catch {
        errors.push('Invalid URL format')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
