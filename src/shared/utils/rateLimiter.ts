import { RateLimiterMemory } from 'rate-limiter-flexible'
import { config } from '@/shared/config/environment.js'
import logger from '@/infrastructure/monitoring/Logger.js'

export class RateLimiter {
  private globalLimiter: RateLimiterMemory
  private commandLimiters: Map<string, RateLimiterMemory>

  constructor() {
    // Global rate limiter - prevents spam across all commands
    this.globalLimiter = new RateLimiterMemory({
      points: config.RATE_LIMIT_MAX_REQUESTS,
      duration: Math.floor(config.RATE_LIMIT_WINDOW_MS / 1000),
      blockDuration: 60, // Block for 1 minute if exceeded
    })

    this.commandLimiters = new Map()
  }

  public createCommandLimiter(
    commandName: string,
    points: number = 5,
    duration: number = 60
  ): void {
    const limiter = new RateLimiterMemory({
      points,
      duration,
      blockDuration: duration * 2, // Block for double the duration
    })

    this.commandLimiters.set(commandName, limiter)
    logger.debug(`Created rate limiter for command: ${commandName}`)
  }

  public async checkGlobalLimit(
    userId: string
  ): Promise<{ allowed: boolean; msBeforeNext?: number }> {
    try {
      await this.globalLimiter.consume(`global_${userId}`)
      return { allowed: true }
    } catch (rateLimiterRes: any) {
      const msBeforeNext = rateLimiterRes.msBeforeNext || 0
      logger.warn(`Global rate limit exceeded for user ${userId}. Reset in ${msBeforeNext}ms`)
      return { allowed: false, msBeforeNext }
    }
  }

  public async checkCommandLimit(
    commandName: string,
    userId: string
  ): Promise<{ allowed: boolean; msBeforeNext?: number }> {
    const limiter = this.commandLimiters.get(commandName)
    if (!limiter) {
      return { allowed: true } // No specific limit for this command
    }

    try {
      await limiter.consume(`${commandName}_${userId}`)
      return { allowed: true }
    } catch (rateLimiterRes: any) {
      const msBeforeNext = rateLimiterRes.msBeforeNext || 0
      logger.warn(
        `Command rate limit exceeded for ${commandName} by user ${userId}. Reset in ${msBeforeNext}ms`
      )
      return { allowed: false, msBeforeNext }
    }
  }

  public async checkAllLimits(
    commandName: string,
    userId: string
  ): Promise<{ allowed: boolean; reason?: string; msBeforeNext?: number }> {
    // Check global limit first
    const globalCheck = await this.checkGlobalLimit(userId)
    if (!globalCheck.allowed) {
      return {
        allowed: false,
        reason: 'global',
        msBeforeNext: globalCheck.msBeforeNext,
      }
    }

    // Then check command-specific limit
    const commandCheck = await this.checkCommandLimit(commandName, userId)
    if (!commandCheck.allowed) {
      return {
        allowed: false,
        reason: 'command',
        msBeforeNext: commandCheck.msBeforeNext,
      }
    }

    return { allowed: true }
  }

  public getStats(): { global: any; commands: Record<string, any> } {
    const commandStats: Record<string, any> = {}

    for (const [name, limiter] of this.commandLimiters.entries()) {
      commandStats[name] = {
        points: limiter.points,
        duration: limiter.duration,
        blockDuration: limiter.blockDuration,
      }
    }

    return {
      global: {
        points: this.globalLimiter.points,
        duration: this.globalLimiter.duration,
        blockDuration: this.globalLimiter.blockDuration,
      },
      commands: commandStats,
    }
  }
}
