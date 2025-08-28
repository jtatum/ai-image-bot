import { describe, it, expect, jest } from '@jest/globals'
import { buildImageErrorResponse } from '@/utils/imageHelpers.js'
import { createRegenerateOnlyButton } from '@/utils/buttons.js'

// Mock the buttons module
jest.mock('@/utils/buttons.js', () => ({
  createImageActionButtons: jest.fn(),
  createRegenerateOnlyButton: jest.fn(),
}))

const mockCreateRegenerateOnlyButton = createRegenerateOnlyButton as jest.MockedFunction<typeof createRegenerateOnlyButton>

describe('Image helpers', () => {
  describe('buildImageErrorResponse', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      
      // Mock button creation to return a mock ActionRow
      mockCreateRegenerateOnlyButton.mockReturnValue({
        components: [{
          data: {
            custom_id: 'regenerate_user123_123456789',
            label: '🔄',
            style: 2
          }
        }]
      } as any)
    })

    it('should build error response with regenerate button', () => {
      const errorMessage = 'Failed to generate image'
      const contextLabel = 'Prompt'
      const prompt = 'a cute robot'
      const userId = 'user123'

      const response = buildImageErrorResponse(errorMessage, contextLabel, prompt, userId)

      expect(response).toEqual({
        content: '<@user123> ❌ Failed to generate image\n**Prompt:** a cute robot',
        ephemeral: false,
        components: [expect.any(Object)]
      })

      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId)
    })

    it('should handle different context labels', () => {
      const errorMessage = 'Safety filter triggered'
      const contextLabel = 'Edit Request'
      const prompt = 'add sunset background'
      const userId = 'user456'

      const response = buildImageErrorResponse(errorMessage, contextLabel, prompt, userId)

      expect(response.content).toBe('<@user456> ❌ Safety filter triggered\n**Edit Request:** add sunset background')
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId)
    })

    it('should handle long prompts', () => {
      const errorMessage = 'Rate limit exceeded'
      const contextLabel = 'Prompt'
      const prompt = 'a very long prompt that contains many words and describes a complex scene with lots of details'
      const userId = 'user789'

      const response = buildImageErrorResponse(errorMessage, contextLabel, prompt, userId)

      expect(response.content).toContain(prompt)
      expect(response.ephemeral).toBe(false)
      expect(response.components).toHaveLength(1)
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId)
    })

    it('should handle empty error message', () => {
      const errorMessage = ''
      const contextLabel = 'Prompt'
      const prompt = 'test prompt'
      const userId = 'user123'

      const response = buildImageErrorResponse(errorMessage, contextLabel, prompt, userId)

      expect(response.content).toBe('<@user123> ❌ \n**Prompt:** test prompt')
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId)
    })
  })
})