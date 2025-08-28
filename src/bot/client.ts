import { Client, Collection, GatewayIntentBits } from 'discord.js'
import { Command, ExtendedClient } from './types.js'
import logger from '@/config/logger.js'
import { config } from '@/config/environment.js'

export class DiscordClient extends Client implements ExtendedClient {
  public commands: Collection<string, Command>
  public cooldowns: Collection<string, Collection<string, number>>

  constructor() {
    super({
      intents: [GatewayIntentBits.Guilds],
      partials: [],
      presence: {
        status: 'online',
        activities: [
          {
            name: 'Reconnected',
            type: 0,
          },
        ],
      },
    })

    this.commands = new Collection()
    this.cooldowns = new Collection()

    this.setupErrorHandlers()
  }

  private setupErrorHandlers(): void {
    this.on('error', error => {
      logger.error('Discord client error:', error)
    })

    this.on('warn', warning => {
      logger.warn('Discord client warning:', warning)
    })

    this.on('shardError', error => {
      logger.error('Shard error:', error)
    })

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
    })

    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception:', error)
      process.exit(1)
    })
  }

  public async start(): Promise<void> {
    try {
      logger.info('Starting Discord bot...')
      await this.login(config.DISCORD_TOKEN)
      logger.info('✅ Discord bot logged in successfully')
    } catch (error) {
      logger.error('Failed to start Discord bot:', error)
      throw error
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down Discord bot...')
    await this.destroy()
    logger.info('✅ Discord bot shutdown complete')
  }
}
