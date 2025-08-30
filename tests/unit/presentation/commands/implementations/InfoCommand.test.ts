import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ChatInputCommandInteraction } from 'discord.js'
import { createMockChatInputInteraction } from '../../../../helpers/mockInteractions.js'
import { InfoCommand } from '@/presentation/commands/implementations/InfoCommand.js'
import { config } from '@/shared/config/environment.js'
import logger from '@/infrastructure/monitoring/Logger.js'

// Mock logger
jest.mock('@/infrastructure/monitoring/Logger.js', () => ({
  __esModule: true,
  default: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock config
jest.mock('@/shared/config/environment.js', () => ({
  config: {
    COMMAND_COOLDOWN_SECONDS: 30,
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    GOOGLE_API_KEY: 'test-api-key',
    HEALTH_CHECK_PORT: 3001,
  },
}))

describe('InfoCommand', () => {
  let command: InfoCommand
  let mockInteraction: ChatInputCommandInteraction
  let mockLogger: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup logger mock
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }
    ;(logger.child as jest.MockedFunction<any>).mockReturnValue(mockLogger)

    // Create command instance
    command = new InfoCommand()

    // Setup default mock interaction
    mockInteraction = createMockChatInputInteraction({
      commandName: 'info',
      client: {
        readyAt: new Date('2023-01-01T00:00:00.000Z'),
        guilds: {
          cache: { size: 5 },
        },
        users: {
          cache: { size: 100 },
        },
        channels: {
          cache: { size: 25 },
        },
        ws: {
          ping: 75,
        },
        commands: {
          size: 3,
        },
      } as any,
      reply: jest.fn<() => Promise<any>>().mockResolvedValue({}),
    })

    // Add guild members fetchMe functionality for BaseCommand validation
    Object.assign(mockInteraction, {
      inGuild: jest.fn().mockReturnValue(true),
      guildId: 'guild123',
      guild: {
        id: 'guild123',
        name: 'Test Guild',
        members: {
          fetchMe: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'bot123' })
        }
      }
    })
  })

  describe('Command Structure', () => {
    it('should have correct command data and properties', () => {
      expect(command.data).toBeDefined()
      expect(command.cooldown).toBe(30)
      expect(command.getCommandInfo()).toEqual({
        name: 'info',
        cooldown: 30,
        className: 'InfoCommand',
      })
    })

    it('should have correct command JSON structure', () => {
      const testCommand = new InfoCommand()
      const commandData = testCommand.data
      
      expect(commandData).toBeDefined()
      
      const commandJSON = commandData.toJSON()
      expect(commandJSON).toBeDefined()
      expect(typeof commandJSON).toBe('object')
      
      if (commandJSON.name) {
        expect(commandJSON.name).toBe('info')
      }
      
      if (commandJSON.description) {
        expect(commandJSON.description).toBe('Display information about the bot and system statistics')
      }
    })

    it('should have no options', () => {
      const commandJSON = command.data.toJSON()
      
      if (commandJSON.options) {
        expect(commandJSON.options).toHaveLength(0)
      }
    })
  })

  describe('Info Display', () => {
    it('should reply with comprehensive bot information embed', async () => {
      await command.execute(mockInteraction)

      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              setColor: expect.any(Function),
              setTitle: expect.any(Function),
              setDescription: expect.any(Function),
            })
          ])
        })
      )
    })

    it('should include bot statistics in embed', async () => {
      const testCommand = new InfoCommand()
      const statisticsField = (testCommand as any).getStatisticsField(mockInteraction.client)
      
      expect(statisticsField.name).toBe('📊 Statistics')
      expect(statisticsField.value).toContain('**Servers:** 5')
      expect(statisticsField.value).toContain('**Users:** 100')
      expect(statisticsField.value).toContain('**Channels:** 25')
      expect(statisticsField.value).toContain('**Commands:** 3')
      expect(statisticsField.inline).toBe(true)
    })

    it('should include performance metrics in embed', async () => {
      // Mock process.uptime to return 3661 seconds (1 hour, 1 minute, 1 second)
      jest.spyOn(process, 'uptime').mockReturnValue(3661)

      const testCommand = new InfoCommand()
      const performanceField = (testCommand as any).getPerformanceField(mockInteraction.client)
      
      expect(performanceField.name).toBe('⚡ Performance')
      expect(performanceField.value).toContain('**Uptime:** 1h 1m 1s')
      expect(performanceField.value).toContain('**Ping:** 75ms')
      expect(performanceField.value).toContain('**Memory:**') // Memory formatting tested separately
      expect(performanceField.value).toContain(`**Node.js:** ${process.version}`)
      expect(performanceField.inline).toBe(true)

      ;(process.uptime as unknown as jest.Mock).mockRestore()
    })

    it('should include environment information in embed', async () => {
      const testCommand = new InfoCommand()
      const environmentField = (testCommand as any).getEnvironmentField()
      
      expect(environmentField.name).toBe('🔧 Environment')
      expect(environmentField.value).toContain('**Mode:** test')
      expect(environmentField.value).toContain('**Log Level:** info')
      expect(environmentField.value).toContain('**AI Enabled:** ✅ Yes')
      expect(environmentField.value).toContain('**Health Port:** 3001')
      expect(environmentField.inline).toBe(true)
    })

    it('should show AI as disabled when no API key', async () => {
      // Temporarily mock config without API key
      const originalConfig = (config as any).GOOGLE_API_KEY
      ;(config as any).GOOGLE_API_KEY = undefined

      const testCommand = new InfoCommand()
      const environmentField = (testCommand as any).getEnvironmentField()
      
      expect(environmentField.value).toContain('**AI Enabled:** ❌ No')

      // Restore original config
      ;(config as any).GOOGLE_API_KEY = originalConfig
    })

    it('should include features information in embed', async () => {
      const testCommand = new InfoCommand()
      const featuresField = (testCommand as any).getFeaturesField()
      
      expect(featuresField.name).toBe('✨ Features')
      expect(featuresField.value).toContain('🎨 **AI Image Generation**')
      expect(featuresField.value).toContain('🏓 **Ping/Latency Check**')
      expect(featuresField.value).toContain('📊 **System Information**')
      expect(featuresField.value).toContain('🔄 **Auto-reload**')
      expect(featuresField.inline).toBe(false)
    })
  })

  describe('Embed Construction', () => {
    it('should build embed successfully', async () => {
      const testCommand = new InfoCommand()
      const embed = await (testCommand as any).buildInfoEmbed(mockInteraction.client)
      
      // Test that embed is created and has expected methods
      expect(embed).toBeDefined()
      expect(typeof embed.setColor).toBe('function')
      expect(typeof embed.addFields).toBe('function')
    })
  })

  describe('Development Mode Features', () => {
    beforeEach(() => {
      // Mock development environment
      ;(config as any).NODE_ENV = 'development'
    })

    afterEach(() => {
      // Reset to test environment
      ;(config as any).NODE_ENV = 'test'
    })

    it('should include system information in development mode', async () => {
      const testCommand = new InfoCommand()
      const embed = await (testCommand as any).buildInfoEmbed(mockInteraction.client)

      const embedData = embed.toJSON()
      const systemField = embedData.fields?.find(field => field.name === '💻 System (Dev Mode)')
      
      expect(systemField).toBeDefined()
      expect(systemField?.value).toContain(`**Platform:** ${process.platform} (${process.arch})`)
      expect(systemField?.value).toContain(`**Process ID:** ${process.pid}`)
      expect(systemField?.value).toContain('**CPU Usage:**')
      expect(systemField?.value).toContain('**Start Time:**')
      expect(systemField?.inline).toBe(false)
    })

    it('should not include system information in non-development mode', async () => {
      ;(config as any).NODE_ENV = 'production'

      const testCommand = new InfoCommand()
      const embed = await (testCommand as any).buildInfoEmbed(mockInteraction.client)

      const embedData = embed.toJSON()
      const systemField = embedData.fields?.find(field => field.name === '💻 System (Dev Mode)')
      
      expect(systemField).toBeUndefined()
    })
  })

  describe('Utility Methods', () => {
    const uptimeTestCases = [
      { seconds: 45, expected: '45s' },
      { seconds: 90, expected: '1m 30s' },
      { seconds: 3661, expected: '1h 1m 1s' },
      { seconds: 90061, expected: '1d 1h 1m 1s' },
      { seconds: 86400, expected: '1d' },
      { seconds: 3600, expected: '1h' },
      { seconds: 0, expected: '0s' }
    ]

    uptimeTestCases.forEach(({ seconds, expected }) => {
      it(`should format ${seconds} seconds as "${expected}"`, () => {
        const testCommand = new InfoCommand()
        const result = (testCommand as any).formatUptime(seconds)
        expect(result).toBe(expected)
      })
    })

    it('should format memory usage correctly', () => {
      const testCommand = new InfoCommand()
      
      // Mock memory usage: 100MB RSS, 50MB used, 80MB total heap
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 104857600,
        heapUsed: 52428800,
        heapTotal: 83886080,
        external: 1048576,
        arrayBuffers: 0,
      })

      const result = (testCommand as any).formatMemoryUsage()
      expect(result).toBe('100MB RSS (50/80MB heap)')

      ;(process.memoryUsage as unknown as jest.Mock).mockRestore()
    })

    it('should calculate CPU usage percentage', () => {
      const testCommand = new InfoCommand()
      
      jest.spyOn(process, 'cpuUsage').mockReturnValue({
        user: 1000000, // 1 second in microseconds
        system: 500000, // 0.5 seconds in microseconds
      })
      
      jest.spyOn(process, 'uptime').mockReturnValue(10) // 10 seconds uptime

      const result = (testCommand as any).getCpuUsage()
      expect(result).toBe('~15.00%') // (1.5 / 10) * 100 = 15%

      ;(process.cpuUsage as unknown as jest.Mock).mockRestore()
      ;(process.uptime as unknown as jest.Mock).mockRestore()
    })
  })

  describe('Validation', () => {
    it('should validate that client is ready', async () => {
      const notReadyInteraction = createMockChatInputInteraction({
        commandName: 'info',
        client: {
          readyAt: null, // Bot not ready
          guilds: { cache: { size: 0 } },
          users: { cache: { size: 0 } },
          channels: { cache: { size: 0 } },
        } as any,
      })

      await expect(command.execute(notReadyInteraction)).rejects.toThrow(
        'Bot is not ready yet, please wait a moment'
      )
    })

    it('should proceed when client is ready', async () => {
      await expect(command.execute(mockInteraction)).resolves.not.toThrow()
      expect(mockInteraction.reply).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle "not ready" errors with custom message', () => {
      const testCommand = new InfoCommand()
      const error = new Error('Bot is not ready yet, please wait a moment')
      
      const message = (testCommand as any).getErrorMessage(error)
      expect(message).toBe('The bot is still starting up. Please try again in a moment.')
    })

    it('should handle cache errors with custom message', () => {
      const testCommand = new InfoCommand()
      const error = new Error('Unable to fetch cache data')
      
      const message = (testCommand as any).getErrorMessage(error)
      expect(message).toBe('Unable to fetch bot statistics at the moment. Please try again later.')
    })

    it('should fall back to base error handling for other errors', () => {
      const testCommand = new InfoCommand()
      const error = new Error('Some other error')
      
      // Mock the parent class method
      const baseGetErrorMessage = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(testCommand)), 'getErrorMessage')
      baseGetErrorMessage.mockReturnValue('Base error message')

      const message = (testCommand as any).getErrorMessage(error)
      expect(message).toBe('Base error message')
      expect(baseGetErrorMessage).toHaveBeenCalledWith(error)

      baseGetErrorMessage.mockRestore()
    })

    it('should handle client data collection failures gracefully', async () => {
      const faultyClient = {
        readyAt: new Date(),
        guilds: { cache: { size: 5 } },
        users: { cache: { size: 100 } },
        channels: { cache: { size: 25 } },
        ws: { ping: null }, // Null ping could cause issues
      }

      const faultyInteraction = createMockChatInputInteraction({
        commandName: 'info',
        client: faultyClient as any,
        reply: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      })

      // Should not throw even with faulty data
      await expect(command.execute(faultyInteraction)).resolves.not.toThrow()
    })
  })

  describe('Configuration Options', () => {
    it('should have correct cooldown setting', () => {
      expect(command.cooldown).toBe(30)
    })

    it('should have execution logging disabled by default', () => {
      expect((command as any).enableExecutionLogging).toBe(false)
    })
  })

  describe('Integration Tests', () => {
    it('should work in DMs without guild context', async () => {
      const dmInteraction = createMockChatInputInteraction({
        commandName: 'info',
        guild: null,
        inGuild: jest.fn().mockReturnValue(false),
        client: mockInteraction.client,
        reply: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      })

      await command.execute(dmInteraction)

      expect(dmInteraction.reply).toHaveBeenCalledWith({
        embeds: [expect.objectContaining({
          setColor: expect.any(Function),
          setTitle: expect.any(Function),
          addFields: expect.any(Function)
        })],
      })
    })

    it('should handle missing client data gracefully', async () => {
      const minimalClient = {
        readyAt: new Date(),
        guilds: { cache: { size: 0 } },
        users: { cache: { size: 0 } },
        channels: { cache: { size: 0 } },
        ws: { ping: -1 },
      }

      const minimalInteraction = createMockChatInputInteraction({
        commandName: 'info',
        client: minimalClient as any,
        reply: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      })

      Object.assign(minimalInteraction, {
        inGuild: jest.fn().mockReturnValue(false),
      })

      await command.execute(minimalInteraction)

      expect(minimalInteraction.reply).toHaveBeenCalled()
    })

    it('should display accurate command count when available', async () => {
      const clientWithCommands = {
        ...mockInteraction.client,
        commands: { size: 10 },
      }

      const interactionWithCommands = createMockChatInputInteraction({
        commandName: 'info',
        client: clientWithCommands as any,
        reply: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      })

      Object.assign(interactionWithCommands, {
        inGuild: jest.fn().mockReturnValue(false),
      })

      const testCommand = new InfoCommand()
      const embed = await (testCommand as any).buildInfoEmbed(clientWithCommands)

      const embedData = embed.toJSON()
      const statisticsField = embedData.fields?.find(field => field.name === '📊 Statistics')
      
      expect(statisticsField?.value).toContain('**Commands:** 10')
    })
  })
})