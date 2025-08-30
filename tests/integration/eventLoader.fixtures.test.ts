import { EventLoader } from '@/infrastructure/loaders/EventLoader.js'
import { ExtendedClient } from '@/bot/types.js'
import { Collection } from 'discord.js'
import { join } from 'path'
// Logger is automatically mocked via __mocks__ directory

describe('EventLoader with Real Fixtures', () => {
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


  it('should load new architecture events from real fixture files', async () => {
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
    const fixturePath = join(process.cwd(), 'tests/fixtures/events/new-architecture')
    const loader = new EventLoader(mockClient, fixturePath)

    await loader.loadEvents()

    // Get the registered handler for testEventClass
    const testEventCall = (mockClient.on as jest.Mock).mock.calls.find(
      call => call[0] === 'testEventClass'
    )

    expect(testEventCall).toBeDefined()

    const handler = testEventCall[1]

    // Should execute without throwing
    await expect(handler('arg1', 'arg2')).resolves.not.toThrow()
  })
})