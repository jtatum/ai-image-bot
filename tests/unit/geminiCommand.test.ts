import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ChatInputCommandInteraction } from 'discord.js'
import { createMockChatInputInteraction } from '../helpers/mockInteractions.js'

// Mock the gemini service
jest.mock('@/services/gemini.js', () => ({
  geminiService: {
    isAvailable: jest.fn() as jest.MockedFunction<any>,
    generateImage: jest.fn() as jest.MockedFunction<any>,
  },
}))

import { geminiService } from '@/services/gemini.js'
const mockGeminiService = geminiService as any

// Mock the config
jest.mock('@/config/environment.js', () => ({
  config: {
    COMMAND_COOLDOWN_SECONDS: 30,
  },
}))

// Mock the helper utilities - we'll spy on these to test integration
jest.mock('@/utils/interactionHelpers.js', () => ({
  checkGeminiAvailability: jest.fn() as jest.MockedFunction<any>,
  handleGeminiResultErrorWithButton: jest.fn() as jest.MockedFunction<any>,
  handleGeminiErrorWithButton: jest.fn() as jest.MockedFunction<any>,
  safeReply: jest.fn() as jest.MockedFunction<any>,
}))

import { checkGeminiAvailability, handleGeminiResultErrorWithButton, handleGeminiErrorWithButton, safeReply } from '@/utils/interactionHelpers.js'
const mockCheckGeminiAvailability = checkGeminiAvailability as jest.MockedFunction<any>
const mockHandleGeminiResultErrorWithButton = handleGeminiResultErrorWithButton as jest.MockedFunction<any>
const mockHandleGeminiErrorWithButton = handleGeminiErrorWithButton as jest.MockedFunction<any>
const mockSafeReply = safeReply as jest.MockedFunction<any>

jest.mock('@/utils/imageHelpers.js', () => ({
  buildImageSuccessResponse: jest.fn() as jest.MockedFunction<any>,
}))

import { buildImageSuccessResponse } from '@/utils/imageHelpers.js'
const mockBuildImageSuccessResponse = buildImageSuccessResponse as jest.MockedFunction<any>

import geminiCommand from '@/commands/gemini.js'

