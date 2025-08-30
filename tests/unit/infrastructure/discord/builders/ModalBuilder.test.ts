import { TextInputStyle, ModalSubmitInteraction } from 'discord.js'
import {
  EnhancedModalBuilder,
  ModalBuilderFactory,
  createTextInputModal,
  createRegenerateModal,
  createEditModal,
  TextInputConfig,
  ImageModalOptions
} from '@/infrastructure/discord/builders/ModalBuilder.js'

describe('EnhancedModalBuilder', () => {
  let builder: EnhancedModalBuilder

  beforeEach(() => {
    builder = new EnhancedModalBuilder()
  })

  describe('setCustomId', () => {
    it('should set the modal customId', () => {
      const result = builder.setCustomId('test_modal')
      expect(result).toBe(builder) // Should return builder for chaining
    })
  })

  describe('setTitle', () => {
    it('should set the modal title', () => {
      const result = builder.setTitle('Test Modal')
      expect(result).toBe(builder) // Should return builder for chaining
    })
  })

  describe('addTextInput', () => {
    it('should add a text input to the modal', () => {
      const config: TextInputConfig = {
        customId: 'test_input',
        label: 'Test Input',
        style: TextInputStyle.Short
      }

      builder.addTextInput(config)
      expect(builder.inputCount).toBe(1)
    })

    it('should return the builder instance for chaining', () => {
      const config: TextInputConfig = {
        customId: 'test_input',
        label: 'Test Input',
        style: TextInputStyle.Short
      }

      const result = builder.addTextInput(config)
      expect(result).toBe(builder)
    })

    it('should throw error when adding more than 5 inputs', () => {
      const configs = Array.from({ length: 5 }, (_, i) => ({
        customId: `input${i}`,
        label: `Input ${i}`,
        style: TextInputStyle.Short
      }))

      builder.addTextInputs(configs)
      expect(builder.inputCount).toBe(5)

      expect(() => {
        builder.addTextInput({
          customId: 'input6',
          label: 'Input 6',
          style: TextInputStyle.Short
        })
      }).toThrow('Maximum 5 text inputs per modal')
    })
  })

  describe('addTextInputs', () => {
    it('should add multiple text inputs at once', () => {
      const configs: TextInputConfig[] = [
        { customId: 'input1', label: 'Input 1', style: TextInputStyle.Short },
        { customId: 'input2', label: 'Input 2', style: TextInputStyle.Paragraph }
      ]

      builder.addTextInputs(configs)
      expect(builder.inputCount).toBe(2)
    })

    it('should throw error when total inputs exceed 5', () => {
      const configs: TextInputConfig[] = Array.from({ length: 6 }, (_, i) => ({
        customId: `input${i}`,
        label: `Input ${i}`,
        style: TextInputStyle.Short
      }))

      expect(() => builder.addTextInputs(configs)).toThrow('Maximum 5 text inputs per modal')
    })
  })

  describe('createTextInputModal', () => {
    it('should create a modal with basic text input', () => {
      const modal = builder.createTextInputModal(
        'test_modal',
        'Test Modal',
        'test_input',
        'Test Input',
        TextInputStyle.Short
      )

      const modalJson = modal.toJSON() as any
      expect(modalJson.custom_id).toBe('test_modal')
      expect(modalJson.title).toBe('Test Modal')
      expect(modalJson.components).toHaveLength(1)
      
      const textInput = modalJson.components[0].components[0]
      expect(textInput.custom_id).toBe('test_input')
      expect(textInput.label).toBe('Test Input')
      expect(textInput.style).toBe(TextInputStyle.Short)
      expect(textInput.required).toBe(true) // Default
    })

    it('should create a modal with all optional properties', () => {
      const options = {
        placeholder: 'Enter text here...',
        value: 'Default value',
        required: false,
        minLength: 5,
        maxLength: 100
      }

      const modal = builder.createTextInputModal(
        'test_modal',
        'Test Modal',
        'test_input',
        'Test Input',
        TextInputStyle.Paragraph,
        options
      )

      const modalJson = modal.toJSON() as any
      const textInput = modalJson.components[0].components[0]
      expect(textInput.placeholder).toBe('Enter text here...')
      expect(textInput.value).toBe('Default value')
      expect(textInput.required).toBe(false)
      expect(textInput.min_length).toBe(5)
      expect(textInput.max_length).toBe(100)
    })
  })

  describe('createRegenerateModal', () => {
    it('should create a regenerate modal with default options', () => {
      const options: ImageModalOptions = {
        userId: '123456789',
        originalPrompt: 'A beautiful sunset'
      }

      const modal = builder.createRegenerateModal(options)

      expect(modal.data.custom_id).toMatch(/^new_regenerate_modal_123456789_\d+$/)
      expect(modal.data.title).toBe('Edit Prompt and Regenerate')

      const textInput = modal.data.components![0].components![0]
      expect(textInput.custom_id).toBe('prompt')
      expect(textInput.label).toBe('Image Prompt')
      expect(textInput.style).toBe(TextInputStyle.Paragraph)
      expect(textInput.value).toBe('A beautiful sunset')
      expect(textInput.max_length).toBe(1000) // Default
    })

    it('should use custom timestamp when provided', () => {
      const timestamp = 1234567890
      const options: ImageModalOptions = {
        userId: '123456789',
        timestamp,
        originalPrompt: 'Test prompt'
      }

      const modal = builder.createRegenerateModal(options)
      expect(modal.data.custom_id).toBe(`new_regenerate_modal_123456789_${timestamp}`)
    })

    it('should use custom maxPromptLength when provided', () => {
      const options: ImageModalOptions = {
        userId: '123456789',
        originalPrompt: 'Test prompt',
        maxPromptLength: 500
      }

      const modal = builder.createRegenerateModal(options)

      const textInput = modal.data.components![0].components![0]
      expect(textInput.max_length).toBe(500)
    })
  })

  describe('createEditModal', () => {
    it('should create an edit modal with default options', () => {
      const options: ImageModalOptions = {
        userId: '123456789'
      }

      const modal = builder.createEditModal(options)

      expect(modal.data.custom_id).toMatch(/^new_edit_modal_123456789_\d+$/)
      expect(modal.data.title).toBe('Describe Your Image Edit')

      const textInput = modal.data.components![0].components![0]
      expect(textInput.custom_id).toBe('edit_description')
      expect(textInput.label).toBe('What changes would you like?')
      expect(textInput.style).toBe(TextInputStyle.Paragraph)
      expect(textInput.max_length).toBe(500) // Default
    })

    it('should use custom maxEditLength when provided', () => {
      const options: ImageModalOptions = {
        userId: '123456789',
        maxEditLength: 300
      }

      const modal = builder.createEditModal(options)

      const textInput = modal.data.components![0].components![0]
      expect(textInput.max_length).toBe(300)
    })
  })

  describe('createCustomModal', () => {
    it('should create a modal with multiple inputs', () => {
      const options = {
        customId: 'custom_modal',
        title: 'Custom Modal',
        inputs: [
          {
            id: 'input1',
            label: 'First Input',
            style: TextInputStyle.Short,
            placeholder: 'Enter first value',
            required: true
          },
          {
            id: 'input2',
            label: 'Second Input',
            style: TextInputStyle.Paragraph,
            value: 'Default text',
            maxLength: 200
          }
        ]
      }

      const modal = builder.createCustomModal(options)

      expect(modal.data.custom_id).toBe('custom_modal')
      expect(modal.data.title).toBe('Custom Modal')
      expect(modal.data.components).toHaveLength(2)

      const firstInput = modal.data.components![0].components![0]
      expect(firstInput.custom_id).toBe('input1')
      expect(firstInput.label).toBe('First Input')
      expect(firstInput.style).toBe(TextInputStyle.Short)
      expect(firstInput.placeholder).toBe('Enter first value')
      expect(firstInput.required).toBe(true)

      const secondInput = modal.data.components![1].components![0]
      expect(secondInput.custom_id).toBe('input2')
      expect(secondInput.label).toBe('Second Input')
      expect(secondInput.style).toBe(TextInputStyle.Paragraph)
      expect(secondInput.value).toBe('Default text')
      expect(secondInput.max_length).toBe(200)
    })

    it('should throw error when more than 5 inputs provided', () => {
      const options = {
        customId: 'custom_modal',
        title: 'Custom Modal',
        inputs: Array.from({ length: 6 }, (_, i) => ({
          id: `input${i}`,
          label: `Input ${i}`,
          style: TextInputStyle.Short
        }))
      }

      expect(() => builder.createCustomModal(options)).toThrow('Maximum 5 action rows per modal')
    })
  })

  describe('build', () => {
    it('should build modal from current configuration', () => {
      builder
        .setCustomId('test_modal')
        .setTitle('Test Modal')
        .addTextInput({
          customId: 'test_input',
          label: 'Test Input',
          style: TextInputStyle.Short,
          placeholder: 'Enter text...',
          maxLength: 100
        })

      const modal = builder.build()

      expect(modal.data.custom_id).toBe('test_modal')
      expect(modal.data.title).toBe('Test Modal')
      expect(modal.data.components).toHaveLength(1)

      const textInput = modal.data.components![0].components![0]
      expect(textInput.custom_id).toBe('test_input')
      expect(textInput.label).toBe('Test Input')
      expect(textInput.placeholder).toBe('Enter text...')
      expect(textInput.max_length).toBe(100)
    })

    it('should throw error when customId is not set', () => {
      builder.setTitle('Test Modal').addTextInput({
        customId: 'test_input',
        label: 'Test Input',
        style: TextInputStyle.Short
      })

      expect(() => builder.build()).toThrow('Modal customId and title are required')
    })

    it('should throw error when title is not set', () => {
      builder.setCustomId('test_modal').addTextInput({
        customId: 'test_input',
        label: 'Test Input',
        style: TextInputStyle.Short
      })

      expect(() => builder.build()).toThrow('Modal customId and title are required')
    })

    it('should throw error when no inputs are added', () => {
      builder.setCustomId('test_modal').setTitle('Test Modal')

      expect(() => builder.build()).toThrow('At least one text input is required')
    })
  })

  describe('reset', () => {
    it('should reset the builder to initial state', () => {
      builder
        .setCustomId('test_modal')
        .setTitle('Test Modal')
        .addTextInput({
          customId: 'test_input',
          label: 'Test Input',
          style: TextInputStyle.Short
        })

      expect(builder.inputCount).toBe(1)

      builder.reset()
      expect(builder.inputCount).toBe(0)
    })

    it('should return the builder instance for chaining', () => {
      const result = builder.reset()
      expect(result).toBe(builder)
    })
  })

  describe('static utility methods', () => {
    describe('validateModalInteraction', () => {
      it('should validate modal interaction with correct prefix', () => {
        const interaction = { customId: 'new_regenerate_modal_123456789_1234567890' } as ModalSubmitInteraction
        const result = EnhancedModalBuilder.validateModalInteraction(interaction, 'new_regenerate_modal_')

        expect(result).toBe(true)
      })

      it('should reject modal interaction with incorrect prefix', () => {
        const interaction = { customId: 'wrong_modal_123456789_1234567890' } as ModalSubmitInteraction
        const result = EnhancedModalBuilder.validateModalInteraction(interaction, 'new_regenerate_modal_')

        expect(result).toBe(false)
      })
    })

    describe('parseUserIdFromCustomId', () => {
      it('should parse userId from regenerate modal customId', () => {
        const customId = 'new_regenerate_modal_123456789_1234567890'
        const result = EnhancedModalBuilder.parseUserIdFromCustomId(customId)

        expect(result).toBe('123456789')
      })

      it('should parse userId from edit modal customId', () => {
        const customId = 'edit_modal_987654321_1234567890'
        const result = EnhancedModalBuilder.parseUserIdFromCustomId(customId)

        expect(result).toBe('987654321')
      })

      it('should return null for invalid customId format', () => {
        const customId = 'invalid_format'
        const result = EnhancedModalBuilder.parseUserIdFromCustomId(customId)

        expect(result).toBeNull()
      })
    })

    describe('parseModalTypeFromCustomId', () => {
      it('should parse regenerate type from customId', () => {
        const customId = 'new_regenerate_modal_123456789_1234567890'
        const result = EnhancedModalBuilder.parseModalTypeFromCustomId(customId)

        expect(result).toBe('regenerate')
      })

      it('should parse edit type from customId', () => {
        const customId = 'new_edit_modal_123456789_1234567890'
        const result = EnhancedModalBuilder.parseModalTypeFromCustomId(customId)

        expect(result).toBe('edit')
      })

      it('should return null for invalid customId format', () => {
        const customId = 'invalid_format'
        const result = EnhancedModalBuilder.parseModalTypeFromCustomId(customId)

        expect(result).toBeNull()
      })
    })

    describe('getFieldValue', () => {
      it('should extract field value from modal interaction', () => {
        const mockInteraction = {
          fields: {
            getTextInputValue: jest.fn().mockReturnValue('test value')
          }
        } as unknown as ModalSubmitInteraction

        const result = EnhancedModalBuilder.getFieldValue(mockInteraction, 'test_field')

        expect(result).toBe('test value')
        expect(mockInteraction.fields.getTextInputValue).toHaveBeenCalledWith('test_field')
      })

      it('should return null when field does not exist', () => {
        const mockInteraction = {
          fields: {
            getTextInputValue: jest.fn().mockImplementation(() => {
              throw new Error('Field not found')
            })
          }
        } as unknown as ModalSubmitInteraction

        const result = EnhancedModalBuilder.getFieldValue(mockInteraction, 'nonexistent_field')

        expect(result).toBeNull()
      })
    })

    describe('validateRequiredFields', () => {
      it('should return true when all required fields are present and non-empty', () => {
        const mockInteraction = {
          fields: {
            getTextInputValue: jest.fn()
              .mockReturnValueOnce('value1')
              .mockReturnValueOnce('value2')
          }
        } as unknown as ModalSubmitInteraction

        const result = EnhancedModalBuilder.validateRequiredFields(mockInteraction, ['field1', 'field2'])

        expect(result).toBe(true)
      })

      it('should return false when a required field is missing', () => {
        const mockInteraction = {
          fields: {
            getTextInputValue: jest.fn()
              .mockReturnValueOnce('value1')
              .mockImplementationOnce(() => { throw new Error('Field not found') })
          }
        } as unknown as ModalSubmitInteraction

        const result = EnhancedModalBuilder.validateRequiredFields(mockInteraction, ['field1', 'field2'])

        expect(result).toBe(false)
      })

      it('should return false when a required field is empty', () => {
        const mockInteraction = {
          fields: {
            getTextInputValue: jest.fn()
              .mockReturnValueOnce('value1')
              .mockReturnValueOnce('   ') // Empty/whitespace only
          }
        } as unknown as ModalSubmitInteraction

        const result = EnhancedModalBuilder.validateRequiredFields(mockInteraction, ['field1', 'field2'])

        expect(result).toBe(false)
      })
    })
  })
})

