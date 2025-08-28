import { ExtendedClient } from '@/bot/types.js'
import { HealthCheckService } from '@/services/healthCheck.js'
import logger from '@/config/logger.js'

export class GracefulShutdown {
  private client: ExtendedClient
  private healthCheckService?: HealthCheckService
  private isShuttingDown = false

  constructor(client: ExtendedClient, healthCheckService?: HealthCheckService) {
    this.client = client
    this.healthCheckService = healthCheckService
    this.setupSignalHandlers()
  }

  private setupSignalHandlers(): void {
    process.on('SIGTERM', () => void this.handleShutdown('SIGTERM'))
    process.on('SIGINT', () => void this.handleShutdown('SIGINT'))
    process.on('SIGUSR2', () => void this.handleShutdown('SIGUSR2')) // Nodemon restart

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
      void this.handleShutdown('unhandledRejection')
    })

    process.on('uncaughtException', error => {
      logger.error('Uncaught Exception:', error)
      void this.handleShutdown('uncaughtException')
    })
  }

  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal:', signal)
      return
    }

    this.isShuttingDown = true
    logger.info(`🔄 Graceful shutdown initiated by signal: ${signal}`)

    try {
      // Set a timeout for forced shutdown
      const forceShutdownTimeout = setTimeout(() => {
        logger.error('❌ Forced shutdown after timeout')
        process.exit(1)
      }, 10000) // 10 seconds

      // Stop health check service first
      if (this.healthCheckService) {
        this.healthCheckService.stop()
      }

      // Gracefully shutdown Discord client
      await this.client.shutdown()

      // Clear the force shutdown timeout
      clearTimeout(forceShutdownTimeout)

      logger.info('✅ Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error)
      process.exit(1)
    }
  }

  public async shutdown(): Promise<void> {
    await this.handleShutdown('manual')
  }
}
