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
process.env.GOOGLE_API_KEY = 'test_google_api_key'
process.env.COMMAND_COOLDOWN_SECONDS = '30'

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
  Collection: jest.fn().mockImplementation(() => {
    const store = new Map()
    return {
      set: (key: any, value: any) => {
        store.set(key, value)
        return store
      },
      get: (key: any) => store.get(key),
      has: (key: any) => store.has(key),
      delete: (key: any) => store.delete(key),
      clear: () => store.clear(),
      get size() { return store.size },
      forEach: (callback: any) => store.forEach(callback)
    }
  }),
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
  SlashCommandBuilder: jest.fn().mockImplementation(() => {
    let commandName = '';
    const builder = {};
    
    builder.setName = jest.fn().mockImplementation((name) => {
      commandName = name;
      return builder;
    });
    builder.setDescription = jest.fn().mockReturnValue(builder);
    builder.addStringOption = jest.fn().mockReturnValue(builder);
    builder.addIntegerOption = jest.fn().mockReturnValue(builder);
    builder.addBooleanOption = jest.fn().mockReturnValue(builder);
    builder.toJSON = jest.fn().mockReturnValue({});
    
    Object.defineProperty(builder, 'name', {
      get() { return commandName; }
    });
    
    return builder;
  }),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setColor: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis()
  })),
  ActionRowBuilder: jest.fn().mockImplementation(() => {
    const actionRow = {
      components: [],
      addComponents: jest.fn().mockImplementation((...components) => {
        actionRow.components.push(...components)
        return actionRow
      }),
      toJSON: jest.fn().mockReturnValue({ type: 1, components: [] })
    }
    return actionRow
  }),
  ButtonBuilder: jest.fn().mockImplementation(() => {
    let customId = ''
    let label = ''
    let style = 2
    
    const button = {
      setCustomId: jest.fn().mockImplementation((id) => {
        customId = id
        return button
      }),
      setLabel: jest.fn().mockImplementation((lbl) => {
        label = lbl
        return button
      }),
      setStyle: jest.fn().mockImplementation((st) => {
        style = st
        return button
      }),
      toJSON: jest.fn().mockImplementation(() => ({
        type: 2,
        custom_id: customId,
        label: label,
        style: style
      })),
      data: {
        get custom_id() { return customId },
        get label() { return label },
        get style() { return style }
      }
    }
    return button
  }),
  ButtonStyle: {
    Primary: 1,
    Secondary: 2,
    Success: 3,
    Danger: 4,
    Link: 5
  },
  ModalBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    addComponents: jest.fn().mockReturnThis()
  })),
  TextInputBuilder: jest.fn().mockImplementation(() => ({
    setCustomId: jest.fn().mockReturnThis(),
    setLabel: jest.fn().mockReturnThis(),
    setStyle: jest.fn().mockReturnThis(),
    setPlaceholder: jest.fn().mockReturnThis(),
    setValue: jest.fn().mockReturnThis(),
    setRequired: jest.fn().mockReturnThis(),
    setMaxLength: jest.fn().mockReturnThis()
  })),
  TextInputStyle: {
    Short: 1,
    Paragraph: 2
  },
  AttachmentBuilder: jest.fn().mockImplementation(() => ({})),
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

// Mock logger globally - must be before any imports that use it
jest.mock('@/config/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  },
}))

// @google/genai is mocked in individual test files as needed

// Global test timeout
jest.setTimeout(10000)