import { ButtonStyle, ButtonInteraction } from 'discord.js'
import {
  EnhancedButtonBuilder,
  ButtonBuilderFactory,
  createImageActionButtons,
  createRegenerateOnlyButton,
  ButtonConfig,
  ActionButtonOptions
} from '@/infrastructure/discord/builders/ButtonBuilder.js'

describe('EnhancedButtonBuilder', () => {
  let builder: EnhancedButtonBuilder

  beforeEach(() => {
    builder = new EnhancedButtonBuilder()
  })

  describe('addButton', () => {
    it('should add a button to the builder', () => {
      const config: ButtonConfig = {
        customId: 'test_button',
        label: 'Test',
        style: ButtonStyle.Primary
      }

      builder.addButton(config)
      expect(builder.buttonCount).toBe(1)
    })

    it('should return the builder instance for chaining', () => {
      const config: ButtonConfig = {
        customId: 'test_button',
        label: 'Test',
        style: ButtonStyle.Primary
      }

      const result = builder.addButton(config)
      expect(result).toBe(builder)
    })
  })

  describe('addButtons', () => {
    it('should add multiple buttons at once', () => {
      const configs: ButtonConfig[] = [
        { customId: 'button1', label: 'Button 1', style: ButtonStyle.Primary },
        { customId: 'button2', label: 'Button 2', style: ButtonStyle.Secondary }
      ]

      builder.addButtons(configs)
      expect(builder.buttonCount).toBe(2)
    })
  })

  describe('createImageActionButtons', () => {
    it('should create both edit and regenerate buttons by default', () => {
      const options: ActionButtonOptions = { userId: '123456789' }
      const actionRow = builder.createImageActionButtons(options)

      expect(actionRow.components).toHaveLength(2)
      const button1Json = actionRow.components[0].toJSON() as any
      const button2Json = actionRow.components[1].toJSON() as any
      expect(button1Json.custom_id).toMatch(/^edit_123456789_\d+$/)
      expect(button2Json.custom_id).toMatch(/^regenerate_123456789_\d+$/)
    })

    it('should create only edit button when includeRegenerate is false', () => {
      const options: ActionButtonOptions = { userId: '123456789', includeRegenerate: false }
      const actionRow = builder.createImageActionButtons(options)

      expect(actionRow.components).toHaveLength(1)
      const button1Json = actionRow.components[0].toJSON() as any
      expect(button1Json.custom_id).toMatch(/^edit_123456789_\d+$/)
    })

    it('should create only regenerate button when includeEdit is false', () => {
      const options: ActionButtonOptions = { userId: '123456789', includeEdit: false }
      const actionRow = builder.createImageActionButtons(options)

      expect(actionRow.components).toHaveLength(1)
      const button1Json = actionRow.components[0].toJSON() as any
      expect(button1Json.custom_id).toMatch(/^regenerate_123456789_\d+$/)
    })

    it('should use custom labels when provided', () => {
      const options: ActionButtonOptions = {
        userId: '123456789',
        customLabels: { edit: 'Custom Edit', regenerate: 'Custom Regenerate' }
      }
      const actionRow = builder.createImageActionButtons(options)

      expect((actionRow.components[0].toJSON() as any).label).toBe('Custom Edit')
      expect((actionRow.components[1].toJSON() as any).label).toBe('Custom Regenerate')
    })

    it('should use custom emojis when provided', () => {
      const options: ActionButtonOptions = {
        userId: '123456789',
        customEmojis: { edit: '📝', regenerate: '🔁' }
      }
      const actionRow = builder.createImageActionButtons(options)

      expect((actionRow.components[0].toJSON() as any).label).toBe('📝')
      expect((actionRow.components[1].toJSON() as any).label).toBe('🔁')
    })

    it('should use custom timestamp when provided', () => {
      const timestamp = 1234567890
      const options: ActionButtonOptions = { userId: '123456789', timestamp }
      const actionRow = builder.createImageActionButtons(options)

      expect((actionRow.components[0].toJSON() as any).custom_id).toBe(`edit_123456789_${timestamp}`)
      expect((actionRow.components[1].toJSON() as any).custom_id).toBe(`regenerate_123456789_${timestamp}`)
    })

    it('should use custom style when provided', () => {
      const options: ActionButtonOptions = { userId: '123456789', style: ButtonStyle.Primary }
      const actionRow = builder.createImageActionButtons(options)

      expect(actionRow.components[0].toJSON().style).toBe(ButtonStyle.Primary)
      expect(actionRow.components[1].toJSON().style).toBe(ButtonStyle.Primary)
    })
  })

  describe('createRegenerateOnlyButton', () => {
    it('should create only regenerate button', () => {
      const options = { userId: '123456789' }
      const actionRow = builder.createRegenerateOnlyButton(options)

      expect(actionRow.components).toHaveLength(1)
      const button1Json = actionRow.components[0].toJSON() as any
      expect(button1Json.custom_id).toMatch(/^regenerate_123456789_\d+$/)
      expect((actionRow.components[0].toJSON() as any).label).toBe('🔄')
    })
  })

  describe('createCustomButton', () => {
    it('should create a button with all properties', () => {
      const config: ButtonConfig = {
        customId: 'test_button',
        label: 'Test Button',
        emoji: '🎉',
        style: ButtonStyle.Success,
        disabled: true
      }

      const button = builder.createCustomButton(config)

      expect((button.toJSON() as any).custom_id).toBe('test_button')
      expect((button.data as any).label).toBe('Test Button')
      expect((button.data as any).emoji).toBe('🎉')
      expect(button.data.style).toBe(ButtonStyle.Success)
      expect(button.data.disabled).toBe(true)
    })

    it('should create a link button with URL', () => {
      const config: ButtonConfig = {
        customId: 'link_button',
        label: 'Visit Site',
        style: ButtonStyle.Link,
        url: 'https://example.com'
      }

      const button = builder.createCustomButton(config)

      expect(button.data.style).toBe(ButtonStyle.Link)
      expect((button.data as any).url).toBe('https://example.com')
    })

    it('should not set URL for non-link buttons', () => {
      const config: ButtonConfig = {
        customId: 'regular_button',
        label: 'Regular',
        style: ButtonStyle.Primary,
        url: 'https://example.com' // Should be ignored
      }

      const button = builder.createCustomButton(config)

      expect((button.data as any).url).toBeUndefined()
    })
  })

  describe('buildActionRow', () => {
    it('should build action row with added buttons', () => {
      const configs: ButtonConfig[] = [
        { customId: 'button1', label: 'Button 1', style: ButtonStyle.Primary },
        { customId: 'button2', label: 'Button 2', style: ButtonStyle.Secondary }
      ]

      builder.addButtons(configs)
      const actionRow = builder.buildActionRow()

      expect(actionRow.components).toHaveLength(2)
      expect((actionRow.components[0].toJSON() as any).custom_id).toBe('button1')
      expect((actionRow.components[1].toJSON() as any).custom_id).toBe('button2')
    })

    it('should throw error when no buttons added', () => {
      expect(() => builder.buildActionRow()).toThrow('No buttons added to builder')
    })

    it('should throw error when more than 5 buttons added', () => {
      const configs: ButtonConfig[] = Array.from({ length: 6 }, (_, i) => ({
        customId: `button${i}`,
        label: `Button ${i}`,
        style: ButtonStyle.Primary
      }))

      builder.addButtons(configs)
      expect(() => builder.buildActionRow()).toThrow('Maximum 5 buttons per action row')
    })
  })

  describe('buildActionRows', () => {
    it('should build single action row for 5 or fewer buttons', () => {
      const configs: ButtonConfig[] = Array.from({ length: 3 }, (_, i) => ({
        customId: `button${i}`,
        label: `Button ${i}`,
        style: ButtonStyle.Primary
      }))

      builder.addButtons(configs)
      const rows = builder.buildActionRows()

      expect(rows).toHaveLength(1)
      expect(rows[0].components).toHaveLength(3)
    })

    it('should build multiple action rows for more than 5 buttons', () => {
      const configs: ButtonConfig[] = Array.from({ length: 8 }, (_, i) => ({
        customId: `button${i}`,
        label: `Button ${i}`,
        style: ButtonStyle.Primary
      }))

      builder.addButtons(configs)
      const rows = builder.buildActionRows()

      expect(rows).toHaveLength(2)
      expect(rows[0].components).toHaveLength(5)
      expect(rows[1].components).toHaveLength(3)
    })

    it('should throw error when no buttons added', () => {
      expect(() => builder.buildActionRows()).toThrow('No buttons added to builder')
    })
  })

  describe('reset', () => {
    it('should reset the builder to initial state', () => {
      builder.addButton({ customId: 'test', label: 'Test', style: ButtonStyle.Primary })
      expect(builder.buttonCount).toBe(1)

      builder.reset()
      expect(builder.buttonCount).toBe(0)
    })

    it('should return the builder instance for chaining', () => {
      const result = builder.reset()
      expect(result).toBe(builder)
    })
  })

  describe('static utility methods', () => {
    describe('validateButtonInteraction', () => {
      it('should validate button interaction with correct prefix', () => {
        const interaction = { customId: 'edit_123456789_1234567890' } as ButtonInteraction
        const result = EnhancedButtonBuilder.validateButtonInteraction(interaction, 'edit_')

        expect(result).toBe(true)
      })

      it('should reject button interaction with incorrect prefix', () => {
        const interaction = { customId: 'wrong_123456789_1234567890' } as ButtonInteraction
        const result = EnhancedButtonBuilder.validateButtonInteraction(interaction, 'edit_')

        expect(result).toBe(false)
      })
    })

    describe('parseUserIdFromCustomId', () => {
      it('should parse userId from edit button customId', () => {
        const customId = 'edit_123456789_1234567890'
        const result = EnhancedButtonBuilder.parseUserIdFromCustomId(customId)

        expect(result).toBe('123456789')
      })

      it('should parse userId from regenerate button customId', () => {
        const customId = 'regenerate_987654321_1234567890'
        const result = EnhancedButtonBuilder.parseUserIdFromCustomId(customId)

        expect(result).toBe('987654321')
      })

      it('should return null for invalid customId format', () => {
        const customId = 'invalid_format'
        const result = EnhancedButtonBuilder.parseUserIdFromCustomId(customId)

        expect(result).toBeNull()
      })
    })

    describe('parseActionFromCustomId', () => {
      it('should parse edit action from customId', () => {
        const customId = 'edit_123456789_1234567890'
        const result = EnhancedButtonBuilder.parseActionFromCustomId(customId)

        expect(result).toBe('edit')
      })

      it('should parse regenerate action from customId', () => {
        const customId = 'regenerate_123456789_1234567890'
        const result = EnhancedButtonBuilder.parseActionFromCustomId(customId)

        expect(result).toBe('regenerate')
      })

      it('should return null for invalid customId format', () => {
        const customId = 'invalid_format'
        const result = EnhancedButtonBuilder.parseActionFromCustomId(customId)

        expect(result).toBeNull()
      })
    })
  })
})

