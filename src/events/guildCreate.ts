import { Events, Guild } from 'discord.js'
import { Event } from '@/bot/types.js'
import logger from '@/config/logger.js'

const guildCreate: Event = {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    logger.info(
      `✅ Joined new guild: ${guild.name} (ID: ${guild.id}) with ${guild.memberCount} members`
    )

    // Optional: Send a welcome message to the system channel
    if (guild.systemChannel) {
      try {
        await guild.systemChannel.send({
          content:
            `👋 Hello **${guild.name}**! Thanks for adding me to your server.\n\n` +
            `🔧 Use \`/help\` to see available commands\n` +
            `📚 Need help? Contact the bot developer\n\n` +
            `Let's get started! 🚀`,
        })
      } catch (error) {
        logger.warn(`Could not send welcome message to ${guild.name}:`, error)
      }
    }

    // Log some basic guild information
    logger.debug(
      `Guild info - Name: ${guild.name}, Members: ${guild.memberCount}, Owner: ${guild.ownerId}`
    )
  },
}

export default guildCreate
