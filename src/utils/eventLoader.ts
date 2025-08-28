import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Event, ExtendedClient } from '@/bot/types.js'
import logger from '@/config/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export class EventLoader {
  private client: ExtendedClient
  private eventsPath: string

  constructor(client: ExtendedClient) {
    this.client = client
    this.eventsPath = join(__dirname, '..', 'events')
  }

  public async loadEvents(): Promise<void> {
    try {
      const eventFiles = this.getEventFiles()

      for (const file of eventFiles) {
        await this.loadEvent(file)
      }

      logger.info(`✅ Loaded ${eventFiles.length} events`)
    } catch (error) {
      logger.error('Failed to load events:', error)
      throw error
    }
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
      const event: Event = eventModule.default || eventModule

      if (!this.isValidEvent(event)) {
        logger.warn(`Invalid event structure in file: ${filePath}`)
        return
      }

      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args))
      } else {
        this.client.on(event.name, (...args) => event.execute(...args))
      }

      logger.debug(`Loaded event: ${event.name}`)
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
