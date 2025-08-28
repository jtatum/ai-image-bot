// @ts-nocheck
import { jest } from '@jest/globals'

// Setup environment variables for testing
process.env.NODE_ENV = 'test'
process.env.DISCORD_TOKEN = 'test_token_123456789'
process.env.CLIENT_ID = 'test_client_id_123456789'
process.env.LOG_LEVEL = 'error' // Reduce log noise during tests
process.env.PORT = '3000' // Override .env file
process.env.HEALTH_CHECK_PORT = '3001'
process.env.RATE_LIMIT_WINDOW_MS = '60000'
process.env.RATE_LIMIT_MAX_REQUESTS = '100'

// Mock Discord.js client for testing
jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(function() {
    this.commands = new Map()
    this.cooldowns = new Map()
    this.login = jest.fn().mockResolvedValue('test_token' as any)
    this.destroy = jest.fn().mockResolvedValue(undefined as any)
    this.on = jest.fn().mockReturnThis()
    this.once = jest.fn().mockReturnThis()
    this.user = { tag: 'TestBot#1234' }
    this.guilds = { cache: { size: 1 } }
    this.users = { cache: { size: 10 } }
    this.channels = { cache: { size: 5 } }
    this.ws = { ping: 50 }
    this.isReady = jest.fn().mockReturnValue(true)
    // Methods that might be called during construction
    this.setupErrorHandlers = jest.fn()
    return this
  }),
  Collection: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    size: 0,
    forEach: jest.fn()
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    GuildMembers: 8,
    GuildMessageReactions: 16,
    DirectMessages: 32
  },
  Partials: {
    Message: 'MESSAGE',
    Channel: 'CHANNEL',
    Reaction: 'REACTION'
  },
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
    addBooleanOption: jest.fn().mockReturnThis(),
    toJSON: jest.fn().mockReturnValue({}),
    name: 'test-command'
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setColor: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis()
  })),
  Events: {
    ClientReady: 'ready',
    InteractionCreate: 'interactionCreate',
    GuildCreate: 'guildCreate',
    Error: 'error'
  },
  REST: jest.fn().mockImplementation(() => ({
    setToken: jest.fn().mockReturnThis(),
    put: jest.fn().mockResolvedValue([] as any)
  })),
  Routes: {
    applicationCommands: jest.fn(),
    applicationGuildCommands: jest.fn()
  }
}))

// Mock the DiscordClient class specifically
jest.mock('@/bot/client.js', () => ({
  DiscordClient: jest.fn().mockImplementation(function() {
    this.commands = new Map()
    this.cooldowns = new Map()
    this.login = jest.fn().mockResolvedValue('test_token' as any)
    this.destroy = jest.fn().mockResolvedValue(undefined as any)
    this.on = jest.fn().mockReturnThis()
    this.once = jest.fn().mockReturnThis()
    this.user = { tag: 'TestBot#1234' }
    this.guilds = { cache: { size: 1 } }
    this.users = { cache: { size: 10 } }
    this.channels = { cache: { size: 5 } }
    this.ws = { ping: 50 }
    this.isReady = jest.fn().mockReturnValue(true)
    this.start = jest.fn().mockResolvedValue(undefined)
    this.shutdown = jest.fn().mockResolvedValue(undefined)
    // Private method that's called in constructor
    this.setupErrorHandlers = jest.fn()
    return this
  })
}))

// Global test timeout
jest.setTimeout(10000)