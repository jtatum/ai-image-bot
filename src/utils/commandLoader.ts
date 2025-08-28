import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Command, ExtendedClient } from '@/bot/types.js'
import logger from '@/config/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class CommandLoader {
  private client: ExtendedClient
  private commandsPath: string

  constructor(client: ExtendedClient) {
    this.client = client
    this.commandsPath = join(__dirname, '..', 'commands')
  }

  public async loadCommands(): Promise<void> {
    try {
      const commandFiles = this.getCommandFiles()

      for (const file of commandFiles) {
        await this.loadCommand(file)
      }

      logger.info(`✅ Loaded ${this.client.commands.size} commands`)
    } catch (error) {
      logger.error('Failed to load commands:', error)
      throw error
    }
  }

  private getCommandFiles(): string[] {
    try {
      return readdirSync(this.commandsPath)
        .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts'))
        .map(file => join(this.commandsPath, file))
    } catch {
      logger.warn('Commands directory not found, skipping command loading')
      return []
    }
  }

  private async loadCommand(filePath: string): Promise<void> {
    try {
      const fileURL = pathToFileURL(filePath).href
      const commandModule = await import(fileURL)
      const command: Command = commandModule.default || commandModule

      if (!this.isValidCommand(command)) {
        logger.warn(`Invalid command structure in file: ${filePath}`)
        return
      }

      this.client.commands.set(command.data.name, command)
      logger.debug(`Loaded command: ${command.data.name}`)
    } catch (error) {
      logger.error(`Failed to load command from ${filePath}:`, error)
    }
  }

  private isValidCommand(command: any): command is Command {
    return (
      command &&
      typeof command === 'object' &&
      command.data &&
      typeof command.data.name === 'string' &&
      typeof command.execute === 'function'
    )
  }

  public async reloadCommand(commandName: string): Promise<boolean> {
    try {
      const commandFiles = this.getCommandFiles()
      const commandFile = commandFiles.find(
        file => file.includes(commandName) || file.includes(commandName.toLowerCase())
      )

      if (!commandFile) {
        logger.warn(`Command file not found for: ${commandName}`)
        return false
      }

      // Note: Hot reload cache clearing doesn't work with ESM
      // Consider using a different approach for hot reload in production

      await this.loadCommand(commandFile)
      logger.info(`✅ Reloaded command: ${commandName}`)
      return true
    } catch (error) {
      logger.error(`Failed to reload command ${commandName}:`, error)
      return false
    }
  }
}
