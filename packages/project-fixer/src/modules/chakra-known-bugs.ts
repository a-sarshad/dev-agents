import type { CheckModule, ProjectConfig, Violation } from '../types.js'

export const chakraKnownBugsModule: CheckModule = {
  id: 'chakra-known-bugs',
  name: 'Chakra UI Known Bugs',
  description: 'Detects usage of known broken Chakra v3 patterns',
  supportedDirections: ['rtl', 'ltr', 'both'],
  supportedDS: ['chakra-v3'],

  check(filePath: string, content: string, _config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

      // lineHeight="8" (resolves to 8× font-size = broken)
      if (/lineHeight=["'`]8["'`]/.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'chakra-known-bugs',
          rule: 'lineheight-8-broken',
          message: 'lineHeight="8" resolves to unitless CSS (8× font-size) — use ratio like "1.333" instead',
          severity: 'error',
          autoFixable: false,
          fix: 'lineHeight="1.333" (for 2xl) or lineHeight="1.14" (for 3xl)',
        })
      }

      // bg="bg.default" (resolves to transparent — broken)
      if (/bg=["'`]bg\.default["'`]/.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'chakra-known-bugs',
          rule: 'bg-default-broken',
          message: 'bg="bg.default" resolves to transparent — use bg="bg" or bg="white"',
          severity: 'error',
          autoFixable: true,
          original: 'bg="bg.default"',
          replacement: 'bg="bg"',
        })
      }

      // useColorMode from chakra (doesn't exist in v3)
      if (line.includes('useColorMode') && line.includes('@chakra-ui')) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'chakra-known-bugs',
          rule: 'use-color-mode-chakra',
          message: 'useColorMode does not exist in Chakra v3 — import from @/contexts/ColorModeContext',
          severity: 'error',
          autoFixable: false,
        })
      }

      // SegmentGroup.Indicator bg="white" (breaks dark mode)
      if (line.includes('SegmentGroup') && line.includes('Indicator') && /bg=["'`]white["'`]/.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'chakra-known-bugs',
          rule: 'segment-indicator-bg',
          message: 'SegmentGroup.Indicator bg="white" breaks dark mode — use bg="bg.panel"',
          severity: 'error',
          autoFixable: true,
          original: 'bg="white"',
          replacement: 'bg="bg.panel"',
        })
      }

      // sx with nested selectors (not injected in Chakra v3)
      if (line.includes('sx=') || line.includes("sx={{")) {
        const nextLines = lines.slice(i, i + 10).join('\n')
        if (nextLines.includes("'& ") || nextLines.includes('"& ') || nextLines.includes('&:')) {
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'chakra-known-bugs',
            rule: 'sx-nested-not-injected',
            message: 'sx nested selectors (& .child, &:focus) are NOT injected in Chakra v3 — use _focusWithin prop or Global from @emotion/react',
            severity: 'error',
            autoFixable: false,
          })
        }
      }

      // Avatar.Root with asChild (do not forward refs)
      if (line.includes('Avatar.Root') && line.includes('asChild')) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'chakra-known-bugs',
          rule: 'avatar-aschild',
          message: 'Avatar.Root does not forward refs for asChild — wrap with <Box as="button"> first',
          severity: 'error',
          autoFixable: false,
        })
      }

      // hardcoded hex color
      const hexMatch = line.match(/#[0-9a-fA-F]{3,8}(?![^"'`]*import)/)
      if (hexMatch && !line.includes('//')) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'chakra-known-bugs',
          rule: 'no-hardcoded-color',
          message: `Hardcoded color "${hexMatch[0]}" — use design token instead`,
          severity: 'warning',
          autoFixable: false,
        })
      }
    }

    return violations
  },

  fix(content: string, violations: Violation[]): string {
    let fixed = content
    for (const v of violations) {
      if (!v.autoFixable || !v.original || !v.replacement) continue
      fixed = fixed.replaceAll(v.original, v.replacement)
    }
    return fixed
  },
}
