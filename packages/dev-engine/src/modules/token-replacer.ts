import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { CheckModule, ProjectConfig, Violation } from '../types.js'

interface TokenMap {
  colors?: Record<string, string>
  spacing?: Record<string, string>
  fontSize?: Record<string, string>
  fontWeight?: Record<string, string>
  borderRadius?: Record<string, string>
}

function loadTokenMap(projectRoot: string, ds: string): TokenMap {
  // 1. project-level override
  const projectMap = resolve(projectRoot, 'token-map.json')
  if (existsSync(projectMap)) {
    return JSON.parse(readFileSync(projectMap, 'utf-8')) as TokenMap
  }

  // 2. bundled template for DS
  const templateDir = new URL('../../templates/', import.meta.url).pathname
  const templateMap = resolve(templateDir, `token-map.${ds}.json`)
  if (existsSync(templateMap)) {
    return JSON.parse(readFileSync(templateMap, 'utf-8')) as TokenMap
  }

  return {}
}

// Patterns that indicate a hardcoded value in JSX/TSX prop or style
const HEX_IN_PROP = /#([0-9a-fA-F]{3,8})\b/g
const PX_FONTSIZE = /fontSize[=: ]["'`](\d+px)["'`]/g
const PX_FONTWEIGHT = /fontWeight[=: ]["'`]?(\d+)["'`]?/g
const PX_BORDER_RADIUS = /borderRadius[=: ]["'`](\d+px)["'`]/g
const STYLE_SPACING = /(?:margin|padding|gap|top|bottom|left|right)[A-Za-z]*[=: ]["'`](\d+px)["'`]/g
// Chakra spacing shorthand props (p, px, py, pt, pr, pb, pl, ps, pe, m, mx, …)
// with a hardcoded px value. Full words are handled by STYLE_SPACING above.
const CHAKRA_SPACING_PROP = /\b(p[xytrblse]?|m[xytrblse]?)[=:]\s*["'`](\d+px)["'`]/g

function isSkippableLine(line: string): boolean {
  const t = line.trim()
  return (
    t.startsWith('//') ||
    t.startsWith('*') ||
    t.startsWith('import') ||
    line.includes('{/*') ||
    // SVG / color data
    line.includes('<svg') || line.includes('<rect') || line.includes('fill=') ||
    line.includes('var(--') ||
    (line.match(/#[0-9a-fA-F]{3,8}/g) ?? []).length >= 3 ||
    /makeThemeSvg|PALETTE_ROWS|colorData/.test(line) ||
    // const/let/var assignment — defining a color constant (intentional)
    /(?:const|let|var)\s+\w+\s*=\s*['"]#/.test(line)
  )
}

export function createTokenReplacerModule(projectRoot: string): CheckModule {
  const tokenMap = loadTokenMap(projectRoot, 'chakra-v3')

  return {
    id: 'token-replacer',
    name: 'Token Replacer',
    description: 'Detects hardcoded values (color/spacing/font) and replaces with design tokens',
    supportedDirections: ['rtl', 'ltr', 'both'],

    check(filePath: string, content: string, _config: ProjectConfig): Violation[] {
      const violations: Violation[] = []
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (isSkippableLine(line)) continue

        // ── Color ──────────────────────────────────────────────
        HEX_IN_PROP.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = HEX_IN_PROP.exec(line)) !== null) {
          const hex = m[0].toLowerCase()
          const token = tokenMap.colors?.[hex] ?? tokenMap.colors?.[hex.toUpperCase()]
          if (!token) continue

          violations.push({
            file: filePath, line: i + 1,
            module: 'token-replacer', rule: 'hardcoded-color',
            message: `${hex} → "${token}"`,
            severity: 'warning', autoFixable: true,
            original: m[0], replacement: token,
          })
        }

        // ── Font Size ───────────────────────────────────────────
        PX_FONTSIZE.lastIndex = 0
        while ((m = PX_FONTSIZE.exec(line)) !== null) {
          const px = m[1]
          const token = tokenMap.fontSize?.[px]
          if (!token) continue
          violations.push({
            file: filePath, line: i + 1,
            module: 'token-replacer', rule: 'hardcoded-font-size',
            message: `fontSize="${px}" → fontSize="${token}"`,
            severity: 'warning', autoFixable: true,
            original: `"${px}"`, replacement: `"${token}"`,
          })
        }

        // ── Font Weight ─────────────────────────────────────────
        PX_FONTWEIGHT.lastIndex = 0
        while ((m = PX_FONTWEIGHT.exec(line)) !== null) {
          const val = m[1]
          const token = tokenMap.fontWeight?.[val]
          if (!token) continue
          // skip if it looks like a number being used as a value (e.g. flex={1})
          if (line.includes(`flex={${val}}`)) continue
          violations.push({
            file: filePath, line: i + 1,
            module: 'token-replacer', rule: 'hardcoded-font-weight',
            message: `fontWeight=${val} → fontWeight="${token}"`,
            severity: 'warning', autoFixable: false,
          })
        }

        // ── Border Radius ───────────────────────────────────────
        PX_BORDER_RADIUS.lastIndex = 0
        while ((m = PX_BORDER_RADIUS.exec(line)) !== null) {
          const px = m[1]
          const token = tokenMap.borderRadius?.[px]
          if (!token) continue
          violations.push({
            file: filePath, line: i + 1,
            module: 'token-replacer', rule: 'hardcoded-border-radius',
            message: `borderRadius="${px}" → borderRadius="${token}"`,
            severity: 'warning', autoFixable: true,
            original: `"${px}"`, replacement: `"${token}"`,
          })
        }

        // ── Inline style spacing ────────────────────────────────
        STYLE_SPACING.lastIndex = 0
        while ((m = STYLE_SPACING.exec(line)) !== null) {
          const px = m[1]
          const token = tokenMap.spacing?.[px]
          if (!token) continue
          violations.push({
            file: filePath, line: i + 1,
            module: 'token-replacer', rule: 'hardcoded-spacing',
            message: `spacing "${px}" → token "${token}" (use Chakra prop instead of inline style)`,
            severity: 'info', autoFixable: false,
          })
        }

        // ── Chakra spacing shorthand (p/m/mt/...) ───────────────
        CHAKRA_SPACING_PROP.lastIndex = 0
        while ((m = CHAKRA_SPACING_PROP.exec(line)) !== null) {
          const px = m[2]
          const token = tokenMap.spacing?.[px]
          if (!token) continue
          violations.push({
            file: filePath, line: i + 1,
            module: 'token-replacer', rule: 'hardcoded-spacing',
            message: `${m[1]}="${px}" → ${m[1]}="${token}"`,
            severity: 'warning', autoFixable: true,
            original: m[0], replacement: m[0].replace(px, token),
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
}
