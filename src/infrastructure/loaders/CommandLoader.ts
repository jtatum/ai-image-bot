import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Command, ExtendedClient } from '@/bot/types.js'
import logger from '@/infrastructure/monitoring/Logger.js'

export interface PathResolver {
  getCommandsPath(): string
}

class DefaultPathResolver implements PathResolver {
  private baseDir: string

  constructor() {
    const __filename = fileURLToPath(import.meta.url)
    this.baseDir = dirname(__filename)
  }

  getCommandsPath(): string {
    return join(this.baseDir, '..', 'presentation', 'commands', 'implementations')
  }
}

export class CommandLoader {
  private client: ExtendedClient
  private commandsPath: string
  private validationFailures: string[] = []

  constructor(client: ExtendedClient, pathResolver?: PathResolver | string) {
    this.client = client

    if (typeof pathResolver === 'string') {
      // Custom path provided directly (for testing)
      this.commandsPath = pathResolver
    } else {
      // Use path resolver (for production or testing with custom resolver)
      const resolver = pathResolver || new DefaultPathResolver()
      this.commandsPath = resolver.getCommandsPath()
    }
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

  public getValidationFailures(): string[] {
    return [...this.validationFailures]
  }

  public hasValidationFailures(): boolean {
    return this.validationFailures.length > 0
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

      // New architecture: expect a class that needs to be instantiated
      const CommandClass = commandModule.default || commandModule[Object.keys(commandModule)[0]]
      let command: Command

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

      if (!this.isValidCommand(command)) {
        logger.warn(`Invalid command structure in file: ${filePath}`)
        this.validationFailures.push(filePath)
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
