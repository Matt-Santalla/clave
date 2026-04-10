import type { HistorySession } from '../store/history-store'

const TITLE_GEN_PREFIX = 'Generate a short 2-4 word title'
const COMMIT_MSG_PREFIX = 'Write a git commit message'

/** Returns true if a session is a Clave meta-session (title generation, commit msg, etc.) */
export function isMetaSession(session: HistorySession): boolean {
  return (
    session.title.startsWith(TITLE_GEN_PREFIX) ||
    session.title.startsWith(COMMIT_MSG_PREFIX)
  )
}

/** Filter out meta-sessions from a list */
export function filterMetaSessions(sessions: HistorySession[]): HistorySession[] {
  return sessions.filter((s) => !isMetaSession(s))
}

/** Get a display-friendly project name */
export function getProjectDisplayName(name: string): string {
  if (!name || name === '-') return 'other'
  return name
}

// CSS variable references for project colors (same as journal)
const PROJECT_COLOR_VARS = [
  'var(--journal-project-1)',
  'var(--journal-project-2)',
  'var(--journal-project-3)',
  'var(--journal-project-4)',
  'var(--journal-project-5)',
  'var(--journal-project-6)',
  'var(--journal-project-7)',
  'var(--journal-project-8)'
]

/** Get a stable color for a project name */
export function getProjectColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PROJECT_COLOR_VARS[Math.abs(hash) % PROJECT_COLOR_VARS.length]
}

export interface DateGroup {
  label: string
  sessions: HistorySession[]
}

/** Group sessions by date bucket: Today, Yesterday, This Week, Last Week, then month/year */
export function groupSessionsByDate(sessions: HistorySession[]): DateGroup[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - ((today.getDay() + 6) % 7)) // Monday
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const groups = new Map<string, HistorySession[]>()
  const groupOrder: string[] = []

  const addToGroup = (label: string, session: HistorySession) => {
    const existing = groups.get(label)
    if (existing) {
      existing.push(session)
    } else {
      groups.set(label, [session])
      groupOrder.push(label)
    }
  }

  for (const session of sessions) {
    const date = new Date(session.lastModified)
    const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    if (sessionDay.getTime() >= today.getTime()) {
      addToGroup('Today', session)
    } else if (sessionDay.getTime() >= yesterday.getTime()) {
      addToGroup('Yesterday', session)
    } else if (sessionDay.getTime() >= thisWeekStart.getTime()) {
      addToGroup('This week', session)
    } else if (sessionDay.getTime() >= lastWeekStart.getTime()) {
      addToGroup('Last week', session)
    } else {
      const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      addToGroup(monthLabel, session)
    }
  }

  return groupOrder.map((label) => ({
    label,
    sessions: groups.get(label)!
  }))
}
