#!/usr/bin/env node
import { Command } from 'commander'
import { resolve } from 'path'
import { loadConfig } from './config.js'
import { run } from './engine.js'
import { printResult, printJSON } from './reporter.js'
import type { RunOptions } from './types.js'

const program = new Command()

program
  .name('projfix')
  .description('Project consistency checker & auto-fixer — RTL/LTR, DS-agnostic')
  .version('0.1.0')

program
  .argument('[path]', 'project root or src directory', '.')
  .option('--fix', 'auto-fix fixable violations', false)
  .option('--report-only', 'print report without fixing', false)
  .option('--changed', 'check only git-changed files', false)
  .option('--module <ids>', 'run specific modules only (comma-separated)')
  .option('--json', 'output as JSON', false)
  .option('--verbose', 'show all files including clean ones', false)
  .action(async (inputPath: string, opts: {
    fix: boolean
    reportOnly: boolean
    changed: boolean
    module?: string
    json: boolean
    verbose: boolean
  }) => {
    const projectRoot = resolve(process.cwd(), inputPath)
    const config = loadConfig(projectRoot)

    const options: RunOptions = {
      fix: opts.fix && !opts.reportOnly,
      reportOnly: opts.reportOnly,
      changed: opts.changed,
      modules: opts.module?.split(',').map(m => m.trim()),
      verbose: opts.verbose,
    }

    console.log(`\n🔍 projfix — checking ${projectRoot}`)
    console.log(`   direction: ${config.direction} | ds: ${config.ds} | locale: ${config.locale}\n`)

    const results = await run(projectRoot, config, options)

    if (opts.json) {
      printJSON(results)
    } else {
      printResult(results)
    }

    const hasErrors = results.some(r => r.violations.some(v => v.severity === 'error'))
    process.exit(hasErrors ? 1 : 0)
  })

program.parse()
