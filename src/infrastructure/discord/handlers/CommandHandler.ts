import { ChatInputCommandInteraction } from 'discord.js'
import { Command, ExtendedClient } from '@/bot/types.js'
import logger from '@/infrastructure/monitoring/Logger.js'
// Inline safeReply function since we removed the utils
async function safeReply(
  interaction: ChatInputCommandInteraction,
  options: { content: string; ephemeral?: boolean }
): Promise<void> {
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(options)
    } else {
      await interaction.reply(options)
    }
  } catch (error) {
    logger.error('Failed to reply to interaction:', error)
  }
}
import { CooldownHandler } from './CooldownHandler.js'

/**
 * Handles Discord slash command execution with cooldown management
 * Extracted from interactionCreate.ts for better separation of concerns
 */
export class CommandHandler {
  private client: ExtendedClient
  private cooldownHandler: CooldownHandler

  constructor(client: ExtendedClient, cooldownHandler: CooldownHandler) {
    this.client = client
    this.cooldownHandler = cooldownHandler
  }

  /**
   * Handle a chat input command interaction
   * @param interaction The Discord chat input interaction
   */
  async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.getCommand(interaction.commandName)

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`)
      return
    }

    // Check and handle cooldown
    const cooldownResult = await this.checkCommandCooldown(interaction, command)
    if (cooldownResult.blocked) {
      return // Cooldown response already sent
    }

    // Execute the command
    await this.executeCommand(command, interaction)
  }

  /**
   * Get a command by name from the client's command collection
   * @param commandName The name of the command to retrieve
   * @returns The command instance or undefined if not found
   */
  private getCommand(commandName: string): Command | undefined {
    return this.client.commands.get(commandName)
  }

  /**
   * Check cooldown for a command and send response if blocked
   * @param interaction The Discord interaction
   * @param command The command being executed
   * @returns Object indicating if execution should be blocked
   */
  private async checkCommandCooldown(
    interaction: ChatInputCommandInteraction,
    command: Command
  ): Promise<{ blocked: boolean }> {
    const cooldownSeconds = command.cooldown ?? 3
    const cooldownResult = this.cooldownHandler.checkCooldown(
      interaction.user.id,
      command.data.name,
      cooldownSeconds
    )

    if (cooldownResult.isOnCooldown && cooldownResult.timeRemaining) {
      await interaction.reply({
        content: `⏳ Please wait ${cooldownResult.timeRemaining.toFixed(1)} more seconds before using \`${command.data.name}\` again.`,
        ephemeral: true,
      })
      return { blocked: true }
    }

    // Set cooldown if not blocked
    this.cooldownHandler.setCooldown(interaction.user.id, command.data.name, cooldownSeconds)

    return { blocked: false }
  }

  /**
   * Execute a command and handle errors
   * @param command The command to execute
   * @param interaction The Discord interaction
   */
  private async executeCommand(
    command: Command,
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    try {
      logger.info(
        `Command executed: ${command.data.name} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`
      )
      await command.execute(interaction)
    } catch (error) {
      await this.handleCommandError(command, interaction, error)
    }
  }

  /**
   * Handle command execution errors
   * @param command The command that failed
   * @param interaction The Discord interaction
   * @param error The error that occurred
   */
  private async handleCommandError(
    command: Command,
    interaction: ChatInputCommandInteraction,
    error: unknown
  ): Promise<void> {
    logger.error(`Error executing command ${command.data.name}:`, error)

    const errorMessage = {
      content: '❌ There was an error while executing this command!',
      ephemeral: true,
    }

    await safeReply(interaction, errorMessage)
  }

  /**
   * Get statistics about command usage
   * @returns Statistics object with command metrics
   */
  getStats(): {
    totalCommands: number
    activeCooldowns: number
  } {
    const cooldownStats = this.cooldownHandler.getStats()

    return {
      totalCommands: this.client.commands.size,
      activeCooldowns: cooldownStats.totalActiveCooldowns,
    }
  }

  /**
   * Check if a specific command exists
   * @param commandName The name of the command to check
   * @returns True if the command exists
   */
  hasCommand(commandName: string): boolean {
    return this.client.commands.has(commandName)
  }

  /**
   * Get all available command names
   * @returns Array of command names
   */
  getCommandNames(): string[] {
    return Array.from(this.client.commands.keys())
  }

  /**
   * Get command information for monitoring/debugging
   * @param commandName The command to get info for
   * @returns Command information or undefined if not found
   */
  getCommandInfo(commandName: string):
    | {
        name: string
        cooldown: number | undefined
        description: string
      }
    | undefined {
    const command = this.getCommand(commandName)
    if (!command) {
      return undefined
    }

    return {
      name: command.data.name,
      cooldown: command.cooldown,
      description: command.data.description,
    }
  }

  /**
   * Clear cooldown for a specific user and command (admin utility)
   * @param userId Discord user ID
   * @param commandName Command name
   */
  clearUserCooldown(userId: string, commandName: string): void {
    this.cooldownHandler.clearCooldown(userId, commandName)
  }

  /**
   * Get active cooldowns for monitoring
   * @returns Array of active cooldown information
   */
  getActiveCooldowns(): Array<{
    userId: string
    commandName: string
    expiresAt: Date
  }> {
    return this.cooldownHandler.getActiveCooldowns()
  }
}
