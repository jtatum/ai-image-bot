import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ChatInputCommandInteraction } from 'discord.js'
import { Command } from '@/bot/types.js'
import interactionCreateEvent from '@/events/interactionCreate.js'
import { createMockChatInputInteraction, createMockButtonInteraction, createMockModalInteraction, createMockInteractionWithClient } from '../helpers/mockInteractions.js'

// Mock the helper utilities
jest.mock('@/utils/interactionHelpers.js', () => ({
  safeReply: jest.fn() as jest.MockedFunction<any>,
}))

jest.mock('@/utils/regenerateImage.js', () => ({
  handleRegenerateButton: jest.fn() as jest.MockedFunction<any>,
  handleRegenerateModal: jest.fn() as jest.MockedFunction<any>,
}))

jest.mock('@/utils/editImage.js', () => ({
  handleEditButton: jest.fn() as jest.MockedFunction<any>,
  handleEditModal: jest.fn() as jest.MockedFunction<any>,
}))

import { safeReply } from '@/utils/interactionHelpers.js'
import { handleRegenerateButton, handleRegenerateModal } from '@/utils/regenerateImage.js'
import { handleEditButton, handleEditModal } from '@/utils/editImage.js'

const mockSafeReply = safeReply as jest.MockedFunction<any>
const mockHandleRegenerateButton = handleRegenerateButton as jest.MockedFunction<any>
const mockHandleRegenerateModal = handleRegenerateModal as jest.MockedFunction<any>
const mockHandleEditButton = handleEditButton as jest.MockedFunction<any>
const mockHandleEditModal = handleEditModal as jest.MockedFunction<any>

