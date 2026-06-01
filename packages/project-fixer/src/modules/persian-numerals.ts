import type { CheckModule, ProjectConfig, Violation } from '../types.js'

// Patterns that strongly suggest a display number (not technical)
const DISPLAY_NUMBER_PATTERNS = [
  // price/amount
  /\{[^}]*(price|amount|total|cost|قیمت|مبلغ|هزینه)[^}]*\}/gi,
  // count/quantity
  /\{[^}]*(count|quantity|تعداد|موجودی)[^}]*\}/gi,
  // rating
  /\{[^}]*(rating|امتیاز)[^}]*\}/gi,
  // page numbers
  /\{[^}]*(page|صفحه)[^}]*\}/gi,
]

// Patterns that suggest technical IDs (should NOT be converted)
const TECHNICAL_ID_PATTERNS = [
  /id\s*[=:]/i,
  /sku\s*[=:]/i,
  /code\s*[=:]/i,
  /key\s*[=:]/i,
  /hash\s*[=:]/i,
  /token\s*[=:]/i,
  /\burl\b/i,
  /\bpath\b/i,
]

// Already using locale → skip
const ALREADY_LOCALIZED = [
  'toLocaleString',
  'toLocaleDateString',
  'Intl.NumberFormat',
  'fa-IR',
  'ar-SA',
  'ar-EG',
]

// Hardcoded Persian numerals in strings (common mistake)
const LATIN_IN_PERSIAN_STRING = /["'][^"']*\d{2,}[^"']*["']/

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

      // skip comments, imports, type declarations
      const trimmed = line.trim()
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('import') ||
        trimmed.startsWith('export type') ||
        trimmed.startsWith('interface') ||
        trimmed.startsWith('type ')
      ) continue

      // skip if already localized in this line
      if (ALREADY_LOCALIZED.some(p => line.includes(p))) continue

      // skip technical ID patterns
      if (TECHNICAL_ID_PATTERNS.some(p => p.test(line))) continue

      // check display number patterns
      for (const pattern of DISPLAY_NUMBER_PATTERNS) {
        pattern.lastIndex = 0
        const match = pattern.exec(line)
        if (!match) continue

        violations.push({
          file: filePath,
          line: i + 1,
          module: 'persian-numerals',
          rule: 'use-locale-number',
          message: `Number "${match[0].trim()}" displayed without fa-IR locale — wrap with .toLocaleString('fa-IR')`,
          severity: 'warning',
          autoFixable: false,
          fix: `{value.toLocaleString('${config.locale}')}`,
        })
      }

      // detect hardcoded Latin numbers inside Persian text strings
      if (LATIN_IN_PERSIAN_STRING.test(line)) {
        const hasPersianChar = /[؀-ۿ]/.test(line)
        if (hasPersianChar) {
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'persian-numerals',
            rule: 'latin-in-persian-string',
            message: 'Latin digits inside Persian string — use Persian numerals (۰-۹) or toLocaleString',
            severity: 'info',
            autoFixable: false,
          })
        }
      }
    }

    return violations
  },
}
