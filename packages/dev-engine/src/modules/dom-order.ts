import type { CheckModule, ProjectConfig, Violation } from '../types.js'

export const domOrderModule: CheckModule = {
  id: 'dom-order',
  name: 'RTL DOM Order',
  description: 'Detects wrong DOM order for RTL — icon/switch FIRST (rightmost), Dialog close at top-left (insetEnd)',
  supportedDirections: ['rtl'],

  check(filePath: string, content: string, _config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

      // Switch before Label (text then switch = wrong in RTL)
      // Pattern: <Text or string literal BEFORE <Switch in same JSX block
      if (line.includes('<Switch') && i > 0) {
        // Check 3 lines before for Text/label that shouldn't precede Switch
        const prevBlock = lines.slice(Math.max(0, i - 3), i).join('\n')
        if (
          (prevBlock.includes('<Text') || prevBlock.includes('<label')) &&
          !prevBlock.includes('<Switch') &&
          !prevBlock.includes('Switch.Root') &&
          !prevBlock.includes('Switch.Label')
        ) {
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'dom-order',
            rule: 'switch-after-label',
            message: 'Switch comes after label text in DOM — in RTL, Switch should be FIRST (rightmost)',
            severity: 'warning',
            autoFixable: false,
            fix: 'Move <Switch.Root> before <Text> in JSX',
          })
        }
      }

      // Button with text before icon (icon should be first in RTL)
      // Detect pattern: <Button>text<Icon (without icon first)
      if (/<Button[^>]*>[^<]*[א-ת؀-ۿݐ-ݿa-zA-Z]/.test(line)) {
        const buttonContent = line.match(/<Button[^>]*>(.+)/)
        if (buttonContent) {
          const inner = buttonContent[1]
          // has Persian/Arabic text AND an icon after
          if (/[؀-ۿ]/.test(inner) && /<[A-Z]/.test(inner)) {
            const textPos = inner.search(/[؀-ۿ]/)
            const iconPos = inner.search(/<[A-Z]/)
            if (textPos < iconPos) {
              violations.push({
                file: filePath,
                line: i + 1,
                module: 'dom-order',
                rule: 'button-icon-after-text',
                message: 'Icon comes AFTER text in Button — in RTL, icon should be FIRST (rightmost/start position)',
                severity: 'warning',
                autoFixable: false,
                fix: 'Move <Icon> before text content in <Button>',
              })
            }
          }
        }
      }

      // Tabs.Trigger with justifyContent="flex-end" (wrong in RTL — text goes left)
      if (line.includes('Tabs.Trigger') && /justifyContent=["'`]flex-end["'`]/.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          module: 'dom-order',
          rule: 'tabs-trigger-justify',
          message: 'Tabs.Trigger justifyContent="flex-end" puts text on LEFT in RTL — use "flex-start"',
          severity: 'error',
          autoFixable: true,
          original: 'justifyContent="flex-end"',
          replacement: 'justifyContent="flex-start"',
        })
      }

      // Dialog/Modal close button placement.
      // RTL convention: title sits at start (right), close (×) sits at the FAR
      // corner = top-LEFT = end. So close must use insetEnd, NOT insetStart/right/left.
      const isCloseEl =
        line.includes('CloseTrigger') ||
        line.includes('CloseButton') ||
        line.includes('DialogClose')
      if (isCloseEl) {
        // physical right=/left= — not logical
        if (/\b(right|left)=["'`]/.test(line)) {
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'dom-order',
            rule: 'close-button-physical-prop',
            message: 'Close button uses a physical prop (right=/left=) — use logical insetEnd= (RTL close sits top-left)',
            severity: 'warning',
            autoFixable: false,
          })
        }
        // insetStart/insetInlineStart — logical but WRONG corner (start = right in RTL).
        const startMatch = line.match(/\b(insetStart|insetInlineStart)=/)
        if (startMatch) {
          const wrong = startMatch[1]
          const right = wrong === 'insetStart' ? 'insetEnd' : 'insetInlineEnd'
          violations.push({
            file: filePath,
            line: i + 1,
            module: 'dom-order',
            rule: 'close-button-wrong-corner',
            message: `Close button uses ${wrong}= (start = right in RTL) — use ${right}= so × sits at the top-left corner (matches Dialog convention)`,
            severity: 'warning',
            autoFixable: false,
            fix: `Change ${wrong}= to ${right}= on the CloseTrigger/CloseButton`,
          })
        }
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