describe('InteractionCreate Event', () => {
  let mockCommand: Command

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    // Setup mocks for helper functions
    mockSafeReply.mockResolvedValue(undefined)
    mockHandleRegenerateButton.mockResolvedValue(undefined)
    mockHandleRegenerateModal.mockResolvedValue(undefined)
    mockHandleEditButton.mockResolvedValue(undefined)
    mockHandleEditModal.mockResolvedValue(undefined)

    // Mock command
    mockCommand = {
      data: { name: 'test' } as any,
      cooldown: 5,
      execute: (jest.fn() as any).mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Button Interactions', () => {
    it('should handle regenerate button interactions', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        customId: 'regenerate_user123_1234567890',
        message: {
          content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
        } as any,
      })

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockHandleRegenerateButton).toHaveBeenCalledWith(mockButtonInteraction)
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle edit button interactions', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        customId: 'edit_user123_1234567890',
      })

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockHandleEditButton).toHaveBeenCalledWith(mockButtonInteraction)
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should ignore non-actionable button interactions', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        customId: 'some_other_button',
      })

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockHandleRegenerateButton).not.toHaveBeenCalled()
      expect(mockHandleEditButton).not.toHaveBeenCalled()
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle regenerate button errors gracefully', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        customId: 'regenerate_user123_1234567890',
      })

      mockHandleRegenerateButton.mockRejectedValue(new Error('Test error'))

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error processing your request!',
        ephemeral: true,
      })
    })

    it('should handle edit button errors gracefully', async () => {
      const mockButtonInteraction = createMockButtonInteraction({
        customId: 'edit_user123_1234567890',
      })

      mockHandleEditButton.mockRejectedValue(new Error('Edit error'))

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error processing your request!',
        ephemeral: true,
      })
    })
  })

  describe('Modal Interactions', () => {
    it('should handle regenerate modal submissions', async () => {
      const mockModalInteraction = createMockModalInteraction({
        customId: 'regenerate_modal_user123_1234567890',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('new test prompt'),
        } as any,
      })

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockHandleRegenerateModal).toHaveBeenCalledWith(mockModalInteraction)
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle edit modal submissions', async () => {
      const mockModalInteraction = createMockModalInteraction({
        customId: 'edit_modal_user123_1234567890',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('edit description'),
        } as any,
      })

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockHandleEditModal).toHaveBeenCalledWith(mockModalInteraction)
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should ignore non-actionable modal submissions', async () => {
      const mockModalInteraction = createMockModalInteraction({
        customId: 'some_other_modal',
      })

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockHandleRegenerateModal).not.toHaveBeenCalled()
      expect(mockHandleEditModal).not.toHaveBeenCalled()
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle regenerate modal errors gracefully', async () => {
      const mockModalInteraction = createMockModalInteraction({
        customId: 'regenerate_modal_user123_1234567890',
      })

      mockHandleRegenerateModal.mockRejectedValue(new Error('Modal error'))

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockModalInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error processing your request!',
        ephemeral: true,
      })
    })

    it('should handle edit modal errors gracefully', async () => {
      const mockModalInteraction = createMockModalInteraction({
        customId: 'edit_modal_user123_1234567890',
      })

      mockHandleEditModal.mockRejectedValue(new Error('Edit modal error'))

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockModalInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error processing your request!',
        ephemeral: true,
      })
    })
  })

  describe('Command Execution', () => {
    let mockInteraction: ChatInputCommandInteraction

    beforeEach(() => {
      // Create stateful collections for cooldown testing
      const commands = new Map([['test', mockCommand]])
      const cooldowns = new Map()

      mockInteraction = createMockInteractionWithClient(
        createMockChatInputInteraction({
          commandName: 'test',
          user: { id: 'user123', tag: 'TestUser#1234' } as any,
          guild: { name: 'TestGuild' } as any,
        }),
        commands,
        cooldowns
      )
    })

    it('should not execute if interaction is not a chat input command', async () => {
      const nonChatInteraction = createMockChatInputInteraction({
        isChatInputCommand: jest.fn().mockReturnValue(false),
      })

      await interactionCreateEvent.execute(nonChatInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle unknown commands gracefully', async () => {
      const unknownCommandInteraction = createMockInteractionWithClient(
        createMockChatInputInteraction({
          commandName: 'unknown-command',
        }),
        new Map(), // Empty commands map
        new Map()
      )

      await interactionCreateEvent.execute(unknownCommandInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should allow command execution when no cooldown is active', async () => {
      await interactionCreateEvent.execute(mockInteraction)

      expect(mockCommand.execute).toHaveBeenCalledWith(mockInteraction)
      expect(mockInteraction.reply).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Please wait'),
        })
      )
    })

    it('should enforce cooldown when command is used within cooldown period', async () => {
      // First execution
      await interactionCreateEvent.execute(mockInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mock calls but not the cooldown state
      jest.clearAllMocks()

      // Immediate second execution (should be blocked)
      await interactionCreateEvent.execute(mockInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Please wait'),
        ephemeral: true,
      })
    })

    it('should allow command execution after cooldown expires', async () => {
      // First execution
      await interactionCreateEvent.execute(mockInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Fast-forward time past cooldown (5 seconds)
      jest.advanceTimersByTime(6000)

      // Reset mock calls
      jest.clearAllMocks()

      // Second execution (should be allowed)
      await interactionCreateEvent.execute(mockInteraction)

      expect(mockCommand.execute).toHaveBeenCalledTimes(1)
      expect(mockInteraction.reply).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Please wait'),
        })
      )
    })

    it('should skip cooldown logic when command cooldown is 0', async () => {
      // Set command cooldown to 0
      const noCooldownCommand = { ...mockCommand, cooldown: 0, data: { name: 'test' } as any }
      const commands = new Map([['test', noCooldownCommand]])
      const cooldowns = new Map()

      const noCooldownInteraction = createMockInteractionWithClient(
        createMockChatInputInteraction({
          commandName: 'test',
          user: { id: 'user123', tag: 'TestUser#1234' } as any,
        }),
        commands,
        cooldowns
      )

      // First execution
      await interactionCreateEvent.execute(noCooldownInteraction)
      expect(noCooldownCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mock calls
      jest.clearAllMocks()

      // Immediate second execution (should be allowed since cooldown is 0)
      await interactionCreateEvent.execute(noCooldownInteraction)

      expect(noCooldownCommand.execute).toHaveBeenCalledTimes(1)
      expect(noCooldownInteraction.reply).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Please wait'),
        })
      )
    })

    it('should use default cooldown of 3 seconds when cooldown is undefined', async () => {
      const defaultCooldownCommand = { ...mockCommand, cooldown: undefined, data: { name: 'test' } as any }
      const commands = new Map([['test', defaultCooldownCommand]])
      const cooldowns = new Map()

      const defaultCooldownInteraction = createMockInteractionWithClient(
        createMockChatInputInteraction({
          commandName: 'test',
          user: { id: 'user123', tag: 'TestUser#1234' } as any,
        }),
        commands,
        cooldowns
      )

      // First execution
      await interactionCreateEvent.execute(defaultCooldownInteraction)
      expect(defaultCooldownCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mocks
      jest.clearAllMocks()

      // Immediate second execution (should be blocked by default 3-second cooldown)
      await interactionCreateEvent.execute(defaultCooldownInteraction)

      expect(defaultCooldownCommand.execute).not.toHaveBeenCalled()
      expect(defaultCooldownInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Please wait'),
        ephemeral: true,
      })
    })

    it('should handle different users independently', async () => {
      const commands = new Map([['test', mockCommand]])
      const cooldowns = new Map()

      // First user executes command
      const user1Interaction = createMockInteractionWithClient(
        createMockChatInputInteraction({
          commandName: 'test',
          user: { id: 'user123', tag: 'TestUser1#1234' } as any,
        }),
        commands,
        cooldowns
      )

      await interactionCreateEvent.execute(user1Interaction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Second user with different ID
      const user2Interaction = createMockInteractionWithClient(
        createMockChatInputInteraction({
          commandName: 'test',
          user: { id: 'user456', tag: 'TestUser2#5678' } as any,
        }),
        commands,
        cooldowns
      )

      // Reset mocks
      jest.clearAllMocks()

      // Second user should be able to execute immediately
      await interactionCreateEvent.execute(user2Interaction)

      expect(mockCommand.execute).toHaveBeenCalledTimes(1)
    })

    it('should handle command execution errors', async () => {
      const error = new Error('Command execution failed')
      mockCommand.execute = (jest.fn() as any).mockRejectedValue(error)

      await interactionCreateEvent.execute(mockInteraction)

      expect(mockSafeReply).toHaveBeenCalledWith(mockInteraction, {
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      })
    })
  })
})