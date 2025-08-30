import { CommandLoader, EventLoader } from '@/infrastructure/loaders/index.js'
import { ExtendedClient } from '@/bot/types.js'
import { Collection } from 'discord.js'
import { join } from 'path'
// Logger is automatically mocked via __mocks__ directory

describe('Loader Production Path Validation', () => {
  let mockClient: ExtendedClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      commands: new Collection(),
      cooldowns: new Collection(),
      on: jest.fn(),
      once: jest.fn()
    } as any
  })

  describe('CommandLoader production paths', () => {
    it('should load commands from actual production directory', async () => {
      // Test that the production command directory path is correct and accessible
      const productionCommandsPath = join(process.cwd(), 'src', 'presentation', 'commands', 'implementations')
      const loader = new CommandLoader(mockClient, productionCommandsPath)

      await loader.loadCommands()

      // Should load the actual production commands (GeminiCommand, PingCommand, InfoCommand)
      expect(mockClient.commands.size).toBeGreaterThan(0)
      
      // Verify we loaded the actual production commands
      const commandNames = Array.from(mockClient.commands.keys())
      expect(commandNames).toContain('gemini')
      expect(commandNames).toContain('ping')
      expect(commandNames).toContain('info')

      // Validate no path resolution failures occurred
      expect(loader.hasValidationFailures()).toBe(false)
    })
  })

  describe('EventLoader production paths', () => {
    it('should load events from actual production directory', async () => {
      // Test that the production events directory path is correct and accessible
      const productionEventsPath = join(process.cwd(), 'src', 'presentation', 'events', 'implementations')
      const loader = new EventLoader(mockClient, productionEventsPath)

      await loader.loadEvents()

      // Should load the actual production events
      expect(mockClient.on).toHaveBeenCalled()
      
      // Verify we loaded the InteractionCreateEvent
      expect(mockClient.on).toHaveBeenCalledWith('interactionCreate', expect.any(Function))

      // Validate no path resolution failures occurred
      expect(loader.hasValidationFailures()).toBe(false)
    })
  })
})