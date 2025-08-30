import { readdirSync } from 'fs'
import { pathToFileURL } from 'url'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ExtendedClient } from '@/bot/types.js'
import logger from '@/infrastructure/monitoring/Logger.js'

export interface PathResolver {
  getModulesPath(): string
}

export class DefaultPathResolver implements PathResolver {
  private baseDir: string

  constructor(private relativePath: string) {
    const __filename = fileURLToPath(import.meta.url)
    this.baseDir = dirname(__filename)
  }

  getModulesPath(): string {
    return join(this.baseDir, ...this.relativePath.split('/'))
  }
}

export interface ModuleConfig<T> {
  pathResolver?: PathResolver | string
  moduleTypeName: string
  validate: (module: unknown) => module is T
  register: (client: ExtendedClient, module: T) => void
  transform?: (moduleClass: unknown) => T
  initialize?: (client: ExtendedClient, moduleInstance: unknown) => void
}

export abstract class BaseModuleLoader<T> {
  protected client: ExtendedClient
  protected modulesPath: string
  protected validationFailures: string[] = []
  protected config: ModuleConfig<T>

  constructor(client: ExtendedClient, config: ModuleConfig<T>) {
    this.client = client
    this.config = config

    if (typeof config.pathResolver === 'string') {
      // Custom path provided directly (for testing)
      this.modulesPath = config.pathResolver
    } else {
      // Use path resolver (for production or testing with custom resolver)
      const resolver = config.pathResolver || this.createDefaultPathResolver()
      this.modulesPath = resolver.getModulesPath()
    }
  }

  protected abstract createDefaultPathResolver(): PathResolver

  public async loadModules(): Promise<void> {
    try {
      const moduleFiles = this.getModuleFiles()

      for (const file of moduleFiles) {
        await this.loadSingleModule(file)
      }

      logger.info(`✅ Loaded ${this.getLoadedCount()} ${this.config.moduleTypeName}s`)
    } catch (error) {
      logger.error(`Failed to load ${this.config.moduleTypeName}s:`, error)
      throw error
    }
  }

  protected abstract getLoadedCount(): number

  public getValidationFailures(): string[] {
    return [...this.validationFailures]
  }

  public hasValidationFailures(): boolean {
    return this.validationFailures.length > 0
  }

  protected abstract getModuleName(module: T): string

  protected getModuleFiles(): string[] {
    try {
      return readdirSync(this.modulesPath)
        .filter(file => (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.d.ts'))
        .map(file => join(this.modulesPath, file))
    } catch {
      logger.warn(
        `${this.config.moduleTypeName}s directory not found, skipping ${this.config.moduleTypeName} loading`
      )
      return []
    }
  }

  protected async loadSingleModule(filePath: string): Promise<void> {
    try {
      const fileURL = pathToFileURL(filePath).href
      const moduleModule = await import(fileURL)

      // New architecture: expect a class that needs to be instantiated
      const ModuleClass = moduleModule.default || moduleModule[Object.keys(moduleModule)[0]]
      let module: T

      if (typeof ModuleClass === 'function') {
        const moduleInstance = new ModuleClass()

        // Initialize the module if it has an initialize method and config has initialize
        if (this.config.initialize && typeof moduleInstance.initialize === 'function') {
          this.config.initialize(this.client, moduleInstance)
        }

        module = this.config.transform
          ? this.config.transform(moduleInstance)
          : (moduleInstance as T)
      } else {
        module = ModuleClass
      }

      if (!this.config.validate(module)) {
        logger.warn(`Invalid ${this.config.moduleTypeName} structure in file: ${filePath}`)
        this.validationFailures.push(filePath)
        return
      }

      this.config.register(this.client, module)
      logger.debug(`Loaded ${this.config.moduleTypeName}: ${this.getModuleName(module)}`)
    } catch (error) {
      logger.error(`Failed to load ${this.config.moduleTypeName} from ${filePath}:`, error)
    }
  }
}
