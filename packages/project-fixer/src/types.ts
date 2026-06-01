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
