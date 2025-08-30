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
  EmbedBuilder: jest.fn().mockImplementation(function MockEmbedBuilder() {
    const fields: any[] = []
    const embed = {
      setColor: jest.fn().mockReturnThis(),
      setTitle: jest.fn().mockReturnThis(),
      setDescription: jest.fn().mockReturnThis(),
      addFields: jest.fn().mockImplementation((...fieldsToAdd) => {
        fields.push(...fieldsToAdd)
        return embed
      }),
      setTimestamp: jest.fn().mockReturnThis(),
      setFooter: jest.fn().mockReturnThis(),
      toJSON: jest.fn().mockReturnValue({
        fields
      })
    }
    // Make it match instanceof checks
    Object.setPrototypeOf(embed, MockEmbedBuilder.prototype)
    return embed
  }),
  ActionRowBuilder: jest.fn().mockImplementation(() => {
    const components: any[] = []
    const actionRow = {
      components,
      addComponents: jest.fn().mockImplementation((...comps) => {
        components.push(...comps)
        return actionRow
      }),
      toJSON: jest.fn().mockImplementation(() => ({ 
        type: 1, 
        components: components.map(comp => comp.toJSON ? comp.toJSON() : comp) 
      }))
    }
    return actionRow
  }),
  ButtonBuilder: jest.fn().mockImplementation(() => {
    let customId = ''
    let label = ''
    let style = 2
    let emoji = ''
    let url = ''
    let disabled = false
    
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
      setEmoji: jest.fn().mockImplementation((em) => {
        emoji = em
        return button
      }),
      setURL: jest.fn().mockImplementation((u) => {
        url = u
        return button
      }),
      setDisabled: jest.fn().mockImplementation((dis) => {
        disabled = dis
        return button
      }),
      toJSON: jest.fn().mockImplementation(() => ({
        type: 2,
        custom_id: customId,
        label: label,
        style: style,
        emoji: emoji || undefined,
        url: url || undefined,
        disabled: disabled || undefined
      })),
      data: {
        get custom_id() { return customId },
        get label() { return label },
        get style() { return style },
        get emoji() { return emoji },
        get url() { return url || undefined },
        get disabled() { return disabled }
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
  ModalBuilder: jest.fn().mockImplementation(() => {
    let customId = ''
    let title = ''
    const components: any[] = []

    const modal = {
      setCustomId: jest.fn().mockImplementation((id) => {
        customId = id
        return modal
      }),
      setTitle: jest.fn().mockImplementation((t) => {
        title = t
        return modal
      }),
      addComponents: jest.fn().mockImplementation((...comps) => {
        components.push(...comps)
        return modal
      }),
      toJSON: jest.fn().mockImplementation(() => ({
        type: 9,
        custom_id: customId,
        title: title,
        components: components.map(comp => {
          if (comp.components) {
            // This is already an ActionRow with components
            return {
              type: 1,
              components: comp.components.map((c: any) => c.toJSON ? c.toJSON() : c)
            }
          } else {
            // This is a single component that needs to be wrapped in ActionRow
            return {
              type: 1,
              components: [comp.toJSON ? comp.toJSON() : comp]
            }
          }
        })
      })),
      data: {
        get custom_id() { return customId },
        get title() { return title },
        get components() { 
          return components.map(comp => {
            if (comp.components) {
              // This is already an ActionRow with components
              return {
                type: 1,
                components: comp.components.map((c: any) => c.toJSON ? c.toJSON() : c)
              }
            } else {
              // This is a single component that needs to be wrapped in ActionRow
              return {
                type: 1,
                components: [comp.toJSON ? comp.toJSON() : comp]
              }
            }
          })
        }
      }
    }
    return modal
  }),
  TextInputBuilder: jest.fn().mockImplementation(() => {
    let customId = ''
    let label = ''
    let style = 1
    let placeholder = ''
    let value = ''
    let required = true
    let minLength: number | undefined = undefined
    let maxLength: number | undefined = undefined

    const textInput = {
      setCustomId: jest.fn().mockImplementation((id) => {
        customId = id
        return textInput
      }),
      setLabel: jest.fn().mockImplementation((lbl) => {
        label = lbl
        return textInput
      }),
      setStyle: jest.fn().mockImplementation((st) => {
        style = st
        return textInput
      }),
      setPlaceholder: jest.fn().mockImplementation((ph) => {
        placeholder = ph
        return textInput
      }),
      setValue: jest.fn().mockImplementation((val) => {
        value = val
        return textInput
      }),
      setRequired: jest.fn().mockImplementation((req) => {
        required = req
        return textInput
      }),
      setMinLength: jest.fn().mockImplementation((min) => {
        minLength = min
        return textInput
      }),
      setMaxLength: jest.fn().mockImplementation((max) => {
        maxLength = max
        return textInput
      }),
      toJSON: jest.fn().mockImplementation(() => ({
        type: 4,
        custom_id: customId,
        label: label,
        style: style,
        placeholder: placeholder || undefined,
        value: value || undefined,
        required: required,
        min_length: minLength,
        max_length: maxLength
      }))
    }
    return textInput
  }),
  TextInputStyle: {
    Short: 1,
    Paragraph: 2
  },
  AttachmentBuilder: jest.fn().mockImplementation((buffer, options) => ({
    attachment: buffer,
    name: options?.name,
    description: options?.description
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