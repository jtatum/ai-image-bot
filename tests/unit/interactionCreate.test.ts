import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { Command, ExtendedClient } from '@/bot/types.js'
import interactionCreateEvent from '@/events/interactionCreate.js'

// Logger is mocked globally in setup.ts

describe('InteractionCreate Event', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>
  let mockClient: Partial<ExtendedClient>
  let mockCommand: Command

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    // Mock command
    mockCommand = {
      data: new SlashCommandBuilder().setName('test').setDescription('Test command'),
      cooldown: 5,
      execute: jest.fn() as any,
    }

    // Create proper Collection mocks that actually work
    const mockCommandsCollection = {
      // @ts-ignore
      get: jest.fn().mockImplementation((key: string) => {
        return key === 'test' ? mockCommand : undefined
      }),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      size: 1,
      forEach: jest.fn()
    }

    // Create a proper stateful mock that tracks cooldowns per command
    const commandCooldowns = new Map<string, Map<string, number>>()
    
    const mockCooldownsCollection = {
      // @ts-ignore
      get: jest.fn().mockImplementation((commandName: string) => {
        if (!commandCooldowns.has(commandName)) {
          commandCooldowns.set(commandName, new Map<string, number>())
        }
        const userTimestamps = commandCooldowns.get(commandName)!
        
        return {
          // @ts-ignore
          has: jest.fn().mockImplementation((userId: string) => userTimestamps.has(userId)),
          // @ts-ignore
          get: jest.fn().mockImplementation((userId: string) => userTimestamps.get(userId)),
          // @ts-ignore
          set: jest.fn().mockImplementation((userId: string, timestamp: number) => {
            userTimestamps.set(userId, timestamp)
          }),
          // @ts-ignore
          delete: jest.fn().mockImplementation((userId: string) => userTimestamps.delete(userId)),
          clear: jest.fn(),
          size: userTimestamps.size,
          forEach: jest.fn()
        }
      }),
      // @ts-ignore
      set: jest.fn().mockImplementation((commandName: string, timestamps: any) => {
        commandCooldowns.set(commandName, new Map<string, number>())
      }),
      // @ts-ignore
      has: jest.fn().mockImplementation((commandName: string) => commandCooldowns.has(commandName)),
      delete: jest.fn(),
      clear: jest.fn(),
      size: 0,
      forEach: jest.fn()
    }

    // Mock client
    mockClient = {
      commands: mockCommandsCollection as any,
      cooldowns: mockCooldownsCollection as any,
    }

    // Mock interaction
    // @ts-ignore
    mockInteraction = {
      isChatInputCommand: jest.fn().mockReturnValue(true),
      isButton: jest.fn().mockReturnValue(false),
      isModalSubmit: jest.fn().mockReturnValue(false),
      commandName: 'test',
      user: { id: 'user123', tag: 'TestUser#1234' },
      guild: { name: 'TestGuild' },
      client: mockClient as ExtendedClient,
      // @ts-ignore
      reply: jest.fn().mockResolvedValue({ createdTimestamp: Date.now() }),
      // @ts-ignore
      editReply: jest.fn().mockResolvedValue({}),
      // @ts-ignore
      followUp: jest.fn().mockResolvedValue({}),
      replied: false,
      deferred: false,
    } as any
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Button Interactions', () => {
    it('should handle regenerate button interactions', async () => {
      const mockButtonInteraction = {
        ...mockInteraction,
        isButton: jest.fn().mockReturnValue(true),
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(false),
        customId: 'regenerate_user123_1234567890',
        message: {
          content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
        },
        // @ts-ignore
        showModal: jest.fn().mockResolvedValue({}),
      } as any

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockButtonInteraction.showModal).toHaveBeenCalled()
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should ignore non-regenerate button interactions', async () => {
      const mockButtonInteraction = {
        ...mockInteraction,
        isButton: jest.fn().mockReturnValue(true),
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(false),
        customId: 'some_other_button',
      } as any

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle button interaction errors gracefully', async () => {
      const mockButtonInteraction = {
        ...mockInteraction,
        isButton: jest.fn().mockReturnValue(true),
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(false),
        customId: 'regenerate_user123_1234567890',
        message: null, // This will cause an error in handleRegenerateButton
        // @ts-ignore
        showModal: jest.fn().mockResolvedValue({}),
        // @ts-ignore
        reply: jest.fn().mockResolvedValue({}),
      } as any

      await interactionCreateEvent.execute(mockButtonInteraction)

      expect(mockButtonInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error processing your request!',
        ephemeral: true,
      })
    })
  })

  describe('Modal Interactions', () => {
    beforeEach(() => {
      // Mock the gemini service for modal tests
      jest.doMock('@/services/gemini.js', () => ({
        geminiService: {
          isAvailable: jest.fn().mockReturnValue(true),
          // @ts-ignore
          generateImage: jest.fn().mockResolvedValue({
            success: true,
            buffer: Buffer.from('fake-image-data'),
          }),
        },
      }))
    })

    it('should handle regenerate modal submissions', async () => {
      const mockModalInteraction = {
        ...mockInteraction,
        isButton: jest.fn().mockReturnValue(false),
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(true),
        customId: 'regenerate_modal_user123_1234567890',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('new test prompt'),
        },
        // @ts-ignore
        deferReply: jest.fn().mockResolvedValue({}),
        // @ts-ignore
        editReply: jest.fn().mockResolvedValue({}),
      } as any

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockModalInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false })
      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should ignore non-regenerate modal submissions', async () => {
      const mockModalInteraction = {
        ...mockInteraction,
        isButton: jest.fn().mockReturnValue(false),
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(true),
        customId: 'some_other_modal',
      } as any

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle modal interaction errors gracefully', async () => {
      const mockModalInteraction = {
        ...mockInteraction,
        isButton: jest.fn().mockReturnValue(false),
        isChatInputCommand: jest.fn().mockReturnValue(false),
        isModalSubmit: jest.fn().mockReturnValue(true),
        customId: 'regenerate_modal_user123_1234567890',
        fields: {
          getTextInputValue: jest.fn().mockImplementation(() => {
            throw new Error('Mock field error')
          }),
        },
        // @ts-ignore
        reply: jest.fn().mockResolvedValue({}),
      } as any

      await interactionCreateEvent.execute(mockModalInteraction)

      expect(mockModalInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error processing your request!',
        ephemeral: true,
      })
    })
  })

  describe('Cooldown Logic', () => {
    it('should allow command execution when no cooldown is active', async () => {
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).toHaveBeenCalled()
      expect(mockInteraction.reply).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Please wait'),
        })
      )
    })

    it('should enforce cooldown when command is used within cooldown period', async () => {
      // First execution
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mock calls but not the cooldown state
      ;(mockCommand.execute as jest.Mock).mockClear()
      ;(mockInteraction.reply as jest.Mock).mockClear()

      // Immediate second execution (should be blocked)
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Please wait'),
        ephemeral: true,
      })
    })

    it('should allow command execution after cooldown expires', async () => {
      // First execution
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Fast-forward time past cooldown (5 seconds)
      jest.advanceTimersByTime(6000)

      // Reset mock calls
      ;(mockCommand.execute as jest.Mock).mockClear()

      // Second execution (should be allowed)
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).toHaveBeenCalledTimes(1)
      expect(mockInteraction.reply).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Please wait'),
        })
      )
    })

    it('should skip cooldown logic when command cooldown is 0', async () => {
      // Set command cooldown to 0
      mockCommand.cooldown = 0

      // First execution
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mock calls
      ;(mockCommand.execute as jest.Mock).mockClear()

      // Immediate second execution (should be allowed since cooldown is 0)
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).toHaveBeenCalledTimes(1)
      expect(mockInteraction.reply).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Please wait'),
        })
      )
    })

    it('should skip cooldown logic when command cooldown is undefined', async () => {
      // Set command cooldown to undefined (should default to 3 but still allow execution)
      mockCommand.cooldown = undefined

      // First execution
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)
    })

    it('should use default cooldown of 3 seconds when cooldown is undefined', async () => {
      mockCommand.cooldown = undefined

      // First execution
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Reset mocks
      ;(mockCommand.execute as jest.Mock).mockClear()
      ;(mockInteraction.reply as jest.Mock).mockClear()

      // Immediate second execution (should be blocked by default 3-second cooldown)
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Please wait'),
        ephemeral: true,
      })
    })

    it('should handle different users independently', async () => {
      // First user executes command
      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)
      expect(mockCommand.execute).toHaveBeenCalledTimes(1)

      // Second user with different ID
      const mockInteraction2 = {
        ...mockInteraction,
        user: { id: 'user456', tag: 'TestUser2#5678' },
      }

      // Reset mocks
      ;(mockCommand.execute as jest.Mock).mockClear()

      // Second user should be able to execute immediately
      await interactionCreateEvent.execute(mockInteraction2 as ChatInputCommandInteraction)

      expect(mockCommand.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe('Command Execution', () => {
    it('should not execute if interaction is not a chat input command', async () => {
      mockInteraction.isChatInputCommand = jest.fn().mockReturnValue(false) as any

      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle unknown commands gracefully', async () => {
      mockInteraction.commandName = 'unknown-command'

      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockCommand.execute).not.toHaveBeenCalled()
    })

    it('should handle command execution errors', async () => {
      const error = new Error('Command execution failed')
      // @ts-ignore
      mockCommand.execute = jest.fn().mockRejectedValue(error) as any

      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      })
    })

    it('should use followUp for error when interaction already replied', async () => {
      const error = new Error('Command execution failed')
      // @ts-ignore
      mockCommand.execute = jest.fn().mockRejectedValue(error) as any
      mockInteraction.replied = true

      await interactionCreateEvent.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.followUp).toHaveBeenCalledWith({
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      })
    })
  })
})