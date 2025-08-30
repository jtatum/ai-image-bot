import { REST, Routes } from 'discord.js'
import { Collection } from 'discord.js'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from '@/shared/config/environment.js'
import logger from '@/infrastructure/monitoring/Logger.js'
import { CommandLoader } from '@/infrastructure/loaders/index.js'
import { ExtendedClient } from '@/bot/types.js'

export async function deployCommands(guildId?: string): Promise<void> {
  try {
    // Create a mock client to collect commands
    const mockClient = {
      commands: new Collection(),
    } as ExtendedClient

    // Use CommandLoader to load all commands with explicit path
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const commandsPath = join(__dirname, '..', 'presentation', 'commands', 'implementations')

    const loader = new CommandLoader(mockClient, commandsPath)
    await loader.loadCommands()

    // Check for validation failures
    if (loader.hasValidationFailures()) {
      const failures = loader.getValidationFailures()
      logger.warn(`Found ${failures.length} invalid command files:`, failures)
    }

    // Extract command data for deployment
    const commands = Array.from(mockClient.commands.values())
      .map(command => {
        if (command.data && typeof command.data.toJSON === 'function') {
          return command.data.toJSON()
        }
        logger.warn(`Command ${command.data?.name || 'unknown'} has invalid data structure`)
        return null
      })
      .filter(Boolean) // Remove null entries

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
