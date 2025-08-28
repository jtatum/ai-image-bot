import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { Command } from '@/bot/types.js'

export const mockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('A test command for testing purposes'),
  
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: 'Test command executed!' })
  }
}

export const mockInteraction = {
  isChatInputCommand: () => true,
  commandName: 'test',
  user: {
    id: 'test-user-id',
    tag: 'TestUser#1234'
  },
  guild: {
    name: 'Test Guild'
  },
  client: {
    commands: new Map(),
    cooldowns: new Map()
  },
  reply: jest.fn().mockResolvedValue(undefined),
  followUp: jest.fn().mockResolvedValue(undefined),
  editReply: jest.fn().mockResolvedValue(undefined),
  replied: false,
  deferred: false,
  createdTimestamp: Date.now()
}