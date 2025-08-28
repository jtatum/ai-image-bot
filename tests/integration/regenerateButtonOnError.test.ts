import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { buildImageErrorResponse } from '@/utils/imageHelpers.js'
import { createRegenerateOnlyButton } from '@/utils/buttons.js'

// Mock the buttons module to return a simple mock action row
jest.mock('@/utils/buttons.js', () => ({
  createRegenerateOnlyButton: jest.fn(),
  createImageActionButtons: jest.fn(),
}))

const mockCreateRegenerateOnlyButton = createRegenerateOnlyButton as jest.MockedFunction<typeof createRegenerateOnlyButton>

describe('Regenerate Button on Error Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock the button creation to return a simple structure
    mockCreateRegenerateOnlyButton.mockReturnValue({
      components: [{
        toJSON: () => ({ custom_id: 'regenerate_user123_123456789', type: 2, style: 2, label: '🔄' })
      }]
    } as any)
  })

  describe('buildImageErrorResponse', () => {
    it('should build error response with regenerate button', () => {
      const errorMessage = 'Failed to generate image'
      const contextLabel = 'Prompt'
      const prompt = 'a cute robot'
      const userId = 'user123'

      const response = buildImageErrorResponse(errorMessage, contextLabel, prompt, userId)

      expect(response).toEqual({
        content: '❌ Failed to generate image\n**Prompt:** a cute robot',
        ephemeral: false,
        components: expect.any(Array)
      })

      expect(response.components).toHaveLength(1)
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId)
    })

    it('should handle different context labels correctly', () => {
      const errorMessage = 'Safety filter triggered'
      const contextLabel = 'Edit Request'
      const prompt = 'add sunset background'
      const userId = 'user456'

      const response = buildImageErrorResponse(errorMessage, contextLabel, prompt, userId)

      expect(response.content).toBe('❌ Safety filter triggered\n**Edit Request:** add sunset background')
      expect(response.ephemeral).toBe(false)
      expect(response.components).toHaveLength(1)
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId)
    })

    it('should create buttons with user-specific IDs', () => {
      const userId1 = 'user123'
      const userId2 = 'user456'

      buildImageErrorResponse('Error 1', 'Prompt', 'prompt1', userId1)
      buildImageErrorResponse('Error 2', 'Prompt', 'prompt2', userId2)

      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId1)
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledWith(userId2)
      expect(mockCreateRegenerateOnlyButton).toHaveBeenCalledTimes(2)
    })
  })

  describe('createRegenerateOnlyButton functionality', () => {
    it('should be called when building error responses', () => {
      // Reset the mock to use the real implementation for this test
      jest.resetModules()
      
      // Import the real function
      const { createRegenerateOnlyButton: realCreateRegenerateOnlyButton } = 
        jest.requireActual('@/utils/buttons.js') as typeof import('@/utils/buttons.js')
      
      const userId = 'test123'
      const actionRow = realCreateRegenerateOnlyButton(userId)
      
      // Verify the structure without getting into Discord.js type issues
      expect(actionRow).toBeDefined()
      expect(actionRow.components).toBeDefined()
      expect(actionRow.components.length).toBe(1)
      
      // Verify the button has the correct pattern in its JSON representation
      const buttonJson = actionRow.components[0].toJSON() as any
      expect(buttonJson.custom_id).toMatch(/^regenerate_test123_\d+$/)
      expect(buttonJson.label).toBe('🔄')
    })
  })
})