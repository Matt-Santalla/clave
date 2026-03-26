import { execFile } from 'child_process'
import { existsSync, watchFile, unwatchFile, type Stats } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { BrowserWindow } from 'electron'
import { getLoginShellEnv } from './pty-manager'

// --- Session tracking ---

interface SessionEntry {
  cwd: string
  claudeSessionId: string
  win: BrowserWindow
  jsonlPath: string
  titleDone: boolean
  planDetected: boolean
}

const sessions = new Map<string, SessionEntry>()

// --- Helpers (shared) ---

function getJsonlPath(cwd: string, claudeSessionId: string): string {
  const projectDir = cwd.replace(/[/.]/g, '-')
  return join(homedir(), '.claude', 'projects', projectDir, `${claudeSessionId}.jsonl`)
}

// --- Public API ---

export function scheduleTitleGeneration(
  sessionId: string,
  cwd: string,
  claudeSessionId: string,
  win: BrowserWindow
): void {
  const jsonlPath = getJsonlPath(cwd, claudeSessionId)
  const entry: SessionEntry = {
    cwd, claudeSessionId, win, jsonlPath,
    titleDone: false, planDetected: false
  }
  sessions.set(sessionId, entry)

  let lastSize = 0
  watchFile(jsonlPath, { persistent: false, interval: 2000 }, (curr: Stats) => {
    if (entry.titleDone && entry.planDetected) {
      unwatchFile(jsonlPath)
      return
    }
    if (curr.size === 0 || curr.size === lastSize) return
    lastSize = curr.size
    processJsonl(sessionId, entry)
  })

  if (existsSync(jsonlPath)) {
    processJsonl(sessionId, entry)
  }
}

export function cleanup(sessionId: string): void {
  const entry = sessions.get(sessionId)
  if (entry) {
    try { unwatchFile(entry.jsonlPath) } catch { /* ignore */ }
  }
  sessions.delete(sessionId)
}

// --- JSONL processing ---

function processJsonl(sessionId: string, entry: SessionEntry): void {
  // Title: grep for the first user message line, parse just that one line
  if (!entry.titleDone) {
    grepFile(entry.jsonlPath, '"type":"user"', true).then((line) => {
      if (!line) return
      const userMessage = parseUserMessage(line)
      if (!userMessage || !isValidMessage(userMessage)) return

      entry.titleDone = true
      console.log(`[title-gen] Session ${sessionId} message: "${userMessage.slice(0, 80)}"`)

      generateTitle(sessionId, userMessage)
        .then((title) => {
          if (entry.win && !entry.win.isDestroyed()) {
            entry.win.webContents.send(`session:auto-title:${sessionId}`, title)
          }
        })
        .catch(() => {})
        .finally(() => stopIfDone(entry))
    })
  }

  // Plan: grep for planFilePath, parse matching lines
  if (!entry.planDetected) {
    grepFile(entry.jsonlPath, 'planFilePath', false).then((output) => {
      if (!output) return
      // Check each matching line (there may be multiple)
      for (const line of output.split('\n')) {
        if (!line.trim()) continue
        try {
          const parsed = JSON.parse(line)
          const planPath = extractPlanPath(parsed)
          if (planPath && existsSync(planPath)) {
            entry.planDetected = true
            if (entry.win && !entry.win.isDestroyed()) {
              entry.win.webContents.send(`session:plan-detected:${sessionId}`, planPath)
            }
            console.log(`[title-gen] Session ${sessionId}: plan detected at ${planPath}`)
            stopIfDone(entry)
            return
          }
        } catch {
          // skip malformed line
        }
      }
    })
  }
}

/** Use grep to search the file without loading it into memory */
function grepFile(filePath: string, pattern: string, firstMatchOnly: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const args = firstMatchOnly
      ? ['-m', '1', pattern, filePath]
      : [pattern, filePath]

    execFile('grep', args, { encoding: 'utf-8', timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null)
        return
      }
      resolve(stdout.trim())
    })
  })
}

