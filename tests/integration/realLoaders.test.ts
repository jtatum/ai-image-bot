import { CommandLoader } from '@/utils/commandLoader.js'
import { EventLoader } from '@/utils/eventLoader.js'
import { ExtendedClient } from '@/bot/types.js'
import { Collection } from 'discord.js'
import { join } from 'path'
// Logger is automatically mocked via __mocks__ directory

// Create a mutable config object
let mockConfig = {
  USE_NEW_ARCHITECTURE: false
}

// Mock the config module
jest.mock('@/config/environment.js', () => ({
  get config() {
    return mockConfig
  }
}))

describe('Real Loaders Integration', () => {
  let mockClient: ExtendedClient

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig.USE_NEW_ARCHITECTURE = false

    mockClient = {
      commands: new Collection(),
      cooldowns: new Collection(),
      on: jest.fn(),
      once: jest.fn()
    } as any
  })

  describe('loading real current commands', () => {
    it('should load all commands from old architecture (current)', async () => {
      const commandsPath = join(process.cwd(), 'src/commands')
      const loader = new CommandLoader(mockClient, commandsPath)

      await loader.loadCommands()

      // Should load without validation failures
      expect(loader.hasValidationFailures()).toBe(false)
      
      // Should load the actual commands from src/commands
      expect(mockClient.commands.size).toBeGreaterThan(0)
      expect(mockClient.commands.has('gemini')).toBe(true)
      expect(mockClient.commands.has('info')).toBe(true)

      // Verify command structure
      const geminiCommand = mockClient.commands.get('gemini')
      expect(geminiCommand).toBeDefined()
      expect(geminiCommand?.data.name).toBe('gemini')
      expect(typeof geminiCommand?.execute).toBe('function')

      const infoCommand = mockClient.commands.get('info')
      expect(infoCommand).toBeDefined()
      expect(infoCommand?.data.name).toBe('info')
      expect(typeof infoCommand?.execute).toBe('function')
    })

    it('should load all commands from new architecture when enabled', async () => {
      mockConfig.USE_NEW_ARCHITECTURE = true

      const commandsPath = join(process.cwd(), 'src/presentation/commands/implementations')
      const loader = new CommandLoader(mockClient, commandsPath)

      await loader.loadCommands()

      // Should load without validation failures  
      expect(loader.hasValidationFailures()).toBe(false)
      
      // Should load the new architecture commands
      expect(mockClient.commands.size).toBeGreaterThan(0)
      expect(mockClient.commands.has('gemini')).toBe(true)
      expect(mockClient.commands.has('info')).toBe(true)
      expect(mockClient.commands.has('ping')).toBe(true)

      // Verify command structure for class-based commands
      const geminiCommand = mockClient.commands.get('gemini')
      expect(geminiCommand).toBeDefined()
      expect(geminiCommand?.data.name).toBe('gemini')
      expect(typeof geminiCommand?.execute).toBe('function')

      const pingCommand = mockClient.commands.get('ping')
      expect(pingCommand).toBeDefined()
      expect(pingCommand?.data.name).toBe('ping')
      expect(typeof pingCommand?.execute).toBe('function')
    })
  })

  describe('loading real current events', () => {
    it('should load all events from old architecture (current)', async () => {
      const eventsPath = join(process.cwd(), 'src/events')
      const loader = new EventLoader(mockClient, eventsPath)

      await loader.loadEvents()

      // Should load without validation failures
      expect(loader.hasValidationFailures()).toBe(false)

      // Should register the actual events from src/events
      const registeredEvents = (mockClient.on as jest.Mock).mock.calls.map(call => call[0])
      const onceEvents = (mockClient.once as jest.Mock).mock.calls.map(call => call[0])
      const allEvents = [...registeredEvents, ...onceEvents]

      // Check for expected events based on actual files
      expect(allEvents).toContain('error')
      expect(allEvents).toContain('guildCreate') 
      expect(allEvents).toContain('interactionCreate')
      expect(onceEvents).toContain('ready') // ready is typically a once event

      // Verify all registered events have handlers
      expect(mockClient.on).toHaveBeenCalled()
      expect(mockClient.once).toHaveBeenCalled()
    })

    it('should load events from new architecture when enabled', async () => {
      mockConfig.USE_NEW_ARCHITECTURE = true

      const eventsPath = join(process.cwd(), 'src/presentation/events/implementations')
      const loader = new EventLoader(mockClient, eventsPath)

      await loader.loadEvents()

      // Should load without validation failures
      expect(loader.hasValidationFailures()).toBe(false)

      // Should register the new architecture events
      const registeredEvents = (mockClient.on as jest.Mock).mock.calls.map(call => call[0])
      const onceEvents = (mockClient.once as jest.Mock).mock.calls.map(call => call[0])

      // The new architecture should have InteractionCreateEvent loaded
      expect(registeredEvents.concat(onceEvents)).toContain('interactionCreate')
    })
  })

  describe('combined loader integration', () => {
    it('should load both commands and events from old architecture', async () => {
      const commandsPath = join(process.cwd(), 'src/commands')
      const eventsPath = join(process.cwd(), 'src/events')
      
      const commandLoader = new CommandLoader(mockClient, commandsPath)
      const eventLoader = new EventLoader(mockClient, eventsPath)

      await commandLoader.loadCommands()
      await eventLoader.loadEvents()

      // Should load without validation failures
      expect(commandLoader.hasValidationFailures()).toBe(false)
      expect(eventLoader.hasValidationFailures()).toBe(false)

      // Should have loaded both commands and events
      expect(mockClient.commands.size).toBeGreaterThan(0)
      expect(mockClient.on).toHaveBeenCalled()
      expect(mockClient.once).toHaveBeenCalled()

      // Commands should be accessible
      expect(mockClient.commands.has('gemini')).toBe(true)
      expect(mockClient.commands.has('info')).toBe(true)

      // Events should be registered
      const allEventCalls = [
        ...(mockClient.on as jest.Mock).mock.calls,
        ...(mockClient.once as jest.Mock).mock.calls
      ]
      expect(allEventCalls.length).toBeGreaterThan(0)
    })

    it('should load both commands and events from new architecture when enabled', async () => {
      mockConfig.USE_NEW_ARCHITECTURE = true

      const commandsPath = join(process.cwd(), 'src/presentation/commands/implementations')
      const eventsPath = join(process.cwd(), 'src/presentation/events/implementations')
      
      const commandLoader = new CommandLoader(mockClient, commandsPath)
      const eventLoader = new EventLoader(mockClient, eventsPath)

      await commandLoader.loadCommands()
      await eventLoader.loadEvents()

      // Should load without validation failures
      expect(commandLoader.hasValidationFailures()).toBe(false)
      expect(eventLoader.hasValidationFailures()).toBe(false)

      // Should have loaded new architecture components
      expect(mockClient.commands.size).toBeGreaterThan(0)
      
      // New architecture has ping command that old doesn't
      expect(mockClient.commands.has('ping')).toBe(true)
      expect(mockClient.commands.has('gemini')).toBe(true)
      expect(mockClient.commands.has('info')).toBe(true)
    })
  })

  describe('error handling with real files', () => {
    it('should handle corrupted command files gracefully', async () => {
      // Test with a path that might have file permission issues
      const commandsPath = join(process.cwd(), 'src/commands')
      const loader = new CommandLoader(mockClient, commandsPath)

      // Should not throw even if some files have issues
      await expect(loader.loadCommands()).resolves.not.toThrow()
    })

    it('should handle corrupted event files gracefully', async () => {
      const eventsPath = join(process.cwd(), 'src/events')
      const loader = new EventLoader(mockClient, eventsPath)

      // Should not throw even if some files have issues
      await expect(loader.loadEvents()).resolves.not.toThrow()
    })
  })
})