// src/renderer/src/store/assistant-store.ts
import { create } from 'zustand'
import type { JournalEntry, JournalData as JournalDay } from '../../../shared/journal-types'

export interface DaySummary {
  count: number
  minutes: number
}

interface AssistantState {
  journal: JournalDay
  loaded: boolean
  enabled: boolean
  aiSummaries: boolean

  // Archive navigation
  viewingDate: string | null // null = today (live), string = viewing archived date
  archivedJournal: JournalDay | null
  availableArchiveDates: string[]

  // Summaries for the last 6 past days keyed by YYYY-MM-DD. Today is not
  // cached here — compute it from `journal` at render time so the week strip
  // reflects live additions without a reload.
  weekSummaries: Record<string, DaySummary>

  // Actions
  loadJournal: () => Promise<void>
  setEnabled: (enabled: boolean) => void
  setAiSummaries: (enabled: boolean) => void
  addEntry: (entry: JournalEntry, cwd: string) => void
  completeEntry: (sessionId: string, summary?: string) => void
  updateEntrySummary: (sessionId: string, summary: string) => void
  updateEntryName: (sessionId: string, name: string) => void
  removeActiveEntry: (sessionId: string) => void
  loadArchiveDates: () => Promise<void>
  loadWeekSummaries: () => Promise<void>
  navigateDay: (direction: 'prev' | 'next') => Promise<void>
  jumpToDate: (date: string) => Promise<void>
  goToToday: () => void
}

function summarizeJournal(day: JournalDay): DaySummary {
  let count = 0
  let minutes = 0
  for (const project of day.projects) {
    count += project.entries.length
    for (const entry of project.entries) {
      if (entry.endTime && entry.startTime) {
        minutes += Math.max(0, Math.round((entry.endTime - entry.startTime) / 60000))
      }
    }
  }
  return { count, minutes }
}

