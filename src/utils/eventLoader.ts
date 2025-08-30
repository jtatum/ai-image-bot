import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Event, ExtendedClient } from '@/bot/types.js'
import logger from '@/config/logger.js'
import { config } from '@/config/environment.js'

export interface PathResolver {
  getEventsPath(useNewArchitecture: boolean): string
}

class DefaultPathResolver implements PathResolver {
  private baseDir: string

  constructor() {
    const __filename = fileURLToPath(import.meta.url)
    this.baseDir = dirname(__filename)
  }

  getEventsPath(useNewArchitecture: boolean): string {
    return useNewArchitecture
      ? join(this.baseDir, '..', 'presentation', 'events', 'implementations')
      : join(this.baseDir, '..', 'events')
  }
}

export class EventLoader {
  private client: ExtendedClient
  private eventsPath: string
  private useNewArchitecture: boolean
  private validationFailures: string[] = []

  constructor(client: ExtendedClient, pathResolver?: PathResolver | string) {
    this.client = client
    this.useNewArchitecture = config.USE_NEW_ARCHITECTURE

    if (typeof pathResolver === 'string') {
      // Custom path provided directly (for testing)
      this.eventsPath = pathResolver
    } else {
      // Use path resolver (for production or testing with custom resolver)
      const resolver = pathResolver || new DefaultPathResolver()
      this.eventsPath = resolver.getEventsPath(this.useNewArchitecture)
    }
  }

  public async loadEvents(): Promise<void> {
    try {
      const eventFiles = this.getEventFiles()

      for (const file of eventFiles) {
        await this.loadEvent(file)
      }

      logger.info(
        `✅ Loaded ${eventFiles.length} events from ${this.useNewArchitecture ? 'new' : 'old'} architecture`
      )
    } catch (error) {
      logger.error('Failed to load events:', error)
      throw error
    }
  }

  public getValidationFailures(): string[] {
    return [...this.validationFailures]
  }

  public hasValidationFailures(): boolean {
    return this.validationFailures.length > 0
  }

  private getEventFiles(): string[] {
    try {
      return readdirSync(this.eventsPath)
        .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts'))
        .map(file => join(this.eventsPath, file))
    } catch {
      logger.warn('Events directory not found, skipping event loading')
      return []
    }
  }

  private async loadEvent(filePath: string): Promise<void> {
    try {
      const fileURL = pathToFileURL(filePath).href
      const eventModule = await import(fileURL)

      let event: Event
      if (this.useNewArchitecture) {
        // New architecture: expect a class that needs to be instantiated
        const EventClass = eventModule.default || eventModule[Object.keys(eventModule)[0]]
        if (typeof EventClass === 'function') {
          const eventInstance = new EventClass()

          // Initialize the event if it has an initialize method
          if (typeof eventInstance.initialize === 'function') {
            eventInstance.initialize(this.client)
          }

          event = {
            name: eventInstance.name,
            execute: eventInstance.execute.bind(eventInstance),
            once: eventInstance.once,
          }
        } else {
          event = EventClass
        }
      } else {
        // Old architecture: expect a plain object
        event = eventModule.default || eventModule
      }

      if (!this.isValidEvent(event)) {
        logger.warn(`Invalid event structure in file: ${filePath}`)
        this.validationFailures.push(filePath)
        return
      }

      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args))
      } else {
        this.client.on(event.name, (...args) => event.execute(...args))
      }

      logger.debug(
        `Loaded event: ${event.name} (${this.useNewArchitecture ? 'new' : 'old'} architecture)`
      )
    } catch (error) {
      logger.error(`Failed to load event from ${filePath}:`, error)
    }
  }

  private isValidEvent(event: any): event is Event {
    return (
      event &&
      typeof event === 'object' &&
      typeof event.name === 'string' &&
      typeof event.execute === 'function'
    )
  }
}
