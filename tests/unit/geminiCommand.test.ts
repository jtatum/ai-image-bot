import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ChatInputCommandInteraction } from 'discord.js'

// Mock the gemini service
const mockGeminiService = {
  isAvailable: jest.fn(),
  generateImage: jest.fn(),
}

jest.mock('@/services/gemini.js', () => ({
  geminiService: mockGeminiService,
}))

// Mock the filename utility
jest.mock('@/utils/filename.js', () => ({
  createImageFilename: jest.fn().mockReturnValue('test_image.png'),
}))

// Mock the config
jest.mock('@/config/environment.js', () => ({
  config: {
    COMMAND_COOLDOWN_SECONDS: 30,
  },
}))


import geminiCommand from '@/commands/gemini.js'
import { createImageFilename } from '@/utils/filename.js'

describe('Gemini Command', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>

  beforeEach(() => {
    jest.clearAllMocks()

    mockInteraction = {
      options: {
        getString: jest.fn().mockReturnValue('test prompt'),
      },
      user: {
        tag: 'TestUser#1234',
        username: 'testuser',
      },
      guild: {
        name: 'TestGuild',
      },
      // @ts-ignore
      reply: jest.fn().mockResolvedValue({}),
      // @ts-ignore
      deferReply: jest.fn().mockResolvedValue({}),
      // @ts-ignore
      editReply: jest.fn().mockResolvedValue({}),
    } as any
  })

  describe('Command Structure', () => {
    it('should have correct command data', () => {
      // SlashCommandBuilder is mocked and returns 'test-command' in tests
      expect(geminiCommand.data.name).toBe('test-command')
      expect(geminiCommand.cooldown).toBe(30)
      expect(typeof geminiCommand.execute).toBe('function')
    })
  })

  describe('Service Availability', () => {
    it('should reply with error when gemini service is unavailable', async () => {
      mockGeminiService.isAvailable.mockReturnValue(false)

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Image generation is currently unavailable. Please try again later.',
        ephemeral: true,
      })
      expect(mockGeminiService.generateImage).not.toHaveBeenCalled()
    })
  })

  describe('Successful Image Generation', () => {
    beforeEach(() => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      // @ts-ignore
      mockGeminiService.generateImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('fake-image-data'),
      })
    })

    it('should generate image successfully and include refresh button', async () => {
      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.deferReply).toHaveBeenCalled()
      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('test prompt')
      expect(createImageFilename).toHaveBeenCalledWith('testuser', 'test prompt')

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
        files: [expect.any(Object)],
        components: [expect.any(Object)], // This should contain the refresh button
      })
    })

    it('should work in DMs without guild context', async () => {
      const dmInteraction = { ...mockInteraction, guild: null }

      await geminiCommand.execute(dmInteraction as ChatInputCommandInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith('test prompt')
      expect(dmInteraction.editReply).toHaveBeenCalledWith({
        content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
        files: [expect.any(Object)],
        components: [expect.any(Object)],
      })
    })
  })

  describe('Failed Image Generation', () => {
    beforeEach(() => {
      mockGeminiService.isAvailable.mockReturnValue(true)
    })

    it('should handle generation failure with error message', async () => {
      // @ts-ignore
      mockGeminiService.generateImage.mockResolvedValue({
        success: false,
        error: 'Content blocked: SAFETY',
      })

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Content blocked: SAFETY\n**Prompt:** test prompt',
      })
    })

    it('should handle generation failure with default error message', async () => {
      // @ts-ignore
      mockGeminiService.generateImage.mockResolvedValue({
        success: false,
      })

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to generate image\n**Prompt:** test prompt',
      })
    })

    it('should handle service exceptions', async () => {
      // @ts-ignore
      mockGeminiService.generateImage.mockRejectedValue(new Error('API Error'))

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to generate image: API Error',
      })
    })

    it('should handle unknown exceptions', async () => {
      // @ts-ignore
      mockGeminiService.generateImage.mockRejectedValue('Unknown error')

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to generate image: Unknown error occurred',
      })
    })
  })

  describe('Prompt Handling', () => {
    beforeEach(() => {
      mockGeminiService.isAvailable.mockReturnValue(true)
      // @ts-ignore
      mockGeminiService.generateImage.mockResolvedValue({
        success: true,
        buffer: Buffer.from('fake-image-data'),
      })
    })

    it('should handle long prompts correctly', async () => {
      const longPrompt = 'a'.repeat(999) // Just under the 1000 char limit
      ;(mockInteraction.options!.getString as jest.Mock).mockReturnValue(longPrompt)

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(longPrompt)
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: `🎨 **Image generated successfully!**\n**Prompt:** ${longPrompt}`,
        files: [expect.any(Object)],
        components: [expect.any(Object)],
      })
    })

    it('should handle prompts with special characters', async () => {
      const specialPrompt = 'robot with ñice émojis 🤖✨ & symbols!'
      ;(mockInteraction.options!.getString as jest.Mock).mockReturnValue(specialPrompt)

      await geminiCommand.execute(mockInteraction as ChatInputCommandInteraction)

      expect(mockGeminiService.generateImage).toHaveBeenCalledWith(specialPrompt)
      expect(createImageFilename).toHaveBeenCalledWith('testuser', specialPrompt)
    })
  })
})