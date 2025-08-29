import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type SafetySetting } from '@google/genai'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import { Buffer } from 'node:buffer'

export interface GenerateImageResult {
  success: boolean
  buffer?: Buffer
  error?: string
}

export interface EditImageResult {
  success: boolean
  buffer?: Buffer
  error?: string
}

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

  private buildSafetySettings(): SafetySetting[] {
    const safetySettings: SafetySetting[] = []

    const safetyMappings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, envVar: config.GEMINI_SAFETY_HARASSMENT },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        envVar: config.GEMINI_SAFETY_HATE_SPEECH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        envVar: config.GEMINI_SAFETY_SEXUALLY_EXPLICIT,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        envVar: config.GEMINI_SAFETY_DANGEROUS_CONTENT,
      },
      {
        category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        envVar: config.GEMINI_SAFETY_CIVIC_INTEGRITY,
      },
    ]

    for (const mapping of safetyMappings) {
      if (mapping.envVar) {
        safetySettings.push({
          category: mapping.category,
          threshold: mapping.envVar as HarmBlockThreshold,
        })
      }
    }

    return safetySettings
  }

  public isAvailable(): boolean {
    return this.client !== null
  }

  public async generateImage(prompt: string): Promise<GenerateImageResult> {
    if (!this.client) {
      throw new Error('Gemini service not available - API key not configured')
    }

    try {
      logger.info(`Generating image for prompt: "${prompt.substring(0, 50)}..."`)

      const safetySettings = this.buildSafetySettings()
      const config = safetySettings.length > 0 ? { safetySettings } : undefined

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [prompt],
        ...(config && { config }),
      })

      // Extract image data from response parts
      if (response.candidates && response.candidates[0]?.content?.parts) {
        let textResponse: string | null = null

        // First, look for image data
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            logger.info('✅ Image generated successfully')
            return { success: true, buffer: Buffer.from(part.inlineData.data, 'base64') }
          }
          // Store text response for potential error message
          if (part.text) {
            textResponse = part.text
          }
        }

        // If no image data found but we have text, use it as error message
        if (textResponse) {
          logger.info('Gemini returned text response instead of image')
          return { success: false, error: textResponse }
        }
      }

      // Check for error information
      let errorMessage = 'Failed to generate image'

      // Check promptFeedback for safety filtering
      if (response.promptFeedback?.blockReason) {
        errorMessage = `Content blocked: ${response.promptFeedback.blockReason}`
      }

      // Check candidates finishReason
      if (response.candidates && response.candidates[0]?.finishReason) {
        const finishReason = response.candidates[0].finishReason
        if (finishReason !== 'STOP') {
          errorMessage = `Generation stopped: ${finishReason}`
        }
      }

      logger.warn(
        JSON.stringify(
          {
            ...(response.candidates && { candidates: response.candidates }),
            ...(response.promptFeedback && { promptFeedback: response.promptFeedback }),
          },
          null,
          2
        )
      )

      return { success: false, error: errorMessage }
    } catch (error) {
      logger.error('Failed to generate image with Gemini:', error)
      throw error
    }
  }

  public async editImage(
    prompt: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/png'
  ): Promise<EditImageResult> {
    if (!this.client) {
      throw new Error('Gemini service not available - API key not configured')
    }

    try {
      logger.info(`Editing image with prompt: "${prompt.substring(0, 50)}..."`)

      // Convert image buffer to base64 for the API
      const imageBase64 = imageBuffer.toString('base64')

      // Create image part for multimodal input
      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType,
        },
      }

      const safetySettings = this.buildSafetySettings()
      const config = safetySettings.length > 0 ? { safetySettings } : undefined

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: [imagePart, prompt],
        ...(config && { config }),
      })

      // Extract image data from response parts
      if (response.candidates && response.candidates[0]?.content?.parts) {
        let textResponse: string | null = null

        // First, look for image data
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            logger.info('✅ Image edited successfully')
            return { success: true, buffer: Buffer.from(part.inlineData.data, 'base64') }
          }
          // Store text response for potential error message
          if (part.text) {
            textResponse = part.text
          }
        }

        // If no image data found but we have text, use it as error message
        if (textResponse) {
          logger.info('Gemini returned text response instead of image for edit')
          return { success: false, error: textResponse }
        }
      }

      // Check for error information
      let errorMessage = 'Failed to edit image'

      // Check promptFeedback for safety filtering
      if (response.promptFeedback?.blockReason) {
        errorMessage = `Content blocked: ${response.promptFeedback.blockReason}`
      }

      // Check candidates finishReason
      if (response.candidates && response.candidates[0]?.finishReason) {
        const finishReason = response.candidates[0].finishReason
        if (finishReason !== 'STOP') {
          errorMessage = `Generation stopped: ${finishReason}`
        }
      }

      logger.warn(
        'Edit image response:',
        JSON.stringify(
          {
            ...(response.candidates && { candidates: response.candidates }),
            ...(response.promptFeedback && { promptFeedback: response.promptFeedback }),
          },
          null,
          2
        )
      )

      return { success: false, error: errorMessage }
    } catch (error) {
      logger.error('Failed to edit image with Gemini:', error)
      throw error
    }
  }
}

export const geminiService = new GeminiService()