describe('ButtonBuilderFactory', () => {
  describe('createImageActionButtons', () => {
    it('should create image action buttons with both edit and regenerate', () => {
      const userId = '123456789'
      const actionRow = ButtonBuilderFactory.createImageActionButtons(userId)

      expect(actionRow.components).toHaveLength(2)
      const button1Json = actionRow.components[0].toJSON() as any
      expect(button1Json.custom_id).toMatch(/^edit_123456789_\d+$/)
      expect((actionRow.components[1].toJSON() as any).custom_id).toMatch(/^regenerate_123456789_\d+$/)
    })

    it('should maintain backward compatibility with utils/buttons.ts', () => {
      const userId = '123456789'
      const actionRow = createImageActionButtons(userId)

      expect(actionRow.components).toHaveLength(2)
      expect((actionRow.components[0].toJSON() as any).label).toBe('✏️')
      expect((actionRow.components[1].toJSON() as any).label).toBe('🔄')
    })
  })

  describe('createRegenerateOnlyButton', () => {
    it('should create regenerate-only button', () => {
      const userId = '123456789'
      const actionRow = ButtonBuilderFactory.createRegenerateOnlyButton(userId)

      expect(actionRow.components).toHaveLength(1)
      const button1Json = actionRow.components[0].toJSON() as any
      expect(button1Json.custom_id).toMatch(/^regenerate_123456789_\d+$/)
      expect((actionRow.components[0].toJSON() as any).label).toBe('🔄')
    })

    it('should maintain backward compatibility with utils/buttons.ts', () => {
      const userId = '123456789'
      const actionRow = createRegenerateOnlyButton(userId)

      expect(actionRow.components).toHaveLength(1)
      expect((actionRow.components[0].toJSON() as any).label).toBe('🔄')
    })
  })
})

describe('Backward Compatibility', () => {
  it('should export factory functions that match original utils/buttons.ts', () => {
    expect(typeof createImageActionButtons).toBe('function')
    expect(typeof createRegenerateOnlyButton).toBe('function')
  })

  it('should produce identical results to original functions', () => {
    const userId = '123456789'
    
    const factoryResult = createImageActionButtons(userId)
    const builderResult = new EnhancedButtonBuilder().createImageActionButtons({ userId })

    // Both should have same structure
    expect(factoryResult.components).toHaveLength(2)
    expect(builderResult.components).toHaveLength(2)

    // Both should have same button styles and labels
    expect(factoryResult.components[0].toJSON().style).toBe(builderResult.components[0].toJSON().style)
    expect(factoryResult.components[1].toJSON().style).toBe(builderResult.components[1].toJSON().style)
    expect((factoryResult.components[0].toJSON() as any).label).toBe((builderResult.components[0].toJSON() as any).label)
    expect((factoryResult.components[1].toJSON() as any).label).toBe((builderResult.components[1].toJSON() as any).label)
  })
})