import { Collection } from 'discord.js'

/**
 * Result of a cooldown check
 */
export interface CooldownResult {
  /** Whether the user is currently on cooldown for this command */
  isOnCooldown: boolean

  /** Time remaining in seconds if on cooldown */
  timeRemaining?: number
}

/**
 * Handles command cooldown management for Discord interactions
 * Extracted from interactionCreate.ts for better separation of concerns
 */
export class CooldownHandler {
  private cooldowns: Collection<string, Collection<string, number>>

  constructor(cooldowns: Collection<string, Collection<string, number>>) {
    this.cooldowns = cooldowns
  }

  /**
   * Check if a user is on cooldown for a specific command
   * @param userId Discord user ID
   * @param commandName Name of the command
   * @param cooldownSeconds Cooldown duration in seconds (0 disables cooldown)
   * @returns CooldownResult indicating if user is on cooldown and time remaining
   */
  checkCooldown(userId: string, commandName: string, cooldownSeconds: number): CooldownResult {
    // Skip cooldown check if cooldown is 0 (disabled)
    if (cooldownSeconds <= 0) {
      return { isOnCooldown: false }
    }

    // Ensure command has a cooldown collection
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection())
    }

    const now = Date.now()
    const timestamps = this.cooldowns.get(commandName)!
    const cooldownAmount = cooldownSeconds * 1000

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownAmount

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000
        return {
          isOnCooldown: true,
          timeRemaining: Math.ceil(timeLeft * 10) / 10, // Round to 1 decimal place
        }
      }
    }

    return { isOnCooldown: false }
  }

  /**
   * Set cooldown for a user and command
   * @param userId Discord user ID
   * @param commandName Name of the command
   * @param cooldownSeconds Cooldown duration in seconds
   */
  setCooldown(userId: string, commandName: string, cooldownSeconds: number): void {
    // Skip setting cooldown if it's disabled
    if (cooldownSeconds <= 0) {
      return
    }

    // Ensure command has a cooldown collection
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection())
    }

    const now = Date.now()
    const timestamps = this.cooldowns.get(commandName)!
    const cooldownAmount = cooldownSeconds * 1000

    // Set timestamp and schedule cleanup
    timestamps.set(userId, now)
    setTimeout(() => timestamps.delete(userId), cooldownAmount)
  }

  /**
   * Manually clear a user's cooldown for a specific command
   * Useful for admin commands or testing
   * @param userId Discord user ID
   * @param commandName Name of the command
   */
  clearCooldown(userId: string, commandName: string): void {
    const timestamps = this.cooldowns.get(commandName)
    if (timestamps) {
      timestamps.delete(userId)
    }
  }

  /**
   * Get all active cooldowns for debugging/monitoring
   * @returns Array of active cooldown information
   */
  getActiveCooldowns(): Array<{
    userId: string
    commandName: string
    expiresAt: Date
  }> {
    const activeCooldowns: Array<{
      userId: string
      commandName: string
      expiresAt: Date
    }> = []

    const now = Date.now()

    this.cooldowns.forEach((userTimestamps, commandName) => {
      userTimestamps.forEach((timestamp, userId) => {
        const expiresAt = new Date(timestamp + 3000) // Default 3 second cooldown for calculation
        if (expiresAt.getTime() > now) {
          activeCooldowns.push({
            userId,
            commandName,
            expiresAt,
          })
        }
      })
    })

    return activeCooldowns
  }

  /**
   * Clear expired cooldowns manually (normally handled automatically)
   * Useful for testing or manual cleanup
   */
  clearExpiredCooldowns(): void {
    const now = Date.now()

    this.cooldowns.forEach((userTimestamps, commandName) => {
      const expiredUsers: string[] = []

      userTimestamps.forEach((timestamp, userId) => {
        // Use a default cooldown of 3 seconds for cleanup
        if (now >= timestamp + 3000) {
          expiredUsers.push(userId)
        }
      })

      expiredUsers.forEach(userId => userTimestamps.delete(userId))

      // Remove empty command cooldown collections
      if (userTimestamps.size === 0) {
        this.cooldowns.delete(commandName)
      }
    })
  }

  /**
   * Get statistics about cooldown usage
   * @returns Statistics object with cooldown metrics
   */
  getStats(): {
    totalCommands: number
    totalActiveCooldowns: number
    commandsWithActiveCooldowns: number
  } {
    let totalActiveCooldowns = 0
    let commandsWithActiveCooldowns = 0

    this.cooldowns.forEach(userTimestamps => {
      const activeCount = userTimestamps.size
      if (activeCount > 0) {
        totalActiveCooldowns += activeCount
        commandsWithActiveCooldowns++
      }
    })

    return {
      totalCommands: this.cooldowns.size,
      totalActiveCooldowns,
      commandsWithActiveCooldowns,
    }
  }
}
