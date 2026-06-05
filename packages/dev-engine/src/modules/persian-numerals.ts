import type { CheckModule, ProjectConfig, Violation } from '../types.js'

// Keywords that suggest a display number variable
const DISPLAY_KEYWORDS = [
  'price', 'amount', 'total', 'cost', 'count', 'quantity',
  'rating', 'score', 'balance', 'fee', 'tax', 'discount',
  'قیمت', 'مبلغ', 'هزینه', 'تعداد', 'موجودی', 'امتیاز',
]

// Already using locale → skip line
const ALREADY_LOCALIZED = [
  'toLocaleString', 'toLocaleDateString', 'Intl.NumberFormat',
  'fa-IR', 'ar-SA', 'ar-EG', 'formatNumber', 'formatPrice',
]

// Simple JSX expression: {someVar} or {obj.prop} or {fn(arg)}
// NOT object literals (those have : and , inside)
// NOT JSX comments {/* ... */}
const SIMPLE_JSX_EXPR = /\{(?!\s*\/\*)([a-zA-Z_$][a-zA-Z0-9_.()[\]'"]*)\}/g

// A single- or double-quoted string literal; group 2 = inner text.
const STRING_LITERAL = /(["'])((?:(?!\1).)*)\1/g

function isObjectLiteral(line: string): boolean {
  // line has { key: value } pattern → data definition, not display
  return /\{\s*\w+\s*:/.test(line)
}

function isInsideComment(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.includes('{/*')
  )
}

function isDataLine(line: string): boolean {
  // mock data, useState init, object assignment
  return (
    /const\s+\w+\s*=\s*\[/.test(line) ||   // const x = [
    /const\s+\w+\s*=\s*\{/.test(line) ||   // const x = {
    /useState\(/.test(line) ||               // useState({...})
    /:\s*['"]/.test(line) ||                 // key: 'value'
    isObjectLiteral(line)
  )
}

export const persianNumeralsModule: CheckModule = {
  id: 'persian-numerals',
  name: 'Persian Numerals',
  description: 'Detects display numbers not formatted with fa-IR locale',
  supportedDirections: ['rtl'],

  check(filePath: string, content: string, config: ProjectConfig): Violation[] {
    if (config.locale !== 'fa-IR' && config.locale !== 'ar-SA' && config.locale !== 'ar-EG') {
      return []
    }

    const violations: Violation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (isInsideComment(line)) continue
      if (isDataLine(line)) continue
      if (ALREADY_LOCALIZED.some(p => line.includes(p))) continue

      // skip imports / type lines
      const trimmed = line.trim()
      if (
        trimmed.startsWith('import') ||
        trimmed.startsWith('export type') ||
        trimmed.startsWith('interface') ||
        trimmed.startsWith('type ')
      ) continue

      // only flag simple {expr} in JSX that contain display keywords
      SIMPLE_JSX_EXPR.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = SIMPLE_JSX_EXPR.exec(line)) !== null) {
        const expr = match[1]
        const exprLower = expr.toLowerCase()

        // skip prop position: someprop={expr} — not a text child
        const matchIndex = match.index
        const charBefore = line[matchIndex - 1]
        if (charBefore === '=') continue

        // skip setter functions: setXxx
        if (/^set[A-Z]/.test(expr)) continue

        // skip React key props and non-display suffixes
        if (/Key$|Ref$|Id$|Type$|Label$|Text$|Class$/.test(expr)) continue

        // skip if variable definition on same/nearby line uses toLocaleString or formatPrice
        const hasDisplayKeyword = DISPLAY_KEYWORDS.some(kw => exprLower.includes(kw.toLowerCase()))
        if (!hasDisplayKeyword) continue

        violations.push({
          file: filePath,
          line: i + 1,
          module: 'persian-numerals',
          rule: 'use-locale-number',
          message: `{${match[1]}} — number display without fa-IR locale. Use: {${match[1]}.toLocaleString('${config.locale}')}`,
          severity: 'warning',
          autoFixable: false,
        })
      }

      // detect hardcoded Latin numbers inside Persian UI strings.
      // Check each string literal in isolation — a digit and a Persian char must
      // co-occur INSIDE the same quoted string. Avoids false positives where a
      // Chakra scale prop (h="12") shares a line with an unrelated Persian
      // comment (/* ارتفاع 48px */), which the old line-level test mis-flagged.
      STRING_LITERAL.lastIndex = 0
      let strMatch: RegExpExecArray | null
      while ((strMatch = STRING_LITERAL.exec(line)) !== null) {
        const str = strMatch[2]
        if (/\d{2,}/.test(str) && /[؀-ۿ]/.test(str)) {
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'persian-numerals',
            rule: 'latin-in-persian-string',
            message: 'Latin digits inside Persian string — use Persian numerals (۰-۹) or toLocaleString',
            severity: 'info',
            autoFixable: false,
          })
          break
        }
      }
    }

    return violations
  },
}
