import { existsSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import type { ProjectConfig } from './types.js'
import { loadMergedResolve, cacheAgeDays } from './cache.js'
import { findDevKnowledge, dsPackage } from './paths.js'

const STALE_DAYS = 7

interface Check {
  label: string
  ok: boolean
  warn?: boolean   // warn = نرم (preflight رد نمی‌شه)، !ok && !warn = hard fail
  detail?: string
}

// Preflight — قبل از impl اجرا می‌شه. hard fail روی env/config، warn روی cache.
export function runDoctor(projectRoot: string, config: ProjectConfig): boolean {
  const checks: Check[] = []

  // 1. config file موجوده؟ (hard)
  const cfgOk = existsSync(resolve(projectRoot, '.dev-engine.json'))
  checks.push({ label: '.dev-engine.json', ok: cfgOk, detail: cfgOk ? '' : 'run: dev-engine init' })

  // 2. DS package نصبه؟ (hard اگه DS مشخصه)
  const pkg = dsPackage(config.ds)
  if (pkg) {
    const installed = existsSync(resolve(projectRoot, 'node_modules', pkg))
    checks.push({ label: `DS installed (${pkg})`, ok: installed, detail: installed ? '' : `missing node_modules/${pkg}` })
  }

  // 3. figma_source تنظیم شده؟ (warn — اول پروژه باید پرسیده شه)
  const hasSource = !!config.figma_source
  checks.push({
    label: 'figma_source',
    ok: hasSource,
    warn: !hasSource,
    detail: hasSource ? config.figma_source! : 'اول پروژه بپرس: mcp یا rest → .dev-engine.json',
  })

  // 4. dev-knowledge پیدا می‌شه؟ (warn — برای لایه DS cache)
  const dn = findDevKnowledge(config.dev_knowledge_path)
  checks.push({ label: 'dev-knowledge', ok: !!dn, warn: !dn, detail: dn ?? 'set DN_PATH یا config.dev_knowledge_path' })

  // 5. cache layers موجودن؟ (warn)
  const merged = loadMergedResolve(projectRoot, config)
  const anyCache = merged._layers.ds || merged._layers.local
  checks.push({
    label: 'figma-resolve cache',
    ok: anyCache,
    warn: !anyCache,
    detail: `DS:${merged._layers.ds ? '✓' : '✗'} Local:${merged._layers.local ? '✓' : '✗'}`,
  })

  // 6. staleness (warn اگه کهنه)
  const age = cacheAgeDays(merged)
  if (age !== null) {
    const stale = age > STALE_DAYS
    checks.push({ label: 'cache freshness', ok: !stale, warn: stale, detail: `${age}d old${stale ? ' — re-sync لازمه' : ''}` })
  }

  // print
  console.log(chalk.bold(`\n🩺 dev-engine doctor — ${projectRoot}\n`))
  let hardFail = false
  for (const c of checks) {
    const icon = c.ok ? chalk.green('✓') : c.warn ? chalk.yellow('⚠') : chalk.red('✗')
    if (!c.ok && !c.warn) hardFail = true
    console.log(`  ${icon}  ${c.label}${c.detail ? chalk.gray('  — ' + c.detail) : ''}`)
  }

  console.log('\n' + '─'.repeat(60))
  if (hardFail) console.log(chalk.red('❌ preflight failed — برطرف کن قبل از impl'))
  else if (checks.some(c => c.warn)) console.log(chalk.yellow('⚠️  preflight passed با warning (impl مجازه)'))
  else console.log(chalk.green('✅ preflight clean — آماده‌ی impl'))

  return !hardFail
}
