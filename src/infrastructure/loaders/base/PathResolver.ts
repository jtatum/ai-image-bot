import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export interface PathResolver {
  getModulesPath(): string
}

export class BasePathResolver implements PathResolver {
  protected baseDir: string

  constructor(importMetaUrl: string) {
    const __filename = fileURLToPath(importMetaUrl)
    this.baseDir = dirname(__filename)
  }

  public getModulesPath(): string {
    throw new Error('getModulesPath must be implemented by subclass')
  }

  protected resolvePath(...pathSegments: string[]): string {
    return join(this.baseDir, ...pathSegments)
  }
}

export class CommandPathResolver extends BasePathResolver {
  public getModulesPath(): string {
    return this.resolvePath('..', '..', 'presentation', 'commands', 'implementations')
  }
}

export class EventPathResolver extends BasePathResolver {
  public getModulesPath(): string {
    return this.resolvePath('..', '..', 'presentation', 'events', 'implementations')
  }
}
