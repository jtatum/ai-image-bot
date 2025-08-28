import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ModalSubmitInteraction } from 'discord.js'
import { handleRegenerateButton, handleRegenerateModal } from '@/utils/regenerateImage.js'
import { createMockButtonInteraction, createMockModalInteraction } from '../helpers/mockInteractions.js'

// Mock the gemini service
jest.mock('@/services/gemini.js', () => ({
  geminiService: {
    isAvailable: jest.fn() as jest.MockedFunction<any>,
    generateImage: jest.fn() as jest.MockedFunction<any>,
  },
}))

import { geminiService } from '@/services/gemini.js'
const mockGeminiService = geminiService as any

// Mock the helper utilities
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

jest.mock('@/utils/modalHelpers.js', () => ({
  createRegenerateModal: jest.fn() as jest.MockedFunction<any>,
}))

import { createRegenerateModal } from '@/utils/modalHelpers.js'
const mockCreateRegenerateModal = createRegenerateModal as jest.MockedFunction<any>

describe('Regenerate Image Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default successful flow
    mockCheckGeminiAvailability.mockResolvedValue(true)
    mockSafeReply.mockResolvedValue(undefined)
    mockHandleGeminiResultErrorWithButton.mockResolvedValue(undefined)
    mockHandleGeminiErrorWithButton.mockResolvedValue(undefined)
    mockGeminiService.generateImage.mockResolvedValue({
      success: true,
      buffer: Buffer.from('fake-image-data'),
    })
    mockBuildImageSuccessResponse.mockReturnValue({
      content: '🎨 **Image regenerated successfully!**\n**Prompt:** a futuristic robot playing chess',
      files: [{}],
      components: [{}],
    })
    mockCreateRegenerateModal.mockReturnValue({
      setCustomId: jest.fn().mockReturnThis(),
      setTitle: jest.fn().mockReturnThis(),
      addComponents: jest.fn().mockReturnThis(),
    })
  })

  describe('handleRegenerateButton', () => {
    it('should extract prompt from message and show modal', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        message: {
          content: '🎨 **Image generated successfully!**\n**Prompt:** a futuristic robot playing chess',
        } as any,
        user: {
          id: 'user123',
        } as any,
      })

      await handleRegenerateButton(mockButtonInteraction)

      expect(mockCreateRegenerateModal).toHaveBeenCalledWith('user123', 'a futuristic robot playing chess')
      expect(mockButtonInteraction.showModal).toHaveBeenCalled()
    })

    it('should handle message with no prompt gracefully', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        message: {
          content: 'Some message without prompt format',
        } as any,
        user: {
          id: 'user456',
        } as any,
      })

      await handleRegenerateButton(mockButtonInteraction)

      expect(mockCreateRegenerateModal).toHaveBeenCalledWith('user456', '')
      expect(mockButtonInteraction.showModal).toHaveBeenCalled()
    })

    it('should handle different prompt formats', async () => {
      const testCases = [
        {
          content: '🎨 **Image generated successfully!**\n**Prompt:** complex prompt with special characters!@#$%',
          expectedPrompt: 'complex prompt with special characters!@#$%'
        },
        {
          content: '✏️ **Image edited successfully!**\n**Prompt:** another test prompt',
          expectedPrompt: 'another test prompt'
        },
      ]

      for (const testCase of testCases) {
        jest.clearAllMocks()
        
        const mockButtonInteraction = createMockButtonInteraction({
          message: {
            content: testCase.content,
          } as any,
          user: {
            id: 'testuser',
          } as any,
        })

        await handleRegenerateButton(mockButtonInteraction)

        expect(mockCreateRegenerateModal).toHaveBeenCalledWith('testuser', testCase.expectedPrompt)
      }
    })
  })

  describe('handleRegenerateModal', () => {
    let mockModalInteraction: ModalSubmitInteraction

    beforeEach(() => {
      mockModalInteraction = createMockModalInteraction({
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('a futuristic robot playing chess'),
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

    it('should successfully regenerate image when service is available', async () => {
      await handleRegenerateModal(mockModalInteraction)

      // Verify the flow
      expect(mockCheckGeminiAvailability).toHaveBeenCalledWith(mockModalInteraction, 'Image generation')
      expect(mockModalInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false })
      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('a futuristic robot playing chess')
      
      expect(mockBuildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('fake-image-data') },
        'testuser',
        'a futuristic robot playing chess',
        'user123',
        'regenerated'
      )
      
      expect(mockSafeReply).toHaveBeenCalledWith(mockModalInteraction, {
        content: '🎨 **Image regenerated successfully!**\n**Prompt:** a futuristic robot playing chess',
        files: [{}],
        components: [{}],
      })
    })

    it('should handle Gemini service unavailable', async () => {
      mockCheckGeminiAvailability.mockResolvedValue(false)

      await handleRegenerateModal(mockModalInteraction)

      expect(mockCheckGeminiAvailability).toHaveBeenCalledWith(mockModalInteraction, 'Image generation')
      expect(mockGeminiService.generateImage).not.toHaveBeenCalled()
      expect(mockModalInteraction.deferReply).not.toHaveBeenCalled()
    })

    it('should handle image generation failure with specific error', async () => {
      mockGeminiService.generateImage.mockResolvedValue({
        success: false,
        error: 'Content blocked: SAFETY',
      })

      await handleRegenerateModal(mockModalInteraction)

      expect(mockHandleGeminiResultErrorWithButton).toHaveBeenCalledWith(
        mockModalInteraction,
        'Content blocked: SAFETY',
        'Prompt',
        'a futuristic robot playing chess',
        'user123'
      )
      expect(mockSafeReply).not.toHaveBeenCalled()
    })

    it('should handle image generation failure with default message', async () => {
      mockGeminiService.generateImage.mockResolvedValue({
        success: false,
      })

      await handleRegenerateModal(mockModalInteraction)

      expect(mockHandleGeminiResultErrorWithButton).toHaveBeenCalledWith(
        mockModalInteraction,
        'Failed to generate image',
        'Prompt',
        'a futuristic robot playing chess',
        'user123'
      )
    })

    it('should handle exceptions during image generation', async () => {
      const apiError = new Error('API Error')
      mockGeminiService.generateImage.mockRejectedValue(apiError)

      await handleRegenerateModal(mockModalInteraction)

      expect(mockHandleGeminiErrorWithButton).toHaveBeenCalledWith(
        mockModalInteraction,
        apiError,
        'Failed to regenerate image',
        'a futuristic robot playing chess',
        'user123'
      )
    })

    it('should handle unknown errors', async () => {
      const unknownError = 'Network timeout'
      mockGeminiService.generateImage.mockRejectedValue(unknownError)

      await handleRegenerateModal(mockModalInteraction)

      expect(mockHandleGeminiErrorWithButton).toHaveBeenCalledWith(
        mockModalInteraction,
        unknownError,
        'Failed to regenerate image',
        'a futuristic robot playing chess',
        'user123'
      )
    })

    it('should work without guild context (DMs)', async () => {
      const dmModalInteraction = createMockModalInteraction({
        guild: null,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('dm regenerate test'),
        } as any,
        user: {
          username: 'dmuser',
          id: 'dmuser789',
          tag: 'DmUser#9876',
        } as any,
      })

      await handleRegenerateModal(dmModalInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('dm regenerate test')
      expect(mockBuildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('fake-image-data') },
        'dmuser',
        'dm regenerate test',
        'dmuser789',
        'regenerated'
      )
    })

    it('should extract correct prompt from modal fields', async () => {
      const customPrompts = [
        'a majestic dragon soaring through clouds',
        'cyberpunk city at night with neon lights',
        'peaceful forest scene with sunlight filtering through trees'
      ]

      for (const prompt of customPrompts) {
        jest.clearAllMocks()
        mockGeminiService.generateImage.mockResolvedValue({
          success: true,
          buffer: Buffer.from('test-image-data'),
        })

        const customModalInteraction = createMockModalInteraction({
          fields: {
            getTextInputValue: jest.fn().mockImplementation((fieldName) => {
              if (fieldName === 'prompt') {
                return prompt
              }
              return null
            }),
          } as any,
        })

        await handleRegenerateModal(customModalInteraction)

        expect(customModalInteraction.fields.getTextInputValue).toHaveBeenCalledWith('prompt')
        expect(mockGeminiService.generateImage).toHaveBeenCalledWith(prompt)
      }
    })

    it('should handle long prompts correctly', async () => {
      const longPrompt = 'a'.repeat(995) // Near the limit
      const longPromptInteraction = createMockModalInteraction({
        fields: {
          getTextInputValue: jest.fn().mockReturnValue(longPrompt),
        } as any,
      })

      await handleRegenerateModal(longPromptInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(longPrompt)
      expect(mockBuildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('fake-image-data') },
        'testuser',
        longPrompt,
        'user123',
        'regenerated'
      )
    })

    it('should log correct information during regeneration', async () => {
      const testPrompt = 'test logging prompt'
      const loggingInteraction = createMockModalInteraction({
        fields: {
          getTextInputValue: jest.fn().mockReturnValue(testPrompt),
        } as any,
        user: {
          tag: 'LogTest#1111',
        } as any,
        guild: {
          name: 'LogTestGuild',
        } as any,
      })

      await handleRegenerateModal(loggingInteraction)

      // This test verifies the logging integration
      // The actual logging is mocked in setup.ts, but we can verify the flow completed
      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(testPrompt)
      expect(mockSafeReply).toHaveBeenCalled()
    })
  })
})