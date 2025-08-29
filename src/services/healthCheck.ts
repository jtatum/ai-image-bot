import express from 'express'
import { Server } from 'http'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'
import { ExtendedClient } from '@/bot/types.js'

export class HealthCheckService {
  private app: express.Application
  private server: Server | null = null
  private client: ExtendedClient

  constructor(client: ExtendedClient) {
    this.client = client
    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.get('/health', (_req, res) => {
      const isReady = this.client.isReady()
      const uptime = process.uptime()
      const memoryUsage = process.memoryUsage()

      const healthData = {
        status: isReady ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: uptime,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        discord: {
          connected: isReady,
          ping: this.client.ws.ping,
          guilds: this.client.guilds.cache.size,
          users: this.client.users.cache.size,
        },
      }

      const statusCode = isReady ? 200 : 503
      res.status(statusCode).json(healthData)
    })

    this.app.get('/ready', (_req, res) => {
      const isReady = this.client.isReady()
      res.status(isReady ? 200 : 503).json({ ready: isReady })
    })

    this.app.get('/metrics', (_req, res) => {
      const metrics = {
        commands_total: this.client.commands.size,
        guilds_total: this.client.guilds.cache.size,
        users_total: this.client.users.cache.size,
        uptime_seconds: process.uptime(),
        memory_usage_bytes: process.memoryUsage().rss,
      }

      res.json(metrics)
    })
  }

  public start(): void {
    const port = config.HEALTH_CHECK_PORT
    this.server = this.app.listen(port, () => {
      logger.info(`✅ Health check server running on port ${port}`)
    })
  }

  public stop(): void {
    if (this.server) {
      this.server.close()
      logger.info('✅ Health check server stopped')
    }
  }
}
