import { execSync } from 'child_process'
import type { CheckModule, CheckResult, ProjectConfig } from '../types.js'

export function runBuildCheck(projectRoot: string): { passed: boolean; error?: string } {
  try {
    const pm = (() => {
      try { execSync('pnpm --version', { cwd: projectRoot, stdio: 'pipe' }); return 'pnpm' } catch { }
      try { execSync('yarn --version', { cwd: projectRoot, stdio: 'pipe' }); return 'yarn' } catch { }
      return 'npm'
    })()

    execSync(`${pm} run build`, { cwd: projectRoot, stdio: 'pipe' })
    return { passed: true }
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer }
    const output = (err.stderr?.toString() ?? '') + (err.stdout?.toString() ?? '')
    const lines = output.split('\n').filter(l => l.includes('error') || l.includes('Error')).slice(0, 5)
    return { passed: false, error: lines.join('\n') || 'Build failed' }
  }
}

export function runGitCheck(projectRoot: string): {
  uncommitted: string[]
  unpushed: number
} {
  let uncommitted: string[] = []
  let unpushed = 0

  try {
    const status = execSync('git status --short', { cwd: projectRoot }).toString()
    uncommitted = status.split('\n').filter(l => l.trim().length > 0)
  } catch { }

  try {
    const log = execSync('git log origin/main..HEAD --oneline 2>/dev/null || git log origin/master..HEAD --oneline 2>/dev/null', {
      cwd: projectRoot, shell: '/bin/sh',
    }).toString()
    unpushed = log.split('\n').filter(l => l.trim()).length
  } catch { }

  return { uncommitted, unpushed }
}

// These run as standalone checks (not file-by-file), called from engine separately
export const buildGitModule: CheckModule = {
  id: 'build-git',
  name: 'Build & Git',
  description: 'Checks build success and git cleanliness',
  supportedDirections: ['rtl', 'ltr', 'both'],

  // not used file-by-file — engine calls runBuildCheck/runGitCheck directly
  check(): [] { return [] },
}
