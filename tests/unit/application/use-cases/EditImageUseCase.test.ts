import { EditImageUseCase, EditImageInput } from '@/application/use-cases/EditImageUseCase.js'
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

  async generateImage(prompt: string): Promise<IImageResult> {
    return this.editImage(prompt, Buffer.alloc(0))
  }

  async editImage(_prompt: string, _imageBuffer: Buffer, _mimeType?: string): Promise<IImageResult> {
    if (this._shouldThrow) {
      throw new Error('Mock editor error')
    }

    if (this._result) {
      return this._result
    }

    if (this._shouldFail) {
      return {
        success: false,
        error: 'Mock editing failed'
      }
    }

    return {
      success: true,
      buffer: Buffer.from('fake-edited-image-data'),
      metadata: {
        model: 'mock-model',
        generatedAt: new Date(),
        processingTime: 150
      }
    }
  }

  getInfo() {
    return {
      name: 'Mock Editor',
      version: '1.0.0',
      supportedFormats: ['image/png', 'image/jpeg'],
      maxPromptLength: 1000
    }
  }
}

// Helper to create valid PNG buffer
function createValidPngBuffer(): Buffer {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const additionalData = Buffer.alloc(100)
  return Buffer.concat([pngSignature, additionalData])
}

// Helper to create valid JPEG buffer
function createValidJpegBuffer(): Buffer {
  const jpegHeader = Buffer.from([0xff, 0xd8])
  const additionalData = Buffer.alloc(100)
  return Buffer.concat([jpegHeader, additionalData])
}

describe('EditImageUseCase', () => {
  let useCase: EditImageUseCase
  let mockGenerator: MockImageGenerator

  beforeEach(() => {
    mockGenerator = new MockImageGenerator()
    useCase = new EditImageUseCase(mockGenerator)
  })

  describe('execute', () => {
    it('should successfully edit an image with valid input', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678',
        '987654321098765432'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.imageResult).toBeDefined()
      expect(result.imageResult!.success).toBe(true)
      expect(result.imageResult!.buffer).toBeInstanceOf(Buffer)
      expect(result.validationResult.isValid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.processedRequest.metadata?.type).toBe('edit')
      expect(result.originalImageInfo.bufferSize).toBe(imageBuffer.length)
      expect(result.originalImageInfo.mimeType).toBe('image/png')
    })

    it('should fail when request validation fails', async () => {
      // Arrange
      const request = new ImageRequest(
        '', // Empty prompt
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.validationResult.isValid).toBe(false)
      expect(result.validationResult.errors).toContain('Prompt must be a non-empty string')
      expect(result.error).toContain('Request validation failed')
    })

    it('should fail when image buffer is invalid', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = Buffer.alloc(0) // Empty buffer
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.error).toBe('Invalid image buffer: buffer is empty')
    })

    it('should fail when MIME type is unsupported', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/bmp' // Unsupported MIME type
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported MIME type: image/bmp')
    })

    it('should fail when PNG buffer has invalid header', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]) // Invalid PNG header
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Buffer does not contain a valid PNG header')
    })

    it('should fail when JPEG buffer has invalid header', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]) // Invalid JPEG header
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/jpeg'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Buffer does not contain a valid JPEG header')
    })

    it('should fail when image generator is not available', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }
      mockGenerator.setAvailable(false)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.validationResult.isValid).toBe(true)
      expect(result.error).toBe('Image generation service is not available')
    })

    it('should handle image editing failure', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }
      mockGenerator.setShouldFail(true)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeDefined()
      expect(result.imageResult!.success).toBe(false)
      expect(result.error).toBe('Mock editing failed')
    })

    it('should handle unexpected errors from generator', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }
      mockGenerator.setShouldThrow(true)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.imageResult).toBeUndefined()
      expect(result.error).toBe('Image editing failed: Mock editor error')
    })

    it('should sanitize the prompt before editing', async () => {
      // Arrange - using HTML tags and extra whitespace that won't fail validation but will be sanitized
      const request = new ImageRequest(
        '  make it more colorful with <b>bold</b> text and extra   spaces  ',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.processedRequest.prompt).toBe('make it more colorful with bold text and extra spaces')
      expect(result.processedRequest.prompt).not.toContain('<b>')
      expect(result.processedRequest.prompt).not.toContain('</b>')
    })

    it('should default mimeType to image/png when not provided', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const imageBuffer = createValidPngBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer
        // mimeType omitted
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.originalImageInfo.mimeType).toBe('image/png')
    })

    it('should reject image buffer that is too large', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB, exceeds 25MB limit
      // Add valid PNG header
      largeBuffer.writeUInt32BE(0x89504e47, 0)
      largeBuffer.writeUInt32BE(0x0d0a1a0a, 4)
      const input: EditImageInput = {
        request,
        imageBuffer: largeBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toContain('Image too large')
    })

    it('should reject buffer that is too small for headers', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const tinyBuffer = Buffer.alloc(4) // Too small for any valid image headers
      const input: EditImageInput = {
        request,
        imageBuffer: tinyBuffer,
        mimeType: 'image/png'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Image buffer too small to contain valid image headers')
    })

    it('should validate JPEG headers correctly', async () => {
      // Arrange
      const request = new ImageRequest(
        'make it more colorful',
        '123456789012345678'
      )
      const jpegBuffer = createValidJpegBuffer()
      const input: EditImageInput = {
        request,
        imageBuffer: jpegBuffer,
        mimeType: 'image/jpeg'
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.success).toBe(true)
      expect(result.originalImageInfo.mimeType).toBe('image/jpeg')
    })
  })

  describe('getGeneratorInfo', () => {
    it('should return generator info', () => {
      // Act
      const info = useCase.getGeneratorInfo()

      // Assert
      expect(info.name).toBe('Mock Editor')
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