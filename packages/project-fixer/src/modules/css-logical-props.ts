import type { CheckModule, ProjectConfig, Violation } from '../types.js'

const PHYSICAL_TO_LOGICAL: Record<string, string> = {
  // Chakra shorthand props
  'mr=': 'me=',
  'ml=': 'ms=',
  'pr=': 'pe=',
  'pl=': 'ps=',
  'borderRight': 'borderInlineEnd',
  'borderLeft': 'borderInlineStart',
  'borderRightWidth': 'borderInlineEndWidth',
  'borderLeftWidth': 'borderInlineStartWidth',
  'borderRightColor': 'borderInlineEndColor',
  'borderLeftColor': 'borderInlineStartColor',
  'borderTopRightRadius': 'borderStartEndRadius',
  'borderTopLeftRadius': 'borderStartStartRadius',
  'borderBottomRightRadius': 'borderEndEndRadius',
  'borderBottomLeftRadius': 'borderEndStartRadius',
  'insetRight': 'insetEnd',
  'insetLeft': 'insetStart',
  // CSS-in-JS / style props
  'marginRight': 'marginInlineEnd',
  'marginLeft': 'marginInlineStart',
  'paddingRight': 'paddingInlineEnd',
  'paddingLeft': 'paddingInlineStart',
  'right:': 'insetInlineEnd:',
  'left:': 'insetInlineStart:',
  'textAlign: "right"': 'textAlign: "end"',
  'textAlign: "left"': 'textAlign: "start"',
  "textAlign: 'right'": "textAlign: 'end'",
  "textAlign: 'left'": "textAlign: 'start'",
  // inline style
  'borderBottomRightRadius:': 'borderEndEndRadius:',
  'borderBottomLeftRadius:': 'borderEndStartRadius:',
  'borderTopRightRadius:': 'borderStartEndRadius:',
  'borderTopLeftRadius:': 'borderStartStartRadius:',
}

export const cssLogicalPropsModule: CheckModule = {
  id: 'css-logical-props',
  name: 'CSS Logical Properties',
  description: 'Detects physical CSS direction props that should be logical',
  supportedDirections: ['rtl', 'ltr', 'both'],

  check(filePath: string, content: string, _config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      for (const [physical, logical] of Object.entries(PHYSICAL_TO_LOGICAL)) {
        if (!line.includes(physical)) continue

        // skip comments
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

        violations.push({
          file: filePath,
          line: i + 1,
          module: 'css-logical-props',
          rule: 'use-logical-props',
          message: `Physical prop "${physical.replace('=', '')}" — use "${logical.replace('=', '')}" instead`,
          severity: 'warning',
          autoFixable: true,
          original: physical,
          replacement: logical,
        })
      }
    }

    return violations
  },

  fix(content: string, violations: Violation[]): string {
    let fixed = content
    for (const v of violations) {
      if (!v.original || !v.replacement) continue
      fixed = fixed.replaceAll(v.original, v.replacement)
    }
    return fixed
  },
}
