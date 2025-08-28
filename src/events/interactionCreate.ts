import { Events, Interaction, Collection } from 'discord.js'
import { Event, ExtendedClient } from '@/bot/types.js'
import logger from '@/config/logger.js'

const interactionCreate: Event = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    const client = interaction.client as ExtendedClient
    const command = client.commands.get(interaction.commandName)

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`)
      return
    }

    // Cooldown management
    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Collection())
    }

    const now = Date.now()
    const timestamps = client.cooldowns.get(command.data.name)!
    const cooldownAmount = (command.cooldown || 3) * 1000

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount

      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000
        await interaction.reply({
          content: `⏳ Please wait ${timeLeft.toFixed(1)} more seconds before using \`${command.data.name}\` again.`,
          ephemeral: true,
        })
        return
      }
    }

    timestamps.set(interaction.user.id, now)
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount)

    try {
      logger.info(
        `Command executed: ${command.data.name} by ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`
      )
      await command.execute(interaction)
    } catch (error) {
      logger.error(`Error executing command ${command.data.name}:`, error)

      const errorMessage = {
        content: '❌ There was an error while executing this command!',
        ephemeral: true,
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage)
      } else {
        await interaction.reply(errorMessage)
      }
    }
  },
}

export default interactionCreate
