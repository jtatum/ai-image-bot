import { describe, it, expect } from '@jest/globals'
import { createRegenerateOnlyButton, createImageActionButtons } from '@/utils/buttons.js'

describe('Button utilities', () => {
  describe('createRegenerateOnlyButton', () => {
    it('should create action row with single regenerate button', () => {
      const userId = 'user123'
      const actionRow = createRegenerateOnlyButton(userId)
      
      expect(actionRow.components.length).toBe(1)
      
      const buttonJson = actionRow.components[0].toJSON() as any
      expect(buttonJson.custom_id).toMatch(/^regenerate_user123_\d+$/)
      expect(buttonJson.label).toBe('🔄')
      expect(buttonJson.style).toBe(2) // ButtonStyle.Secondary
    })

    it('should create different custom IDs for different users', () => {
      const actionRow1 = createRegenerateOnlyButton('user123')
      const actionRow2 = createRegenerateOnlyButton('user456')
      
      const button1Json = actionRow1.components[0].toJSON() as any
      const button2Json = actionRow2.components[0].toJSON() as any
      
      expect(button1Json.custom_id).toMatch(/^regenerate_user123_\d+$/)
      expect(button2Json.custom_id).toMatch(/^regenerate_user456_\d+$/)
      expect(button1Json.custom_id).not.toBe(button2Json.custom_id)
    })
  })

  describe('createImageActionButtons', () => {
    it('should create action row with both edit and regenerate buttons', () => {
      const userId = 'user123'
      const actionRow = createImageActionButtons(userId)
      
      expect(actionRow.components.length).toBe(2)
      
      const editButtonJson = actionRow.components[0].toJSON() as any
      const regenerateButtonJson = actionRow.components[1].toJSON() as any
      
      expect(editButtonJson.custom_id).toMatch(/^edit_user123_\d+$/)
      expect(editButtonJson.label).toBe('✏️')
      
      expect(regenerateButtonJson.custom_id).toMatch(/^regenerate_user123_\d+$/)
      expect(regenerateButtonJson.label).toBe('🔄')
    })
  })
})