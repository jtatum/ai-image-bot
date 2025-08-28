import { REST, Routes } from 'discord.js'
import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from '@/config/environment.js'
import logger from '@/config/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function deployCommands(guildId?: string): Promise<void> {
  const commands = []
  const commandsPath = join(__dirname, '..', 'commands')

  try {
    const commandFiles = readdirSync(commandsPath).filter(
      file => file.endsWith('.ts') || file.endsWith('.js')
    )

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file)
      const fileURL = pathToFileURL(filePath).href

      try {
        const commandModule = await import(fileURL)
        const command = commandModule.default || commandModule

        if (command && command.data && typeof command.data.toJSON === 'function') {
          commands.push(command.data.toJSON())
          logger.debug(`Loaded command: ${command.data.name}`)
        } else {
          logger.warn(`Invalid command structure in file: ${file}`)
        }
      } catch (error) {
        logger.error(`Failed to load command from ${file}:`, error)
      }
    }

    const rest = new REST().setToken(config.DISCORD_TOKEN)

    logger.info(`🔄 Deploying ${commands.length} commands...`)

    let data: any
    if (guildId) {
      // Deploy to specific guild (faster for development)
      data = await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, guildId), {
        body: commands,
      })
      logger.info(`✅ Successfully deployed ${data.length} commands to guild ${guildId}`)
    } else {
      // Deploy globally (takes up to 1 hour to update)
      data = await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands })
      logger.info(`✅ Successfully deployed ${data.length} commands globally`)
    }
  } catch (error) {
    logger.error('❌ Failed to deploy commands:', error)
    throw error
  }
}

// If this file is run directly, deploy commands
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const guildId = process.argv[2] // Optional guild ID for faster deployment

  deployCommands(guildId)
    .then(() => {
      logger.info('✅ Command deployment completed')
      process.exit(0)
    })
    .catch(error => {
      logger.error('❌ Command deployment failed:', error)
      process.exit(1)
    })
}
