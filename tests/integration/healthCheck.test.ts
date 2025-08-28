import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import request from 'supertest'
import { HealthCheckService } from '@/services/healthCheck'
import { DiscordClient } from '@/bot/client'

describe('HealthCheck Service', () => {
  let healthCheckService: HealthCheckService
  let mockClient: DiscordClient
  let server: any

  beforeEach(() => {
    mockClient = new DiscordClient()
    healthCheckService = new HealthCheckService(mockClient)
  })

  afterEach(() => {
    if (server) {
      server.close()
    }
  })

  describe('Health endpoint', () => {
    it('should return health status', async () => {
      // Mock the client as ready
      jest.spyOn(mockClient, 'isReady').mockReturnValue(true)

      const response = await request(healthCheckService['app'])
        .get('/health')
        .expect(200)

      expect(response.body).toHaveProperty('status', 'healthy')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('uptime')
      expect(response.body).toHaveProperty('memory')
      expect(response.body).toHaveProperty('discord')
      expect(response.body.discord).toHaveProperty('connected', true)
    })

    it('should return unhealthy status when client is not ready', async () => {
      // Mock the client as not ready
      jest.spyOn(mockClient, 'isReady').mockReturnValue(false)

      const response = await request(healthCheckService['app'])
        .get('/health')
        .expect(503)

      expect(response.body).toHaveProperty('status', 'unhealthy')
      expect(response.body.discord).toHaveProperty('connected', false)
    })
  })

  describe('Ready endpoint', () => {
    it('should return ready status', async () => {
      jest.spyOn(mockClient, 'isReady').mockReturnValue(true)

      const response = await request(healthCheckService['app'])
        .get('/ready')
        .expect(200)

      expect(response.body).toHaveProperty('ready', true)
    })

    it('should return not ready status', async () => {
      jest.spyOn(mockClient, 'isReady').mockReturnValue(false)

      const response = await request(healthCheckService['app'])
        .get('/ready')
        .expect(503)

      expect(response.body).toHaveProperty('ready', false)
    })
  })

  describe('Metrics endpoint', () => {
    it('should return metrics', async () => {
      const response = await request(healthCheckService['app'])
        .get('/metrics')
        .expect(200)

      expect(response.body).toHaveProperty('commands_total')
      expect(response.body).toHaveProperty('guilds_total')
      expect(response.body).toHaveProperty('users_total')
      expect(response.body).toHaveProperty('uptime_seconds')
      expect(response.body).toHaveProperty('memory_usage_bytes')
    })
  })
})