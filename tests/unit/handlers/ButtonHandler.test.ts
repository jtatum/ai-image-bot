import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ButtonHandler, ButtonHandlerFunction, ButtonHandlerConfig } from '@/infrastructure/discord/handlers/ButtonHandler.js'
import { createMockButtonInteraction } from '../../helpers/mockInteractions.js'

// Mock the logger
jest.mock('@/config/logger.js', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

import logger from '@/config/logger.js'

const mockLogger = logger as jest.Mocked<typeof logger>

describe('ButtonHandler', () => {
  let buttonHandler: ButtonHandler
  let mockHandler1: jest.MockedFunction<ButtonHandlerFunction>
  let mockHandler2: jest.MockedFunction<ButtonHandlerFunction>

  beforeEach(() => {
    jest.clearAllMocks()
    buttonHandler = new ButtonHandler()
    
    mockHandler1 = jest.fn() as jest.MockedFunction<ButtonHandlerFunction>
    mockHandler2 = jest.fn() as jest.MockedFunction<ButtonHandlerFunction>
  })

  describe('registerHandler', () => {
    it('should register a handler successfully', () => {
      const config: ButtonHandlerConfig = {
        prefix: 'test_',
        handler: mockHandler1,
        description: 'Test handler',
      }

      buttonHandler.registerHandler(config)

      expect(buttonHandler.hasHandler('test_')).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered button handler for prefix: test_',
        { description: 'Test handler' }
      )
    })

    it('should register handler without description', () => {
      const config: ButtonHandlerConfig = {
        prefix: 'nodesc_',
        handler: mockHandler1,
      }

      buttonHandler.registerHandler(config)

      expect(buttonHandler.hasHandler('nodesc_')).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered button handler for prefix: nodesc_',
        { description: 'No description provided' }
      )
    })

    it('should warn when overriding existing handler', () => {
      const config1: ButtonHandlerConfig = {
        prefix: 'override_',
        handler: mockHandler1,
      }
      const config2: ButtonHandlerConfig = {
        prefix: 'override_',
        handler: mockHandler2,
      }

      buttonHandler.registerHandler(config1)
      buttonHandler.registerHandler(config2)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Button handler for prefix 'override_' is being overridden"
      )
      expect(buttonHandler.getHandlerInfo('override_')?.handler).toBe(mockHandler2)
    })
  })

  describe('registerHandlers', () => {
    it('should register multiple handlers at once', () => {
      const configs: ButtonHandlerConfig[] = [
        { prefix: 'multi1_', handler: mockHandler1 },
        { prefix: 'multi2_', handler: mockHandler2 },
      ]

      buttonHandler.registerHandlers(configs)

      expect(buttonHandler.hasHandler('multi1_')).toBe(true)
      expect(buttonHandler.hasHandler('multi2_')).toBe(true)
      expect(buttonHandler.getStats().totalHandlers).toBe(2)
    })

    it('should handle empty array', () => {
      buttonHandler.registerHandlers([])

      expect(buttonHandler.getStats().totalHandlers).toBe(0)
    })
  })

  describe('handleButton', () => {
    beforeEach(() => {
      buttonHandler.registerHandler({
        prefix: 'test_',
        handler: mockHandler1,
        description: 'Test handler',
      })
    })

    it('should handle button interaction successfully', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'test_user123',
      })

      await buttonHandler.handleButton(interaction)

      expect(mockHandler1).toHaveBeenCalledWith(interaction)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handling button interaction: test_user123',
        {
          userId: 'user123',
          guildId: 'guild123',
          handlerPrefix: 'test_',
        }
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Button interaction handled successfully: test_user123'
      )
    })

    it('should handle button without guild context', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'test_dm',
        guild: null,
      })

      await buttonHandler.handleButton(interaction)

      expect(mockHandler1).toHaveBeenCalledWith(interaction)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handling button interaction: test_dm',
        {
          userId: 'user123',
          guildId: undefined,
          handlerPrefix: 'test_',
        }
      )
    })

    it('should handle unknown button gracefully', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'unknown_button',
      })

      await buttonHandler.handleButton(interaction)

      expect(mockHandler1).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith('No handler found for button: unknown_button')
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ This button action is not recognized.',
          ephemeral: true,
        })
      )
    })

    it('should handle button handler errors', async () => {
      const error = new Error('Handler failed')
      mockHandler1.mockImplementation(() => Promise.reject(error))

      const interaction = createMockButtonInteraction({
        customId: 'test_error',
      })

      await buttonHandler.handleButton(interaction)

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in button handler for prefix 'test_':",
        error
      )
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ There was an error processing your button action!',
          ephemeral: true,
        })
      )
    })

    it('should handle button handler errors when interaction already replied', async () => {
      const error = new Error('Handler failed after reply')
      mockHandler1.mockImplementation(() => Promise.reject(error))

      const interaction = createMockButtonInteraction({
        customId: 'test_replied',
        replied: true,
      })

      await buttonHandler.handleButton(interaction)

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in button handler for prefix 'test_':",
        error
      )
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ There was an error processing your button action!',
          ephemeral: true,
        })
      )
    })

    it('should handle button handler errors when interaction deferred', async () => {
      const error = new Error('Handler failed after defer')
      mockHandler1.mockImplementation(() => Promise.reject(error))

      const interaction = createMockButtonInteraction({
        customId: 'test_deferred',
        deferred: true,
      })

      await buttonHandler.handleButton(interaction)

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ There was an error processing your button action!',
          ephemeral: true,
        })
      )
    })

    it('should handle reply failure during error handling', async () => {
      const handlerError = new Error('Handler failed')
      const replyError = new Error('Reply failed')
      
      mockHandler1.mockImplementation(() => Promise.reject(handlerError))

      const interaction = createMockButtonInteraction({
        customId: 'test_reply_fail',
      })
      interaction.reply = jest.fn().mockImplementation(() => Promise.reject(replyError)) as any

      // Should not throw despite reply failure
      await expect(buttonHandler.handleButton(interaction)).resolves.toBeUndefined()

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in button handler for prefix 'test_':",
        handlerError
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send button error message to user:',
        {
          originalError: handlerError,
          replyError,
          customId: 'test_reply_fail',
          userId: 'user123',
        }
      )
    })
  })

  describe('findHandler', () => {
    beforeEach(() => {
      buttonHandler.registerHandler({ prefix: 'gen_', handler: mockHandler1 })
      buttonHandler.registerHandler({ prefix: 'edit_', handler: mockHandler2 })
    })

    it('should find handler by prefix matching', () => {
      expect(buttonHandler.canHandle('gen_user123')).toBe(true)
      expect(buttonHandler.canHandle('edit_user456')).toBe(true)
      expect(buttonHandler.getMatchingPrefix('gen_user123')).toBe('gen_')
      expect(buttonHandler.getMatchingPrefix('edit_user456')).toBe('edit_')
    })

    it('should return undefined for non-matching custom ID', () => {
      expect(buttonHandler.canHandle('unknown_button')).toBe(false)
      expect(buttonHandler.getMatchingPrefix('unknown_button')).toBeUndefined()
    })

    it('should match longest prefix first', () => {
      buttonHandler.registerHandler({ prefix: 'long_prefix_', handler: mockHandler1 })
      buttonHandler.registerHandler({ prefix: 'long_', handler: mockHandler2 })

      expect(buttonHandler.getMatchingPrefix('long_prefix_test')).toBe('long_prefix_')
      expect(buttonHandler.getMatchingPrefix('long_test')).toBe('long_')
    })
  })

  describe('unregisterHandler', () => {
    beforeEach(() => {
      buttonHandler.registerHandler({ prefix: 'remove_', handler: mockHandler1 })
    })

    it('should unregister existing handler', () => {
      const result = buttonHandler.unregisterHandler('remove_')

      expect(result).toBe(true)
      expect(buttonHandler.hasHandler('remove_')).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith('Unregistered button handler for prefix: remove_')
    })

    it('should return false for non-existent handler', () => {
      const result = buttonHandler.unregisterHandler('nonexistent_')

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to unregister non-existent button handler: nonexistent_'
      )
    })
  })

  describe('clearHandlers', () => {
    it('should clear all handlers', () => {
      buttonHandler.registerHandler({ prefix: 'clear1_', handler: mockHandler1 })
      buttonHandler.registerHandler({ prefix: 'clear2_', handler: mockHandler2 })

      expect(buttonHandler.getStats().totalHandlers).toBe(2)

      buttonHandler.clearHandlers()

      expect(buttonHandler.getStats().totalHandlers).toBe(0)
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared 2 button handlers')
    })

    it('should handle clearing when no handlers exist', () => {
      buttonHandler.clearHandlers()

      expect(buttonHandler.getStats().totalHandlers).toBe(0)
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared 0 button handlers')
    })
  })

  describe('getRegisteredPrefixes', () => {
    it('should return all registered prefixes', () => {
      buttonHandler.registerHandler({ prefix: 'prefix1_', handler: mockHandler1 })
      buttonHandler.registerHandler({ prefix: 'prefix2_', handler: mockHandler2 })

      const prefixes = buttonHandler.getRegisteredPrefixes()

      expect(prefixes).toEqual(['prefix1_', 'prefix2_'])
    })

    it('should return empty array when no handlers registered', () => {
      const prefixes = buttonHandler.getRegisteredPrefixes()

      expect(prefixes).toEqual([])
    })
  })

  describe('hasHandler', () => {
    beforeEach(() => {
      buttonHandler.registerHandler({ prefix: 'exists_', handler: mockHandler1 })
    })

    it('should return true for existing handler', () => {
      expect(buttonHandler.hasHandler('exists_')).toBe(true)
    })

    it('should return false for non-existent handler', () => {
      expect(buttonHandler.hasHandler('missing_')).toBe(false)
    })
  })

  describe('getHandlerInfo', () => {
    const config: ButtonHandlerConfig = {
      prefix: 'info_',
      handler: mockHandler1,
      description: 'Info handler',
    }

    beforeEach(() => {
      buttonHandler.registerHandler(config)
    })

    it('should return handler configuration for existing handler', () => {
      const info = buttonHandler.getHandlerInfo('info_')

      expect(info).toEqual(config)
    })

    it('should return undefined for non-existent handler', () => {
      const info = buttonHandler.getHandlerInfo('missing_')

      expect(info).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      buttonHandler.registerHandler({ prefix: 'stat1_', handler: mockHandler1 })
      buttonHandler.registerHandler({ prefix: 'stat2_', handler: mockHandler2 })

      const stats = buttonHandler.getStats()

      expect(stats).toEqual({
        totalHandlers: 2,
        registeredPrefixes: ['stat1_', 'stat2_'],
      })
    })

    it('should return empty statistics when no handlers exist', () => {
      const stats = buttonHandler.getStats()

      expect(stats).toEqual({
        totalHandlers: 0,
        registeredPrefixes: [],
      })
    })
  })

  describe('canHandle and getMatchingPrefix', () => {
    beforeEach(() => {
      buttonHandler.registerHandler({ prefix: 'handle_', handler: mockHandler1 })
      buttonHandler.registerHandler({ prefix: 'manage_', handler: mockHandler2 })
    })

    it('should correctly identify handleable custom IDs', () => {
      expect(buttonHandler.canHandle('handle_test123')).toBe(true)
      expect(buttonHandler.canHandle('manage_user456')).toBe(true)
      expect(buttonHandler.canHandle('unknown_button')).toBe(false)
    })

    it('should return correct matching prefixes', () => {
      expect(buttonHandler.getMatchingPrefix('handle_test')).toBe('handle_')
      expect(buttonHandler.getMatchingPrefix('manage_user')).toBe('manage_')
      expect(buttonHandler.getMatchingPrefix('nomatch_test')).toBeUndefined()
    })
  })

  describe('integration scenarios', () => {
    it('should handle multiple button types in sequence', async () => {
      const genHandler = jest.fn() as jest.MockedFunction<ButtonHandlerFunction>
      const editHandler = jest.fn() as jest.MockedFunction<ButtonHandlerFunction>

      buttonHandler.registerHandlers([
        { prefix: 'gen_', handler: genHandler, description: 'Generate handler' },
        { prefix: 'edit_', handler: editHandler, description: 'Edit handler' },
      ])

      const genInteraction = createMockButtonInteraction({ customId: 'gen_user123' })
      const editInteraction = createMockButtonInteraction({ customId: 'edit_user123' })

      await buttonHandler.handleButton(genInteraction)
      await buttonHandler.handleButton(editInteraction)

      expect(genHandler).toHaveBeenCalledWith(genInteraction)
      expect(editHandler).toHaveBeenCalledWith(editInteraction)
      expect(genHandler).toHaveBeenCalledTimes(1)
      expect(editHandler).toHaveBeenCalledTimes(1)
    })

    it('should handle handler registration and unregistration lifecycle', () => {
      // Register initial handlers
      buttonHandler.registerHandlers([
        { prefix: 'lifecycle1_', handler: mockHandler1 },
        { prefix: 'lifecycle2_', handler: mockHandler2 },
      ])

      expect(buttonHandler.getStats().totalHandlers).toBe(2)

      // Unregister one handler
      const removed = buttonHandler.unregisterHandler('lifecycle1_')
      expect(removed).toBe(true)
      expect(buttonHandler.getStats().totalHandlers).toBe(1)

      // Clear all handlers
      buttonHandler.clearHandlers()
      expect(buttonHandler.getStats().totalHandlers).toBe(0)
    })

    it('should handle complex prefix patterns', () => {
      buttonHandler.registerHandlers([
        { prefix: 'user_action_', handler: mockHandler1 },
        { prefix: 'admin_', handler: mockHandler2 },
        { prefix: 'user_', handler: mockHandler1 }, // Shorter prefix that could conflict
      ])

      // Should match the longer, more specific prefix first
      expect(buttonHandler.getMatchingPrefix('user_action_delete')).toBe('user_action_')
      expect(buttonHandler.getMatchingPrefix('user_profile')).toBe('user_')
      expect(buttonHandler.getMatchingPrefix('admin_ban')).toBe('admin_')
    })
  })

  describe('Button Builder Integration', () => {
    describe('createImageActionButtons', () => {
      it('should create action buttons with default options', () => {
        const actionRow = buttonHandler.createImageActionButtons({
          userId: 'user123',
        })

        expect(actionRow).toBeDefined()
        expect(actionRow.components).toHaveLength(2) // edit and regenerate buttons
        
        const buttons = actionRow.components
        expect((buttons[0].data as any).custom_id).toMatch(/^edit_user123_\d+$/)
        expect((buttons[1].data as any).custom_id).toMatch(/^regenerate_user123_\d+$/)
      })

      it('should create action buttons with custom options', () => {
        const actionRow = buttonHandler.createImageActionButtons({
          userId: 'user456',
          timestamp: 1234567890,
          includeEdit: true,
          includeRegenerate: true,
          customLabels: {
            edit: 'Modify',
            regenerate: 'Retry'
          }
        })

        expect(actionRow.components).toHaveLength(2)
        
        const buttons = actionRow.components
        expect((buttons[0].data as any).custom_id).toBe('edit_user456_1234567890')
        expect((buttons[1].data as any).custom_id).toBe('regenerate_user456_1234567890')
      })
    })

    describe('createRegenerateOnlyButton', () => {
      it('should create regenerate-only button', () => {
        const actionRow = buttonHandler.createRegenerateOnlyButton({
          userId: 'user789',
        })

        expect(actionRow).toBeDefined()
        expect(actionRow.components).toHaveLength(1) // regenerate button only
        
        const button = actionRow.components[0]
        expect((button.data as any).custom_id).toMatch(/^regenerate_user789_\d+$/)
      })

      it('should create regenerate-only button with custom timestamp', () => {
        const actionRow = buttonHandler.createRegenerateOnlyButton({
          userId: 'user999',
          timestamp: 9876543210,
        })

        expect(actionRow.components).toHaveLength(1)
        
        const button = actionRow.components[0]
        expect((button.data as any).custom_id).toBe('regenerate_user999_9876543210')
      })
    })

    describe('parseUserIdFromCustomId', () => {
      it('should parse user ID from edit button custom ID', () => {
        const userId = buttonHandler.parseUserIdFromCustomId('edit_123456_1234567890')
        expect(userId).toBe('123456')
      })

      it('should parse user ID from regenerate button custom ID', () => {
        const userId = buttonHandler.parseUserIdFromCustomId('regenerate_789012_1234567890')
        expect(userId).toBe('789012')
      })

      it('should return null for invalid custom ID', () => {
        const userId = buttonHandler.parseUserIdFromCustomId('invalid_format')
        expect(userId).toBeNull()
      })
    })

    describe('parseActionFromCustomId', () => {
      it('should parse action type from edit button', () => {
        const action = buttonHandler.parseActionFromCustomId('edit_123_1234567890')
        expect(action).toBe('edit')
      })

      it('should parse action type from regenerate button', () => {
        const action = buttonHandler.parseActionFromCustomId('regenerate_456_1234567890')
        expect(action).toBe('regenerate')
      })

      it('should return null for invalid custom ID', () => {
        const action = buttonHandler.parseActionFromCustomId('unknown_123_456')
        expect(action).toBeNull()
      })
    })

    describe('validateButtonInteraction', () => {
      it('should validate button interaction with expected prefix', () => {
        const interaction = createMockButtonInteraction({
          customId: 'edit_user123_1234567890'
        })

        const isValid = buttonHandler.validateButtonInteraction(interaction, 'edit_')
        expect(isValid).toBe(true)
      })

      it('should reject button interaction with wrong prefix', () => {
        const interaction = createMockButtonInteraction({
          customId: 'regenerate_user123_1234567890'
        })

        const isValid = buttonHandler.validateButtonInteraction(interaction, 'edit_')
        expect(isValid).toBe(false)
      })

      it('should reject button interaction with no prefix match', () => {
        const interaction = createMockButtonInteraction({
          customId: 'unknown_button'
        })

        const isValid = buttonHandler.validateButtonInteraction(interaction, 'edit_')
        expect(isValid).toBe(false)
      })
    })

    describe('integration with existing handler functionality', () => {
      it('should work with created buttons in handler workflow', async () => {
        // Register a handler for edit buttons
        buttonHandler.registerHandler({
          prefix: 'edit_',
          handler: mockHandler1,
          description: 'Edit button handler'
        })

        // Create buttons using the builder
        const actionRow = buttonHandler.createImageActionButtons({
          userId: 'user123',
          timestamp: 1234567890
        })

        // Extract the edit button's custom ID
        const editButton = actionRow.components[0]
        const customId = (editButton.data as any).custom_id as string

        // Create an interaction with that custom ID
        const interaction = createMockButtonInteraction({ customId })

        // Should be handled by our registered handler
        expect(buttonHandler.canHandle(customId)).toBe(true)
        expect(buttonHandler.getMatchingPrefix(customId)).toBe('edit_')

        // Handle the interaction
        await buttonHandler.handleButton(interaction)

        expect(mockHandler1).toHaveBeenCalledWith(interaction)
      })

      it('should parse user ID from created button custom IDs', () => {
        const actionRow = buttonHandler.createImageActionButtons({
          userId: '456789012345',  // Use numeric Discord user ID
          timestamp: 9999999999
        })

        const editButton = actionRow.components[0]
        const regenerateButton = actionRow.components[1]

        const editCustomId = (editButton.data as any).custom_id as string
        const regenerateCustomId = (regenerateButton.data as any).custom_id as string

        const editUserId = buttonHandler.parseUserIdFromCustomId(editCustomId)
        const regenerateUserId = buttonHandler.parseUserIdFromCustomId(regenerateCustomId)

        expect(editUserId).toBe('456789012345')
        expect(regenerateUserId).toBe('456789012345')
      })
    })
  })
})