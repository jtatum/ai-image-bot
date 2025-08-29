import { 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  ModalSubmitInteraction,
  User,
  Guild,
  CommandInteractionOptionResolver,
  Collection,
  Message,
  Attachment,
  ModalSubmitFields
} from 'discord.js'

/**
 * Factory function to create a properly typed mock ChatInputCommandInteraction
 */
export function createMockChatInputInteraction(overrides: any = {}): ChatInputCommandInteraction {
  const mockUser: Partial<User> = {
    id: 'user123',
    tag: 'TestUser#1234',
    username: 'testuser',
    bot: false,
    ...overrides.user
  }

  const mockGuild: Partial<Guild> = {
    name: 'TestGuild',
    id: 'guild123',
    ...overrides.guild
  }

  const mockOptions: Partial<CommandInteractionOptionResolver> = {
    getString: jest.fn().mockReturnValue('test prompt'),
    getInteger: jest.fn(),
    getBoolean: jest.fn(),
    getUser: jest.fn(),
    getChannel: jest.fn(),
    getRole: jest.fn(),
    getMentionable: jest.fn(),
    getNumber: jest.fn(),
    getAttachment: jest.fn(),
    ...overrides.options
  }

  const mockInteraction: Partial<ChatInputCommandInteraction> = {
    type: 2, // InteractionType.ApplicationCommand
    commandType: 1, // ApplicationCommandType.ChatInput
    commandName: 'test',
    user: mockUser as User,
    guild: mockGuild as Guild,
    options: mockOptions as CommandInteractionOptionResolver,
    channel: { id: 'channel123', type: 0 },
    isChatInputCommand: jest.fn().mockReturnValue(true),
    isButton: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    inGuild: jest.fn().mockReturnValue(!!overrides.guild),
    reply: jest.fn().mockResolvedValue({ createdTimestamp: Date.now() }),
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    replied: false,
    deferred: false,
    ephemeral: false,
    ...overrides
  }

  return mockInteraction as ChatInputCommandInteraction
}

/**
 * Factory function to create a properly typed mock ButtonInteraction
 */
export function createMockButtonInteraction(overrides: any = {}): ButtonInteraction {
  const mockUser: Partial<User> = {
    id: 'user123',
    tag: 'TestUser#1234',
    username: 'testuser',
    bot: false,
    ...overrides.user
  }

  const mockGuild: Partial<Guild> = {
    name: 'TestGuild',
    id: 'guild123',
    ...overrides.guild
  }

  const mockMessage: Partial<Message> = {
    content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
    attachments: new Collection(),
    ...overrides.message
  }

  const mockInteraction: Partial<ButtonInteraction> = {
    type: 3, // InteractionType.MessageComponent
    user: mockUser as User,
    guild: mockGuild as Guild,
    customId: 'regenerate_user123_1234567890',
    message: mockMessage as Message,
    isButton: jest.fn().mockReturnValue(true),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    reply: jest.fn().mockResolvedValue({}),
    showModal: jest.fn().mockResolvedValue({}),
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    replied: false,
    deferred: false,
    ephemeral: false,
    ...overrides
  }

  return mockInteraction as ButtonInteraction
}

/**
 * Factory function to create a properly typed mock ModalSubmitInteraction
 */
export function createMockModalInteraction(overrides: any = {}): ModalSubmitInteraction {
  const mockUser: Partial<User> = {
    id: 'user123',
    tag: 'TestUser#1234',
    username: 'testuser',
    bot: false,
    ...overrides.user
  }

  const mockGuild: Partial<Guild> = {
    name: 'TestGuild',
    id: 'guild123',
    ...overrides.guild
  }

  const mockMessage: Partial<Message> = {
    content: '🎨 **Image generated successfully!**\n**Prompt:** test prompt',
    attachments: new Collection([
      ['attachment1', {
        url: 'https://example.com/image.png',
        contentType: 'image/png',
        name: 'image.png',
        size: 1024
      } as Attachment]
    ]),
    ...overrides.message
  }

  // Mock fields with a proper Map structure  
  const fieldsMap = new Map([
    ['prompt', {
      customId: 'prompt',
      value: 'test modal input',
      type: 4 // TextInputStyle.Paragraph
    }]
  ])

  const mockFields: Partial<ModalSubmitFields> & { fields: any } = {
    getTextInputValue: jest.fn().mockReturnValue('test modal input'),
    fields: fieldsMap,
    ...overrides.fields
  }

  const mockInteraction: Partial<ModalSubmitInteraction> = {
    type: 5, // InteractionType.ModalSubmit
    user: mockUser as User,
    guild: mockGuild as Guild,
    customId: 'regenerate_modal_user123_1234567890',
    message: mockMessage as Message,
    fields: mockFields as ModalSubmitFields,
    isButton: jest.fn().mockReturnValue(false),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(true),
    reply: jest.fn().mockResolvedValue({}),
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    followUp: jest.fn().mockResolvedValue({}),
    replied: false,
    deferred: false,
    ephemeral: false,
    ...overrides
  }

  return mockInteraction as ModalSubmitInteraction
}

/**
 * Creates a mock interaction with client and commands collections for testing
 */
export function createMockInteractionWithClient<T extends ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction>(
  baseInteraction: T,
  commands: Map<string, any> = new Map(),
  cooldowns: any = null
): T {
  // Create a proper cooldowns mock that creates Collections on demand
  const cooldownStore = cooldowns || new Map()
  
  const mockCooldowns = {
    has: (key: string) => cooldownStore.has(key),
    get: (key: string) => cooldownStore.get(key),
    set: (key: string, value: any) => {
      cooldownStore.set(key, value)
      return cooldownStore
    },
    delete: (key: string) => cooldownStore.delete(key),
    clear: () => cooldownStore.clear(),
  }

  const mockClient = {
    commands,
    cooldowns: mockCooldowns,
    guilds: { cache: { size: 1 } },
    users: { cache: { size: 10 } },
    channels: { cache: { size: 5 } },
    ws: { ping: 50 }
  }

  return {
    ...baseInteraction,
    client: mockClient
  } as T
}