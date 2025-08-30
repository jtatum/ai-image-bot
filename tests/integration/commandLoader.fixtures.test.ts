import { CommandLoader } from '@/utils/commandLoader.js'
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

describe('CommandLoader with Real Fixtures', () => {
  let mockClient: ExtendedClient

  beforeEach(() => {
    jest.clearAllMocks()
    mockConfig.USE_NEW_ARCHITECTURE = false

    mockClient = {
      commands: new Collection(),
      cooldowns: new Collection(),
    } as any
  })

  it('should load old architecture commands from real fixture files', async () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/commands/old-architecture')
    const loader = new CommandLoader(mockClient, fixturePath)

    await loader.loadCommands()

    // Should load valid commands
    expect(mockClient.commands.has('testcommand')).toBe(true)
    
    const loadedCommand = mockClient.commands.get('testcommand')
    expect(loadedCommand).toBeDefined()
    expect(loadedCommand?.data.name).toBe('testcommand')
    expect(loadedCommand?.cooldown).toBe(5)
    expect(typeof loadedCommand?.execute).toBe('function')

    // Should not load invalid commands
    expect(mockClient.commands.has('invalid')).toBe(false)
  })

  it('should load new architecture commands from real fixture files', async () => {
    mockConfig.USE_NEW_ARCHITECTURE = true

    const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
    const loader = new CommandLoader(mockClient, fixturePath)

    await loader.loadCommands()

    // Should load class-based commands
    expect(mockClient.commands.has('testcommandclass')).toBe(true)
    
    const classCommand = mockClient.commands.get('testcommandclass')
    expect(classCommand).toBeDefined()
    expect(classCommand?.data.name).toBe('testcommandclass')
    expect(classCommand?.cooldown).toBe(10)
    expect(typeof classCommand?.execute).toBe('function')

    // Should also handle plain objects in new architecture
    expect(mockClient.commands.has('plainobjectinnewarch')).toBe(true)
    
    const plainCommand = mockClient.commands.get('plainobjectinnewarch')
    expect(plainCommand?.cooldown).toBe(0)

    // Should not load invalid commands
    expect(mockClient.commands.has('invalidclass')).toBe(false)
  })

  it('should execute loaded commands correctly', async () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/commands/old-architecture')
    const loader = new CommandLoader(mockClient, fixturePath)

    await loader.loadCommands()

    const command = mockClient.commands.get('testcommand')
    expect(command).toBeDefined()

    // Should execute without throwing
    const mockInteraction = { reply: jest.fn() } as any
    await expect(command?.execute(mockInteraction)).resolves.not.toThrow()
  })

  it('should handle missing commands directory gracefully', async () => {
    const nonExistentPath = join(process.cwd(), 'tests/fixtures/commands/nonexistent')
    const loader = new CommandLoader(mockClient, nonExistentPath)

    await expect(loader.loadCommands()).resolves.not.toThrow()
    expect(mockClient.commands.size).toBe(0)
  })

  it('should bind command execution context correctly for class-based commands', async () => {
    mockConfig.USE_NEW_ARCHITECTURE = true

    const fixturePath = join(process.cwd(), 'tests/fixtures/commands/new-architecture')
    const loader = new CommandLoader(mockClient, fixturePath)

    await loader.loadCommands()

    const classCommand = mockClient.commands.get('testcommandclass')
    expect(classCommand).toBeDefined()
    
    // The execute function should be properly bound to the instance
    expect(typeof classCommand?.execute).toBe('function')
    
    const mockInteraction = { reply: jest.fn() } as any
    await expect(classCommand?.execute(mockInteraction)).resolves.not.toThrow()
  })
})