import { REST, Routes } from 'discord.js'
import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from '@/shared/config/environment.js'
import logger from '@/infrastructure/monitoring/Logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export async function deployCommands(guildId?: string): Promise<void> {
  const commands = []
  const commandsPath = join(__dirname, '..', 'presentation', 'commands', 'implementations')

  try {
    const commandFiles = readdirSync(commandsPath).filter(
      file =>
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        !file.endsWith('.d.ts') &&
        file !== 'index.ts' &&
        file !== 'index.js'
    )

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file)
      const fileURL = pathToFileURL(filePath).href

      try {
        const commandModule = await import(fileURL)
        // New architecture: expect a class that needs to be instantiated
        const CommandClass = commandModule.default || commandModule[Object.keys(commandModule)[0]]
        let command

        if (typeof CommandClass === 'function') {
          const commandInstance = new CommandClass()
          command = {
            data: commandInstance.data,
            execute: commandInstance.execute.bind(commandInstance),
            cooldown: commandInstance.cooldown,
          }
        } else {
          command = CommandClass
        }

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

    let data: unknown
    if (guildId) {
      // Deploy to specific guild (faster for development)
      data = await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, guildId), {
        body: commands,
      })
      logger.info(
        `✅ Successfully deployed ${(data as { length: number }).length} commands to guild ${guildId}`
      )
    } else {
      // Deploy globally (takes up to 1 hour to update)
      data = await rest.put(Routes.applicationCommands(config.CLIENT_ID), { body: commands })
      logger.info(
        `✅ Successfully deployed ${(data as { length: number }).length} commands globally`
      )
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