function pastDatesEndingYesterday(todayStr: string, days: number): string[] {
  const out: string[] = []
  const base = new Date(todayStr + 'T12:00:00')
  for (let i = days; i >= 1; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function getProjectName(cwd: string): string {
  return cwd.split('/').filter(Boolean).pop() || cwd
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSave(journal: JournalDay): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    window.electronAPI?.journalSave?.(journal)
  }, 300)
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  journal: { date: '', projects: [] },
  loaded: false,
  enabled: localStorage.getItem('clave-ai-assistant-enabled') !== 'false',
  aiSummaries: localStorage.getItem('clave-ai-summaries-enabled') !== 'false',
  viewingDate: null,
  archivedJournal: null,
  availableArchiveDates: [],
  weekSummaries: {},

  setEnabled: (enabled) => {
    localStorage.setItem('clave-ai-assistant-enabled', String(enabled))
    set({ enabled })
  },

  setAiSummaries: (enabled) => {
    localStorage.setItem('clave-ai-summaries-enabled', String(enabled))
    set({ aiSummaries: enabled })
  },

  loadJournal: async () => {
    if (!window.electronAPI?.journalLoad) return
    const data = await window.electronAPI.journalLoad()
    const today = getTodayString()

    if (data.date === today) {
      set({ journal: data, loaded: true })
    } else {
      // Archive the previous day's journal before starting fresh
      if (data.date && data.projects.length > 0) {
        window.electronAPI.journalArchive?.(data)
      }
      const fresh: JournalDay = { date: today, projects: [] }
      set({ journal: fresh, loaded: true })
      debouncedSave(fresh)
    }
  },

  addEntry: (entry, cwd) => {
    const state = get()
    const today = getTodayString()
    const journal = state.journal.date === today ? state.journal : { date: today, projects: [] }

    const projects = [...journal.projects]
    const projectIdx = projects.findIndex((p) => p.cwd === cwd)

    if (projectIdx >= 0) {
      // Check for duplicate by sessionId
      if (projects[projectIdx].entries.some((e) => e.sessionId === entry.sessionId)) return
      // If same claudeSessionId exists (resumed session), update it instead of adding new entry
      if (entry.claudeSessionId) {
        const existingIdx = projects[projectIdx].entries.findIndex(
          (e) => e.claudeSessionId === entry.claudeSessionId
        )
        if (existingIdx >= 0) {
          projects[projectIdx] = {
            ...projects[projectIdx],
            entries: projects[projectIdx].entries.map((e, i) =>
              i === existingIdx
                ? {
                    ...e,
                    sessionId: entry.sessionId,
                    status: 'active' as const,
                    endTime: undefined
                  }
                : e
            )
          }
          const updated = { date: today, projects }
          set({ journal: updated })
          debouncedSave(updated)
          return
        }
      }
      projects[projectIdx] = {
        ...projects[projectIdx],
        entries: [entry, ...projects[projectIdx].entries]
      }
    } else {
      projects.unshift({
        cwd,
        name: getProjectName(cwd),
        entries: [entry]
      })
    }

    const updated = { date: today, projects }
    set({ journal: updated })
    debouncedSave(updated)
  },

  completeEntry: (sessionId, summary) => {
    const state = get()
    const projects = state.journal.projects.map((p) => ({
      ...p,
      entries: p.entries.map((e) =>
        e.sessionId === sessionId
          ? {
              ...e,
              status: 'completed' as const,
              endTime: Date.now(),
              summary: summary ?? e.summary
            }
          : e
      )
    }))
    const updated = { ...state.journal, projects }
    set({ journal: updated })
    debouncedSave(updated)
  },

  updateEntrySummary: (sessionId, summary) => {
    const state = get()
    const projects = state.journal.projects.map((p) => ({
      ...p,
      entries: p.entries.map((e) => (e.sessionId === sessionId ? { ...e, summary } : e))
    }))
    const updated = { ...state.journal, projects }
    set({ journal: updated })
    debouncedSave(updated)
  },

  updateEntryName: (sessionId, name) => {
    const state = get()
    const projects = state.journal.projects.map((p) => ({
      ...p,
      entries: p.entries.map((e) => (e.sessionId === sessionId ? { ...e, sessionName: name } : e))
    }))
    const updated = { ...state.journal, projects }
    set({ journal: updated })
    debouncedSave(updated)
  },

  removeActiveEntry: (sessionId) => {
    const state = get()
    const projects = state.journal.projects
      .map((p) => ({
        ...p,
        entries: p.entries.filter((e) => !(e.sessionId === sessionId && e.status === 'active'))
      }))
      .filter((p) => p.entries.length > 0)
    const updated = { ...state.journal, projects }
    set({ journal: updated })
    debouncedSave(updated)
  },

  loadArchiveDates: async () => {
    if (!window.electronAPI?.journalListArchives) return
    const dates = await window.electronAPI.journalListArchives()
    set({ availableArchiveDates: dates })
  },

  loadWeekSummaries: async () => {
    if (!window.electronAPI?.journalLoadArchive) return
    const today = getTodayString()
    const dates = pastDatesEndingYesterday(today, 6)
    const results = await Promise.all(
      dates.map(async (date) => {
        try {
          const data = await window.electronAPI.journalLoadArchive(date)
          return [date, data ? summarizeJournal(data) : { count: 0, minutes: 0 }] as const
        } catch {
          return [date, { count: 0, minutes: 0 }] as const
        }
      })
    )
    const summaries: Record<string, DaySummary> = {}
    for (const [date, summary] of results) summaries[date] = summary
    set({ weekSummaries: summaries })
  },

  jumpToDate: async (date) => {
    const today = getTodayString()
    if (date === today) {
      set({ viewingDate: null, archivedJournal: null })
      return
    }
    if (!window.electronAPI?.journalLoadArchive) return
    const archived = await window.electronAPI.journalLoadArchive(date)
    // Even if the archive returns null (no entries for that day), switch the
    // view so the user lands on the requested date with an empty state.
    set({
      viewingDate: date,
      archivedJournal: archived ?? { date, projects: [] }
    })
  },

  navigateDay: async (direction) => {
    const state = get()
    const todayStr = getTodayString()

    // Build sorted list of all dates: archives + today
    const allDates = [...new Set([...state.availableArchiveDates, todayStr])].sort()
    const currentDate = state.viewingDate || todayStr
    const currentIndex = allDates.indexOf(currentDate)

    let targetIndex: number
    if (direction === 'prev') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : -1
    } else {
      targetIndex = currentIndex < allDates.length - 1 ? currentIndex + 1 : -1
    }

    if (targetIndex < 0) return

    const targetDate = allDates[targetIndex]

    if (targetDate === todayStr) {
      set({ viewingDate: null, archivedJournal: null })
      return
    }

    if (!window.electronAPI?.journalLoadArchive) return
    const archived = await window.electronAPI.journalLoadArchive(targetDate)
    if (archived) {
      set({ viewingDate: targetDate, archivedJournal: archived })
    }
  },

  goToToday: () => {
    set({ viewingDate: null, archivedJournal: null })
  }
}))
