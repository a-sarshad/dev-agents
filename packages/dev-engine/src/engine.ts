import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { glob } from 'glob'
import { execSync } from 'child_process'
import type { CheckModule, CheckResult, ProjectConfig, RunOptions, Violation } from './types.js'
import { getDirectionForFile } from './config.js'

// All modules
import { cssLogicalPropsModule } from './modules/css-logical-props.js'
import { iconDirectionModule } from './modules/icon-direction.js'
import { persianNumeralsModule } from './modules/persian-numerals.js'
import { chakraKnownBugsModule } from './modules/chakra-known-bugs.js'
import { domOrderModule } from './modules/dom-order.js'
import { debugArtifactsModule } from './modules/debug-artifacts.js'
import { createTokenReplacerModule } from './modules/token-replacer.js'
import { runBuildCheck, runGitCheck, runHandoffCheck } from './modules/build-git-check.js'
import { dsComponentUsageModule } from './modules/ds-component-usage.js'

const BASE_MODULES: CheckModule[] = [
  cssLogicalPropsModule,
  iconDirectionModule,
  persianNumeralsModule,
  chakraKnownBugsModule,
  domOrderModule,
  debugArtifactsModule,
  dsComponentUsageModule,
]

function getModules(projectRoot: string, config: ProjectConfig, selectedIds?: string[]): CheckModule[] {
  const ALL_MODULES = [...BASE_MODULES, createTokenReplacerModule(projectRoot)]
  return ALL_MODULES.filter(m => {
    if (selectedIds && !selectedIds.includes(m.id)) return false
    if (m.supportedDS && config.ds !== 'generic' && !m.supportedDS.includes(config.ds)) return false
    return true
  })
}

function getFiles(projectRoot: string, patterns: string[], ignorePatterns: string[]): string[] {
  const files: string[] = []
  for (const pattern of patterns) {
    const matches = glob.sync(pattern, {
      cwd: projectRoot,
      ignore: ignorePatterns,
      absolute: true,
    })
    files.push(...matches)
  }
  return [...new Set(files)]
}

function getIgnoredLines(content: string): Set<number> {
  const ignored = new Set<number>()
  const lines = content.split('\n')
  let disabledFrom = -1

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    // inline: any line ending with // dev-engine-ignore
    if (lines[i].includes('// dev-engine-ignore')) {
      ignored.add(i + 1)
      continue
    }
    // block: // dev-engine-disable ... // dev-engine-enable
    if (trimmed.startsWith('// dev-engine-disable')) {
      disabledFrom = i + 2  // disable starts on NEXT line
      continue
    }
    if (trimmed === '// dev-engine-enable') {
      // disable ends on this line (enable line itself is not disabled)
      if (disabledFrom !== -1) {
        for (let n = disabledFrom; n <= i; n++) ignored.add(n)
        disabledFrom = -1
      }
      continue
    }
  }
  // unclosed disable block — disable to end of file
  if (disabledFrom !== -1) {
    for (let n = disabledFrom; n <= lines.length; n++) ignored.add(n)
  }

  return ignored
}

function getChangedFiles(projectRoot: string): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', { cwd: projectRoot }).toString()
    return output
      .split('\n')
      .filter(f => f.endsWith('.tsx') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.js'))
      .map(f => resolve(projectRoot, f))
      .filter(f => {
        try { readFileSync(f); return true } catch { return false }
      })
  } catch {
    return []
  }
}

export async function run(
  projectRoot: string,
  config: ProjectConfig,
  options: RunOptions
): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  let files: string[]
  if (options.changed) {
    files = getChangedFiles(projectRoot)
    if (files.length === 0) {
      console.log('No changed files found (git diff HEAD)')
      return []
    }
  } else {
    const ignorePatterns = [
      ...(config.ignore ?? []).map(p => `**/${p}/**`),
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
    ]
    files = getFiles(projectRoot, ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js'], ignorePatterns)
  }

  const modules = getModules(projectRoot, config, options.modules)

  for (const filePath of files) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const fileDirection = getDirectionForFile(filePath, config)
    const fileConfig: ProjectConfig = { ...config, direction: fileDirection }

    const ignoredLines = getIgnoredLines(content)
    const allViolations: Violation[] = []

    for (const module of modules) {
      if (!module.supportedDirections.includes(fileDirection)) continue

      const violations = module.check(filePath, content, fileConfig)
        .filter(v => !ignoredLines.has(v.line))
      allViolations.push(...violations)
    }

    let fixedCount = 0
    let currentContent = content

    if (options.fix) {
      for (const module of modules) {
        if (!module.fix) continue
        const fixableViolations = allViolations.filter(
          v => v.module === module.id && v.autoFixable
        )
        if (fixableViolations.length === 0) continue
        const newContent = module.fix(currentContent, fixableViolations)
        if (newContent !== currentContent) {
          fixedCount += fixableViolations.length
          currentContent = newContent
        }
      }

      if (fixedCount > 0) {
        writeFileSync(filePath, currentContent, 'utf-8')
      }
    }

    const remainingViolations = options.fix
      ? allViolations.filter(v => !v.autoFixable)
      : allViolations

    results.push({
      file: filePath.replace(projectRoot + '/', ''),
      violations: remainingViolations,
      fixed: fixedCount,
      skipped: 0,
    })
  }

  // ── Build & Git check (project-level, not per-file) ──────────────────────
  if (!options.modules || options.modules.includes('build-git')) {
    const build = runBuildCheck(projectRoot)
    if (!build.passed) {
      results.push({
        file: '[build]',
        violations: [{
          file: '[build]', line: 0, module: 'build-git', rule: 'build-failed',
          message: `Build failed:\n${build.error}`,
          severity: 'error', autoFixable: false,
        }],
        fixed: 0, skipped: 0,
      })
    }

    const git = runGitCheck(projectRoot)
    if (git.uncommitted.length > 0 || git.unpushed > 0) {
      const msgs: string[] = []
      if (git.uncommitted.length > 0) msgs.push(`${git.uncommitted.length} uncommitted file(s)`)
      if (git.unpushed > 0) msgs.push(`${git.unpushed} unpushed commit(s)`)
      results.push({
        file: '[git]',
        violations: [{
          file: '[git]', line: 0, module: 'build-git', rule: 'git-dirty',
          message: msgs.join(' | '),
          severity: git.uncommitted.length > 0 ? 'error' : 'warning',
          autoFixable: false,
        }],
        fixed: 0, skipped: 0,
      })
    }

    const handoff = runHandoffCheck(projectRoot)
    if (handoff.stale) {
      results.push({
        file: '[handoff]',
        violations: [{
          file: '[handoff]', line: 0, module: 'build-git', rule: 'handoff-stale',
          message: `HANDOFF.md is ${handoff.commitsBehind} commits behind — run wf-session-update`,
          severity: 'warning',
          autoFixable: false,
        }],
        fixed: 0, skipped: 0,
      })
    }
  }

  return results
}
