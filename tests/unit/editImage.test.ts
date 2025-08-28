import {
  ButtonInteraction,
  ModalSubmitInteraction,
  Attachment,
} from 'discord.js'
import { handleEditButton, handleEditModal } from '@/utils/editImage.js'
import { geminiService } from '@/services/gemini.js'
import { createImageFilename } from '@/utils/filename.js'
import { checkGeminiAvailability, handleGeminiResultError, handleGeminiError, safeReply } from '@/utils/interactionHelpers.js'
import { buildImageSuccessResponse } from '@/utils/imageHelpers.js'
import { createEditModal } from '@/utils/modalHelpers.js'

// Mock dependencies
jest.mock('@/services/gemini.js')
jest.mock('@/utils/filename.js')
jest.mock('@/config/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

// Mock the new helper utilities
jest.mock('@/utils/interactionHelpers.js', () => ({
  checkGeminiAvailability: jest.fn(),
  handleGeminiResultError: jest.fn(),
  handleGeminiError: jest.fn(),
  safeReply: jest.fn(),
}))

jest.mock('@/utils/imageHelpers.js', () => ({
  buildImageSuccessResponse: jest.fn().mockReturnValue({
    content: '✏️ **Image edited successfully!**\n**Edit Request:** Add a sunset background',
    files: [{}],
    components: [{}],
  }),
}))

jest.mock('@/utils/modalHelpers.js', () => ({
  createEditModal: jest.fn().mockReturnValue({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis(),
  }),
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

    // Setup mocks for the new helper functions
    ;(checkGeminiAvailability as any).mockResolvedValue(true)
    ;(safeReply as any).mockResolvedValue(undefined)
    ;(handleGeminiResultError as any).mockResolvedValue(undefined)
    ;(handleGeminiError as any).mockResolvedValue(undefined)
    ;(buildImageSuccessResponse as jest.Mock).mockReturnValue({
      content: '✏️ **Image edited successfully!**\n**Edit Request:** Add a sunset background',
      files: [{}],
      components: [{}],
    })

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

      expect(createEditModal).toHaveBeenCalledWith('user123')
      expect(mockButtonInteraction.showModal).toHaveBeenCalledTimes(1)
    })

    it('should create modal with correct properties', async () => {
      await handleEditButton(mockButtonInteraction)

      expect(createEditModal).toHaveBeenCalledWith('user123')
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
      ;(checkGeminiAvailability as jest.Mock).mockResolvedValue(false)

      await handleEditModal(mockModalInteraction)

      expect(checkGeminiAvailability).toHaveBeenCalledWith(mockModalInteraction, 'Image editing')
    })

    it('should return error if no original image is found', async () => {
      ;(mockModalInteraction.message!.attachments.first as jest.Mock).mockReturnValue(null)

      await handleEditModal(mockModalInteraction)

      expect(safeReply).toHaveBeenCalledWith(mockModalInteraction, {
        content: '❌ Could not find the original image to edit.',
        ephemeral: true,
      })
    })

    it('should successfully edit image and return result', async () => {
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

      expect(buildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('edited-image-data') },
        'TestUser',
        'Add a sunset background',
        'user123',
        'edited',
        'Edit Request'
      )

      expect(safeReply).toHaveBeenCalledWith(mockModalInteraction, {
        content: '✏️ **Image edited successfully!**\n**Edit Request:** Add a sunset background',
        files: [{}],
        components: [{}],
      })
    })

    it('should handle edit failure', async () => {
      mockGeminiService.editImage.mockResolvedValue({
        success: false,
        error: 'Content blocked',
      })

      await handleEditModal(mockModalInteraction)

      expect(handleGeminiResultError).toHaveBeenCalledWith(
        mockModalInteraction,
        'Content blocked',
        'Edit Request',
        'Add a sunset background'
      )
    })

    it('should handle service errors', async () => {
      mockGeminiService.editImage.mockRejectedValue(new Error('API Error'))

      await handleEditModal(mockModalInteraction)

      expect(handleGeminiError).toHaveBeenCalledWith(
        mockModalInteraction,
        new Error('API Error'),
        'Failed to edit image'
      )
    })

    it('should create both edit and regenerate buttons in response', async () => {
      mockGeminiService.editImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('edited-image-data'),
      })

      await handleEditModal(mockModalInteraction)

      expect(buildImageSuccessResponse).toHaveBeenCalledWith(
        { success: true, buffer: Buffer.from('edited-image-data') },
        'TestUser',
        'Add a sunset background',
        'user123',
        'edited',
        'Edit Request'
      )
      
      // Verify components are included in the response
      expect(safeReply).toHaveBeenCalledWith(mockModalInteraction, expect.objectContaining({
        components: [{}]
      }))
    })
  })
})