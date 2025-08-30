import { CommandLoader } from '@/infrastructure/loaders/index.js'
import { ExtendedClient } from '@/bot/types.js'
import { Collection } from 'discord.js'
import { join } from 'path'
// Logger is automatically mocked via __mocks__ directory

describe('CommandLoader', () => {
  let mockClient: ExtendedClient

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      commands: new Collection(),
      cooldowns: new Collection(),
    } as any
  })

  describe('constructor', () => {
    it('should create loader with custom path string', () => {
      const customPath = '/direct/path'
      const loader = new CommandLoader(mockClient, customPath)
      expect(loader).toBeInstanceOf(CommandLoader)
    })
  })

  describe('loadCommands', () => {
    it('should load commands from new architecture', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
      const loader = new CommandLoader(mockClient, fixturePath)

      await loader.loadCommands()

      expect(mockClient.commands.size).toBeGreaterThan(0)
      expect(mockClient.commands.has('testcommandclass')).toBe(true)
      expect(mockClient.commands.has('plainobjectinnewarch')).toBe(true)
    })

    it('should handle missing directory gracefully', async () => {
      const nonExistentPath = '/path/that/does/not/exist'
      const loader = new CommandLoader(mockClient, nonExistentPath)

      await expect(loader.loadCommands()).resolves.not.toThrow()
      expect(mockClient.commands.size).toBe(0)
    })

    it('should handle invalid commands gracefully', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
      const loader = new CommandLoader(mockClient, fixturePath)

      await loader.loadCommands()

      // Should not load invalid commands (like InvalidCommandClass.js)
      expect(mockClient.commands.has('invalidclass')).toBe(false)
    })

    it('should validate command structure', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
      const loader = new CommandLoader(mockClient, fixturePath)

      await loader.loadCommands()

      // All loaded commands should have valid structure
      mockClient.commands.forEach(command => {
        expect(command.data).toBeDefined()
        expect(command.data.name).toBeDefined()
        expect(typeof command.data.name).toBe('string')
        expect(typeof command.execute).toBe('function')
      })
    })
  })

  describe('reloadCommand', () => {
    it('should reload existing command successfully', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
      const loader = new CommandLoader(mockClient, fixturePath)

      // Load initial commands
      await loader.loadCommands()
      expect(mockClient.commands.has('testcommandclass')).toBe(true)

      // Reload specific command - use the exact filename
      const result = await loader.reloadCommand('TestCommandClass')
      expect(result).toBe(true)
    })

    it('should return false for non-existent command', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
      const loader = new CommandLoader(mockClient, fixturePath)

      const result = await loader.reloadCommand('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('validation failures tracking', () => {
    it('should track validation failures', async () => {
      const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
      const loader = new CommandLoader(mockClient, fixturePath)

      await loader.loadCommands()

      // Check if validation failures are tracked (InvalidCommandClass should fail)
      const failures = loader.getValidationFailures()
      expect(Array.isArray(failures)).toBe(true)
      expect(loader.hasValidationFailures()).toBe(failures.length > 0)
    })
  })
})