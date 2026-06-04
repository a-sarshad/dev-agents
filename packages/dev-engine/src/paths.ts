import { existsSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import { globSync } from 'glob'

// config DS id → نام پوشه در dev-knowledge/design-systems/
const DS_FOLDER: Record<string, string> = {
  'chakra-v3': 'chakra-ui-v3',
  'chakra-v2': 'chakra-ui-v3',
  'mui': 'mui',
  'antd': 'antd',
  'mantine': 'mantine',
  'generic': 'generic',
}

export function dsFolder(ds: string): string {
  return DS_FOLDER[ds] ?? ds
}

// config DS id → نام package برای چک نصب
const DS_PACKAGE: Record<string, string> = {
  'chakra-v3': '@chakra-ui/react',
  'chakra-v2': '@chakra-ui/react',
  'mui': '@mui/material',
  'antd': 'antd',
  'mantine': '@mantine/core',
}

export function dsPackage(ds: string): string | null {
  return DS_PACKAGE[ds] ?? null
}

// محل dev-knowledge: env DN_PATH > config > مسیرهای رایج (local Mac یا Cowork mount)
export function findDevKnowledge(configPath?: string): string | null {
  const candidates: string[] = []
  if (process.env.DN_PATH) candidates.push(process.env.DN_PATH)
  if (configPath) candidates.push(configPath)
  candidates.push(resolve(homedir(), 'Documents/GitHub/Tools/dev-knowledge'))
  try {
    candidates.push(...globSync('/sessions/*/mnt/dev-knowledge'))
  } catch { /* /sessions نیست — local */ }
  return candidates.find(p => existsSync(p)) ?? null
}
