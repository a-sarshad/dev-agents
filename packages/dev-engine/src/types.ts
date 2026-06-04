export type Direction = 'rtl' | 'ltr' | 'both'
export type Calendar = 'jalali' | 'hijri' | 'gregorian'
export type DesignSystem = 'chakra-v3' | 'chakra-v2' | 'mui' | 'antd' | 'mantine' | 'generic'
export type IconLibrary = 'lucide' | 'heroicons' | 'fa' | 'mdi' | 'generic'

export interface PathConfig {
  direction: Direction
  locale?: string
}

export interface ProjectConfig {
  direction: Direction
  locale: string
  calendar: Calendar
  ds: DesignSystem
  icon_lib: IconLibrary
  paths?: Record<string, PathConfig>
  ignore?: string[]
  ignore_custom_components?: string[]
  claude_api_key?: string
  modules?: string[]
  // Figma sync (BLUEPRINT §6) — اول پروژه پرسیده و اینجا ذخیره می‌شه
  figma_source?: 'mcp' | 'rest'
  figma_file_key?: string
  ds_mcp?: string
  dev_knowledge_path?: string   // override برای پیدا کردن لایه DS cache
  import_alias?: string         // برای scan — مثلاً '@/' (پیش‌فرض)
}

export interface Violation {
  file: string
  line: number
  column?: number
  module: string
  rule: string
  message: string
  severity: 'error' | 'warning' | 'info'
  autoFixable: boolean
  fix?: string
  original?: string
  replacement?: string
}

export interface CheckResult {
  file: string
  violations: Violation[]
  fixed: number
  skipped: number
}

export interface CheckModule {
  id: string
  name: string
  description: string
  supportedDirections: Direction[]
  supportedDS?: DesignSystem[]
  check(filePath: string, content: string, config: ProjectConfig): Violation[]
  fix?(content: string, violations: Violation[]): string
}

export interface RunOptions {
  fix: boolean
  reportOnly: boolean
  changed: boolean
  modules?: string[]
  verbose: boolean
}

// ── Figma → code resolution cache (BLUEPRINT §6) ──────────────────────────────
// دو لایه: DS (shared، در dev-knowledge) + Local (در repo پروژه). merge با Local-first.
export interface FigmaResolveCache {
  components?: Record<string, string>   // Figma component name → code import (e.g. "Button": "@chakra-ui/react#Button")
  tokens?: Record<string, string>       // Figma var/token → code token (e.g. "color/primary/500": "colors.primary.500")
  variables?: Record<string, string>    // Figma boolean/string variable → معنی/flag
  _synced?: string                      // ISO date آخرین sync
  _source?: string                      // 'mcp' | 'rest' | 'seed'
}

export interface MergedResolve extends FigmaResolveCache {
  _layers: { ds: boolean; local: boolean }   // کدوم لایه‌ها contribute کردن
}
