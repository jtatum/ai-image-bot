import 'reflect-metadata'
import { DiscordClient } from '@/bot/client.js'
import { CommandLoader } from '@/utils/commandLoader.js'
import { EventLoader } from '@/utils/eventLoader.js'
import { HealthCheckService } from '@/services/healthCheck.js'
import { GracefulShutdown } from '@/utils/gracefulShutdown.js'
import { RateLimiter } from '@/utils/rateLimiter.js'
import logger from '@/config/logger.js'
import { config } from '@/config/environment.js'

class GeminiBot {
  private client: DiscordClient
  private commandLoader: CommandLoader
  private eventLoader: EventLoader
  private healthCheckService: HealthCheckService
  // @ts-expect-error - Used for side effects
  private _gracefulShutdown: GracefulShutdown
  private rateLimiter: RateLimiter

  constructor() {
    logger.info('🚀 Starting Gemini Bot...')

    this.client = new DiscordClient()
    this.commandLoader = new CommandLoader(this.client)
    this.eventLoader = new EventLoader(this.client)
    this.healthCheckService = new HealthCheckService(this.client)

    this._gracefulShutdown = new GracefulShutdown(this.client, this.healthCheckService)
    this.rateLimiter = new RateLimiter()

    this.setupRateLimiters()
  }

  private setupRateLimiters(): void {
    // Global rate limiting is now handled by individual command cooldowns
    // Add the rate limiter to the client for use in command handlers
    ;(this.client as any).rateLimiter = this.rateLimiter
  }

  public async start(): Promise<void> {
    try {
      // Load commands and events
      await this.commandLoader.loadCommands()
      await this.eventLoader.loadEvents()

      // Start health check service
      this.healthCheckService.start()

      // Start the Discord client
      await this.client.start()

      logger.info('✅ Gemini Bot started successfully!')

      // Log environment info
      logger.info(`Environment: ${config.NODE_ENV}`)
      logger.info(`Log Level: ${config.LOG_LEVEL}`)
      logger.info(`Health Check Port: ${config.HEALTH_CHECK_PORT}`)
    } catch (error) {
      logger.error('❌ Failed to start Gemini Bot:', error)
      process.exit(1)
    }
  }
}

// Start the bot
const bot = new GeminiBot()
bot.start().catch(error => {
  logger.error('❌ Fatal error during bot startup:', error)
  process.exit(1)
})
