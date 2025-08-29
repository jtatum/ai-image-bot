import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type SafetySetting } from '@google/genai'
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
          threshold: mapping.envVar as HarmBlockThreshold,
        })
      }
    }

    return safetySettings
  }

  /**
   * Process the Gemini API response and extract image data or error information
   */
  private processGenerationResponse(response: unknown, processingTime: number): IImageResult {
    // Extract image data from response parts
    if (
      this.isValidResponse(response) &&
      response.candidates &&
      response.candidates[0]?.content?.parts
    ) {
      let textResponse: string | null = null

      // First, look for image data
      for (const part of response.candidates[0].content.parts) {
        const partData = part as { inlineData?: { data?: string }; text?: string }
        if (partData.inlineData && partData.inlineData.data) {
          return {
            success: true,
            buffer: Buffer.from(partData.inlineData.data, 'base64'),
            metadata: {
              model: this.modelName,
              generatedAt: new Date(),
              processingTime,
            },
          }
        }
        // Store text response for potential error message
        if (partData.text) {
          textResponse = partData.text
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
    const responseData = response as {
      promptFeedback?: { blockReason?: string; safetyRatings?: unknown[] }
      candidates?: { finishReason?: string }[]
    }
    if (responseData.promptFeedback?.blockReason) {
      errorMessage = `Content blocked: ${responseData.promptFeedback.blockReason}`
      safetyFiltering = {
        blocked: true,
        reason: responseData.promptFeedback.blockReason,
        categories: responseData.promptFeedback.safetyRatings?.map(
          (rating: unknown) => (rating as { category: unknown }).category
        ) as string[],
      }
    }

    // Check candidates finishReason
    if (responseData.candidates && responseData.candidates[0]?.finishReason) {
      const finishReason = responseData.candidates[0].finishReason
      if (finishReason !== 'STOP') {
        errorMessage = `Generation stopped: ${finishReason}`
      }
    }

    // Log detailed response for debugging
    logger.debug('Gemini response details:', {
      candidates: responseData.candidates?.map((c: unknown) => ({
        finishReason: (c as { finishReason?: unknown }).finishReason,
        contentParts: (c as { content?: { parts?: unknown[] } }).content?.parts?.map(
          (p: unknown) => ({
            hasInlineData: !!(p as { inlineData?: unknown }).inlineData,
            hasText: !!(p as { text?: unknown }).text,
          })
        ),
      })),
      promptFeedback: responseData.promptFeedback,
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

  /**
   * Type guard to check if response has expected structure
   */
  private isValidResponse(
    response: unknown
  ): response is { candidates: Array<{ content: { parts: Array<unknown> } }> } {
    return (
      typeof response === 'object' &&
      response !== null &&
      'candidates' in response &&
      Array.isArray((response as { candidates: unknown }).candidates)
    )
  }
}
