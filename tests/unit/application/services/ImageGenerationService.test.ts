import { ImageGenerationService } from '@/application/services/ImageGenerationService.js'
import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { ImageRequest } from '@/domain/entities/ImageRequest.js'
import logger from '@/infrastructure/monitoring/Logger.js'
import { Buffer } from 'node:buffer'

// Mock the logger
jest.mock('@/infrastructure/monitoring/Logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

describe('ImageGenerationService', () => {
  let mockImageGenerator: jest.Mocked<IImageGenerator>
  let imageGenerationService: ImageGenerationService
  let mockLogger: jest.Mocked<typeof logger>

  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger = logger as jest.Mocked<typeof logger>

    mockImageGenerator = {
      isAvailable: jest.fn(),
      generateImage: jest.fn(),
      editImage: jest.fn(),
      getInfo: jest.fn().mockReturnValue({
        name: 'Test Generator',
        version: '1.0',
        supportedFormats: ['image/png'],
        maxPromptLength: 1000,
      }),
    }

    imageGenerationService = new ImageGenerationService(mockImageGenerator)
  })

  describe('isAvailable', () => {
    it('should return true when generator is available', () => {
      mockImageGenerator.isAvailable.mockReturnValue(true)
      expect(imageGenerationService.isAvailable()).toBe(true)
    })

    it('should return false when generator is not available', () => {
      mockImageGenerator.isAvailable.mockReturnValue(false)
      expect(imageGenerationService.isAvailable()).toBe(false)
    })
  })

  describe('generateImage', () => {
    const validRequest = new ImageRequest(
      'test prompt',
      '123456789012345678',
      '987654321098765432',
      new Date(),
      {
        type: 'generate',
        source: 'command',
        messageId: '111111111111111111',
        channelId: '222222222222222222',
      }
    )

    it('should successfully generate an image', async () => {
      const mockResult: IImageResult = {
        success: true,
        buffer: Buffer.from('test-image-data'),
      }

      mockImageGenerator.generateImage.mockResolvedValue(mockResult)

      const result = await imageGenerationService.generateImage(validRequest)

      expect(result.success).toBe(true)
      expect(result.buffer).toEqual(Buffer.from('test-image-data'))
      expect(result.metadata).toMatchObject({
        model: 'Test Generator',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })

      expect(mockImageGenerator.generateImage).toHaveBeenCalledWith('test prompt')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing image generation request:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          promptLength: 11,
          requestType: 'generate',
          source: 'command',
        })
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Image generation completed successfully:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          processingTime: expect.any(Number),
          bufferSize: 15,
        })
      )
    })

    it('should handle validation failures', async () => {
      const invalidRequest = new ImageRequest('', '123456789012345678', '987654321098765432')

      const result = await imageGenerationService.generateImage(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid request')
      expect(mockImageGenerator.generateImage).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Image generation request validation failed:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          errors: expect.arrayContaining(['Prompt must be a non-empty string']),
        })
      )
    })

    it('should handle generator failures', async () => {
      const mockResult: IImageResult = {
        success: false,
        error: 'Generation failed',
      }

      mockImageGenerator.generateImage.mockResolvedValue(mockResult)

      const result = await imageGenerationService.generateImage(validRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Generation failed')
      expect(result.metadata).toMatchObject({
        model: 'Test Generator',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Image generation failed:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          error: 'Generation failed',
          processingTime: expect.any(Number),
        })
      )
    })

    it('should handle generator exceptions', async () => {
      const error = new Error('API error')
      mockImageGenerator.generateImage.mockRejectedValue(error)

      const result = await imageGenerationService.generateImage(validRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe('An unexpected error occurred during image generation')
      expect(result.metadata).toMatchObject({
        model: 'Test Generator',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Image generation service error:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          error: 'API error',
          processingTime: expect.any(Number),
        })
      )
    })

    it('should sanitize prompts before generation', async () => {
      const dirtyPrompt = 'cute <b>cat</b> with <i>whiskers</i>'
      const dirtyRequest = new ImageRequest(
        dirtyPrompt,
        '123456789012345678',
        '987654321098765432'
      )

      const mockResult: IImageResult = {
        success: true,
        buffer: Buffer.from('test-image-data'),
      }

      mockImageGenerator.generateImage.mockResolvedValue(mockResult)

      await imageGenerationService.generateImage(dirtyRequest)

      // Should call generator with sanitized prompt (HTML tags removed)
      expect(mockImageGenerator.generateImage).toHaveBeenCalledWith('cute cat with whiskers')
    })

    it('should log validation warnings', async () => {
      // Create a request with a very short prompt (generates warning)
      const shortPromptRequest = new ImageRequest(
        'cat',
        '123456789012345678',
        '987654321098765432'
      )

      const mockResult: IImageResult = {
        success: true,
        buffer: Buffer.from('test-image-data'),
      }

      mockImageGenerator.generateImage.mockResolvedValue(mockResult)

      await imageGenerationService.generateImage(shortPromptRequest)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Image generation request has warnings:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          warnings: expect.arrayContaining(['Very short prompts may produce unexpected results']),
        })
      )
    })
  })

  describe('editImage', () => {
    const validRequest = new ImageRequest(
      'edit this image',
      '123456789012345678',
      '987654321098765432',
      new Date(),
      {
        type: 'edit',
        source: 'modal',
      }
    )
    const originalImageBuffer = Buffer.from('original-image-data')

    it('should successfully edit an image', async () => {
      const mockResult: IImageResult = {
        success: true,
        buffer: Buffer.from('edited-image-data'),
      }

      mockImageGenerator.editImage.mockResolvedValue(mockResult)

      const result = await imageGenerationService.editImage(
        validRequest,
        originalImageBuffer,
        'image/jpeg'
      )

      expect(result.success).toBe(true)
      expect(result.buffer).toEqual(Buffer.from('edited-image-data'))
      expect(result.metadata).toMatchObject({
        model: 'Test Generator',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })

      expect(mockImageGenerator.editImage).toHaveBeenCalledWith(
        'edit this image',
        originalImageBuffer,
        'image/jpeg'
      )
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing image edit request:',
        expect.objectContaining({
          userId: '123456789012345678',
          guildId: '987654321098765432',
          promptLength: 15,
          originalImageSize: 19,
          mimeType: 'image/jpeg',
          requestType: 'edit',
          source: 'modal',
        })
      )
    })

    it('should handle missing image buffer', async () => {
      const result = await imageGenerationService.editImage(
        validRequest,
        Buffer.from(''),
        'image/png'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Original image buffer is required for editing')
      expect(mockImageGenerator.editImage).not.toHaveBeenCalled()
    })

    it('should handle edit failures', async () => {
      const mockResult: IImageResult = {
        success: false,
        error: 'Edit failed',
      }

      mockImageGenerator.editImage.mockResolvedValue(mockResult)

      const result = await imageGenerationService.editImage(
        validRequest,
        originalImageBuffer
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Edit failed')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Image editing failed:',
        expect.objectContaining({
          error: 'Edit failed',
        })
      )
    })

    it('should handle edit exceptions', async () => {
      const error = new Error('Edit API error')
      mockImageGenerator.editImage.mockRejectedValue(error)

      const result = await imageGenerationService.editImage(
        validRequest,
        originalImageBuffer
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('An unexpected error occurred during image editing')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Image editing service error:',
        expect.objectContaining({
          error: 'Edit API error',
        })
      )
    })
  })

  describe('getGeneratorInfo', () => {
    it('should return generator information', () => {
      const info = imageGenerationService.getGeneratorInfo()

      expect(info).toEqual({
        name: 'Test Generator',
        version: '1.0',
        supportedFormats: ['image/png'],
        maxPromptLength: 1000,
      })
    })
  })

  describe('createRequest', () => {
    it('should create a new ImageRequest with provided parameters', () => {
      const request = imageGenerationService.createRequest(
        'test prompt',
        '123456789012345678',
        '987654321098765432',
        {
          messageId: '111111111111111111',
          channelId: '222222222222222222',
          type: 'generate',
          source: 'command',
        }
      )

      expect(request).toBeInstanceOf(ImageRequest)
      expect(request.prompt).toBe('test prompt')
      expect(request.userId).toBe('123456789012345678')
      expect(request.guildId).toBe('987654321098765432')
      expect(request.requestedAt).toBeInstanceOf(Date)
      expect(request.metadata).toMatchObject({
        messageId: '111111111111111111',
        channelId: '222222222222222222',
        type: 'generate',
        source: 'command',
      })
    })

    it('should create a request without optional parameters', () => {
      const request = imageGenerationService.createRequest('test prompt', '123456789012345678')

      expect(request).toBeInstanceOf(ImageRequest)
      expect(request.prompt).toBe('test prompt')
      expect(request.userId).toBe('123456789012345678')
      expect(request.guildId).toBeUndefined()
      expect(request.metadata).toBeUndefined()
    })
  })
})