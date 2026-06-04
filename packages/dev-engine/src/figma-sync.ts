import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { globSync } from 'glob'
import chalk from 'chalk'
import type { ProjectConfig, FigmaResolveCache } from './types.js'
import { loadMergedResolve, localCachePath, dsCachePath, cacheAgeDays } from './cache.js'

// scan src/components → نگاشت ComponentName → import path (BLUEPRINT §6.4: detection = scan)
export function scanLocalComponents(projectRoot: string, config: ProjectConfig): Record<string, string> {
  const alias = config.import_alias ?? '@/'
  const srcRoot = resolve(projectRoot, 'src')
  const files = globSync('components/**/*.{tsx,jsx}', { cwd: srcRoot, nodir: true })
  const map: Record<string, string> = {}
  const re = /export\s+(?:default\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g
  for (const rel of files) {
    let content: string
    try {
      content = readFileSync(resolve(srcRoot, rel), 'utf-8')
    } catch {
      continue
    }
    const importPath = alias + rel.replace(/\.[jt]sx$/, '')   // @/components/ui/TitleBar
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      const name = m[1]
      if (!map[name]) map[name] = `${importPath}#${name}`
    }
  }
  return map
}

const TEMPLATE: FigmaResolveCache = {
  components: {},
  tokens: {},
  variables: {},
  _synced: new Date().toISOString().slice(0, 10),
  _source: 'mcp',
}

// figma-sync: validate / scaffold لایه Local cache.
// population واقعی = MCP (Claude می‌نویسه) یا REST (نیاز token + Enterprise برای variables).
// CLI اینجا فقط template می‌سازه و وضعیت merge رو گزارش می‌ده.
export function runFigmaSync(projectRoot: string, config: ProjectConfig, opts: { init: boolean; scan: boolean }): void {
  const localPath = localCachePath(projectRoot)

  if (opts.scan) {
    const scanned = scanLocalComponents(projectRoot, config)
    let existing: FigmaResolveCache = {}
    if (existsSync(localPath)) {
      try { existing = JSON.parse(readFileSync(localPath, 'utf-8')) as FigmaResolveCache } catch { /* خراب — بازنویسی */ }
    }
    const out: FigmaResolveCache = {
      ...existing,
      // scanned پایه‌ست؛ entryهای دستی موجود برنده‌ان (override نمی‌شن)
      components: { ...scanned, ...(existing.components ?? {}) },
      tokens: existing.tokens ?? {},
      variables: existing.variables ?? {},
      _synced: new Date().toISOString().slice(0, 10),
      _source: existing._source ?? 'scan',
    }
    mkdirSync(dirname(localPath), { recursive: true })
    writeFileSync(localPath, JSON.stringify(out, null, 2) + '\n')
    console.log(chalk.green(`✓ scanned ${Object.keys(scanned).length} local components → ${localPath}`))
    return
  }

  if (opts.init) {
    if (existsSync(localPath)) {
      console.log(chalk.yellow(`already exists: ${localPath}`))
    } else {
      mkdirSync(dirname(localPath), { recursive: true })
      writeFileSync(localPath, JSON.stringify(TEMPLATE, null, 2) + '\n')
      console.log(chalk.green(`✓ template written: ${localPath}`))
      console.log(chalk.gray('  حالا با MCP (Claude) یا REST پرش کن.'))
    }
    return
  }

  const merged = loadMergedResolve(projectRoot, config)
  console.log(chalk.bold(`\n🔄 figma-sync status — ${projectRoot}\n`))

  const dsPath = dsCachePath(config)
  console.log(`  DS layer:    ${merged._layers.ds ? chalk.green('✓ ' + dsPath) : chalk.gray('✗ ' + (dsPath ?? 'dev-knowledge پیدا نشد'))}`)
  console.log(`  Local layer: ${merged._layers.local ? chalk.green('✓ ' + localPath) : chalk.gray('✗ none — dev-engine figma-sync --init')}`)
  console.log(
    `  merged: ${chalk.cyan(Object.keys(merged.components ?? {}).length + ' components')}` +
    `  ${chalk.cyan(Object.keys(merged.tokens ?? {}).length + ' tokens')}` +
    `  ${chalk.cyan(Object.keys(merged.variables ?? {}).length + ' variables')}`
  )

  const age = cacheAgeDays(merged)
  if (age !== null) console.log(`  synced: ${merged._synced} (${age}d ago)${age > 7 ? chalk.yellow(' — کهنه') : ''}`)

  console.log('\n' + chalk.gray('population:'))
  if (config.figma_source === 'rest') {
    console.log('  REST → نیاز FIGMA_TOKEN + figma_file_key (variables API = Enterprise).')
  } else {
    console.log('  MCP (default) → Claude از Figma MCP می‌کشه و این فایل رو می‌نویسه؛ CLI فقط merge/read می‌کنه.')
  }
}
