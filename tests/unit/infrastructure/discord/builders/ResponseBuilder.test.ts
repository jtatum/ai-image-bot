import {
  EnhancedResponseBuilder,
  ResponseBuilderFactory,
  createImageAttachment,
  buildImageSuccessResponse,
  buildImageErrorResponse,
  ImageOperationType,
  SuccessResponseOptions,
  ErrorResponseOptions,
  AttachmentOptions
} from '@/infrastructure/discord/builders/ResponseBuilder.js'
import { GenerateImageResult } from '@/services/gemini.js'

// Mock the filename utility
jest.mock('@/utils/filename.js', () => ({
  createImageFilename: jest.fn().mockReturnValue('test-user-test-prompt.png')
}))

describe('EnhancedResponseBuilder', () => {
  let builder: EnhancedResponseBuilder
  let mockSuccessResult: GenerateImageResult
  let mockFailedResult: GenerateImageResult

  beforeEach(() => {
    builder = new EnhancedResponseBuilder()
    
    mockSuccessResult = {
      success: true,
      buffer: Buffer.from('fake image data', 'utf-8')
    }

    mockFailedResult = {
      success: false,
      error: 'Generation failed'
    }
  })

  describe('createImageAttachment', () => {
    it('should create an attachment from successful result', () => {
      const attachment = builder.createImageAttachment(
        mockSuccessResult,
        'testuser',
        'a beautiful sunset'
      )

      expect(attachment.name).toBe('test-user-test-prompt.png')
      expect(attachment.description).toBe('Generated image: a beautiful sunset')
      expect(attachment.attachment).toBe(mockSuccessResult.buffer)
    })

    it('should create an attachment with custom prefix', () => {
      const options: AttachmentOptions = { prefix: 'edited' }
      
      const attachment = builder.createImageAttachment(
        mockSuccessResult,
        'testuser',
        'a beautiful sunset',
        options
      )

      expect(attachment.description).toBe('Edited image: a beautiful sunset')
    })

    it('should use custom filename when provided', () => {
      const options: AttachmentOptions = { filename: 'custom-image.png' }
      
      const attachment = builder.createImageAttachment(
        mockSuccessResult,
        'testuser',
        'a beautiful sunset',
        options
      )

      expect(attachment.name).toBe('custom-image.png')
    })

    it('should use custom description when provided', () => {
      const options: AttachmentOptions = { description: 'Custom description' }
      
      const attachment = builder.createImageAttachment(
        mockSuccessResult,
        'testuser',
        'a beautiful sunset',
        options
      )

      expect(attachment.description).toBe('Custom description')
    })

    it('should truncate long prompts in description', () => {
      const longPrompt = 'a'.repeat(150)
      
      const attachment = builder.createImageAttachment(
        mockSuccessResult,
        'testuser',
        longPrompt
      )

      expect(attachment.description).toBe(`Generated image: ${longPrompt.substring(0, 100)}`)
    })

    it('should throw error for failed result', () => {
      expect(() => {
        builder.createImageAttachment(mockFailedResult, 'testuser', 'test prompt')
      }).toThrow('Cannot create attachment from failed result')
    })

    it('should throw error for result without buffer', () => {
      const resultWithoutBuffer = { success: true, buffer: undefined }
      
      expect(() => {
        builder.createImageAttachment(resultWithoutBuffer as any, 'testuser', 'test prompt')
      }).toThrow('Cannot create attachment from failed result')
    })
  })

  describe('buildImageSuccessResponse', () => {
    it('should build a complete success response', () => {
      const options: SuccessResponseOptions = {
        type: 'generated',
        username: 'testuser',
        prompt: 'a beautiful sunset',
        userId: '123456789'
      }

      const response = builder.buildImageSuccessResponse(mockSuccessResult, options)

      expect(response.content).toBe('<@123456789> 🎨 **Image generated successfully!**\n**Prompt:** a beautiful sunset')
      expect(response.files).toHaveLength(1)
      expect(response.components).toHaveLength(1) // Should include buttons by default
      expect(response.files[0].name).toBe('test-user-test-prompt.png')
    })

    it('should handle different operation types', () => {
      const types: ImageOperationType[] = ['generated', 'edited', 'regenerated']
      const expectedEmojis = ['🎨', '✏️', '🎨']
      const expectedLabels = ['generated', 'edited', 'regenerated']

      types.forEach((type, index) => {
        const options: SuccessResponseOptions = {
          type,
          username: 'testuser',
          prompt: 'test prompt',
          userId: '123456789'
        }

        const response = builder.buildImageSuccessResponse(mockSuccessResult, options)

        expect(response.content).toContain(expectedEmojis[index])
        expect(response.content).toContain(`Image ${expectedLabels[index]} successfully!`)
      })
    })

    it('should use custom context label', () => {
      const options: SuccessResponseOptions = {
        type: 'generated',
        username: 'testuser',
        prompt: 'test prompt',
        userId: '123456789',
        contextLabel: 'Description'
      }

      const response = builder.buildImageSuccessResponse(mockSuccessResult, options)

      expect(response.content).toContain('**Description:** test prompt')
    })

    it('should exclude buttons when requested', () => {
      const options: SuccessResponseOptions = {
        type: 'generated',
        username: 'testuser',
        prompt: 'test prompt',
        userId: '123456789',
        includeButtons: false
      }

      const response = builder.buildImageSuccessResponse(mockSuccessResult, options)

      expect(response.components).toHaveLength(0)
    })

    it('should use custom message when provided', () => {
      const options: SuccessResponseOptions = {
        type: 'generated',
        username: 'testuser',
        prompt: 'test prompt',
        userId: '123456789',
        customMessage: 'Custom success message!'
      }

      const response = builder.buildImageSuccessResponse(mockSuccessResult, options)

      expect(response.content).toBe('Custom success message!')
    })

    it('should pass attachment options correctly', () => {
      const options: SuccessResponseOptions = {
        type: 'edited',
        username: 'testuser',
        prompt: 'test prompt',
        userId: '123456789',
        attachmentOptions: {
          filename: 'custom.png',
          description: 'Custom desc'
        }
      }

      const response = builder.buildImageSuccessResponse(mockSuccessResult, options)

      expect(response.files[0].name).toBe('custom.png')
      expect(response.files[0].description).toBe('Custom desc')
    })
  })

  describe('buildImageErrorResponse', () => {
    it('should build a complete error response', () => {
      const options: ErrorResponseOptions = {
        errorMessage: 'Something went wrong',
        contextLabel: 'Prompt',
        prompt: 'test prompt',
        userId: '123456789'
      }

      const response = builder.buildImageErrorResponse(options)

      expect(response.content).toBe('<@123456789> ❌ Something went wrong\n**Prompt:** test prompt')
      expect(response.ephemeral).toBe(false) // Default
      expect(response.components).toHaveLength(1) // Should include retry button by default
    })

    it('should be ephemeral when requested', () => {
      const options: ErrorResponseOptions = {
        errorMessage: 'Error message',
        contextLabel: 'Prompt',
        prompt: 'test prompt',
        userId: '123456789',
        ephemeral: true
      }

      const response = builder.buildImageErrorResponse(options)

      expect(response.ephemeral).toBe(true)
    })

    it('should exclude retry button when requested', () => {
      const options: ErrorResponseOptions = {
        errorMessage: 'Error message',
        contextLabel: 'Prompt',
        prompt: 'test prompt',
        userId: '123456789',
        includeRetryButton: false
      }

      const response = builder.buildImageErrorResponse(options)

      expect(response.components).toHaveLength(0)
    })

    it('should use custom message when provided', () => {
      const options: ErrorResponseOptions = {
        errorMessage: 'Error message',
        contextLabel: 'Prompt',
        prompt: 'test prompt',
        userId: '123456789',
        customMessage: 'Custom error message!'
      }

      const response = builder.buildImageErrorResponse(options)

      expect(response.content).toBe('Custom error message!')
    })
  })

  describe('buildTextResponse', () => {
    it('should build a simple text response', () => {
      const response = builder.buildTextResponse({
        content: 'Simple text message'
      })

      expect(response.content).toBe('Simple text message')
      expect(response.ephemeral).toBe(false)
      expect(response.components).toHaveLength(0)
    })

    it('should include image buttons when requested', () => {
      const response = builder.buildTextResponse({
        content: 'Text with buttons',
        userId: '123456789',
        includeImageButtons: true
      })

      expect(response.components).toHaveLength(1)
      expect(response.components[0].components).toHaveLength(2) // Edit and regenerate buttons
    })

    it('should include retry button when requested', () => {
      const response = builder.buildTextResponse({
        content: 'Text with retry',
        userId: '123456789',
        includeRetryButton: true
      })

      expect(response.components).toHaveLength(1)
      expect(response.components[0].components).toHaveLength(1) // Only regenerate button
    })

    it('should be ephemeral when requested', () => {
      const response = builder.buildTextResponse({
        content: 'Ephemeral message',
        ephemeral: true
      })

      expect(response.ephemeral).toBe(true)
    })

    it('should prioritize image buttons over retry button', () => {
      const response = builder.buildTextResponse({
        content: 'Both buttons requested',
        userId: '123456789',
        includeImageButtons: true,
        includeRetryButton: true
      })

      expect(response.components).toHaveLength(1)
      expect(response.components[0].components).toHaveLength(2) // Should be image buttons, not retry
    })
  })

  describe('buildProgressResponse', () => {
    it('should build generating progress response', () => {
      const response = builder.buildProgressResponse({
        userId: '123456789',
        operation: 'generating',
        prompt: 'test prompt'
      })

      expect(response.content).toContain('🎨 **Generating your image...**')
      expect(response.content).toContain('**Prompt:** test prompt')
      expect(response.content).toContain('*This may take a few moments.*')
      expect(response.components).toHaveLength(0) // No buttons during progress
    })

    it('should build editing progress response', () => {
      const response = builder.buildProgressResponse({
        userId: '123456789',
        operation: 'editing'
      })

      expect(response.content).toContain('✏️ **Editing your image...**')
      expect(response.content).not.toContain('**Prompt:**') // No prompt provided
    })

    it('should build processing progress response', () => {
      const response = builder.buildProgressResponse({
        userId: '123456789',
        operation: 'processing'
      })

      expect(response.content).toContain('⚙️ **Processing your request...**')
    })

    it('should be ephemeral when requested', () => {
      const response = builder.buildProgressResponse({
        userId: '123456789',
        operation: 'generating',
        ephemeral: true
      })

      expect(response.ephemeral).toBe(true)
    })
  })

  describe('static utility methods', () => {
    describe('validateImageResult', () => {
      it('should validate successful result with buffer', () => {
        const result = EnhancedResponseBuilder.validateImageResult(mockSuccessResult)
        expect(result).toBe(true)
      })

      it('should reject failed result', () => {
        const result = EnhancedResponseBuilder.validateImageResult(mockFailedResult)
        expect(result).toBe(false)
      })

      it('should reject result without buffer', () => {
        const resultWithoutBuffer = { success: true, buffer: undefined }
        const result = EnhancedResponseBuilder.validateImageResult(resultWithoutBuffer as any)
        expect(result).toBe(false)
      })

      it('should reject result with empty buffer', () => {
        const resultWithEmptyBuffer = { success: true, buffer: Buffer.alloc(0) }
        const result = EnhancedResponseBuilder.validateImageResult(resultWithEmptyBuffer)
        expect(result).toBe(false)
      })
    })

    describe('getFileSizeString', () => {
      it('should format bytes correctly', () => {
        expect(EnhancedResponseBuilder.getFileSizeString(Buffer.alloc(0))).toBe('0 Bytes')
        expect(EnhancedResponseBuilder.getFileSizeString(Buffer.alloc(500))).toBe('500 Bytes')
        expect(EnhancedResponseBuilder.getFileSizeString(Buffer.alloc(1024))).toBe('1 KB')
        expect(EnhancedResponseBuilder.getFileSizeString(Buffer.alloc(1536))).toBe('1.5 KB')
        expect(EnhancedResponseBuilder.getFileSizeString(Buffer.alloc(1048576))).toBe('1 MB')
        expect(EnhancedResponseBuilder.getFileSizeString(Buffer.alloc(1073741824))).toBe('1 GB')
      })
    })
  })
})

