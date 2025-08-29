import { GeminiAdapter } from '@/infrastructure/google/GeminiAdapter.js'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import { Buffer } from 'node:buffer'

// Mock the dependencies
jest.mock('@/config/environment.js')
jest.mock('@/config/logger.js', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// Mock the Google GenAI module
const mockGenerateContent = jest.fn()

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'DANGEROUS_CONTENT',
    HARM_CATEGORY_CIVIC_INTEGRITY: 'CIVIC_INTEGRITY',
  },
}))

describe('GeminiAdapter', () => {
  let geminiAdapter: GeminiAdapter
  let mockConfig: jest.Mocked<typeof config>
  let mockLogger: jest.Mocked<typeof logger>

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig = config as jest.Mocked<typeof config>
    mockLogger = logger as jest.Mocked<typeof logger>
    
    // Clear all safety settings
    mockConfig.GEMINI_SAFETY_HARASSMENT = undefined
    mockConfig.GEMINI_SAFETY_HATE_SPEECH = undefined
    mockConfig.GEMINI_SAFETY_SEXUALLY_EXPLICIT = undefined
    mockConfig.GEMINI_SAFETY_DANGEROUS_CONTENT = undefined
    mockConfig.GEMINI_SAFETY_CIVIC_INTEGRITY = undefined
  })

  describe('constructor', () => {
    it('should initialize successfully with API key', () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      
      geminiAdapter = new GeminiAdapter()
      
      expect(geminiAdapter.isAvailable()).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Gemini adapter initialized successfully')
    })

    it('should handle missing API key gracefully', () => {
      mockConfig.GOOGLE_API_KEY = undefined
      
      geminiAdapter = new GeminiAdapter()
      
      expect(geminiAdapter.isAvailable()).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith('⚠️ Google API key not provided, Gemini adapter disabled')
    })
  })

  describe('generateImage', () => {
    beforeEach(() => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      geminiAdapter = new GeminiAdapter()
    })

    it('should successfully generate an image', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.from('test-image-data').toString('base64'),
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      const result = await geminiAdapter.generateImage('cute cat')

      expect(result.success).toBe(true)
      expect(result.buffer).toEqual(Buffer.from('test-image-data'))
      expect(result.metadata).toMatchObject({
        model: 'gemini-2.5-flash-image-preview',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-image-preview',
        contents: ['cute cat'],
      })
    })

    it('should handle text response instead of image', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Cannot generate this image due to policy restrictions',
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      const result = await geminiAdapter.generateImage('inappropriate content')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot generate this image due to policy restrictions')
      expect(result.metadata).toMatchObject({
        model: 'gemini-2.5-flash-image-preview',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })
    })

    it('should handle content blocking', async () => {
      const mockResponse = {
        promptFeedback: {
          blockReason: 'SAFETY',
          safetyRatings: [
            {
              category: 'HARASSMENT',
              probability: 'HIGH',
            },
          ],
        },
        candidates: [],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      const result = await geminiAdapter.generateImage('blocked content')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Content blocked: SAFETY')
      expect(result.metadata?.safetyFiltering).toMatchObject({
        blocked: true,
        reason: 'SAFETY',
        categories: ['HARASSMENT'],
      })
    })

    it('should handle finish reason other than STOP', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [],
            },
            finishReason: 'MAX_TOKENS',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      const result = await geminiAdapter.generateImage('very long prompt')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Generation stopped: MAX_TOKENS')
    })

    it('should handle API errors', async () => {
      const error = new Error('API quota exceeded')
      mockGenerateContent.mockRejectedValue(error)

      await expect(geminiAdapter.generateImage('test prompt')).rejects.toThrow('API quota exceeded')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Gemini image generation error:',
        expect.objectContaining({
          error: 'API quota exceeded',
          processingTime: expect.any(Number),
        })
      )
    })

    it('should throw error when not available', async () => {
      mockConfig.GOOGLE_API_KEY = undefined
      const unavailableAdapter = new GeminiAdapter()

      await expect(unavailableAdapter.generateImage('test prompt')).rejects.toThrow(
        'Gemini service not available - API key not configured'
      )
    })

    it('should include safety settings when configured', async () => {
      mockConfig.GEMINI_SAFETY_HARASSMENT = 'BLOCK_MEDIUM_AND_ABOVE'
      mockConfig.GEMINI_SAFETY_HATE_SPEECH = 'BLOCK_ONLY_HIGH'
      
      const newAdapter = new GeminiAdapter()
      
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.from('test-image-data').toString('base64'),
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      await newAdapter.generateImage('test prompt')

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-image-preview',
        contents: ['test prompt'],
        config: {
          safetySettings: expect.arrayContaining([
            {
              category: 'HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
            {
              category: 'HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH',
            },
          ]),
        },
      })
    })
  })

  describe('editImage', () => {
    beforeEach(() => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      geminiAdapter = new GeminiAdapter()
    })

    const testImageBuffer = Buffer.from('test-image-binary-data')

    it('should successfully edit an image', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.from('edited-image-data').toString('base64'),
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      const result = await geminiAdapter.editImage('make it blue', testImageBuffer, 'image/jpeg')

      expect(result.success).toBe(true)
      expect(result.buffer).toEqual(Buffer.from('edited-image-data'))
      expect(result.metadata).toMatchObject({
        model: 'gemini-2.5-flash-image-preview',
        generatedAt: expect.any(Date),
        processingTime: expect.any(Number),
      })

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-image-preview',
        contents: [
          {
            inlineData: {
              data: testImageBuffer.toString('base64'),
              mimeType: 'image/jpeg',
            },
          },
          'make it blue',
        ],
      })
    })

    it('should use default mime type when not specified', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: Buffer.from('edited-image-data').toString('base64'),
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      await geminiAdapter.editImage('make it blue', testImageBuffer)

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-image-preview',
        contents: [
          {
            inlineData: {
              data: testImageBuffer.toString('base64'),
              mimeType: 'image/png',
            },
          },
          'make it blue',
        ],
      })
    })

    it('should handle edit failures', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Cannot edit this image',
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }

      mockGenerateContent.mockResolvedValue(mockResponse)

      const result = await geminiAdapter.editImage('make it blue', testImageBuffer)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot edit this image')
    })

    it('should throw error when not available', async () => {
      mockConfig.GOOGLE_API_KEY = undefined
      const unavailableAdapter = new GeminiAdapter()

      await expect(
        unavailableAdapter.editImage('test prompt', testImageBuffer)
      ).rejects.toThrow('Gemini service not available - API key not configured')
    })
  })

  describe('getInfo', () => {
    beforeEach(() => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      geminiAdapter = new GeminiAdapter()
    })

    it('should return correct adapter information', () => {
      const info = geminiAdapter.getInfo()

      expect(info).toEqual({
        name: 'Google Gemini',
        version: 'gemini-2.5-flash-image-preview',
        supportedFormats: ['image/png', 'image/jpeg', 'image/webp'],
        maxPromptLength: 1000,
      })
    })
  })

  describe('isAvailable', () => {
    it('should return true when API key is configured', () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      geminiAdapter = new GeminiAdapter()
      
      expect(geminiAdapter.isAvailable()).toBe(true)
    })

    it('should return false when API key is not configured', () => {
      mockConfig.GOOGLE_API_KEY = undefined
      geminiAdapter = new GeminiAdapter()
      
      expect(geminiAdapter.isAvailable()).toBe(false)
    })
  })
})