import { describe, it, expect, beforeEach, jest } from '@jest/globals'

describe('Configuration', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  describe('Environment Configuration', () => {
    it('should load environment variables correctly', async () => {
      // Set test environment variables
      process.env.DISCORD_TOKEN = 'test_token'
      process.env.CLIENT_ID = 'test_client_id'
      process.env.NODE_ENV = 'test'
      process.env.LOG_LEVEL = 'info'

      const { config } = await import('@/shared/config/environment')

      expect(config.DISCORD_TOKEN).toBe('test_token')
      expect(config.CLIENT_ID).toBe('test_client_id')
      expect(config.NODE_ENV).toBe('test')
      expect(config.LOG_LEVEL).toBe('info')
    })

    it('should use default values for optional environment variables', async () => {
      process.env.DISCORD_TOKEN = 'test_token'
      process.env.CLIENT_ID = 'test_client_id'
      delete process.env.NODE_ENV
      delete process.env.LOG_LEVEL
      delete process.env.PORT

      const { config } = await import('@/shared/config/environment')

      expect(config.NODE_ENV).toBe('development')
      expect(config.LOG_LEVEL).toBe('info')
      expect(config.PORT).toBe(3000)
    })

    it('should validate required environment variables', async () => {
      delete process.env.DISCORD_TOKEN
      delete process.env.CLIENT_ID

      // Mock process.exit to prevent actual exit during test
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })
      
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

      await expect(async () => {
        await import('@/shared/config/environment')
      }).rejects.toThrow('process.exit called')

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('❌ Invalid environment configuration:'),
        expect.any(Object)
      )

      mockExit.mockRestore()
      mockConsoleError.mockRestore()
    })
  })
})