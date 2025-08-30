import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { BaseCommand } from '../base/BaseCommand.js'

/**
 * Discord command for checking bot latency and responsiveness
 * Simple command that demonstrates the new BaseCommand architecture
 */
export class PingCommand extends BaseCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Check the bot's latency and responsiveness")

  public readonly cooldown = 3 // Short cooldown for ping command

  // Disable execution logging for ping since it's a simple utility command
  protected readonly enableExecutionLogging = false

  // Reduce max execution time for ping command
  protected readonly maxExecutionTimeMs = 2000

  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const startTime = Date.now()

    // Send initial reply to measure round-trip time
    await interaction.reply({
      content: '🏓 Calculating ping...',
      ephemeral: false,
    })

    const endTime = Date.now()
    const roundTripTime = endTime - startTime
    const wsLatency = interaction.client.ws.ping

    // Build ping information
    const pingInfo = this.buildPingInfo(roundTripTime, wsLatency)
    const statusEmoji = this.getStatusEmoji(roundTripTime, wsLatency)

    // Edit the reply with actual ping information
    await interaction.editReply({
      content: `${statusEmoji} **Pong!**\n${pingInfo}`,
    })
  }

  /**
   * Build formatted ping information string
   */
  private buildPingInfo(roundTripTime: number, wsLatency: number): string {
    const lines = [
      `**Round-trip time:** ${roundTripTime}ms`,
      `**WebSocket latency:** ${wsLatency}ms`,
      `**Status:** ${this.getLatencyStatus(roundTripTime, wsLatency)}`,
    ]

    // Add uptime information
    const uptime = this.formatUptime(process.uptime())
    lines.push(`**Uptime:** ${uptime}`)

    return lines.join('\n')
  }

  /**
   * Get appropriate emoji based on latency
   */
  private getStatusEmoji(roundTripTime: number, wsLatency: number): string {
    const maxLatency = Math.max(roundTripTime, wsLatency)

    if (maxLatency < 100) return '🟢'
    if (maxLatency < 300) return '🟡'
    return '🔴'
  }

  /**
   * Get human-readable latency status
   */
  private getLatencyStatus(roundTripTime: number, wsLatency: number): string {
    const maxLatency = Math.max(roundTripTime, wsLatency)

    if (maxLatency < 100) return 'Excellent'
    if (maxLatency < 200) return 'Good'
    if (maxLatency < 300) return 'Fair'
    if (maxLatency < 500) return 'Poor'
    return 'Very Poor'
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    const parts: string[] = []

    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`)

    return parts.join(' ')
  }

  /**
   * Override performance logging to log ping-specific metrics
   */
  protected async executeCommand_withMetrics(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const startTime = Date.now()
    await this.executeCommand(interaction)
    const duration = Date.now() - startTime

    // Log ping-specific metrics
    this.logger.debug('Ping command metrics', {
      command: this.data.name,
      user: interaction.user.id,
      executionTime: duration,
      wsLatency: interaction.client.ws.ping,
      guildId: interaction.guildId,
    })
  }

  /**
   * Custom validation for ping command
   */
  protected async validateExecution(interaction: ChatInputCommandInteraction): Promise<void> {
    await super.validateExecution(interaction)

    // Check if client is ready (WebSocket ping of -1 is normal before first measurement)
    if (interaction.client.readyAt === null) {
      throw new Error('Bot is not ready to process commands')
    }
  }

  /**
   * Override error messages for ping-specific errors
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('WebSocket')) {
        return 'Connection to Discord is unstable. Please try again.'
      }
    }

    return super.getErrorMessage(error)
  }
}
