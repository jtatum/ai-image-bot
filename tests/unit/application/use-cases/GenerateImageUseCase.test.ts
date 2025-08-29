import { GenerateImageUseCase } from '@/application/use-cases/GenerateImageUseCase.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { Buffer } from 'node:buffer'

// Mock image generator implementation
class MockImageGenerator implements IImageGenerator {
  private _isAvailable = true
  private _shouldFail = false
  private _shouldThrow = false
  private _result: IImageResult | null = null

  isAvailable(): boolean {
    return this._isAvailable
  }

  setAvailable(available: boolean): void {
    this._isAvailable = available
  }

  setShouldFail(shouldFail: boolean): void {
    this._shouldFail = shouldFail
  }

  setShouldThrow(shouldThrow: boolean): void {
    this._shouldThrow = shouldThrow
  }

  setResult(result: IImageResult): void {
    this._result = result
  }

  async generateImage(_prompt: string): Promise<IImageResult> {
    if (this._shouldThrow) {
      throw new Error('Mock generator error')
    }

    if (this._result) {
      return this._result
    }

    if (this._shouldFail) {
      return {
        success: false,
        error: 'Mock generation failed'
      }
    }

    return {
      success: true,
      buffer: Buffer.from('fake-image-data'),
      metadata: {
        model: 'mock-model',
        generatedAt: new Date(),
        processingTime: 100
      }
    }
  }

  async editImage(prompt: string, _imageBuffer: Buffer, _mimeType?: string): Promise<IImageResult> {
    return this.generateImage(prompt)
  }

  getInfo() {
    return {
      name: 'Mock Generator',
      version: '1.0.0',
      supportedFormats: ['image/png', 'image/jpeg'],
      maxPromptLength: 1000
    }
  }
}

describe('GenerateImageUseCase', () => {
  let useCase: GenerateImageUseCase
  let mockGenerator: MockImageGenerator

  beforeEach(() => {
    mockGenerator = new MockImageGenerator()
    useCase = new GenerateImageUseCase(mockGenerator)
  })

  describe('execute', () => {
    it('should successfully generate an image with valid request', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678',
        '987654321098765432'
      )

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(true)
      expect(result.imageResult).toBeDefined()
      expect(result.imageResult!.success).toBe(true)
      expect(result.imageResult!.buffer).toBeInstanceOf(Buffer)
      expect(result.validationResult.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.processedRequest.metadata?.type).toBe('generate')
    })

    it('should fail when request validation fails', async () => {
      // Arrange
      const request = new ImageRequest(
        '', // Empty prompt
        '123456789012345678'
      )

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.validationResult.isValid).toBe(false)
      expect(result.validationResult.errors).toContain('Prompt must be a non-empty string')
      expect(result.error).toContain('Request validation failed')
    })

    it('should fail when image generator is not available', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      mockGenerator.setAvailable(false)

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.validationResult.isValid).toBe(true)
      expect(result.error).toBe('Image generation service is not available')
    })

    it('should handle image generation failure', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      mockGenerator.setShouldFail(true)

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeDefined()
      expect(result.imageResult!.success).toBe(false)
      expect(result.error).toBe('Mock generation failed')
    })

    it('should handle unexpected errors from generator', async () => {
      // Arrange
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678'
      )
      mockGenerator.setShouldThrow(true)

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.error).toBe('Image generation failed: Mock generator error')
    })

    it('should sanitize the prompt before generation', async () => {
      // Arrange - using HTML tags and extra whitespace that won't fail validation but will be sanitized
      const request = new ImageRequest(
        '  a beautiful sunset with <b>bold</b> text and extra   spaces  ',
        '123456789012345678'
      )

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(true)
      expect(result.processedRequest.prompt).toBe('a beautiful sunset with bold text and extra spaces')
      expect(result.processedRequest.prompt).not.toContain('<b>')
      expect(result.processedRequest.prompt).not.toContain('</b>')
    })

    it('should preserve metadata and add generation type', async () => {
      // Arrange
      const originalMetadata = {
        messageId: '111111111111111111',
        channelId: '222222222222222222',
        source: 'command' as const
      }
      const request = new ImageRequest(
        'a beautiful sunset',
        '123456789012345678',
        '987654321098765432',
        new Date(),
        originalMetadata
      )

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(true)
      expect(result.processedRequest.metadata).toEqual({
        ...originalMetadata,
        type: 'generate'
      })
    })

    it('should handle validation warnings gracefully', async () => {
      // Arrange - Very short prompt will generate warnings but not errors
      const request = new ImageRequest(
        'cat',
        '123456789012345678'
      )

      // Act
      const result = await useCase.execute(request)

      // Assert
      expect(result.success).toBe(true)
      expect(result.validationResult.isValid).toBe(true)
      expect(result.validationResult.warnings).toContain('Very short prompts may produce unexpected results')
    })
  })

  describe('getGeneratorInfo', () => {
    it('should return generator info', () => {
      // Act
      const info = useCase.getGeneratorInfo()

      // Assert
      expect(info.name).toBe('Mock Generator')
      expect(info.version).toBe('1.0.0')
      expect(info.supportedFormats).toEqual(['image/png', 'image/jpeg'])
      expect(info.maxPromptLength).toBe(1000)
    })
  })

  describe('isAvailable', () => {
    it('should return true when generator is available', () => {
      // Act
      const isAvailable = useCase.isAvailable()

      // Assert
      expect(isAvailable).toBe(true)
    })

    it('should return false when generator is not available', () => {
      // Arrange
      mockGenerator.setAvailable(false)

      // Act
      const isAvailable = useCase.isAvailable()

      // Assert
      expect(isAvailable).toBe(false)
    })
  })
})