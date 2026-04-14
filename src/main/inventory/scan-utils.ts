// src/main/inventory/scan-utils.ts
// Shared helpers used by multiple inventory scanners.
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs/promises'
import { contentCache } from './content-cache'

export async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(root, e.name))
  } catch {
    return []
  }
}

export async function readJson(filePath: string): Promise<unknown | null> {
  const content = await contentCache.readIfChanged(filePath)
  if (!content) return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const out: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '')
    if (key) out[key] = value
  }
  return out
}

/**
 * Walks up from `startDir` toward the filesystem root, invoking `visit` at each
 * directory. Guards against symlink loops via a visited set.
 */
export async function walkUpFromCwd(
  startDir: string,
  visit: (dir: string) => Promise<void>
): Promise<void> {
  const visited = new Set<string>()
  let current = path.resolve(startDir)
  while (!visited.has(current)) {
    visited.add(current)
    await visit(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
}

interface InstalledPluginEntry {
  scope?: string
  projectPath?: string
  installPath?: string
}

interface InstalledPluginsFile {
  plugins?: Record<string, InstalledPluginEntry[]>
}

interface SettingsFile {
  enabledPlugins?: Record<string, boolean>
}

function isWithin(child: string, parent: string): boolean {
  if (child === parent) return true
  return child.startsWith(parent + path.sep)
}

/**
 * Returns the single active install path for every plugin Claude Code would
 * load for a session at `cwd`. Reads:
 *
 *   - `~/.claude/plugins/installed_plugins.json` — which install path is the
 *     active version per plugin (other versions on disk are rollback cache).
 *   - `~/.claude/settings.json` → `enabledPlugins` — which plugins are toggled on.
 *
 * Filters local-scoped plugins to those whose `projectPath` contains `cwd`.
 * Falls back to an empty list when `installed_plugins.json` is missing or
 * malformed — we'd rather under-report than dedupe incorrectly.
 */
async function getActivePlugins(
  cwd: string
): Promise<Array<{ pluginRoot: string; pluginName: string }>> {
  const home = os.homedir()
  const installed = (await readJson(
    path.join(home, '.claude', 'plugins', 'installed_plugins.json')
  )) as InstalledPluginsFile | null
  if (!installed?.plugins) return []

  const settings = (await readJson(
    path.join(home, '.claude', 'settings.json')
  )) as SettingsFile | null
  const enabled = settings?.enabledPlugins ?? {}

  const resolvedCwd = path.resolve(cwd)
  const out: Array<{ pluginRoot: string; pluginName: string }> = []

  for (const [key, entries] of Object.entries(installed.plugins)) {
    if (enabled[key] === false) continue
    const at = key.lastIndexOf('@')
    const pluginName = at > 0 ? key.slice(0, at) : key
    for (const entry of entries ?? []) {
      if (!entry?.installPath) continue
      if (entry.scope === 'local') {
        if (!entry.projectPath) continue
        if (!isWithin(resolvedCwd, path.resolve(entry.projectPath))) continue
      }
      out.push({ pluginRoot: entry.installPath, pluginName })
    }
  }
  return out
}

/**
 * Iterates every plugin Claude Code actually loads for this session. Each
 * plugin is visited exactly once — no multi-version duplication, no
 * out-of-scope local plugins, no disabled plugins.
 */
export async function forEachPluginRoot(
  cwd: string,
  visit: (pluginRoot: string, pluginName: string) => Promise<void>
): Promise<void> {
  const plugins = await getActivePlugins(cwd)
  for (const p of plugins) {
    await visit(p.pluginRoot, p.pluginName)
  }
}
