import { Events } from 'discord.js'
import { Event } from '@/bot/types.js'
import logger from '@/config/logger.js'

const error: Event = {
  name: Events.Error,
  async execute(error: Error) {
    logger.error('Discord.js error:', error)
  },
}

export default error
