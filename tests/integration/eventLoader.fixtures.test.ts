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

describe('EventLoader with Real Fixtures', () => {
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

  it('should load old architecture events from real fixture files', async () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/events/old-architecture')
    const loader = new EventLoader(mockClient, fixturePath)

    await loader.loadEvents()

    // Should register valid events
    expect(mockClient.on).toHaveBeenCalledWith('testEvent', expect.any(Function))
    expect(mockClient.once).toHaveBeenCalledWith('onceEvent', expect.any(Function))

    // Should not register invalid events (no name or no execute)
    const registeredEvents = (mockClient.on as jest.Mock).mock.calls.map(call => call[0])
    const onceEvents = (mockClient.once as jest.Mock).mock.calls.map(call => call[0])

    expect(registeredEvents).not.toContain('invalidEvent')
    expect([...registeredEvents, ...onceEvents]).not.toContain(undefined)
  })

  it('should load new architecture events from real fixture files', async () => {
    mockConfig.USE_NEW_ARCHITECTURE = true

    const fixturePath = join(process.cwd(), 'tests/fixtures/events/new-architecture')
    const loader = new EventLoader(mockClient, fixturePath)

    await loader.loadEvents()

    // Should register class-based events
    expect(mockClient.on).toHaveBeenCalledWith('testEventClass', expect.any(Function))
    expect(mockClient.once).toHaveBeenCalledWith('onceEventClass', expect.any(Function))

    // Should also handle plain objects in new architecture
    expect(mockClient.on).toHaveBeenCalledWith('plainObjectInNewArch', expect.any(Function))
  })

  it('should execute loaded events correctly', async () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/events/old-architecture')
    const loader = new EventLoader(mockClient, fixturePath)

    await loader.loadEvents()

    // Get the registered handler for testEvent
    const testEventCall = (mockClient.on as jest.Mock).mock.calls.find(
      call => call[0] === 'testEvent'
    )

    expect(testEventCall).toBeDefined()

    const handler = testEventCall[1]

    // Should execute without throwing
    await expect(handler('arg1', 'arg2')).resolves.not.toThrow()
  })
})