describe('ResponseBuilderFactory', () => {
  let mockSuccessResult: GenerateImageResult

  beforeEach(() => {
    mockSuccessResult = {
      success: true,
      buffer: Buffer.from('fake image data', 'utf-8')
    }
  })

  describe('createImageAttachment', () => {
    it('should create image attachment with backward compatibility', () => {
      const attachment = ResponseBuilderFactory.createImageAttachment(
        mockSuccessResult,
        'testuser',
        'test prompt',
        'edited'
      )

      expect(attachment.name).toBe('test-user-test-prompt.png')
      expect(attachment.description).toBe('Edited image: test prompt')
    })

    it('should maintain compatibility with utils/imageHelpers.ts', () => {
      const attachment = createImageAttachment(
        mockSuccessResult,
        'testuser',
        'test prompt'
      )

      expect(attachment.name).toBe('test-user-test-prompt.png')
      expect(attachment.description).toBe('Generated image: test prompt')
    })
  })

  describe('buildImageSuccessResponse', () => {
    it('should build success response with backward compatibility', () => {
      const response = ResponseBuilderFactory.buildImageSuccessResponse(
        mockSuccessResult,
        'testuser',
        'test prompt',
        '123456789',
        'generated',
        'Description'
      )

      expect(response.content).toBe('<@123456789> 🎨 **Image generated successfully!**\n**Description:** test prompt')
      expect(response.files).toHaveLength(1)
      expect(response.components).toHaveLength(1)
    })

    it('should maintain compatibility with utils/imageHelpers.ts', () => {
      const response = buildImageSuccessResponse(
        mockSuccessResult,
        'testuser',
        'test prompt',
        '123456789',
        'edited'
      )

      expect(response.content).toContain('✏️ **Image edited successfully!**')
      expect(response.files).toHaveLength(1)
      expect(response.components).toHaveLength(1)
    })
  })

  describe('buildImageErrorResponse', () => {
    it('should build error response with backward compatibility', () => {
      const response = ResponseBuilderFactory.buildImageErrorResponse(
        'Something went wrong',
        'Prompt',
        'test prompt',
        '123456789'
      )

      expect(response.content).toBe('<@123456789> ❌ Something went wrong\n**Prompt:** test prompt')
      expect(response.ephemeral).toBe(false)
      expect(response.components).toHaveLength(1)
    })

    it('should maintain compatibility with utils/imageHelpers.ts', () => {
      const response = buildImageErrorResponse(
        'Error message',
        'Description',
        'test prompt',
        '123456789'
      )

      expect(response.content).toContain('❌ Error message')
      expect(response.content).toContain('**Description:** test prompt')
    })
  })
})

