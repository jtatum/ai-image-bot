import { describe, it, expect, beforeEach } from '@jest/globals'
import { ImageRequest, DEFAULT_VALIDATION_CONFIG } from '@/domain/entities/ImageRequest.js'
import { testImageRequestContract } from '../interfaces/IImageRequest.test.js'

describe('ImageRequest Entity', () => {
  // Test the interface contract
  testImageRequestContract((overrides) => {
    return new ImageRequest(
      overrides?.prompt ?? 'Test prompt',
      overrides?.userId ?? '123456789012345678',
      overrides?.guildId ?? '987654321098765432',
      overrides?.requestedAt ?? new Date(),
      overrides?.metadata
    )
  })

  describe('Constructor', () => {
    it('should create instance with required parameters', () => {
      const request = new ImageRequest('Test prompt', '123456789012345678')
      
      expect(request.prompt).toBe('Test prompt')
      expect(request.userId).toBe('123456789012345678')
      expect(request.guildId).toBeUndefined()
      expect(request.requestedAt).toBeInstanceOf(Date)
      expect(request.metadata).toBeUndefined()
    })

    it('should create instance with all parameters', () => {
      const now = new Date()
      const metadata = {
        messageId: 'msg123',
        channelId: 'ch123',
        type: 'generate' as const,
        source: 'command' as const
      }
      
      const request = new ImageRequest(
        'Full test prompt',
        '123456789012345678',
        '987654321098765432',
        now,
        metadata
      )
      
      expect(request.prompt).toBe('Full test prompt')
      expect(request.userId).toBe('123456789012345678')
      expect(request.guildId).toBe('987654321098765432')
      expect(request.requestedAt).toBe(now)
      expect(request.metadata).toEqual(metadata)
    })
  })

  describe('Validation', () => {
    let validRequest: ImageRequest

    beforeEach(() => {
      validRequest = new ImageRequest(
        'A valid test prompt for image generation',
        '123456789012345678',
        '987654321098765432'
      )
    })

    describe('Prompt Validation', () => {
      it('should pass validation for valid prompts', () => {
        const result = validRequest.validate()
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should fail for empty prompts', () => {
        const request = new ImageRequest('', '123456789012345678')
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Prompt must be a non-empty string')
      })

      it('should fail for whitespace-only prompts', () => {
        const request = new ImageRequest('   \t\n   ', '123456789012345678')
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Prompt cannot be empty')
      })

      it('should fail for prompts exceeding max length', () => {
        const longPrompt = 'a'.repeat(1001)
        const request = new ImageRequest(longPrompt, '123456789012345678')
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('1000 characters')
        )).toBe(true)
      })

      it('should fail for prompts below min length', () => {
        const config = { ...DEFAULT_VALIDATION_CONFIG, minPromptLength: 5 }
        const request = new ImageRequest(
          'hi',
          '123456789012345678',
          undefined,
          new Date(),
          undefined,
          config
        )
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('at least 5 characters')
        )).toBe(true)
      })

      it('should fail for prompts with banned patterns', () => {
        const request = new ImageRequest(
          '<script>alert("xss")</script>Generate image',
          '123456789012345678'
        )
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('prohibited content')
        )).toBe(true)
      })

      it('should warn about very short prompts', () => {
        const request = new ImageRequest('cat', '123456789012345678')
        const result = request.validate()
        
        expect(result.isValid).toBe(true) // Not invalid, just warned
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.some(warning => 
          warning.includes('short prompts')
        )).toBe(true)
      })

      it('should warn about very long prompts', () => {
        const longButValidPrompt = 'a'.repeat(600)
        const request = new ImageRequest(longButValidPrompt, '123456789012345678')
        const result = request.validate()
        
        expect(result.isValid).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.some(warning => 
          warning.includes('long prompts')
        )).toBe(true)
      })

      it('should warn about excessive word repetition', () => {
        const repetitivePrompt = 'cat cat cat cat cat cat cat dog'
        const request = new ImageRequest(repetitivePrompt, '123456789012345678')
        const result = request.validate()
        
        expect(result.isValid).toBe(true)
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.some(warning => 
          warning.includes('repetition')
        )).toBe(true)
      })
    })

    describe('User ID Validation', () => {
      it('should fail for empty user ID', () => {
        const request = new ImageRequest('Test prompt', '')
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('User ID must be a non-empty string') || error.includes('User ID cannot be empty')
        )).toBe(true)
      })

      it('should fail for non-numeric user ID', () => {
        const request = new ImageRequest('Test prompt', 'invalid-user-id')
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('valid Discord user ID')
        )).toBe(true)
      })

      it('should fail for user ID with wrong length', () => {
        const request = new ImageRequest('Test prompt', '123') // Too short
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('valid Discord user ID length')
        )).toBe(true)
      })

      it('should pass for valid Discord user ID', () => {
        const request = new ImageRequest('Test prompt', '123456789012345678')
        const result = request.validate()
        
        // Should not have user ID related errors
        expect(result.errors.every(error => 
          !error.toLowerCase().includes('user id')
        )).toBe(true)
      })
    })

    describe('Guild Context Validation', () => {
      it('should allow DM requests by default', () => {
        const request = new ImageRequest('Test prompt', '123456789012345678')
        const result = request.validate()
        
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.some(warning => 
          warning.includes('direct message')
        )).toBe(true)
      })

      it('should reject DM requests when not allowed', () => {
        const config = { ...DEFAULT_VALIDATION_CONFIG, allowDMs: false }
        const request = new ImageRequest(
          'Test prompt',
          '123456789012345678',
          undefined,
          new Date(),
          undefined,
          config
        )
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('Guild ID is required')
        )).toBe(true)
      })

      it('should validate guild ID format when provided', () => {
        const request = new ImageRequest(
          'Test prompt',
          '123456789012345678',
          'invalid-guild'
        )
        const result = request.validate()
        
        expect(result.isValid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('valid Discord guild ID')
        )).toBe(true)
      })
    })

    describe('Timestamp Validation', () => {
      it('should warn about future timestamps', () => {
        const futureDate = new Date(Date.now() + 120000) // 2 minutes in future
        const request = new ImageRequest(
          'Test prompt',
          '123456789012345678',
          '987654321098765432',
          futureDate
        )
        const result = request.validate()
        
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.some(warning => 
          warning.includes('future')
        )).toBe(true)
      })

      it('should warn about very old timestamps', () => {
        const oldDate = new Date(Date.now() - 7200000) // 2 hours ago
        const request = new ImageRequest(
          'Test prompt',
          '123456789012345678',
          '987654321098765432',
          oldDate
        )
        const result = request.validate()
        
        expect(result.warnings).toBeDefined()
        expect(result.warnings!.some(warning => 
          warning.includes('very old')
        )).toBe(true)
      })
    })
  })

  describe('Prompt Sanitization', () => {
    it('should remove script tags', () => {
      const request = new ImageRequest(
        '<script>alert("xss")</script>Generate a cat image',
        '123456789012345678'
      )
      const sanitized = request.sanitizePrompt()
      
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
      expect(sanitized).toContain('Generate a cat image')
    })

    it('should remove HTML tags', () => {
      const request = new ImageRequest(
        '<div>Generate a <strong>beautiful</strong> image</div>',
        '123456789012345678'
      )
      const sanitized = request.sanitizePrompt()
      
      expect(sanitized).not.toContain('<div>')
      expect(sanitized).not.toContain('<strong>')
      expect(sanitized).toBe('Generate a beautiful image')
    })

    it('should remove angle brackets', () => {
      const request = new ImageRequest(
        'Generate image with some brackets < and >',
        '123456789012345678'
      )
      const sanitized = request.sanitizePrompt()
      
      expect(sanitized).not.toContain('<')
      expect(sanitized).not.toContain('>')
      expect(sanitized).toContain('with')
      expect(sanitized).toContain('brackets')
    })

    it('should normalize whitespace', () => {
      const request = new ImageRequest(
        '  Generate   a    cat   image  \n\t  ',
        '123456789012345678'
      )
      const sanitized = request.sanitizePrompt()
      
      expect(sanitized).toBe('Generate a cat image')
    })

    it('should remove control characters', () => {
      const request = new ImageRequest(
        'Generate\x00\x01\x02 a cat image',
        '123456789012345678'
      )
      const sanitized = request.sanitizePrompt()
      
      expect(sanitized).toBe('Generate a cat image')
    })

    it('should handle empty result after sanitization', () => {
      const request = new ImageRequest(
        '<script></script>',
        '123456789012345678'
      )
      const sanitized = request.sanitizePrompt()
      
      expect(sanitized).toBe('')
    })
  })

  describe('Helper Methods', () => {
    let originalRequest: ImageRequest

    beforeEach(() => {
      originalRequest = new ImageRequest(
        '  Generate <script>hack</script> a cat image  ',
        '123456789012345678',
        '987654321098765432',
        new Date(),
        { type: 'generate', source: 'command' }
      )
    })

    describe('withSanitizedPrompt', () => {
      it('should return new instance with sanitized prompt', () => {
        const sanitizedRequest = originalRequest.withSanitizedPrompt()
        
        expect(sanitizedRequest).not.toBe(originalRequest) // New instance
        expect(sanitizedRequest.prompt).toBe('Generate a cat image')
        expect(sanitizedRequest.userId).toBe(originalRequest.userId)
        expect(sanitizedRequest.guildId).toBe(originalRequest.guildId)
        expect(sanitizedRequest.requestedAt).toBe(originalRequest.requestedAt)
        expect(sanitizedRequest.metadata).toEqual(originalRequest.metadata)
      })
    })

    describe('withMetadata', () => {
      it('should return new instance with updated metadata', () => {
        const newMetadata = { messageId: 'msg456', channelId: 'ch456' }
        const updatedRequest = originalRequest.withMetadata(newMetadata)
        
        expect(updatedRequest).not.toBe(originalRequest) // New instance
        expect(updatedRequest.metadata).toEqual({
          type: 'generate',
          source: 'command',
          messageId: 'msg456',
          channelId: 'ch456'
        })
        expect(updatedRequest.prompt).toBe(originalRequest.prompt)
        expect(updatedRequest.userId).toBe(originalRequest.userId)
      })

      it('should handle undefined original metadata', () => {
        const requestWithoutMetadata = new ImageRequest(
          'Test prompt',
          '123456789012345678'
        )
        const updatedRequest = requestWithoutMetadata.withMetadata({
          type: 'edit'
        })
        
        expect(updatedRequest.metadata).toEqual({ type: 'edit' })
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-string prompt gracefully', () => {
      // This would be a TypeScript error, but let's test runtime behavior
      const request = new ImageRequest(
        null as any,
        '123456789012345678'
      )
      const result = request.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(error => 
        error.includes('non-empty string')
      )).toBe(true)
    })

    it('should handle invalid date in requestedAt', () => {
      const request = new ImageRequest(
        'Test prompt',
        '123456789012345678',
        '987654321098765432',
        new Date('invalid') // Invalid date
      )
      
      // Should not throw error during validation
      expect(() => request.validate()).not.toThrow()
    })

    it('should handle complex metadata validation', () => {
      const request = new ImageRequest(
        'Test prompt',
        '123456789012345678',
        '987654321098765432',
        new Date(),
        {
          messageId: '',
          channelId: null as any,
          type: 'invalid-type' as any,
          source: 'invalid-source' as any
        }
      )
      const result = request.validate()
      
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.length).toBeGreaterThan(0)
    })
  })
})