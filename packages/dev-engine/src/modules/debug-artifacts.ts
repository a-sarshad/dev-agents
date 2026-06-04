import type { CheckModule, ProjectConfig, Violation } from '../types.js'

const DEBUG_PATTERNS: Array<{ pattern: RegExp; rule: string; message: string; severity: 'error' | 'warning' }> = [
  {
    pattern: /console\.(log|warn|error|info|debug|table|dir)\s*\(/,
    rule: 'console-log',
    message: 'console statement left in production code',
    severity: 'error',
  },
  {
    pattern: /\bdebugger\b/,
    rule: 'debugger-statement',
    message: 'debugger statement left in code',
    severity: 'error',
  },
  {
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b/i,
    rule: 'todo-comment',
    message: 'Unresolved TODO/FIXME comment',
    severity: 'warning',
  },
]

export const debugArtifactsModule: CheckModule = {
  id: 'debug-artifacts',
  name: 'Debug Artifacts',
  description: 'Detects console.log, debugger, TODO/FIXME left in code',
  supportedDirections: ['rtl', 'ltr', 'both'],

  check(filePath: string, content: string, _config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // skip full-line comments (only flag actual code)
      const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')

      for (const { pattern, rule, message, severity } of DEBUG_PATTERNS) {
        // allow TODO in comments (that's normal), but flag console/debugger even in comments? No — skip all in comments
        if (isComment && rule === 'todo-comment') {
          // TODO in comments IS what we want to find
        } else if (isComment) {
          continue
        }

        pattern.lastIndex = 0
        if (!pattern.test(line)) continue

        violations.push({
          file: filePath,
          line: i + 1,
          module: 'debug-artifacts',
          rule,
          message,
          severity,
          autoFixable: false,
        })
      }
    }

    return violations
  },
}
