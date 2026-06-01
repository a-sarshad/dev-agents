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

const ALL_MODULES: CheckModule[] = [
  cssLogicalPropsModule,
  iconDirectionModule,
  persianNumeralsModule,
  chakraKnownBugsModule,
  domOrderModule,
]

function getModules(config: ProjectConfig, selectedIds?: string[]): CheckModule[] {
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

  const modules = getModules(config, options.modules)

  for (const filePath of files) {
    let content: string
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const fileDirection = getDirectionForFile(filePath, config)
    const fileConfig: ProjectConfig = { ...config, direction: fileDirection }

    const allViolations: Violation[] = []

    for (const module of modules) {
      if (!module.supportedDirections.includes(fileDirection)) continue

      const violations = module.check(filePath, content, fileConfig)
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

  return results
}
