import { Event, ExtendedClient } from '@/bot/types.js'
import { BaseModuleLoader, PathResolver, EventPathResolver } from '../base/index.js'

export class EventLoader extends BaseModuleLoader<Event> {
  private loadedEventFiles: string[] = []

  constructor(client: ExtendedClient, pathResolver?: PathResolver | string) {
    super(client, {
      pathResolver,
      moduleTypeName: 'event',
      validate: EventLoader.isValidEvent,
      register: (client: ExtendedClient, event: Event) => {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args))
        } else {
          client.on(event.name, (...args) => event.execute(...args))
        }
      },
      transform: (moduleInstance: unknown) => {
        const eventInstance = moduleInstance as {
          name: Event['name']
          execute: Event['execute']
          once?: Event['once']
        }
        return {
          name: eventInstance.name,
          execute: eventInstance.execute.bind(eventInstance),
          once: eventInstance.once,
        }
      },
      initialize: (client: ExtendedClient, moduleInstance: unknown) => {
        const eventInstance = moduleInstance as {
          initialize?: (client: ExtendedClient) => void
        }
        if (typeof eventInstance.initialize === 'function') {
          eventInstance.initialize(client)
        }
      },
    })
  }

  protected createDefaultPathResolver(): PathResolver {
    return new EventPathResolver(import.meta.url)
  }

  protected getLoadedCount(): number {
    return this.loadedEventFiles.length
  }

  protected getModuleName(event: Event): string {
    return event.name
  }

  public async loadEvents(): Promise<void> {
    const eventFiles = this.getModuleFiles()
    this.loadedEventFiles = eventFiles
    return this.loadModules()
  }

  private static isValidEvent(event: unknown): event is Event {
    if (!event || typeof event !== 'object' || event === null) {
      return false
    }

    const evt = event as Record<string, unknown>

    return (
      'name' in evt &&
      'execute' in evt &&
      typeof evt.name === 'string' &&
      typeof evt.execute === 'function'
    )
  }
}