describe('Gemini Command', () => {
  let mockInteraction: ChatInputCommandInteraction

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default successful flow
    mockCheckGeminiAvailability.mockResolvedValue(true)
    mockSafeReply.mockResolvedValue(undefined)
    mockHandleGeminiResultErrorWithButton.mockResolvedValue(undefined)
    mockHandleGeminiErrorWithButton.mockResolvedValue(undefined)
    mockBuildImageSuccessResponse.mockReturnValue({
      content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
      files: [{}],
      components: [{}],
    })

    mockInteraction = createMockChatInputInteraction({
      options: {
        getString: jest.fn().mockReturnValue('test prompt'),
      } as any,
      user: {
        tag: 'TestUser#1234',
        username: 'testuser',
        id: 'user123',
      } as any,
      guild: {
        name: 'TestGuild',
      } as any,
    })
  })

  describe('Command Structure', () => {
    it('should have correct command data', () => {
      expect(geminiCommand.data.name).toBe('gemini') // Actual command name
      expect(geminiCommand.cooldown).toBe(30)
      expect(typeof geminiCommand.execute).toBe('function')
    })
  })

  describe('Service Availability Check', () => {
    it('should check availability and return early if service unavailable', async () => {
      mockCheckGeminiAvailability.mockResolvedValue(false)

      await geminiCommand.execute(mockInteraction)

      expect(mockCheckGeminiAvailability).toHaveBeenCalledWith(mockInteraction, 'Image generation')
      expect(mockGeminiService.generateImage).not.toHaveBeenCalled()
      expect(mockSafeReply).not.toHaveBeenCalled()
    })

    it('should proceed with generation when service is available', async () => {
      mockCheckGeminiAvailability.mockResolvedValue(true)
      mockGeminiService.generateImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('fake-image-data'),
      })

      await geminiCommand.execute(mockInteraction)

      expect(mockCheckGeminiAvailability).toHaveBeenCalledWith(mockInteraction, 'Image generation')
      expect(mockInteraction.deferReply).toHaveBeenCalled()
      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('test prompt')
    })
  })

  describe('Successful Image Generation', () => {
    beforeEach(() => {
      mockCheckGeminiAvailability.mockResolvedValue(true)
      mockGeminiService.generateImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('fake-image-data'),
      })
    })

    it('should generate image and send success response with buttons', async () => {
      await geminiCommand.execute(mockInteraction)

      // Verify the flow
      expect(mockInteraction.deferReply).toHaveBeenCalled()
      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('test prompt')
      
      // Verify success response building
      expect(mockBuildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('fake-image-data') },
        'testuser',
        'test prompt',
        'user123',
        'generated'
      )
      
      // Verify response sent
      expect(mockSafeReply).toHaveBeenCalledWith(mockInteraction, {
        content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
        files: [{}],
        components: [{}],
      })
    })

    it('should work in DMs without guild context', async () => {
      const dmInteraction = createMockChatInputInteraction({
        guild: null,
        options: {
          getString: jest.fn().mockReturnValue('dm test prompt'),
        } as any,
        user: {
          username: 'dmuser',
          id: 'dmuser456',
        } as any,
      })

      await geminiCommand.execute(dmInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('dm test prompt')
      expect(mockBuildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('fake-image-data') },
        'dmuser',
        'dm test prompt',
        'dmuser456',
        'generated'
      )
    })

    it('should handle prompts with special characters correctly', async () => {
      const specialPrompt = 'robot with ñice émojis 🤖✨ & symbols!'
      const specialInteraction = createMockChatInputInteraction({
        options: {
          getString: jest.fn().mockReturnValue(specialPrompt),
        } as any,
      })

      await geminiCommand.execute(specialInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(specialPrompt)
      expect(mockBuildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('fake-image-data') },
        'testuser',
        specialPrompt,
        'user123',
        'generated'
      )
    })

    it('should handle long prompts correctly', async () => {
      const longPrompt = 'a'.repeat(999) // Just under the 1000 char limit
      const longPromptInteraction = createMockChatInputInteraction({
        options: {
          getString: jest.fn().mockReturnValue(longPrompt),
        } as any,
      })

      mockBuildImageSuccessResponse.mockReturnValue({
        content: `🎨 **Image generated successfully!**\n**Prompt:** ${longPrompt}`,
        files: [{}],
        components: [{}],
      })

      await geminiCommand.execute(longPromptInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(longPrompt)
      expect(mockSafeReply).toHaveBeenCalledWith(longPromptInteraction, {
        content: `🎨 **Image generated successfully!**\n**Prompt:** ${longPrompt}`,
        files: [{}],
        components: [{}],
      })
    })
  })

  describe('Failed Image Generation', () => {
    beforeEach(() => {
      mockCheckGeminiAvailability.mockResolvedValue(true)
    })

    it('should handle generation failure with specific error message', async () => {
      mockGeminiService.generateImage.mockResolvedValue({
        success: false,
        error: 'Content blocked: SAFETY',
      })

      await geminiCommand.execute(mockInteraction)

      expect(mockHandleGeminiResultErrorWithButton).toHaveBeenCalledWith(
        mockInteraction,
        'Content blocked: SAFETY',
        'Prompt',
        'test prompt',
        'user123'
      )
      expect(mockSafeReply).not.toHaveBeenCalled()
    })

    it('should handle generation failure with default error message', async () => {
      mockGeminiService.generateImage.mockResolvedValue({
        success: false,
      })

      await geminiCommand.execute(mockInteraction)

      expect(mockHandleGeminiResultErrorWithButton).toHaveBeenCalledWith(
        mockInteraction,
        'Failed to generate image',
        'Prompt',
        'test prompt',
        'user123'
      )
    })

    it('should handle service exceptions', async () => {
      const apiError = new Error('API rate limit exceeded')
      mockGeminiService.generateImage.mockRejectedValue(apiError)

      await geminiCommand.execute(mockInteraction)

      expect(mockHandleGeminiErrorWithButton).toHaveBeenCalledWith(
        mockInteraction,
        apiError,
        'Failed to generate image',
        'test prompt',
        'user123'
      )
    })

    it('should handle unknown exceptions', async () => {
      const unknownError = 'Network timeout'
      mockGeminiService.generateImage.mockRejectedValue(unknownError)

      await geminiCommand.execute(mockInteraction)

      expect(mockHandleGeminiErrorWithButton).toHaveBeenCalledWith(
        mockInteraction,
        unknownError,
        'Failed to generate image',
        'test prompt',
        'user123'
      )
    })
  })

  describe('Parameter Extraction', () => {
    it('should correctly extract prompt from interaction options', async () => {
      const customPrompt = 'a majestic dragon in the clouds'
      const customInteraction = createMockChatInputInteraction({
        options: {
          getString: jest.fn().mockImplementation((name, required) => {
            if (name === 'prompt' && required === true) {
              return customPrompt
            }
            return null
          }),
        } as any,
      })

      mockGeminiService.generateImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('dragon-image-data'),
      })

      await geminiCommand.execute(customInteraction)

      expect(customInteraction.options.getString).toHaveBeenCalledWith('prompt', true)
      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(customPrompt)
    })
  })

  describe('Error Handling Integration', () => {
    it('should not proceed if availability check fails', async () => {
      mockCheckGeminiAvailability.mockResolvedValue(false)

      await geminiCommand.execute(mockInteraction)

      expect(mockInteraction.deferReply).not.toHaveBeenCalled()
      expect(mockGeminiService.generateImage).not.toHaveBeenCalled()
      expect(mockSafeReply).not.toHaveBeenCalled()
    })
  })
})