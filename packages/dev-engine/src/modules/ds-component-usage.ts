import type { CheckModule, DesignSystem, ProjectConfig, Violation } from '../types.js'

interface NativeCheck {
  pattern: RegExp
  rule: string
  message: string
  severity: 'error' | 'warning'
  fix: string
}

const CHAKRA_V3_CHECKS: NativeCheck[] = [
  {
    pattern: /<NativeSelect/,
    rule: 'native-select',
    message: 'NativeSelect is banned — use Chakra Select (namespace pattern) instead',
    severity: 'error',
    fix: '<Select.Root> / <Select.Trigger> / <Select.Content>',
  },
  {
    pattern: /<select[\s>/]/,
    rule: 'raw-select',
    message: 'Raw <select> — use Chakra Select component',
    severity: 'error',
    fix: '<Select.Root> / <Select.Trigger> / <Select.Content>',
  },
  {
    pattern: /as=["'`]select["'`]/,
    rule: 'box-as-select',
    message: 'Box/Flex as="select" — use Chakra Select component',
    severity: 'error',
    fix: '<Select.Root>',
  },
  {
    pattern: /<table[\s>/]/,
    rule: 'raw-table',
    message: 'Raw <table> — use Chakra Table component',
    severity: 'warning',
    fix: '<Table.Root> / <Table.Header> / <Table.Body> / <Table.Row> / <Table.Cell>',
  },
  {
    pattern: /<progress[\s>/]/,
    rule: 'raw-progress',
    message: 'Raw <progress> — use Chakra Progress component',
    severity: 'warning',
    fix: '<Progress.Root> / <Progress.Track> / <Progress.Range>',
  },
]

const DS_CHECKS: Record<DesignSystem, NativeCheck[]> = {
  'chakra-v3': CHAKRA_V3_CHECKS,
  'chakra-v2': [],
  'mui': [],
  'antd': [],
  'mantine': [],
  'generic': [],
}

export const dsComponentUsageModule: CheckModule = {
  id: 'ds-component-usage',
  name: 'DS Component Usage',
  description: 'Detects raw HTML elements that should use design system components instead',
  supportedDirections: ['rtl', 'ltr', 'both'],

  check(filePath: string, content: string, config: ProjectConfig): Violation[] {
    const violations: Violation[] = []
    const checks = DS_CHECKS[config.ds] ?? []
    if (checks.length === 0) return violations

    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // skip comments and type annotation lines
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('{/*')
      ) continue

      // skip lines that are clearly inside string literals (import paths, template strings with HTML)
      if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) continue

      for (const check of checks) {
        if (!check.pattern.test(line)) continue

        // extra skip: NativeSelect in import paths (e.g. import ... from '@chakra-ui/react')
        if (check.rule === 'native-select' && line.trim().startsWith('import')) continue

        violations.push({
          file: filePath,
          line: i + 1,
          module: 'ds-component-usage',
          rule: check.rule,
          message: check.message,
          severity: check.severity,
          autoFixable: false,
          fix: check.fix,
        })
      }
    }

    return violations
  },
}
