import { Client, Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'

export interface Command {
  data: SlashCommandBuilder
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>
  cooldown?: number
}

export interface Event {
  name: string
  once?: boolean
  execute: (...args: unknown[]) => Promise<void>
}

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>
  cooldowns: Collection<string, Collection<string, number>>
  rateLimiter?: unknown
  shutdown(): Promise<void>
}

export interface RateLimitInfo {
  userId: string
  commandName: string
  resetTime: number
}

export interface BotConfig {
  token: string
  clientId: string
  guildId?: string
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}
