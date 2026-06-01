import chalk from 'chalk'
import type { CheckResult, Violation } from './types.js'

export function printResult(results: CheckResult[]): void {
  let totalViolations = 0
  let totalFixed = 0
  let totalErrors = 0
  let totalWarnings = 0

  for (const result of results) {
    if (result.violations.length === 0 && result.fixed === 0) continue

    if (result.fixed > 0) {
      console.log(chalk.green(`\n✅ ${result.file} — ${result.fixed} auto-fixed`))
    }

    if (result.violations.length > 0) {
      console.log(chalk.yellow(`\n⚠️  ${result.file}`))
      for (const v of result.violations) {
        printViolation(v)
        if (v.severity === 'error') totalErrors++
        else totalWarnings++
      }
    }

    totalViolations += result.violations.length
    totalFixed += result.fixed
  }

  printSummary(results.length, totalViolations, totalFixed, totalErrors, totalWarnings)
}

function printViolation(v: Violation): void {
  const location = chalk.gray(`${v.line}${v.column ? `:${v.column}` : ''}`)
  const badge = v.severity === 'error' ? chalk.red('[error]') : chalk.yellow('[warn]')
  const fixable = v.autoFixable ? chalk.green(' [auto-fix available]') : ''
  const module = chalk.cyan(`[${v.module}]`)

  console.log(`  ${location}  ${badge} ${module} ${v.message}${fixable}`)

  if (v.original && v.replacement) {
    console.log(chalk.red(`         - ${v.original}`))
    console.log(chalk.green(`         + ${v.replacement}`))
  }
}

function printSummary(
  files: number,
  violations: number,
  fixed: number,
  errors: number,
  warnings: number
): void {
  console.log('\n' + '─'.repeat(60))

  if (violations === 0 && fixed === 0) {
    console.log(chalk.green(`✅ All good — ${files} files checked, no issues found`))
    return
  }

  const parts: string[] = [`📁 ${files} files checked`]
  if (fixed > 0) parts.push(chalk.green(`${fixed} fixed`))
  if (errors > 0) parts.push(chalk.red(`${errors} errors`))
  if (warnings > 0) parts.push(chalk.yellow(`${warnings} warnings`))

  console.log(parts.join('  |  '))

  if (errors > 0) {
    console.log(chalk.red('\n❌ Run with --fix to auto-fix fixable issues'))
  }
}

export function printJSON(results: CheckResult[]): void {
  console.log(JSON.stringify(results, null, 2))
}
