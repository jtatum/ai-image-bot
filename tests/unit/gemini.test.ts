import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Set up the mock BEFORE any other imports
const mockGenerateContent = jest.fn() as jest.MockedFunction<any>

// Mock the config to be controllable in tests
const mockConfig = {
  GOOGLE_API_KEY: undefined as string | undefined,
}

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}))

jest.mock('@/config/environment.js', () => ({
  config: mockConfig,
}))

// NOW import the service after the mock is set up
import { GeminiService } from '@/services/gemini.js'

describe('GeminiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with API key when provided', () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'

      const service = new GeminiService()

      expect(service.isAvailable()).toBe(true)
    })

    it('should not initialize client when no API key is provided', () => {
      mockConfig.GOOGLE_API_KEY = undefined

      const service = new GeminiService()

      expect(service.isAvailable()).toBe(false)
    })

    it('should not initialize client when API key is empty string', () => {
      mockConfig.GOOGLE_API_KEY = ''

      const service = new GeminiService()

      expect(service.isAvailable()).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('should return true when client is initialized', () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'

      const service = new GeminiService()

      expect(service.isAvailable()).toBe(true)
    })

    it('should return false when client is not initialized', () => {
      mockConfig.GOOGLE_API_KEY = undefined

      const service = new GeminiService()

      expect(service.isAvailable()).toBe(false)
    })
  })

  describe('generateImage', () => {
    it('should throw error when service is not available', async () => {
      mockConfig.GOOGLE_API_KEY = undefined

      const service = new GeminiService()

      await expect(service.generateImage('test prompt')).rejects.toThrow(
        'Gemini service not available - API key not configured'
      )
    })

    it('should generate image successfully and return Buffer', async () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      const mockImageData = 'base64encodedimagedata'
      const expectedBuffer = Buffer.from(mockImageData, 'base64')

      // @ts-ignore
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    data: mockImageData,
                  },
                },
              ],
            },
          },
        ],
      })

      const service = new GeminiService()
      const result = await service.generateImage('a cute robot')

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-image-preview',
        contents: ['a cute robot'],
      })
      expect(result).toEqual(expectedBuffer)
    })

    it('should return null when no image data is found in response', async () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'

      // @ts-ignore
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Some text response without image',
                },
              ],
            },
          },
        ],
      })

      const service = new GeminiService()
      const result = await service.generateImage('test prompt')

      expect(result).toBeNull()
    })

    it('should return null when no candidates in response', async () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'

      // @ts-ignore
      mockGenerateContent.mockResolvedValue({
        candidates: [],
      })

      const service = new GeminiService()
      const result = await service.generateImage('test prompt')

      expect(result).toBeNull()
    })

    it('should handle API errors and re-throw them', async () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'
      const apiError = new Error('API Error: Rate limit exceeded')

      // @ts-ignore
      mockGenerateContent.mockRejectedValue(apiError)

      const service = new GeminiService()

      await expect(service.generateImage('test prompt')).rejects.toThrow(
        'API Error: Rate limit exceeded'
      )
    })

    it('should handle safety filter responses', async () => {
      mockConfig.GOOGLE_API_KEY = 'test-api-key'

      // @ts-ignore
      mockGenerateContent.mockResolvedValue({
        candidates: [
          {
            content: {
              parts: [], // Empty parts array indicates content was filtered
            },
            finishReason: 'SAFETY',
          },
        ],
      })

      const service = new GeminiService()
      const result = await service.generateImage('inappropriate content')

      expect(result).toBeNull()
    })
  })
})