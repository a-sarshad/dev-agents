import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { ProjectConfig, FigmaResolveCache, MergedResolve } from './types.js'
import { findDevKnowledge, dsFolder } from './paths.js'

const LOCAL_CACHE = '.claude/context/figma-resolve.json'

function readJSON(path: string): FigmaResolveCache | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as FigmaResolveCache
  } catch {
    return null
  }
}

// لایه DS: dev-knowledge/design-systems/<ds>/figma-resolve.json (shared)
export function dsCachePath(config: ProjectConfig): string | null {
  const dn = findDevKnowledge(config.dev_knowledge_path)
  if (!dn) return null
  return resolve(dn, 'design-systems', dsFolder(config.ds), 'figma-resolve.json')
}

// لایه Local: <project>/.claude/context/figma-resolve.json
export function localCachePath(projectRoot: string): string {
  return resolve(projectRoot, LOCAL_CACHE)
}

// هر دو لایه رو می‌خونه و merge می‌کنه — Local-first (آینه‌ی gate Component Resolution)
export function loadMergedResolve(projectRoot: string, config: ProjectConfig): MergedResolve {
  const dsPath = dsCachePath(config)
  const ds = dsPath && existsSync(dsPath) ? readJSON(dsPath) : null
  const localPath = localCachePath(projectRoot)
  const local = existsSync(localPath) ? readJSON(localPath) : null

  // local روی ds اولویت داره (spread دوم برنده‌ست)
  return {
    components: { ...(ds?.components ?? {}), ...(local?.components ?? {}) },
    tokens: { ...(ds?.tokens ?? {}), ...(local?.tokens ?? {}) },
    variables: { ...(ds?.variables ?? {}), ...(local?.variables ?? {}) },
    _synced: local?._synced ?? ds?._synced,
    _source: local?._source ?? ds?._source,
    _layers: { ds: !!ds, local: !!local },
  }
}

// یه اسم Figma → mapping کد (component یا token یا variable)، Local-first
export function resolveName(
  merged: MergedResolve,
  name: string
): { kind: 'component' | 'token' | 'variable'; value: string } | null {
  if (merged.components?.[name]) return { kind: 'component', value: merged.components[name] }
  if (merged.tokens?.[name]) return { kind: 'token', value: merged.tokens[name] }
  if (merged.variables?.[name]) return { kind: 'variable', value: merged.variables[name] }
  return null
}

// سن cache بر حسب روز (برای staleness check)
export function cacheAgeDays(merged: MergedResolve): number | null {
  if (!merged._synced) return null
  const synced = new Date(merged._synced).getTime()
  if (Number.isNaN(synced)) return null
  return Math.floor((Date.now() - synced) / 86_400_000)
}
