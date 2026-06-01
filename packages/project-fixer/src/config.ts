import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { ProjectConfig } from './types.js'

const DEFAULTS: ProjectConfig = {
  direction: 'rtl',
  locale: 'fa-IR',
  calendar: 'jalali',
  ds: 'generic',
  icon_lib: 'generic',
  ignore: ['node_modules', 'dist', '.next', 'build', 'coverage'],
  ignore_custom_components: [],
}

export function loadConfig(projectRoot: string): ProjectConfig {
  // search: CWD first, then provided path (handles `projfix ./src` from project root)
  const candidates = [
    resolve(process.cwd(), '.projfix.json'),
    resolve(projectRoot, '.projfix.json'),
  ]

  const configPath = candidates.find(p => existsSync(p))

  if (!configPath) {
    console.warn(`⚠️  No .projfix.json found — using defaults (direction: rtl, locale: fa-IR)`)
    return DEFAULTS
  }

  const raw = readFileSync(configPath, 'utf-8')
  const userConfig = JSON.parse(raw) as Partial<ProjectConfig>

  return { ...DEFAULTS, ...userConfig }
}

export function getDirectionForFile(filePath: string, config: ProjectConfig): 'rtl' | 'ltr' {
  if (config.direction !== 'both') return config.direction

  if (!config.paths) return 'rtl'

  for (const [pattern, pathConfig] of Object.entries(config.paths)) {
    if (filePath.includes(pattern)) {
      return pathConfig.direction === 'both' ? 'rtl' : pathConfig.direction
    }
  }

  return 'rtl'
}