function stopIfDone(entry: SessionEntry): void {
  if (entry.titleDone && entry.planDetected) {
    try { unwatchFile(entry.jsonlPath) } catch { /* ignore */ }
  }
}

// --- Parsing ---

function parseUserMessage(line: string): string | null {
  try {
    const entry = JSON.parse(line)
    if (entry.type === 'user' && entry.message?.content) {
      const text =
        typeof entry.message.content === 'string'
          ? entry.message.content
          : Array.isArray(entry.message.content)
            ? entry.message.content
                .filter((b: { type: string }) => b.type === 'text')
                .map((b: { text: string }) => b.text)
                .join(' ')
            : ''
      if (text.trim()) return text.trim()
    }
  } catch {
    // malformed
  }
  return null
}

function extractPlanPath(entry: Record<string, unknown>): string | null {
  if (typeof entry.planFilePath === 'string') return entry.planFilePath

  const content = (entry.message as Record<string, unknown>)?.content
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use' && block.name === 'ExitPlanMode') {
        const planPath = (block.input as Record<string, unknown>)?.planFilePath
        if (typeof planPath === 'string') return planPath
      }
    }
  }
  return null
}

// --- Title generation ---

function generateTitle(sessionId: string, userMessage: string): Promise<string> {
  const prompt = `Generate a short 2-4 word title for this Claude Code terminal session based on what the user asked.
Rules:
- Return ONLY the title, no quotes, no explanation
- Be specific about what the user is working on
- Lowercase, like an IDE tab title
- Examples: "fix auth middleware", "add dark mode", "refactor store", "debug api"

User's message:
${userMessage}`

  const env = { ...getLoginShellEnv() }
  delete env.CLAUDECODE

  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      'claude',
      ['-p', '--model', 'haiku'],
      { env, encoding: 'utf-8', maxBuffer: 1024 * 1024, timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error('[title-gen] claude CLI error:', err.message, stderr)
          const fallback = heuristicTitle(userMessage)
          if (fallback) {
            console.log(`[title-gen] Session ${sessionId} (heuristic): "${fallback}"`)
            resolve(fallback)
          } else {
            reject(new Error(stderr || err.message))
          }
          return
        }
        const title = stdout.trim()
        if (!title) {
          const fallback = heuristicTitle(userMessage)
          if (fallback) {
            console.log(`[title-gen] Session ${sessionId} (heuristic): "${fallback}"`)
            resolve(fallback)
          } else {
            reject(new Error('Empty response from Claude'))
          }
          return
        }
        const wordCount = title.split(/\s+/).length
        if (wordCount > 6 || /^(I |I'm |I'll |The |This |You |It |We |My |Let )/.test(title)) {
          console.warn(`[title-gen] Rejected bad title for ${sessionId}: "${title}"`)
          const fallback = heuristicTitle(userMessage)
          if (fallback) {
            console.log(`[title-gen] Session ${sessionId} (heuristic): "${fallback}"`)
            resolve(fallback)
          } else {
            reject(new Error('Response is not a valid title'))
          }
          return
        }
        console.log(`[title-gen] Session ${sessionId}: "${title}"`)
        resolve(title)
      }
    )
    child.stdin?.write(prompt)
    child.stdin?.end()
  })
}

// --- Helpers ---

function isValidMessage(msg: string): boolean {
  if (msg.length < 5) return false
  if (msg.startsWith('/')) return false
  if (/^(y|n|yes|no)$/i.test(msg)) return false
  return true
}

const PREFIX_RE =
  /^(please\s+|can you\s+|could you\s+|I want to\s+|I need to\s+|I need you to\s+|help me\s+)/i

function heuristicTitle(message: string): string | null {
  let text = message.split(/\n/)[0].trim()
  text = text.replace(PREFIX_RE, '')
  const words = text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
  if (words.length === 0) return null
  return words.join(' ').toLowerCase()
}
