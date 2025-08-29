import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { BaseCommand } from '@/presentation/commands/base/BaseCommand.js'
import { ExtendedClient } from '@/bot/types.js'
import { config } from '@/config/environment.js'

/**
 * Discord command for displaying bot information and statistics
 * Enhanced version using the new BaseCommand architecture
 */
export class InfoCommand extends BaseCommand {
  public readonly data = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Display information about the bot and system statistics')

  public readonly cooldown = config.COMMAND_COOLDOWN_SECONDS

  // Disable execution logging for info since it's a utility command
  protected readonly enableExecutionLogging = false

  protected async executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client
    const embed = await this.buildInfoEmbed(client)

    await this.safeReply(interaction, {
      embeds: [embed],
    })
  }

  /**
   * Build comprehensive info embed with bot statistics and system information
   */
  private async buildInfoEmbed(
    client: ChatInputCommandInteraction['client']
  ): Promise<EmbedBuilder> {
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('🤖 Gemini Discord Bot')
      .setDescription('A production-grade Discord bot featuring Google Gemini AI image generation')
      .setTimestamp()
      .setFooter({ text: 'Made with ❤️ using TypeScript & Discord.js' })

    // Add bot statistics
    embed.addFields(this.getStatisticsField(client))

    // Add performance metrics
    embed.addFields(this.getPerformanceField(client))

    // Add environment information
    embed.addFields(this.getEnvironmentField())

    // Add features information
    embed.addFields(this.getFeaturesField())

    // Add system information if available
    const systemInfo = this.getSystemInfo()
    if (systemInfo) {
      embed.addFields(systemInfo)
    }

    return embed
  }

  /**
   * Get bot statistics field
   */
  private getStatisticsField(client: ChatInputCommandInteraction['client']) {
    return {
      name: '📊 Statistics',
      value: [
        `**Servers:** ${client.guilds.cache.size}`,
        `**Users:** ${client.users.cache.size}`,
        `**Channels:** ${client.channels.cache.size}`,
        `**Commands:** ${(client as ExtendedClient).commands?.size || 'N/A'}`,
      ].join('\n'),
      inline: true,
    }
  }

  /**
   * Get performance metrics field
   */
  private getPerformanceField(client: ChatInputCommandInteraction['client']) {
    const uptime = this.formatUptime(process.uptime())
    const memoryUsage = this.formatMemoryUsage()

    return {
      name: '⚡ Performance',
      value: [
        `**Uptime:** ${uptime}`,
        `**Ping:** ${client.ws.ping}ms`,
        `**Memory:** ${memoryUsage}`,
        `**Node.js:** ${process.version}`,
      ].join('\n'),
      inline: true,
    }
  }

  /**
   * Get environment information field
   */
  private getEnvironmentField() {
    return {
      name: '🔧 Environment',
      value: [
        `**Mode:** ${config.NODE_ENV}`,
        `**Log Level:** ${config.LOG_LEVEL}`,
        `**AI Enabled:** ${config.GOOGLE_API_KEY ? '✅ Yes' : '❌ No'}`,
        `**Health Port:** ${config.HEALTH_CHECK_PORT}`,
      ].join('\n'),
      inline: true,
    }
  }

  /**
   * Get features information field
   */
  private getFeaturesField() {
    const features = [
      '🎨 **AI Image Generation** - Powered by Google Gemini',
      '🏓 **Ping/Latency Check** - Real-time performance monitoring',
      '📊 **System Information** - Comprehensive bot statistics',
      '🔄 **Auto-reload** - Hot reload support for development',
    ]

    return {
      name: '✨ Features',
      value: features.join('\n'),
      inline: false,
    }
  }

  /**
   * Get system information if running in development mode
   */
  private getSystemInfo() {
    if (config.NODE_ENV !== 'development') {
      return null
    }

    const platform = process.platform
    const arch = process.arch
    const pid = process.pid

    return {
      name: '💻 System (Dev Mode)',
      value: [
        `**Platform:** ${platform} (${arch})`,
        `**Process ID:** ${pid}`,
        `**CPU Usage:** ${this.getCpuUsage()}`,
        `**Start Time:** <t:${Math.floor(Date.now() / 1000 - process.uptime())}:R>`,
      ].join('\n'),
      inline: false,
    }
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
   * Format memory usage in human-readable format
   */
  private formatMemoryUsage(): string {
    const usage = process.memoryUsage()
    const rss = Math.round(usage.rss / 1024 / 1024)
    const heapUsed = Math.round(usage.heapUsed / 1024 / 1024)
    const heapTotal = Math.round(usage.heapTotal / 1024 / 1024)

    return `${rss}MB RSS (${heapUsed}/${heapTotal}MB heap)`
  }

  /**
   * Get CPU usage information (basic implementation)
   */
  private getCpuUsage(): string {
    const usage = process.cpuUsage()
    const totalUsage = (usage.user + usage.system) / 1000000 // Convert to seconds
    const uptime = process.uptime()
    const cpuPercent = ((totalUsage / uptime) * 100).toFixed(2)

    return `~${cpuPercent}%`
  }

  /**
   * Custom validation for info command
   */
  protected async validateExecution(interaction: ChatInputCommandInteraction): Promise<void> {
    await super.validateExecution(interaction)

    // Check if client has cached data
    if (!interaction.client.readyAt) {
      throw new Error('Bot is not ready yet, please wait a moment')
    }
  }

  /**
   * Override error messages for info-specific errors
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('not ready')) {
        return 'The bot is still starting up. Please try again in a moment.'
      }

      if (error.message.includes('cache')) {
        return 'Unable to fetch bot statistics at the moment. Please try again later.'
      }
    }

    return super.getErrorMessage(error)
  }
}