describe('ModalBuilderFactory', () => {
  describe('createTextInputModal', () => {
    it('should create a basic text input modal', () => {
      const modal = ModalBuilderFactory.createTextInputModal(
        'test_modal',
        'Test Modal',
        'test_input',
        'Test Input',
        TextInputStyle.Short
      )

      const modalJson = modal.toJSON() as any
      expect(modalJson.custom_id).toBe('test_modal')
      expect(modalJson.title).toBe('Test Modal')

      const textInput = modalJson.components[0].components[0]
      expect(textInput.custom_id).toBe('test_input')
      expect(textInput.label).toBe('Test Input')
      expect(textInput.style).toBe(TextInputStyle.Short)
    })

    it('should maintain backward compatibility with utils/modalHelpers.ts', () => {
      const modal = createTextInputModal(
        'test_modal',
        'Test Modal',
        'test_input',
        'Test Input',
        TextInputStyle.Paragraph,
        {
          placeholder: 'Enter text...',
          value: 'Default',
          maxLength: 200
        }
      )

      expect(modal.data.custom_id).toBe('test_modal')
      expect(modal.data.title).toBe('Test Modal')

      const textInput = modal.data.components![0].components![0]
      expect(textInput.placeholder).toBe('Enter text...')
      expect(textInput.value).toBe('Default')
      expect(textInput.max_length).toBe(200)
    })
  })

  describe('createRegenerateModal', () => {
    it('should create a regenerate modal', () => {
      const userId = '123456789'
      const originalPrompt = 'A beautiful sunset'

      const modal = ModalBuilderFactory.createRegenerateModal(userId, originalPrompt)

      expect(modal.data.custom_id).toMatch(/^new_regenerate_modal_123456789_\d+$/)
      expect(modal.data.title).toBe('Edit Prompt and Regenerate')

      const textInput = modal.data.components![0].components![0]
      expect(textInput.custom_id).toBe('prompt')
      expect(textInput.value).toBe(originalPrompt)
    })

    it('should maintain backward compatibility with utils/modalHelpers.ts', () => {
      const userId = '123456789'
      const originalPrompt = 'Test prompt'

      const modal = createRegenerateModal(userId, originalPrompt)

      expect(modal.data.title).toBe('Edit Prompt and Regenerate')
      expect(modal.data.components![0].components![0].value).toBe(originalPrompt)
    })
  })

  describe('createEditModal', () => {
    it('should create an edit modal', () => {
      const userId = '123456789'

      const modal = ModalBuilderFactory.createEditModal(userId)

      expect(modal.data.custom_id).toMatch(/^new_edit_modal_123456789_\d+$/)
      expect(modal.data.title).toBe('Describe Your Image Edit')

      const textInput = modal.data.components![0].components![0]
      expect(textInput.custom_id).toBe('edit_description')
      expect(textInput.label).toBe('What changes would you like?')
    })

    it('should maintain backward compatibility with utils/modalHelpers.ts', () => {
      const userId = '123456789'

      const modal = createEditModal(userId)

      expect(modal.data.title).toBe('Describe Your Image Edit')
      expect(modal.data.components![0].components![0].custom_id).toBe('edit_description')
    })
  })
})

describe('Backward Compatibility', () => {
  it('should export factory functions that match original utils/modalHelpers.ts', () => {
    expect(typeof createTextInputModal).toBe('function')
    expect(typeof createRegenerateModal).toBe('function')
    expect(typeof createEditModal).toBe('function')
  })

  it('should produce identical results to original functions', () => {
    const userId = '123456789'
    const prompt = 'Test prompt'

    const factoryResult = createRegenerateModal(userId, prompt)
    const builderResult = new EnhancedModalBuilder().createRegenerateModal({ userId, originalPrompt: prompt })

    // Both should have same structure
    expect(factoryResult.data.title).toBe(builderResult.data.title)
    expect(factoryResult.data.components).toHaveLength(1)
    expect(builderResult.data.components).toHaveLength(1)

    // Both should have same input configuration
    const factoryInput = factoryResult.data.components![0].components![0]
    const builderInput = builderResult.data.components![0].components![0]
    
    expect(factoryInput.custom_id).toBe(builderInput.custom_id)
    expect(factoryInput.label).toBe(builderInput.label)
    expect(factoryInput.style).toBe(builderInput.style)
    expect(factoryInput.value).toBe(builderInput.value)
  })
})