import { Events, Client } from 'discord.js'
import { Event } from '@/bot/types.js'
import logger from '@/config/logger.js'

const ready: Event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    if (!client.user) {
      logger.error('Client user is null after ready event')
      return
    }

    logger.info(`✅ Ready! Logged in as ${client.user.tag}`)
    logger.info(`🏠 Connected to ${client.guilds.cache.size} guilds`)
    logger.info(`👥 Serving ${client.users.cache.size} users`)

    const activities = [
      'Ready to help!',
      `Serving ${client.guilds.cache.size} servers`,
      'Type / to see commands',
    ]

    let activityIndex = 0

    setInterval(() => {
      client.user?.setActivity(activities[activityIndex], { type: 0 })
      activityIndex = (activityIndex + 1) % activities.length
    }, 30000)
  },
}

export default ready
