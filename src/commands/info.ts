import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { Command } from '@/bot/types.js'
import { config } from '@/config/environment.js'

const info: Command = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Displays information about the bot'),

  cooldown: config.COMMAND_COOLDOWN_SECONDS,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client
    const uptime = process.uptime()
    const uptimeString = new Date(uptime * 1000).toISOString().substr(11, 8)

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('🤖 Bot Information')
      .setDescription('A production-grade Discord bot built with TypeScript and Discord.js')
      .addFields(
        {
          name: '📊 Statistics',
          value: `Servers: ${client.guilds.cache.size}\nUsers: ${client.users.cache.size}\nChannels: ${client.channels.cache.size}`,
          inline: true,
        },
        {
          name: '⚡ Performance',
          value: `Uptime: ${uptimeString}\nPing: ${client.ws.ping}ms\nNode.js: ${process.version}`,
          inline: true,
        },
        {
          name: '🔧 Environment',
          value: `Mode: ${config.NODE_ENV}\nLog Level: ${config.LOG_LEVEL}`,
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Made with ❤️ using Discord.js' })

    await interaction.reply({ embeds: [embed] })
  },
}

export default info
