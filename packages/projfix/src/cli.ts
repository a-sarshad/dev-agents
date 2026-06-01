#!/usr/bin/env node
import { Command } from 'commander'
import { resolve } from 'path'
import { watch } from 'fs'
import { loadConfig } from './config.js'
import { run } from './engine.js'
import { printResult, printJSON } from './reporter.js'
import { runInit } from './init.js'
import type { RunOptions } from './types.js'

const program = new Command()

program
  .name('projfix')
  .description('Project consistency checker & auto-fixer — RTL/LTR, DS-agnostic')
  .version('0.1.0')

// ── Main check command ────────────────────────────────────────────────────────
program
  .argument('[path]', 'project root or src directory', '.')
  .option('--fix', 'auto-fix fixable violations', false)
  .option('--report-only', 'print report without fixing', false)
  .option('--changed', 'check only git-changed files', false)
  .option('--module <ids>', 'run specific modules only (comma-separated)')
  .option('--json', 'output as JSON', false)
  .option('--verbose', 'show all files including clean ones', false)
  .option('--exit-zero', 'always exit 0 (useful for CI report-only pipelines)', false)
  .option('--config <path>', 'explicit path to .projfix.json (overrides auto-detect)')
  .option('--watch', 'watch for file changes and re-run automatically', false)
  .action(async (inputPath: string, opts: {
    fix: boolean
    reportOnly: boolean
    changed: boolean
    module?: string
    json: boolean
    verbose: boolean
    exitZero: boolean
    config?: string
    watch: boolean
  }) => {
    const projectRoot = resolve(process.cwd(), inputPath)
    const config = loadConfig(projectRoot, opts.config)

    const options: RunOptions = {
      fix: opts.fix && !opts.reportOnly,
      reportOnly: opts.reportOnly,
      changed: opts.changed,
      modules: opts.module?.split(',').map(m => m.trim()),
      verbose: opts.verbose,
    }

    const doRun = async (label?: string) => {
      if (label) console.log(`\n🔄  ${label}\n`)
      else {
        console.log(`\n🔍 projfix — checking ${projectRoot}`)
        console.log(`   direction: ${config.direction} | ds: ${config.ds} | locale: ${config.locale}\n`)
      }

      const results = await run(projectRoot, config, options)

      if (opts.json) {
        printJSON(results)
      } else {
        printResult(results)
      }

      return results.some(r => r.violations.some(v => v.severity === 'error'))
    }

    const hasErrors = await doRun()

    if (opts.watch) {
      console.log('\n👁️  Watching for changes… (Ctrl+C to stop)\n')
      let debounce: ReturnType<typeof setTimeout> | null = null

      watch(projectRoot, { recursive: true }, (_event, filename) => {
        if (!filename) return
        if (!/\.(tsx?|jsx?)$/.test(filename)) return
        if (/node_modules|\.git|dist|build/.test(filename)) return

        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => doRun(`Changed: ${filename}`), 300)
      })
      return
    }

    process.exit(opts.exitZero ? 0 : (hasErrors ? 1 : 0))
  })

// ── Init subcommand ───────────────────────────────────────────────────────────
program
  .command('init [dir]')
  .description('create .projfix.json interactively')
  .action(async (dir?: string) => {
    const targetDir = resolve(process.cwd(), dir ?? '.')
    await runInit(targetDir)
  })

program.parse()
