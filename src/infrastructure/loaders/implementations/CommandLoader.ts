import { Command, ExtendedClient } from '@/bot/types.js'
import { BaseModuleLoader, PathResolver, CommandPathResolver } from '../base/index.js'
import logger from '@/infrastructure/monitoring/Logger.js'

export class CommandLoader extends BaseModuleLoader<Command> {
  constructor(client: ExtendedClient, pathResolver?: PathResolver | string) {
    super(client, {
      pathResolver,
      moduleTypeName: 'command',
      validate: CommandLoader.isValidCommand,
      register: (client: ExtendedClient, command: Command) => {
        client.commands.set(command.data.name, command)
      },
      transform: (moduleInstance: unknown) => {
        const commandInstance = moduleInstance as {
          data: Command['data']
          execute: Command['execute']
          cooldown?: Command['cooldown']
        }
        return {
          data: commandInstance.data,
          execute: commandInstance.execute.bind(commandInstance),
          cooldown: commandInstance.cooldown,
        }
      },
    })
  }

  protected createDefaultPathResolver(): PathResolver {
    return new CommandPathResolver(import.meta.url)
  }

  protected getLoadedCount(): number {
    return this.client.commands.size
  }

  protected getModuleName(command: Command): string {
    return command.data.name
  }

  public async loadCommands(): Promise<void> {
    return this.loadModules()
  }

  private static isValidCommand(command: unknown): command is Command {
    if (!command || typeof command !== 'object' || command === null) {
      return false
    }

    const cmd = command as Record<string, unknown>

    return (
      'data' in cmd &&
      'execute' in cmd &&
      typeof cmd.data === 'object' &&
      cmd.data !== null &&
      'name' in (cmd.data as Record<string, unknown>) &&
      typeof (cmd.data as Record<string, unknown>).name === 'string' &&
      typeof cmd.execute === 'function'
    )
  }

  public async reloadCommand(commandName: string): Promise<boolean> {
    try {
      const commandFiles = this.getModuleFiles()
      const commandFile = commandFiles.find(
        file => file.includes(commandName) || file.includes(commandName.toLowerCase())
      )

      if (!commandFile) {
        logger.warn(`Command file not found for: ${commandName}`)
        return false
      }

      // Note: Hot reload cache clearing doesn't work with ESM
      // Consider using a different approach for hot reload in production

      await this.loadSingleModule(commandFile)
      logger.info(`✅ Reloaded command: ${commandName}`)
      return true
    } catch (error) {
      logger.error(`Failed to reload command ${commandName}:`, error)
      return false
    }
  }
}
