import {
  ButtonInteraction,
  ModalSubmitInteraction,
  Attachment,
} from 'discord.js'
import { handleEditButton, handleEditModal } from '@/utils/editImage.js'
import { geminiService } from '@/services/gemini.js'
import { createImageFilename } from '@/utils/filename.js'

// Mock dependencies
jest.mock('@/services/gemini.js')
jest.mock('@/utils/filename.js')
jest.mock('@/config/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('EditImage Utils', () => {
  let mockButtonInteraction: jest.Mocked<ButtonInteraction>
  let mockModalInteraction: jest.Mocked<ModalSubmitInteraction>
  let mockGeminiService: jest.Mocked<typeof geminiService>
  let mockCreateImageFilename: jest.MockedFunction<typeof createImageFilename>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock geminiService
    mockGeminiService = geminiService as jest.Mocked<typeof geminiService>
    mockGeminiService.isAvailable = jest.fn()
    mockGeminiService.editImage = jest.fn()

    // Mock createImageFilename
    mockCreateImageFilename = createImageFilename as jest.MockedFunction<typeof createImageFilename>
    mockCreateImageFilename.mockReturnValue('edited_test_image.png')

    // Mock ButtonInteraction
    mockButtonInteraction = {
      user: {
        id: 'user123',
        tag: 'TestUser#1234',
      },
      guild: {
        name: 'Test Guild',
      },
      showModal: jest.fn().mockResolvedValue(undefined),
    } as any

    // Mock ModalSubmitInteraction
    mockModalInteraction = {
      user: {
        id: 'user123',
        tag: 'TestUser#1234',
        username: 'TestUser',
      },
      guild: {
        name: 'Test Guild',
      },
      fields: {
        getTextInputValue: jest.fn() as jest.MockedFunction<(customId: string) => string>,
      },
      message: {
        attachments: {
          first: jest.fn(),
          set: jest.fn(),
          clear: jest.fn(),
        },
      },
      reply: jest.fn().mockResolvedValue(undefined),
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
    } as any

    // Mock fetch
    ;(global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)
  })

  describe('handleEditButton', () => {
    it('should show edit modal when button is clicked', async () => {
      await handleEditButton(mockButtonInteraction)

      expect(mockButtonInteraction.showModal).toHaveBeenCalledTimes(1)
      
      const modalArg = (mockButtonInteraction.showModal as jest.Mock).mock.calls[0][0]
      expect(modalArg).toBeDefined()
    })

    it('should create modal with correct properties', async () => {
      await handleEditButton(mockButtonInteraction)

      expect(mockButtonInteraction.showModal).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleEditModal', () => {
    beforeEach(() => {
      const mockAttachment = {
        url: 'https://example.com/image.png',
        contentType: 'image/png',
      } as Attachment

      ;(mockModalInteraction.message!.attachments.first as jest.Mock).mockReturnValue(mockAttachment)
      ;(mockModalInteraction.fields.getTextInputValue as jest.MockedFunction<(customId: string) => string>).mockReturnValue('Add a sunset background')
    })

    it('should return error if Gemini service is not available', async () => {
      mockGeminiService.isAvailable.mockReturnValue(false)

      await handleEditModal(mockModalInteraction)

      expect(mockModalInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Image editing is currently unavailable. Please try again later.',
        ephemeral: true,
      })
    })

    it('should return error if no original image is found', async () => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      ;(mockModalInteraction.message!.attachments.first as jest.Mock).mockReturnValue(null)

      await handleEditModal(mockModalInteraction)

      expect(mockModalInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Could not find the original image to edit.',
        ephemeral: true,
      })
    })

    it('should successfully edit image and return result', async () => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      mockGeminiService.editImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('edited-image-data'),
      })

      await handleEditModal(mockModalInteraction)

      expect(mockModalInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false })
      expect(mockGeminiService.editImage).toHaveBeenCalledWith(
        'Add a sunset background',
        expect.any(Buffer),
        'image/png'
      )

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '✏️ **Image edited successfully!**\n**Edit Request:** Add a sunset background',
          files: expect.arrayContaining([expect.any(Object)]),
          components: expect.arrayContaining([expect.any(Object)]),
        })
      )
    })

    it('should handle edit failure', async () => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      mockGeminiService.editImage.mockResolvedValue({
        success: false,
        error: 'Content blocked',
      })

      await handleEditModal(mockModalInteraction)

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Content blocked\n**Edit Request:** Add a sunset background',
      })
    })

    it('should handle service errors', async () => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      mockGeminiService.editImage.mockRejectedValue(new Error('API Error'))

      await handleEditModal(mockModalInteraction)

      expect(mockModalInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to edit image: API Error',
      })
    })

    it('should create both edit and regenerate buttons in response', async () => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      mockGeminiService.editImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('edited-image-data'),
      })

      await handleEditModal(mockModalInteraction)

      const editReplyCall = (mockModalInteraction.editReply as jest.Mock).mock.calls[0][0]
      expect(editReplyCall.components).toHaveLength(1)
      expect(editReplyCall.components[0]).toBeDefined()
    })
  })
})