import type { CheckModule, ProjectConfig, Violation } from '../types.js'

// Contexts that imply "forward/next" → ChevronRight is WRONG in RTL (should be ChevronLeft)
const FORWARD_CONTEXTS = [
  'next', 'forward', 'nextPage', 'goNext', 'breadcrumb', 'crumb',
  'carousel', 'slider', 'pagination', '"بعدی"', "'بعدی'",
  'NavigateNext', 'ArrowForward',
]

// Contexts that imply "back/prev" → ChevronLeft is WRONG in RTL (should be ChevronRight)
const BACK_CONTEXTS = [
  'prev', 'back', 'previous', 'prevPage', 'goPrev', 'goBack',
  '"قبلی"', "'قبلی'", 'NavigateBefore', 'ArrowBack',
]

// Icon names per library that indicate horizontal direction
const ICON_PATTERNS: Record<string, { right: string[]; left: string[] }> = {
  lucide: {
    right: ['ChevronRight', 'ArrowRight', 'MoveRight', 'ChevronsRight'],
    left: ['ChevronLeft', 'ArrowLeft', 'MoveLeft', 'ChevronsLeft'],
  },
  heroicons: {
    right: ['ChevronRightIcon', 'ArrowRightIcon'],
    left: ['ChevronLeftIcon', 'ArrowLeftIcon'],
  },
  fa: {
    right: ['FaChevronRight', 'FaArrowRight', 'FaAngleRight'],
    left: ['FaChevronLeft', 'FaArrowLeft', 'FaAngleLeft'],
  },
  mdi: {
    right: ['mdiChevronRight', 'mdiArrowRight'],
    left: ['mdiChevronLeft', 'mdiArrowLeft'],
  },
  generic: {
    right: ['ChevronRight', 'ArrowRight'],
    left: ['ChevronLeft', 'ArrowLeft'],
  },
}

// Breadcrumb separator patterns — always wrong if ChevronRight in RTL
const BREADCRUMB_PATTERNS = [
  /Breadcrumb/i,
  /breadcrumb/,
  /crumb/i,
  /separator/i,
]

function getWindowLines(lines: string[], index: number, window = 5): string {
  const start = Math.max(0, index - window)
  const end = Math.min(lines.length - 1, index + window)
  return lines.slice(start, end + 1).join('\n')
}

export const iconDirectionModule: CheckModule = {
  id: 'icon-direction',
  name: 'Icon Direction',
  description: 'Detects directional icons used incorrectly in RTL context',
  supportedDirections: ['rtl'],

  check(filePath: string, content: string, config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const lines = content.split('\n')
    const iconLib = ICON_PATTERNS[config.icon_lib] ?? ICON_PATTERNS.generic

    // skip files explicitly verified by user
    const ignoreFiles: string[] = (config as unknown as Record<string, string[]>)['ignore_icon_direction_files'] ?? []
    if (ignoreFiles.some(f => filePath.includes(f))) return []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const context = getWindowLines(lines, i)

      // skip comments
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

      // Check ChevronRight used in forward/next context → should be ChevronLeft in RTL
      for (const icon of iconLib.right) {
        if (!line.includes(icon)) continue

        // Breadcrumb separator — flag in RTL (NOT auto-fixable — context determines correct icon)
        const isBreadcrumb = BREADCRUMB_PATTERNS.some(p => p.test(context))
        if (isBreadcrumb) {
          const opposite = icon.replace('Right', 'Left')
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'icon-direction',
            rule: 'breadcrumb-separator-rtl',
            message: `${icon} near breadcrumb/separator context in RTL — verify direction (separator→${opposite}, back-button→${icon})`,
            severity: 'warning',
            autoFixable: false,
          })
          continue
        }

        // Forward context
        const isForward = FORWARD_CONTEXTS.some(ctx => context.includes(ctx))
        if (isForward) {
          const opposite = icon.replace('Right', 'Left')
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'icon-direction',
            rule: 'forward-icon-rtl',
            message: `${icon} used in "next/forward" context in RTL — should be ${opposite}`,
            severity: 'warning',
            autoFixable: false,
            original: icon,
            replacement: opposite,
          })
        }
      }

      // Check ChevronLeft used in back/prev context → should be ChevronRight in RTL
      for (const icon of iconLib.left) {
        if (!line.includes(icon)) continue

        const isBack = BACK_CONTEXTS.some(ctx => context.includes(ctx))
        if (isBack) {
          const opposite = icon.replace('Left', 'Right')
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'icon-direction',
            rule: 'back-icon-rtl',
            message: `${icon} used in "back/prev" context in RTL — should be ${opposite}`,
            severity: 'warning',
            autoFixable: false,
            original: icon,
            replacement: opposite,
          })
        }
      }

      // scaleX(-1) antipattern for icon flipping
      if (line.includes('scaleX(-1)')) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'icon-direction',
          rule: 'no-scalex-flip',
          message: 'scaleX(-1) used to flip icon — use the correct directional icon instead',
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
