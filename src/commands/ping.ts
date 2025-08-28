import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js'
import { Command } from '@/bot/types.js'
import { config } from '@/config/environment.js'

const ping: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong! and shows bot latency'),

  cooldown: config.COMMAND_COOLDOWN_SECONDS,

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({
      content: 'Pinging...',
      fetchReply: true,
    })

    const latency = sent.createdTimestamp - interaction.createdTimestamp
    const apiLatency = Math.round(interaction.client.ws.ping)

    await interaction.editReply({
      content: `🏓 Pong!\n📊 Latency: ${latency}ms\n💓 API Latency: ${apiLatency}ms`,
    })
  },
}

export default ping
