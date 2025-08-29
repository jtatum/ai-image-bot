import { GoogleGenAI, HarmCategory, type SafetySetting } from '@google/genai'
import { IImageGenerator, IImageResult } from '@/domain/interfaces/IImageGenerator.js'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import { Buffer } from 'node:buffer'

/**
 * Adapter for Google Gemini AI image generation service
 * Implements the IImageGenerator interface to provide AI image generation
 */
export class GeminiAdapter implements IImageGenerator {
  private client: GoogleGenAI | null = null
  private readonly modelName = 'gemini-2.5-flash-image-preview'

  constructor() {
    if (config.GOOGLE_API_KEY) {
      this.client = new GoogleGenAI({
        apiKey: config.GOOGLE_API_KEY,
      })
      logger.info('✅ Gemini adapter initialized successfully')
    } else {
      logger.warn('⚠️ Google API key not provided, Gemini adapter disabled')
    }
  }

  /**
   * Check if the Gemini service is available
   */
  public isAvailable(): boolean {
    return this.client !== null
  }

  /**
   * Generate a new image from a text prompt
   */
  public async generateImage(prompt: string): Promise<IImageResult> {
    if (!this.client) {
      throw new Error('Gemini service not available - API key not configured')
    }

    const startTime = Date.now()

    try {
      logger.debug(`Generating image with Gemini: "${prompt.substring(0, 50)}..."`)

      const safetySettings = this.buildSafetySettings()
      const requestConfig = safetySettings.length > 0 ? { safetySettings } : undefined

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [prompt],
        ...(requestConfig && { config: requestConfig }),
      })

      const processingTime = Date.now() - startTime

      // Process the response
      const result = this.processGenerationResponse(response, processingTime)

      if (result.success) {
        logger.debug(`✅ Image generated successfully in ${processingTime}ms`)
      } else {
        logger.warn(`❌ Image generation failed: ${result.error}`)
      }

      return result
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Gemini image generation error:', {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      })
      throw error
    }
  }

  /**
   * Edit an existing image based on a text prompt
   */
  public async editImage(
    prompt: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/png'
  ): Promise<IImageResult> {
    if (!this.client) {
      throw new Error('Gemini service not available - API key not configured')
    }

    const startTime = Date.now()

    try {
      logger.debug(
        `Editing image with Gemini: "${prompt.substring(0, 50)}..." (${imageBuffer.length} bytes)`
      )

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
      const requestConfig = safetySettings.length > 0 ? { safetySettings } : undefined

      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [imagePart, prompt],
        ...(requestConfig && { config: requestConfig }),
      })

      const processingTime = Date.now() - startTime

      // Process the response
      const result = this.processGenerationResponse(response, processingTime)

      if (result.success) {
        logger.debug(`✅ Image edited successfully in ${processingTime}ms`)
      } else {
        logger.warn(`❌ Image editing failed: ${result.error}`)
      }

      return result
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Gemini image editing error:', {
        error: error instanceof Error ? error.message : String(error),
        processingTime,
      })
      throw error
    }
  }

  /**
   * Get information about the Gemini image generator
   */
  public getInfo(): {
    name: string
    version?: string
    supportedFormats?: string[]
    maxPromptLength?: number
  } {
    return {
      name: 'Google Gemini',
      version: this.modelName,
      supportedFormats: ['image/png', 'image/jpeg', 'image/webp'],
      maxPromptLength: 1000,
    }
  }

  /**
   * Build safety settings from environment configuration
   */
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
          threshold: mapping.envVar as any,
        })
      }
    }

    return safetySettings
  }

  /**
   * Process the Gemini API response and extract image data or error information
   */
  private processGenerationResponse(response: any, processingTime: number): IImageResult {
    // Extract image data from response parts
    if (response.candidates && response.candidates[0]?.content?.parts) {
      let textResponse: string | null = null

      // First, look for image data
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return {
            success: true,
            buffer: Buffer.from(part.inlineData.data, 'base64'),
            metadata: {
              model: this.modelName,
              generatedAt: new Date(),
              processingTime,
            },
          }
        }
        // Store text response for potential error message
        if (part.text) {
          textResponse = part.text
        }
      }

      // If no image data found but we have text, use it as error message
      if (textResponse) {
        logger.debug('Gemini returned text response instead of image:', textResponse)
        return {
          success: false,
          error: textResponse,
          metadata: {
            model: this.modelName,
            generatedAt: new Date(),
            processingTime,
          },
        }
      }
    }

    // Check for error information
    let errorMessage = 'Failed to generate image'
    let safetyFiltering:
      | {
          blocked: boolean
          reason?: string
          categories?: string[]
        }
      | undefined

    // Check promptFeedback for safety filtering
    if (response.promptFeedback?.blockReason) {
      errorMessage = `Content blocked: ${response.promptFeedback.blockReason}`
      safetyFiltering = {
        blocked: true,
        reason: response.promptFeedback.blockReason,
        categories: response.promptFeedback.safetyRatings?.map((rating: any) => rating.category),
      }
    }

    // Check candidates finishReason
    if (response.candidates && response.candidates[0]?.finishReason) {
      const finishReason = response.candidates[0].finishReason
      if (finishReason !== 'STOP') {
        errorMessage = `Generation stopped: ${finishReason}`
      }
    }

    // Log detailed response for debugging
    logger.debug('Gemini response details:', {
      candidates: response.candidates?.map((c: any) => ({
        finishReason: c.finishReason,
        contentParts: c.content?.parts?.map((p: any) => ({
          hasInlineData: !!p.inlineData,
          hasText: !!p.text,
        })),
      })),
      promptFeedback: response.promptFeedback,
    })

    return {
      success: false,
      error: errorMessage,
      metadata: {
        model: this.modelName,
        generatedAt: new Date(),
        processingTime,
        ...(safetyFiltering && { safetyFiltering }),
      },
    }
  }
}
