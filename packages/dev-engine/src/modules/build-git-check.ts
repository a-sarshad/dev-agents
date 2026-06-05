import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import type { CheckModule, CheckResult, ProjectConfig } from '../types.js'

// Pick the package manager from the project's lockfile, not from what happens
// to be installed globally — otherwise a globally-installed pnpm runs
// `pnpm run build` against an npm project and reports a phantom build failure.
function detectPackageManager(projectRoot: string): 'pnpm' | 'yarn' | 'npm' {
  if (existsSync(resolve(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(projectRoot, 'yarn.lock'))) return 'yarn'
  if (existsSync(resolve(projectRoot, 'package-lock.json'))) return 'npm'
  // no lockfile → fall back to whatever is installed
  try { execSync('pnpm --version', { cwd: projectRoot, stdio: 'pipe' }); return 'pnpm' } catch { }
  try { execSync('yarn --version', { cwd: projectRoot, stdio: 'pipe' }); return 'yarn' } catch { }
  return 'npm'
}

export function runBuildCheck(projectRoot: string, buildCommand?: string): { passed: boolean; error?: string } {
  try {
    const cmd = buildCommand?.trim()
      ? buildCommand
      : `${detectPackageManager(projectRoot)} run build`

    execSync(cmd, { cwd: projectRoot, stdio: 'pipe' })
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

export function runHandoffCheck(projectRoot: string): { stale: boolean; commitsBehind: number } {
  try {
    const lastHandoff = execSync(
      'git log --oneline -1 -- HANDOFF.md 2>/dev/null',
      { cwd: projectRoot, shell: '/bin/sh' }
    ).toString().trim()

    if (!lastHandoff) return { stale: false, commitsBehind: 0 }

    const hash = lastHandoff.split(' ')[0]
    const behind = execSync(
      `git log ${hash}..HEAD --oneline 2>/dev/null`,
      { cwd: projectRoot, shell: '/bin/sh' }
    ).toString().trim()

    const count = behind ? behind.split('\n').filter(l => l.trim()).length : 0
    return { stale: count > 3, commitsBehind: count }
  } catch {
    return { stale: false, commitsBehind: 0 }
  }
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