describe('Backward Compatibility', () => {
  let mockSuccessResult: GenerateImageResult

  beforeEach(() => {
    mockSuccessResult = {
      success: true,
      buffer: Buffer.from('fake image data', 'utf-8')
    }
  })

  it('should export factory functions that match original utils/imageHelpers.ts', () => {
    expect(typeof createImageAttachment).toBe('function')
    expect(typeof buildImageSuccessResponse).toBe('function')
    expect(typeof buildImageErrorResponse).toBe('function')
  })

  it('should produce identical results to original functions', () => {
    const username = 'testuser'
    const prompt = 'test prompt'
    const userId = '123456789'

    const factoryResult = buildImageSuccessResponse(
      mockSuccessResult,
      username,
      prompt,
      userId,
      'generated'
    )

    const builderResult = new EnhancedResponseBuilder().buildImageSuccessResponse(mockSuccessResult, {
      type: 'generated',
      username,
      prompt,
      userId
    })

    // Both should have same structure
    expect(factoryResult.files).toHaveLength(1)
    expect(builderResult.files).toHaveLength(1)
    expect(factoryResult.components).toHaveLength(1)
    expect(builderResult.components).toHaveLength(1)

    // Both should have same content pattern (excluding timestamp differences in button IDs)
    expect(factoryResult.content).toContain('🎨 **Image generated successfully!**')
    expect(builderResult.content).toContain('🎨 **Image generated successfully!**')
    expect(factoryResult.content).toContain('**Prompt:** test prompt')
    expect(builderResult.content).toContain('**Prompt:** test prompt')

    // Both should have same attachment properties
    expect(factoryResult.files[0].name).toBe(builderResult.files[0].name)
    expect(factoryResult.files[0].description).toBe(builderResult.files[0].description)
  })
})