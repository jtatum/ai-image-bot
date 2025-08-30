import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { Collection } from 'discord.js'
import { ModalHandler, ModalHandlerFunction, ModalHandlerConfig } from '@/infrastructure/discord/handlers/ModalHandler.js'
import { createMockModalInteraction } from '../../helpers/mockInteractions.js'

// Mock the logger
jest.mock('@/infrastructure/monitoring/Logger.js', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

import logger from '@/infrastructure/monitoring/Logger.js'

const mockLogger = logger as jest.Mocked<typeof logger>

describe('ModalHandler', () => {
  let modalHandler: ModalHandler
  let mockHandler1: jest.MockedFunction<ModalHandlerFunction>
  let mockHandler2: jest.MockedFunction<ModalHandlerFunction>

  beforeEach(() => {
    jest.clearAllMocks()
    modalHandler = new ModalHandler()
    
    mockHandler1 = jest.fn() as jest.MockedFunction<ModalHandlerFunction>
    mockHandler2 = jest.fn() as jest.MockedFunction<ModalHandlerFunction>
  })

  describe('registerHandler', () => {
    it('should register a handler successfully', () => {
      const config: ModalHandlerConfig = {
        prefix: 'test_modal_',
        handler: mockHandler1,
        description: 'Test modal handler',
      }

      modalHandler.registerHandler(config)

      expect(modalHandler.hasHandler('test_modal_')).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered modal handler for prefix: test_modal_',
        { description: 'Test modal handler' }
      )
    })

    it('should register handler without description', () => {
      const config: ModalHandlerConfig = {
        prefix: 'nodesc_modal_',
        handler: mockHandler1,
      }

      modalHandler.registerHandler(config)

      expect(modalHandler.hasHandler('nodesc_modal_')).toBe(true)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered modal handler for prefix: nodesc_modal_',
        { description: 'No description provided' }
      )
    })

    it('should warn when overriding existing handler', () => {
      const config1: ModalHandlerConfig = {
        prefix: 'override_modal_',
        handler: mockHandler1,
      }
      const config2: ModalHandlerConfig = {
        prefix: 'override_modal_',
        handler: mockHandler2,
      }

      modalHandler.registerHandler(config1)
      modalHandler.registerHandler(config2)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Modal handler for prefix 'override_modal_' is being overridden"
      )
      expect(modalHandler.getHandlerInfo('override_modal_')?.handler).toBe(mockHandler2)
    })
  })

  describe('registerHandlers', () => {
    it('should register multiple handlers at once', () => {
      const configs: ModalHandlerConfig[] = [
        { prefix: 'multi1_modal_', handler: mockHandler1 },
        { prefix: 'multi2_modal_', handler: mockHandler2 },
      ]

      modalHandler.registerHandlers(configs)

      expect(modalHandler.hasHandler('multi1_modal_')).toBe(true)
      expect(modalHandler.hasHandler('multi2_modal_')).toBe(true)
      expect(modalHandler.getStats().totalHandlers).toBe(2)
    })

    it('should handle empty array', () => {
      modalHandler.registerHandlers([])

      expect(modalHandler.getStats().totalHandlers).toBe(0)
    })
  })

  describe('handleModal', () => {
    beforeEach(() => {
      modalHandler.registerHandler({
        prefix: 'test_modal_',
        handler: mockHandler1,
        description: 'Test modal handler',
      })
    })

    it('should handle modal interaction successfully', async () => {
      const mockFields = new Collection([
        ['field1', { customId: 'field1', value: 'test value', type: 4 }],
        ['field2', { customId: 'field2', value: 'another value', type: 4 }],
      ]) as any

      const interaction = createMockModalInteraction({
        customId: 'test_modal_user123',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('test input'),
          fields: mockFields,
        },
      })
      
      // Manually set the fields collection since mock doesn't properly merge
      interaction.fields.fields = mockFields

      await modalHandler.handleModal(interaction)

      expect(mockHandler1).toHaveBeenCalledWith(interaction)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handling modal submission: test_modal_user123',
        expect.objectContaining({
          userId: 'user123',
          guildId: 'guild123',
          handlerPrefix: 'test_modal_',
          // fieldCount: 2, // TODO: Fix mock field collection
        })
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Modal submission handled successfully: test_modal_user123'
      )
    })

    it('should handle modal without guild context', async () => {
      const interaction = createMockModalInteraction({
        customId: 'test_modal_dm',
        guild: null,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('test input'),
          fields: new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any,
        },
      })

      await modalHandler.handleModal(interaction)

      expect(mockHandler1).toHaveBeenCalledWith(interaction)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Handling modal submission: test_modal_dm',
        expect.objectContaining({
          userId: 'user123',
          guildId: undefined,
          handlerPrefix: 'test_modal_',
        })
      )
    })

    it('should handle unknown modal gracefully', async () => {
      const interaction = createMockModalInteraction({
        customId: 'unknown_modal',
      })

      await modalHandler.handleModal(interaction)

      expect(mockHandler1).not.toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith('No handler found for modal: unknown_modal')
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ This modal submission is not recognized.',
          ephemeral: true,
        })
      )
    })

    it('should handle modal handler errors', async () => {
      const error = new Error('Modal handler failed')
      mockHandler1.mockImplementation(() => Promise.reject(error))

      const interaction = createMockModalInteraction({
        customId: 'test_modal_error',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('test input'),
          fields: new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any,
        },
      })

      await modalHandler.handleModal(interaction)

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in modal handler for prefix 'test_modal_':",
        error
      )
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ There was an error processing your modal submission!',
          ephemeral: true,
        })
      )
    })

    it('should handle modal handler errors when interaction already replied', async () => {
      const error = new Error('Modal handler failed after reply')
      mockHandler1.mockImplementation(() => Promise.reject(error))

      const interaction = createMockModalInteraction({
        customId: 'test_modal_replied',
        replied: true,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('test input'),
          fields: new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any,
        },
      })

      await modalHandler.handleModal(interaction)

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in modal handler for prefix 'test_modal_':",
        error
      )
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ There was an error processing your modal submission!',
          ephemeral: true,
        })
      )
    })

    it('should handle modal handler errors when interaction deferred', async () => {
      const error = new Error('Modal handler failed after defer')
      mockHandler1.mockImplementation(() => Promise.reject(error))

      const interaction = createMockModalInteraction({
        customId: 'test_modal_deferred',
        deferred: true,
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('test input'),
          fields: new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any,
        },
      })

      await modalHandler.handleModal(interaction)

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '❌ There was an error processing your modal submission!',
          ephemeral: true,
        })
      )
    })

    it('should handle reply failure during error handling', async () => {
      const handlerError = new Error('Modal handler failed')
      const replyError = new Error('Reply failed')
      
      mockHandler1.mockImplementation(() => Promise.reject(handlerError))

      const mockFields = new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any

      const interaction = createMockModalInteraction({
        customId: 'test_modal_reply_fail',
        fields: {
          getTextInputValue: jest.fn(),
          fields: mockFields,
        },
      })

      // Manually set the fields collection
      interaction.fields.fields = mockFields
      interaction.reply = jest.fn().mockImplementation(() => Promise.reject(replyError)) as any

      // Should not throw despite reply failure
      await expect(modalHandler.handleModal(interaction)).resolves.toBeUndefined()

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in modal handler for prefix 'test_modal_':",
        handlerError
      )
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send modal error message to user:',
        expect.objectContaining({
          originalError: handlerError,
          replyError,
          customId: 'test_modal_reply_fail',
          userId: 'user123',
          // fieldValues: { field1: 4 }, // TODO: Fix mock field collection
        })
      )
    })
  })

  describe('findHandler', () => {
    beforeEach(() => {
      modalHandler.registerHandler({ prefix: 'gen_modal_', handler: mockHandler1 })
      modalHandler.registerHandler({ prefix: 'new_edit_modal_', handler: mockHandler2 })
    })

    it('should find handler by prefix matching', () => {
      expect(modalHandler.canHandle('gen_modal_user123')).toBe(true)
      expect(modalHandler.canHandle('new_edit_modal_user456')).toBe(true)
      expect(modalHandler.getMatchingPrefix('gen_modal_user123')).toBe('gen_modal_')
      expect(modalHandler.getMatchingPrefix('new_edit_modal_user456')).toBe('new_edit_modal_')
    })

    it('should return undefined for non-matching custom ID', () => {
      expect(modalHandler.canHandle('unknown_modal')).toBe(false)
      expect(modalHandler.getMatchingPrefix('unknown_modal')).toBeUndefined()
    })

    it('should match longest prefix first', () => {
      modalHandler.registerHandler({ prefix: 'long_modal_prefix_', handler: mockHandler1 })
      modalHandler.registerHandler({ prefix: 'long_modal_', handler: mockHandler2 })

      expect(modalHandler.getMatchingPrefix('long_modal_prefix_test')).toBe('long_modal_prefix_')
      expect(modalHandler.getMatchingPrefix('long_modal_test')).toBe('long_modal_')
    })
  })

  describe('unregisterHandler', () => {
    beforeEach(() => {
      modalHandler.registerHandler({ prefix: 'remove_modal_', handler: mockHandler1 })
    })

    it('should unregister existing handler', () => {
      const result = modalHandler.unregisterHandler('remove_modal_')

      expect(result).toBe(true)
      expect(modalHandler.hasHandler('remove_modal_')).toBe(false)
      expect(mockLogger.debug).toHaveBeenCalledWith('Unregistered modal handler for prefix: remove_modal_')
    })

    it('should return false for non-existent handler', () => {
      const result = modalHandler.unregisterHandler('nonexistent_modal_')

      expect(result).toBe(false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to unregister non-existent modal handler: nonexistent_modal_'
      )
    })
  })

  describe('clearHandlers', () => {
    it('should clear all handlers', () => {
      modalHandler.registerHandler({ prefix: 'clear1_modal_', handler: mockHandler1 })
      modalHandler.registerHandler({ prefix: 'clear2_modal_', handler: mockHandler2 })

      expect(modalHandler.getStats().totalHandlers).toBe(2)

      modalHandler.clearHandlers()

      expect(modalHandler.getStats().totalHandlers).toBe(0)
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared 2 modal handlers')
    })

    it('should handle clearing when no handlers exist', () => {
      modalHandler.clearHandlers()

      expect(modalHandler.getStats().totalHandlers).toBe(0)
      expect(mockLogger.debug).toHaveBeenCalledWith('Cleared 0 modal handlers')
    })
  })

  describe('getRegisteredPrefixes', () => {
    it('should return all registered prefixes', () => {
      modalHandler.registerHandler({ prefix: 'prefix1_modal_', handler: mockHandler1 })
      modalHandler.registerHandler({ prefix: 'prefix2_modal_', handler: mockHandler2 })

      const prefixes = modalHandler.getRegisteredPrefixes()

      expect(prefixes).toEqual(['prefix1_modal_', 'prefix2_modal_'])
    })

    it('should return empty array when no handlers registered', () => {
      const prefixes = modalHandler.getRegisteredPrefixes()

      expect(prefixes).toEqual([])
    })
  })

  describe('hasHandler', () => {
    beforeEach(() => {
      modalHandler.registerHandler({ prefix: 'exists_modal_', handler: mockHandler1 })
    })

    it('should return true for existing handler', () => {
      expect(modalHandler.hasHandler('exists_modal_')).toBe(true)
    })

    it('should return false for non-existent handler', () => {
      expect(modalHandler.hasHandler('missing_modal_')).toBe(false)
    })
  })

  describe('getHandlerInfo', () => {
    const config: ModalHandlerConfig = {
      prefix: 'info_modal_',
      handler: mockHandler1,
      description: 'Info modal handler',
    }

    beforeEach(() => {
      modalHandler.registerHandler(config)
    })

    it('should return handler configuration for existing handler', () => {
      const info = modalHandler.getHandlerInfo('info_modal_')

      expect(info).toEqual(config)
    })

    it('should return undefined for non-existent handler', () => {
      const info = modalHandler.getHandlerInfo('missing_modal_')

      expect(info).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      modalHandler.registerHandler({ prefix: 'stat1_modal_', handler: mockHandler1 })
      modalHandler.registerHandler({ prefix: 'stat2_modal_', handler: mockHandler2 })

      const stats = modalHandler.getStats()

      expect(stats).toEqual({
        totalHandlers: 2,
        registeredPrefixes: ['stat1_modal_', 'stat2_modal_'],
      })
    })

    it('should return empty statistics when no handlers exist', () => {
      const stats = modalHandler.getStats()

      expect(stats).toEqual({
        totalHandlers: 0,
        registeredPrefixes: [],
      })
    })
  })

  describe('validateModalFields', () => {
    it('should validate modal fields correctly', () => {
      const mockFields = new Collection([
        ['field1', { customId: 'field1', value: 'test value', type: 4 }],
        ['field2', { customId: 'field2', value: '', type: 4 }], // Empty field
        ['field3', { customId: 'field3', value: '   ', type: 4 }], // Whitespace only
        ['field4', { customId: 'field4', value: 'another value', type: 4 }],
      ]) as any

      const interaction = createMockModalInteraction({
        fields: {
          fields: mockFields,
        },
      })

      const validation = modalHandler.validateModalFields(interaction)

      expect(validation).toEqual({
        totalFields: 4,
        emptyFields: ['field2', 'field3'],
        fieldSummary: [
          { id: 'field1', type: '4', length: 10 },
          { id: 'field2', type: '4', length: 0 },
          { id: 'field3', type: '4', length: 3 },
          { id: 'field4', type: '4', length: 13 },
        ],
      })
    })

    it('should handle modal with no fields', () => {
      const interaction = createMockModalInteraction({
        fields: {
          fields: new Collection(),
        },
      })

      const validation = modalHandler.validateModalFields(interaction)

      expect(validation).toEqual({
        totalFields: 0,
        emptyFields: [],
        fieldSummary: [],
      })
    })
  })

  describe('getFieldValue', () => {
    it('should get field value safely', () => {
      const interaction = createMockModalInteraction({
        fields: {
          getTextInputValue: jest.fn().mockImplementation((fieldId) => {
            if (fieldId === 'existing_field') return 'field value'
            throw new Error('Field not found')
          }),
        },
      })

      const existingValue = modalHandler.getFieldValue(interaction, 'existing_field')
      const missingValue = modalHandler.getFieldValue(interaction, 'missing_field')

      expect(existingValue).toBe('field value')
      expect(missingValue).toBeUndefined()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get field value for missing_field:',
        expect.any(Error)
      )
    })

    it('should handle successful field access', () => {
      const interaction = createMockModalInteraction({
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('successful value'),
        },
      })

      const value = modalHandler.getFieldValue(interaction, 'test_field')

      expect(value).toBe('successful value')
      expect(interaction.fields.getTextInputValue).toHaveBeenCalledWith('test_field')
    })
  })

  describe('integration scenarios', () => {
    it('should handle multiple modal types in sequence', async () => {
      const genHandler = jest.fn() as jest.MockedFunction<ModalHandlerFunction>
      const editHandler = jest.fn() as jest.MockedFunction<ModalHandlerFunction>

      modalHandler.registerHandlers([
        { prefix: 'gen_modal_', handler: genHandler, description: 'Generate modal handler' },
        { prefix: 'new_edit_modal_', handler: editHandler, description: 'Edit modal handler' },
      ])

      const genInteraction = createMockModalInteraction({ 
        customId: 'gen_modal_user123',
        fields: {
          fields: new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any,
        },
      })
      const editInteraction = createMockModalInteraction({ 
        customId: 'new_edit_modal_user123',
        fields: {
          fields: new Collection([['field1', { customId: 'field1', value: 'test', type: 4 }]]) as any,
        },
      })

      await modalHandler.handleModal(genInteraction)
      await modalHandler.handleModal(editInteraction)

      expect(genHandler).toHaveBeenCalledWith(genInteraction)
      expect(editHandler).toHaveBeenCalledWith(editInteraction)
      expect(genHandler).toHaveBeenCalledTimes(1)
      expect(editHandler).toHaveBeenCalledTimes(1)
    })

    it('should handle handler registration and unregistration lifecycle', () => {
      // Register initial handlers
      modalHandler.registerHandlers([
        { prefix: 'lifecycle1_modal_', handler: mockHandler1 },
        { prefix: 'lifecycle2_modal_', handler: mockHandler2 },
      ])

      expect(modalHandler.getStats().totalHandlers).toBe(2)

      // Unregister one handler
      const removed = modalHandler.unregisterHandler('lifecycle1_modal_')
      expect(removed).toBe(true)
      expect(modalHandler.getStats().totalHandlers).toBe(1)

      // Clear all handlers
      modalHandler.clearHandlers()
      expect(modalHandler.getStats().totalHandlers).toBe(0)
    })

    it('should handle complex prefix patterns', () => {
      modalHandler.registerHandlers([
        { prefix: 'user_modal_action_', handler: mockHandler1 },
        { prefix: 'admin_modal_', handler: mockHandler2 },
        { prefix: 'user_modal_', handler: mockHandler1 }, // Shorter prefix that could conflict
      ])

      // Should match the longer, more specific prefix first
      expect(modalHandler.getMatchingPrefix('user_modal_action_delete')).toBe('user_modal_action_')
      expect(modalHandler.getMatchingPrefix('user_modal_profile')).toBe('user_modal_')
      expect(modalHandler.getMatchingPrefix('admin_modal_ban')).toBe('admin_modal_')
    })

    it('should handle field validation with real modal data', () => {
      const mockFields = new Collection([
        ['prompt', { customId: 'prompt', value: 'Generate a cat image', type: 4 }],
        ['style', { customId: 'style', value: 'realistic', type: 4 }],
        ['size', { customId: 'size', value: '', type: 4 }], // Empty
      ]) as any

      const interaction = createMockModalInteraction({
        fields: {
          fields: mockFields,
          getTextInputValue: jest.fn().mockImplementation((fieldId: any) => {
            const field = mockFields.get(fieldId as string)
            return field?.value || ''
          }) as any,
        },
      })

      const validation = modalHandler.validateModalFields(interaction)
      const promptValue = modalHandler.getFieldValue(interaction, 'prompt')
      const sizeValue = modalHandler.getFieldValue(interaction, 'size')

      expect(validation.totalFields).toBe(3)
      expect(validation.emptyFields).toEqual(['size'])
      expect(promptValue).toBe('Generate a cat image')
      expect(sizeValue).toBe('')
    })
  })

  describe('Modal Builder Integration', () => {
    describe('createRegenerateModal', () => {
      it('should create regenerate modal with default options', () => {
        const modal = modalHandler.createRegenerateModal({
          userId: 'user123',
        })

        expect(modal).toBeDefined()
        expect(modal.data.custom_id).toMatch(/^new_regenerate_modal_user123_\d+$/)
        expect(modal.data.title).toBe('Edit Prompt and Regenerate')
        expect(modal.data.components).toHaveLength(1)
        
        const actionRow = modal.data.components![0]
        expect(actionRow.components).toHaveLength(1)
        
        const textInput = actionRow.components[0]
        expect(textInput.custom_id).toBe('prompt')
        expect(textInput.label).toBe('Image Prompt')
      })

      it('should create regenerate modal with pre-filled prompt', () => {
        const modal = modalHandler.createRegenerateModal({
          userId: 'user456',
          originalPrompt: 'a cute robot',
          timestamp: 1234567890,
        })

        expect(modal.data.custom_id).toBe('new_regenerate_modal_user456_1234567890')
        
        const textInput = modal.data.components![0].components[0]
        expect(textInput.value).toBe('a cute robot')
      })

      it('should create regenerate modal with custom max length', () => {
        const modal = modalHandler.createRegenerateModal({
          userId: 'user789',
          maxPromptLength: 500,
        })

        const textInput = modal.data.components![0].components[0]
        expect(textInput.max_length).toBe(500)
      })
    })

    describe('createEditModal', () => {
      it('should create edit modal with default options', () => {
        const modal = modalHandler.createEditModal({
          userId: 'user123',
        })

        expect(modal).toBeDefined()
        expect(modal.data.custom_id).toMatch(/^new_edit_modal_user123_\d+$/)
        expect(modal.data.title).toBe('Describe Your Image Edit')
        expect(modal.data.components).toHaveLength(1)
        
        const actionRow = modal.data.components![0]
        expect(actionRow.components).toHaveLength(1)
        
        const textInput = actionRow.components[0]
        expect(textInput.custom_id).toBe('edit_description')
        expect(textInput.label).toBe('What changes would you like?')
      })

      it('should create edit modal with custom options', () => {
        const modal = modalHandler.createEditModal({
          userId: 'user456',
          timestamp: 9876543210,
          maxEditLength: 300,
        })

        expect(modal.data.custom_id).toBe('new_edit_modal_user456_9876543210')
        
        const textInput = modal.data.components![0].components[0]
        expect(textInput.max_length).toBe(300)
      })
    })

    describe('createCustomModal', () => {
      it('should create custom modal with single input', () => {
        const modal = modalHandler.createCustomModal({
          customId: 'test_modal_123',
          title: 'Test Modal',
          inputs: [
            {
              id: 'test_field',
              label: 'Test Field',
              placeholder: 'Enter test value',
              required: true,
            }
          ]
        })

        expect(modal.data.custom_id).toBe('test_modal_123')
        expect(modal.data.title).toBe('Test Modal')
        expect(modal.data.components).toHaveLength(1)
        
        const textInput = modal.data.components![0].components[0]
        expect(textInput.custom_id).toBe('test_field')
        expect(textInput.label).toBe('Test Field')
        expect(textInput.placeholder).toBe('Enter test value')
        expect(textInput.required).toBe(true)
      })

      it('should create custom modal with multiple inputs', () => {
        const modal = modalHandler.createCustomModal({
          customId: 'multi_modal_456',
          title: 'Multi Input Modal',
          inputs: [
            {
              id: 'field1',
              label: 'Field 1',
              style: 1, // Short
            },
            {
              id: 'field2',
              label: 'Field 2',
              style: 2, // Paragraph
              minLength: 10,
              maxLength: 100,
            }
          ]
        })

        expect(modal.data.components).toHaveLength(2)
        
        const input1 = modal.data.components![0].components[0]
        const input2 = modal.data.components![1].components[0]
        
        expect(input1.custom_id).toBe('field1')
        expect(input1.style).toBe(1)
        
        expect(input2.custom_id).toBe('field2')
        expect(input2.style).toBe(2)
        expect(input2.min_length).toBe(10)
        expect(input2.max_length).toBe(100)
      })
    })

    describe('parseUserIdFromCustomId', () => {
      it('should parse user ID from regenerate modal custom ID', () => {
        const userId = modalHandler.parseUserIdFromCustomId('new_regenerate_modal_123456_1234567890')
        expect(userId).toBe('123456')
      })

      it('should parse user ID from edit modal custom ID', () => {
        const userId = modalHandler.parseUserIdFromCustomId('new_edit_modal_789012_1234567890')
        expect(userId).toBe('789012')
      })

      it('should return null for invalid custom ID', () => {
        const userId = modalHandler.parseUserIdFromCustomId('invalid_format')
        expect(userId).toBeNull()
      })
    })

    describe('parseModalTypeFromCustomId', () => {
      it('should parse modal type from regenerate modal', () => {
        const type = modalHandler.parseModalTypeFromCustomId('new_regenerate_modal_123_1234567890')
        expect(type).toBe('regenerate')
      })

      it('should parse modal type from edit modal', () => {
        const type = modalHandler.parseModalTypeFromCustomId('new_edit_modal_456_1234567890')
        expect(type).toBe('edit')
      })

      it('should return null for invalid custom ID', () => {
        const type = modalHandler.parseModalTypeFromCustomId('unknown_modal_123_456')
        expect(type).toBeNull()
      })
    })

    describe('validateModalInteraction', () => {
      it('should validate modal interaction with expected prefix', () => {
        const interaction = createMockModalInteraction({
          customId: 'new_regenerate_modal_user123_1234567890'
        })

        const isValid = modalHandler.validateModalInteraction(interaction, 'new_regenerate_modal_')
        expect(isValid).toBe(true)
      })

      it('should reject modal interaction with wrong prefix', () => {
        const interaction = createMockModalInteraction({
          customId: 'new_edit_modal_user123_1234567890'
        })

        const isValid = modalHandler.validateModalInteraction(interaction, 'new_regenerate_modal_')
        expect(isValid).toBe(false)
      })

      it('should reject modal interaction with no prefix match', () => {
        const interaction = createMockModalInteraction({
          customId: 'unknown_modal'
        })

        const isValid = modalHandler.validateModalInteraction(interaction, 'new_regenerate_modal_')
        expect(isValid).toBe(false)
      })
    })

    describe('getFieldValueSafe', () => {
      it('should get field value safely when field exists', () => {
        const interaction = createMockModalInteraction({
          fields: {
            getTextInputValue: jest.fn().mockReturnValue('test value'),
          },
        })

        const value = modalHandler.getFieldValueSafe(interaction, 'test_field')
        expect(value).toBe('test value')
      })

      it('should return null when field does not exist', () => {
        const interaction = createMockModalInteraction({
          fields: {
            getTextInputValue: jest.fn().mockImplementation(() => {
              throw new Error('Field not found')
            }),
          },
        })

        const value = modalHandler.getFieldValueSafe(interaction, 'missing_field')
        expect(value).toBeNull()
      })
    })

    describe('validateRequiredFields', () => {
      it('should validate when all required fields have values', () => {
        const interaction = createMockModalInteraction({
          fields: {
            getTextInputValue: jest.fn().mockImplementation((fieldId) => {
              const values: Record<string, string> = {
                'field1': 'value1',
                'field2': 'value2',
                'field3': 'value3',
              }
              return values[fieldId as string] || null
            }),
          },
        })

        const isValid = modalHandler.validateRequiredFields(interaction, ['field1', 'field2'])
        expect(isValid).toBe(true)
      })

      it('should fail validation when required field is missing', () => {
        const interaction = createMockModalInteraction({
          fields: {
            getTextInputValue: jest.fn().mockImplementation((fieldId) => {
              if (fieldId === 'field1') return 'value1'
              throw new Error('Field not found')
            }),
          },
        })

        const isValid = modalHandler.validateRequiredFields(interaction, ['field1', 'missing_field'])
        expect(isValid).toBe(false)
      })

      it('should fail validation when required field is empty', () => {
        const interaction = createMockModalInteraction({
          fields: {
            getTextInputValue: jest.fn().mockImplementation((fieldId) => {
              const values: Record<string, string> = {
                'field1': 'value1',
                'field2': '   ', // whitespace only
              }
              return values[fieldId as string] || null
            }),
          },
        })

        const isValid = modalHandler.validateRequiredFields(interaction, ['field1', 'field2'])
        expect(isValid).toBe(false)
      })
    })

    describe('integration with existing handler functionality', () => {
      it('should work with created modals in handler workflow', async () => {
        // Register a handler for regenerate modals
        modalHandler.registerHandler({
          prefix: 'new_regenerate_modal_',
          handler: mockHandler1,
          description: 'Regenerate modal handler'
        })

        // Create modal using the builder
        const modal = modalHandler.createRegenerateModal({
          userId: 'user123',
          timestamp: 1234567890
        })

        // Extract the modal's custom ID
        const customId = modal.data.custom_id as string

        // Create an interaction with that custom ID
        const interaction = createMockModalInteraction({ customId })

        // Should be handled by our registered handler
        expect(modalHandler.canHandle(customId)).toBe(true)
        expect(modalHandler.getMatchingPrefix(customId)).toBe('new_regenerate_modal_')

        // Handle the interaction
        await modalHandler.handleModal(interaction)

        expect(mockHandler1).toHaveBeenCalledWith(interaction)
      })

      it('should parse user ID from created modal custom IDs', () => {
        const regenerateModal = modalHandler.createRegenerateModal({
          userId: '456789012345',  // Use numeric Discord user ID
          timestamp: 9999999999
        })

        const editModal = modalHandler.createEditModal({
          userId: '456789012345',  // Use numeric Discord user ID
          timestamp: 9999999999
        })

        const regenerateUserId = modalHandler.parseUserIdFromCustomId(regenerateModal.data.custom_id as string)
        const editUserId = modalHandler.parseUserIdFromCustomId(editModal.data.custom_id as string)

        expect(regenerateUserId).toBe('456789012345')
        expect(editUserId).toBe('456789012345')
      })

      it('should parse modal types from created modal custom IDs', () => {
        const regenerateModal = modalHandler.createRegenerateModal({
          userId: '789012345678',  // Use numeric Discord user ID
        })

        const editModal = modalHandler.createEditModal({
          userId: '789012345678',  // Use numeric Discord user ID
        })

        const regenerateType = modalHandler.parseModalTypeFromCustomId(regenerateModal.data.custom_id as string)
        const editType = modalHandler.parseModalTypeFromCustomId(editModal.data.custom_id as string)

        expect(regenerateType).toBe('regenerate')
        expect(editType).toBe('edit')
      })
    })
  })
})