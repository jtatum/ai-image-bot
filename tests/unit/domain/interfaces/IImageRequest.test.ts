import { describe, it, expect } from '@jest/globals'
import { IImageRequest, IValidationResult } from '@/domain/interfaces/IImageRequest.js'

/**
 * Contract tests for IImageRequest implementations
 */
export function testImageRequestContract(createRequest: (overrides?: Partial<IImageRequest>) => IImageRequest) {
  describe('IImageRequest Contract', () => {
    let request: IImageRequest

    beforeEach(() => {
      request = createRequest()
    })

    describe('Required Properties', () => {
      it('should have all required properties', () => {
        expect(request).toHaveProperty('prompt')
        expect(request).toHaveProperty('userId') 
        expect(request).toHaveProperty('requestedAt')
        expect(request.requestedAt).toBeInstanceOf(Date)
      })

      it('should have string prompt and userId', () => {
        expect(typeof request.prompt).toBe('string')
        expect(typeof request.userId).toBe('string')
      })

      it('should have optional guildId', () => {
        if (request.guildId !== undefined) {
          expect(typeof request.guildId).toBe('string')
        }
      })
    })

    describe('validate method', () => {
      it('should return IValidationResult', () => {
        const result = request.validate()
        
        expect(result).toHaveProperty('isValid')
        expect(result).toHaveProperty('errors')
        expect(typeof result.isValid).toBe('boolean')
        expect(Array.isArray(result.errors)).toBe(true)
        
        if (result.warnings) {
          expect(Array.isArray(result.warnings)).toBe(true)
        }
      })

      it('should validate non-empty prompt', () => {
        const emptyPromptRequest = createRequest({ prompt: '' })
        const result = emptyPromptRequest.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(error => error.toLowerCase().includes('prompt'))).toBe(true)
      })

      it('should validate prompt length limits', () => {
        const longPrompt = 'a'.repeat(1500) // This exceeds the 1000 char limit in the actual implementation
        const longPromptRequest = createRequest({ prompt: longPrompt })
        const result = longPromptRequest.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.toLowerCase().includes('exceed') || error.toLowerCase().includes('characters')
        )).toBe(true)
      })

      it('should validate userId presence', () => {
        const noUserIdRequest = createRequest({ userId: '' })
        const result = noUserIdRequest.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.toLowerCase().includes('user') || error.toLowerCase().includes('id')
        )).toBe(true)
      })

      it('should pass validation for valid requests', () => {
        const validRequest = createRequest({
          prompt: 'A valid prompt for image generation',
          userId: '123456789012345678', // Valid Discord user ID format
          guildId: '987654321098765432'  // Valid Discord guild ID format
        })
        const result = validRequest.validate()
        
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('sanitizePrompt method', () => {
      it('should return a string', () => {
        const sanitized = request.sanitizePrompt()
        expect(typeof sanitized).toBe('string')
      })

      it('should handle harmful patterns', () => {
        const harmfulRequest = createRequest({
          prompt: '<script>alert("xss")</script> Generate a nice image'
        })
        const sanitized = harmfulRequest.sanitizePrompt()
        
        // Should remove or escape harmful content
        expect(sanitized).not.toContain('<script>')
        expect(sanitized).not.toContain('alert')
      })

      it('should preserve valid content', () => {
        const goodRequest = createRequest({
          prompt: 'Generate a beautiful landscape with mountains and trees'
        })
        const sanitized = goodRequest.sanitizePrompt()
        
        expect(sanitized).toContain('landscape')
        expect(sanitized).toContain('mountains')
        expect(sanitized).toContain('trees')
      })

      it('should trim whitespace', () => {
        const spacedRequest = createRequest({
          prompt: '  Generate an image with extra spaces  '
        })
        const sanitized = spacedRequest.sanitizePrompt()
        
        expect(sanitized).not.toMatch(/^\s/)
        expect(sanitized).not.toMatch(/\s$/)
        expect(sanitized.length).toBeLessThan(spacedRequest.prompt.length)
      })
    })

    describe('Optional metadata', () => {
      it('should handle metadata when present', () => {
        if (request.metadata) {
          const { metadata } = request
          
          if (metadata.messageId) {
            expect(typeof metadata.messageId).toBe('string')
          }
          
          if (metadata.channelId) {
            expect(typeof metadata.channelId).toBe('string')
          }
          
          if (metadata.type) {
            expect(['generate', 'edit', 'regenerate']).toContain(metadata.type)
          }
          
          if (metadata.source) {
            expect(['command', 'button', 'modal']).toContain(metadata.source)
          }
        }
      })
    })
  })
}

// Mock implementation for testing
class MockImageRequest implements IImageRequest {
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

  constructor(
    prompt: string = 'Generate a test image',
    userId: string = 'test-user-123',
    guildId?: string,
    requestedAt: Date = new Date(),
    metadata?: any
  ) {
    this.prompt = prompt
    this.userId = userId
    this.guildId = guildId
    this.requestedAt = requestedAt
    this.metadata = metadata
  }

  validate(): IValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate prompt
    if (!this.prompt || this.prompt.trim().length === 0) {
      errors.push('Prompt cannot be empty')
    } else if (this.prompt.length > 1000) {
      errors.push('Prompt cannot exceed 1000 characters')
    } else if (this.prompt.length < 3) {
      warnings.push('Very short prompts may produce unexpected results')
    }

    // No additional check needed - length validation already covered above

    // Validate userId
    if (!this.userId || this.userId.trim().length === 0) {
      errors.push('User ID is required')
    }

    // Validate dates
    if (this.requestedAt > new Date()) {
      warnings.push('Request timestamp is in the future')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  sanitizePrompt(): string {
    return this.prompt
      .trim()
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove remaining angle brackets
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }
}

// Test the mock implementation
describe('IImageRequest Interface Tests', () => {
  testImageRequestContract((overrides) => {
    const defaults = {
      prompt: 'Generate a test image',
      userId: '123456789012345678', // Valid Discord user ID format
      guildId: '987654321098765432', // Valid Discord guild ID format
      requestedAt: new Date(),
      metadata: {
        messageId: 'msg123',
        channelId: 'ch123',
        type: 'generate' as const,
        source: 'command' as const
      }
    }
    
    return new MockImageRequest(
      overrides?.prompt ?? defaults.prompt,
      overrides?.userId ?? defaults.userId,
      overrides?.guildId ?? defaults.guildId,
      overrides?.requestedAt ?? defaults.requestedAt,
      overrides?.metadata ?? defaults.metadata
    )
  })
})