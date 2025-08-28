import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ButtonInteraction, ModalSubmitInteraction } from 'discord.js'
import { handleRegenerateButton, handleRegenerateModal } from '@/utils/regenerateImage.js'

// Mock the gemini service
jest.mock('@/services/gemini.js', () => ({
  geminiService: {
    isAvailable: jest.fn(),
    generateImage: jest.fn(),
  },
}))

// Mock the filename utility
jest.mock('@/utils/filename.js', () => ({
  createImageFilename: jest.fn().mockReturnValue('test_image.png'),
}))

// Import the mocked modules
import { geminiService } from '@/services/gemini.js'
import { createImageFilename } from '@/utils/filename.js'

describe('Regenerate Image Utils', () => {
  let mockButtonInteraction: Partial<ButtonInteraction>
  let mockModalInteraction: Partial<ModalSubmitInteraction>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock button interaction
    // @ts-ignore
    mockButtonInteraction = {
      customId: 'regenerate_user123_1234567890',
      user: { id: 'user123', tag: 'TestUser#1234' },
      message: {
        content: '🎨 **Image generated successfully!**\n**Prompt:** a cute robot playing chess',
      },
      // @ts-ignore
      showModal: jest.fn().mockResolvedValue({}),
    } as any

    // Mock modal interaction
    // @ts-ignore
    mockModalInteraction = {
      customId: 'regenerate_modal_user123_1234567890',
      user: { id: 'user123', tag: 'TestUser#1234', username: 'testuser' },
      guild: { name: 'TestGuild' },
      fields: {
        getTextInputValue: jest.fn().mockReturnValue('a futuristic robot playing chess'),
      },
      // @ts-ignore
      deferReply: jest.fn().mockResolvedValue({}),
      // @ts-ignore
      editReply: jest.fn().mockResolvedValue({}),
      // @ts-ignore
      reply: jest.fn().mockResolvedValue({}),
    } as any
  })

  describe('handleRegenerateButton', () => {
    it('should extract prompt from message content and show modal', async () => {
      await handleRegenerateButton(mockButtonInteraction as ButtonInteraction)

      expect(mockButtonInteraction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          setCustomId: expect.any(Function),
          setTitle: expect.any(Function),
          addComponents: expect.any(Function),
        })
      )
    })

    it('should handle missing prompt in message content', async () => {
      mockButtonInteraction.message = {
        content: '🎨 **Image generated successfully!**\nNo prompt found',
      } as any

      await handleRegenerateButton(mockButtonInteraction as ButtonInteraction)

      expect(mockButtonInteraction.showModal).toHaveBeenCalled()
    })

    it('should handle empty message content', async () => {
      mockButtonInteraction.message = {
        content: '',
      } as any

      await handleRegenerateButton(mockButtonInteraction as ButtonInteraction)

      expect(mockButtonInteraction.showModal).toHaveBeenCalled()
    })
  })

  describe('handleRegenerateModal', () => {
    beforeEach(() => {
      ;(geminiService.isAvailable as jest.Mock).mockReturnValue(true)
      // @ts-ignore
      ;(geminiService.generateImage as jest.Mock).mockResolvedValue({
        success: true,
        buffer: Buffer.from('fake-image-data'),
      })
    })

    it('should generate image successfully and reply with attachment', async () => {
      await handleRegenerateModal(mockModalInteraction as any)

      expect(geminiService.generateImage).toHaveBeenCalledWith('a futuristic robot playing chess')
      expect(createImageFilename).toHaveBeenCalledWith('testuser', 'a futuristic robot playing chess')
      expect(mockModalInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false })
      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '🎨 **Image regenerated successfully!**\n**Prompt:** a futuristic robot playing chess',
        files: [expect.any(Object)],
        components: [expect.any(Object)],
      })
    })

    it('should handle Gemini service unavailable', async () => {
      ;(geminiService.isAvailable as jest.Mock).mockReturnValue(false)

      await handleRegenerateModal(mockModalInteraction as any)

      expect(mockModalInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Image generation is currently unavailable. Please try again later.',
        ephemeral: true,
      })
      expect(geminiService.generateImage).not.toHaveBeenCalled()
    })

    it('should handle image generation failure', async () => {
      // @ts-ignore
      ;(geminiService.generateImage as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Content blocked: SAFETY',
      })

      await handleRegenerateModal(mockModalInteraction as any)

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Content blocked: SAFETY\n**Prompt:** a futuristic robot playing chess',
      })
    })

    it('should handle image generation error with default message', async () => {
      // @ts-ignore
      ;(geminiService.generateImage as jest.Mock).mockResolvedValue({
        success: false,
      })

      await handleRegenerateModal(mockModalInteraction as any)

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to generate image\n**Prompt:** a futuristic robot playing chess',
      })
    })

    it('should handle exceptions during image generation', async () => {
      // @ts-ignore
      ;(geminiService.generateImage as jest.Mock).mockRejectedValue(new Error('API Error'))

      await handleRegenerateModal(mockModalInteraction as any)

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to regenerate image: API Error',
      })
    })

    it('should handle unknown errors', async () => {
      // @ts-ignore
      ;(geminiService.generateImage as jest.Mock).mockRejectedValue('Unknown error')

      await handleRegenerateModal(mockModalInteraction as any)

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to regenerate image: Unknown error occurred',
      })
    })

    it('should work without guild context (DMs)', async () => {
      const dmModalInteraction = { ...mockModalInteraction, guild: null }

      await handleRegenerateModal(dmModalInteraction as any)

      expect(geminiService.generateImage).toHaveBeenCalledWith('a futuristic robot playing chess')
      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '🎨 **Image regenerated successfully!**\n**Prompt:** a futuristic robot playing chess',
        files: [expect.any(Object)],
        components: [expect.any(Object)],
      })
    })
  })
})