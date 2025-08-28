import { GoogleGenAI } from '@google/genai'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import { Buffer } from 'node:buffer'

export class GeminiService {
  private client: GoogleGenAI | null = null

  constructor() {
    if (config.GOOGLE_API_KEY) {
      this.client = new GoogleGenAI({
        apiKey: config.GOOGLE_API_KEY,
      })
      logger.info('✅ Gemini service initialized')
    } else {
      logger.warn('⚠️ Google API key not provided, Gemini service disabled')
    }
  }

  public isAvailable(): boolean {
    return this.client !== null
  }

  public async generateImage(prompt: string): Promise<Buffer | null> {
    if (!this.client) {
      throw new Error('Gemini service not available - API key not configured')
    }

    try {
      logger.info(`Generating image for prompt: "${prompt.substring(0, 50)}..."`)

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [prompt],
      })

      // Extract image data from response parts
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            logger.info('✅ Image generated successfully')
            return Buffer.from(part.inlineData.data, 'base64')
          }
        }
      }

      logger.warn('No image data found in response')
      return null
    } catch (error) {
      logger.error('Failed to generate image with Gemini:', error)
      throw error
    }
  }
}

export const geminiService = new GeminiService()
