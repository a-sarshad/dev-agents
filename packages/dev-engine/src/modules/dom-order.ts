import type { CheckModule, ProjectConfig, Violation } from '../types.js'

// Find every <Button …>…</Button> block via a brace/quote-aware scan of the opening tag,
// so arrow fns (onClick={() => …}) and multi-line props don't break detection.
// Returns the children (inner) of each non-self-closing Button plus its start offset.
function findButtonBlocks(content: string): { inner: string; index: number }[] {
  const out: { inner: string; index: number }[] = []
  let idx = 0
  while ((idx = content.indexOf('<Button', idx)) !== -1) {
    const after = content[idx + 7]
    // skip <ButtonGroup, <ButtonX… (only a real <Button followed by space/>/newline/self-close)
    if (after && /[A-Za-z]/.test(after)) { idx += 7; continue }

    // walk to the '>' that closes the opening tag, tracking {…} depth and quotes
    let i = idx + 7
    let depth = 0
    let quote = ''
    for (; i < content.length; i++) {
      const c = content[i]
      if (quote) { if (c === quote) quote = ''; continue }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    const openEnd = i
    if (openEnd >= content.length) break
    // self-closing <Button … /> → no children
    if (content[openEnd - 1] === '/') { idx = openEnd + 1; continue }

    const closeIdx = content.indexOf('</Button>', openEnd)
    if (closeIdx === -1) { idx = openEnd + 1; continue }

    out.push({ inner: content.slice(openEnd + 1, closeIdx), index: idx })
    idx = closeIdx + 9
  }
  return out
}

export const domOrderModule: CheckModule = {
  id: 'dom-order',
  name: 'DOM Order',
  description: 'Button icon FIRST (leading) in both RTL/LTR; RTL extras — Switch first, Dialog close top-left (insetEnd)',
  supportedDirections: ['rtl', 'ltr', 'both'],

  check(filePath: string, content: string, config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const lines = content.split('\n')
    const isRtl = config.direction !== 'ltr' // rtl + both

    // ── RTL-only per-line checks ──────────────────────────────────────────
    if (isRtl) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue

        // Switch before Label (text then switch = wrong in RTL)
        if (line.includes('<Switch') && i > 0) {
          const prevBlock = lines.slice(Math.max(0, i - 3), i).join('\n')
          if (
            (prevBlock.includes('<Text') || prevBlock.includes('<label')) &&
            !prevBlock.includes('<Switch') &&
            !prevBlock.includes('Switch.Root') &&
            !prevBlock.includes('Switch.Label')
          ) {
            violations.push({
              file: filePath, line: i + 1,
              module: 'dom-order', rule: 'switch-after-label',
              message: 'Switch comes after label text in DOM — in RTL, Switch should be FIRST (rightmost)',
              severity: 'warning', autoFixable: false,
              fix: 'Move <Switch.Root> before <Text> in JSX',
            })
          }
        }

        // Tabs.Trigger with justifyContent="flex-end" (wrong in RTL — text goes left)
        if (line.includes('Tabs.Trigger') && /justifyContent=["'`]flex-end["'`]/.test(line)) {
          violations.push({
            file: filePath, line: i + 1,
            module: 'dom-order', rule: 'tabs-trigger-justify',
            message: 'Tabs.Trigger justifyContent="flex-end" puts text on LEFT in RTL — use "flex-start"',
            severity: 'error', autoFixable: true,
            original: 'justifyContent="flex-end"', replacement: 'justifyContent="flex-start"',
          })
        }

        // Dialog/Modal close button: RTL convention → close (×) at top-LEFT = end (insetEnd).
        const isCloseEl =
          line.includes('CloseTrigger') || line.includes('CloseButton') || line.includes('DialogClose')
        if (isCloseEl) {
          if (/\b(right|left)=["'`]/.test(line)) {
            violations.push({
              file: filePath, line: i + 1,
              module: 'dom-order', rule: 'close-button-physical-prop',
              message: 'Close button uses a physical prop (right=/left=) — use logical insetEnd= (RTL close sits top-left)',
              severity: 'warning', autoFixable: false,
            })
          }
          const startMatch = line.match(/\b(insetStart|insetInlineStart)=/)
          if (startMatch) {
            const wrong = startMatch[1]
            const right = wrong === 'insetStart' ? 'insetEnd' : 'insetInlineEnd'
            violations.push({
              file: filePath, line: i + 1,
              module: 'dom-order', rule: 'close-button-wrong-corner',
              message: `Close button uses ${wrong}= (start = right in RTL) — use ${right}= so × sits at the top-left corner`,
              severity: 'warning', autoFixable: false,
              fix: `Change ${wrong}= to ${right}= on the CloseTrigger/CloseButton`,
            })
          }
        }
      }
    }

    // ── Button icon-first (LEADING) — direction-agnostic ──────────────────
    // Default convention (RTL & LTR): icon is FIRST in DOM = leading/start side
    // (RTL → right of text, LTR → left of text). The DOM order is the same for both;
    // `dir` flips the visual side. Flag a label that appears BEFORE the first icon.
    // Not flagged: icon-only, text-only, icon-first, or icon on BOTH sides (icon already leads).
    const side = isRtl ? 'right' : 'left'
    for (const { inner: raw, index } of findButtonBlocks(content)) {
      const inner = raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // strip JSX comments
      const firstTag = inner.search(/</)
      const beforeTag = firstTag === -1 ? inner : inner.slice(0, firstTag)
      const hasLabelBeforeTag = /[A-Za-z؀-ۿ]/.test(beforeTag) // Latin or Persian/Arabic label
      const hasIcon = /<[A-Z][A-Za-z]/.test(inner)            // a component (icon) child
      if (hasLabelBeforeTag && hasIcon) {
        const lineNo = content.slice(0, index).split('\n').length
        violations.push({
          file: filePath, line: lineNo,
          module: 'dom-order', rule: 'button-icon-after-text',
          message: `Icon comes AFTER label in Button — icon should be FIRST in DOM (leading; ${side} of text in ${isRtl ? 'RTL' : 'LTR'}). Override only for an intentional trailing icon.`,
          severity: 'warning', autoFixable: false,
          fix: 'Move the icon before the label text in <Button>',
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
