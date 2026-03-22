import { execFile } from 'child_process'
import { getLoginShellEnv } from './pty-manager'

const ANSI_REGEX =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]/g

interface SessionBuffer {
  buffer: string
  titled: boolean
}

const sessions = new Map<string, SessionBuffer>()

const MAX_BUFFER = 4000
const PROMPT_BUFFER = 3000

export function accumulate(sessionId: string, data: string): void {
  let entry = sessions.get(sessionId)
  if (!entry) {
    entry = { buffer: '', titled: false }
    sessions.set(sessionId, entry)
  }
  if (entry.titled || entry.buffer.length >= MAX_BUFFER) return
  const stripped = data.replace(ANSI_REGEX, '')
  entry.buffer = (entry.buffer + stripped).slice(0, MAX_BUFFER)
}

export function getBufferLength(sessionId: string): number {
  return sessions.get(sessionId)?.buffer.length ?? 0
}

/** Clear the buffer (e.g. after startup banner, before real conversation starts) */
export function resetBuffer(sessionId: string): void {
  const entry = sessions.get(sessionId)
  if (entry) entry.buffer = ''
}

export function isAlreadyTitled(sessionId: string): boolean {
  return sessions.get(sessionId)?.titled ?? false
}

export function generateTitle(sessionId: string): Promise<string> {
  const entry = sessions.get(sessionId)
  if (!entry || entry.titled) return Promise.reject(new Error('No buffer or already titled'))

  entry.titled = true

  const content = entry.buffer.slice(0, PROMPT_BUFFER)
  const prompt = `Generate a short 3-5 word title for this Claude Code terminal session.
Rules:
- Return ONLY the title, no quotes, no explanation
- Be specific about what the user is working on
- Lowercase, like an IDE tab title
- Examples: "fix auth middleware", "add dark mode", "refactor user store"

Session output:
${content}`

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
          reject(new Error(stderr || err.message))
          return
        }
        const title = stdout.trim()
        if (!title) {
          reject(new Error('Empty response from Claude'))
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

export function cleanup(sessionId: string): void {
  sessions.delete(sessionId)
}
