// src/renderer/src/components/assistant/AssistantPanel.tsx
import { useEffect, useState } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline'
import { useAssistantStore } from '../../store/assistant-store'
import { useSessionStore } from '../../store/session-store'
import { useWorkTrackerStore } from '../../store/work-tracker-store'
import { cleanSummary } from '../../lib/journal-utils'
import { formatDuration } from '../work-tracker/utils'

function ActiveBanner(): React.ReactNode {
  const journal = useAssistantStore((s) => s.journal)
  const sessions = useSessionStore((s) => s.sessions)
  const setActiveView = useSessionStore((s) => s.setActiveView)
  const activeEntries: Array<{ sessionId: string; name: string; cwd: string }> = []

  for (const project of journal.projects) {
    for (const entry of project.entries) {
      if (entry.status === 'active') {
        activeEntries.push({
          sessionId: entry.sessionId,
          name: entry.sessionName,
          cwd: project.name
        })
      }
    }
  }

  if (activeEntries.length === 0) return null

  const handleClick = (sessionId: string): void => {
    const runtimeSession = sessions.find((s) => s.id === sessionId)
    if (runtimeSession) {
      useSessionStore.getState().selectSession(runtimeSession.id, false)
      setActiveView('terminals')
    }
  }

  return (
    <div
      className="mx-5 mb-4 px-4 py-3 rounded-lg border"
      style={{
        backgroundColor: 'var(--journal-active-bg)',
        borderColor: 'var(--journal-active-border)'
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
          style={{ backgroundColor: 'var(--journal-active-dot)' }}
        />
        <div className="text-xs font-medium" style={{ color: 'var(--journal-active-text)' }}>
          Working on
        </div>
      </div>
      <div className="space-y-1.5 pl-4">
        {activeEntries.map((entry) => (
          <button
            key={entry.sessionId}
            onClick={() => handleClick(entry.sessionId)}
            className="block w-full text-left text-sm text-text-primary truncate hover:text-accent transition-colors"
          >
            {entry.name}
            <span className="text-xs text-text-tertiary ml-2">{entry.cwd}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface EntryItemProps {
  entry: {
    sessionId: string
    claudeSessionId?: string
    sessionName: string
    summary?: string
    startTime: number
    endTime?: number
    status: 'active' | 'completed'
  }
  isArchive?: boolean
}

function EntryItem({ entry, isArchive }: EntryItemProps): React.ReactNode {
  const [expanded, setExpanded] = useState(false)
  const setActiveView = useSessionStore((s) => s.setActiveView)
  const sessions = useSessionStore((s) => s.sessions)

  const displayText = entry.sessionName || 'Untitled session'
  const summaryText = entry.summary ? cleanSummary(entry.summary) : undefined
  const timeStr = entry.endTime
    ? new Date(entry.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : entry.status === 'active'
      ? 'in progress'
      : ''

  const runtimeSession = !isArchive ? sessions.find((s) => s.id === entry.sessionId) : undefined

  const handleViewSession = (): void => {
    if (runtimeSession) {
      useSessionStore.getState().selectSession(runtimeSession.id, false)
      setActiveView('terminals')
    }
  }

  // Calculate duration string
  const durationMs = entry.endTime && entry.startTime ? entry.endTime - entry.startTime : 0
  const durationMin = Math.round(durationMs / 60000)
  const durationStr =
    durationMin >= 60
      ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
      : durationMin > 0
        ? `${durationMin}m`
        : ''

  const isActive = entry.status === 'active'

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-start gap-2 w-full text-left mb-2 hover:bg-surface-100 rounded-md px-2 py-1 -mx-2 transition-colors"
      >
        {isActive ? (
          <span
            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 animate-pulse"
            style={{ backgroundColor: 'var(--journal-active-dot)' }}
          />
        ) : (
          <CheckCircleIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-text-tertiary" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm text-text-secondary leading-relaxed line-clamp-2">
            {summaryText || displayText}
          </div>
          {timeStr && (
            <div className="text-xs text-text-tertiary mt-0.5">
              {timeStr}
              {isActive && <span className="ml-1.5 text-accent">active</span>}
            </div>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="bg-surface-100 rounded-lg p-3 mb-2 -mx-2">
      <button
        onClick={() => setExpanded(false)}
        className="text-sm text-text-primary font-medium mb-2 text-left w-full"
      >
        {summaryText || displayText}
      </button>

      {summaryText && (
        <div className="text-xs text-text-tertiary mb-2">Session: {displayText}</div>
      )}

      <div className="flex gap-3 text-xs text-text-tertiary mb-2.5">
        {entry.startTime && (
          <span>
            {new Date(entry.startTime).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit'
            })}
            {entry.endTime && (
              <>
                {' \u2192 '}
                {new Date(entry.endTime).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </>
            )}
          </span>
        )}
        {durationStr && <span>{durationStr}</span>}
      </div>

      {runtimeSession && (
        <div className="flex gap-1.5">
          <button
            onClick={handleViewSession}
            className="text-xs px-2.5 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            View Session
          </button>
        </div>
      )}
    </div>
  )
}

// CSS variable references for project heading colors
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

function formatArchiveDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

export function AssistantPanel(): React.ReactNode {
  const journal = useAssistantStore((s) => s.journal)
  const loaded = useAssistantStore((s) => s.loaded)
  const enabled = useAssistantStore((s) => s.enabled)
  const viewingDate = useAssistantStore((s) => s.viewingDate)
  const archivedJournal = useAssistantStore((s) => s.archivedJournal)
  const availableArchiveDates = useAssistantStore((s) => s.availableArchiveDates)
  const navigateDay = useAssistantStore((s) => s.navigateDay)
  const goToToday = useAssistantStore((s) => s.goToToday)
  const loadArchiveDates = useAssistantStore((s) => s.loadArchiveDates)
  const yesterdaySummary = useWorkTrackerStore((s) => s.yesterdaySummary)

  // Load archive dates on mount
  useEffect(() => {
    loadArchiveDates()
  }, [loadArchiveDates])

  const isViewingArchive = viewingDate !== null
  const displayJournal = isViewingArchive && archivedJournal ? archivedJournal : journal

  if (!enabled) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-sm text-text-tertiary">Daily Log is disabled</div>
          <div className="text-xs text-text-tertiary mt-1 opacity-60">
            Enable it in Settings to track your work
          </div>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm text-text-tertiary">Loading daily log...</span>
      </div>
    )
  }

  const today = new Date()
  const dateLabel = isViewingArchive
    ? formatArchiveDate(viewingDate)
    : today.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })

  const totalSessions = displayJournal.projects.reduce((sum, p) => sum + p.entries.length, 0)
  const hasContent = displayJournal.projects.length > 0

  // Can navigate prev/next?
  const todayStr = today.toISOString().slice(0, 10)
  const allDates = [...new Set([...availableArchiveDates, todayStr])].sort()
  const currentDate = viewingDate || todayStr
  const currentIndex = allDates.indexOf(currentDate)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < allDates.length - 1

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Date header with navigation */}
      <div className="px-5 pt-5 pb-3">
        <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary mb-1">Daily Log</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDay('prev')}
            disabled={!canGoPrev}
            className="p-1 rounded hover:bg-surface-200 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronLeftIcon className="w-4 h-4 text-text-secondary" />
          </button>
          <h2 className="text-lg font-semibold text-text-primary">
            {isViewingArchive ? dateLabel : `Today, ${dateLabel}`}
          </h2>
          <button
            onClick={() => navigateDay('next')}
            disabled={!canGoNext}
            className="p-1 rounded hover:bg-surface-200 transition-colors disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronRightIcon className="w-4 h-4 text-text-secondary" />
          </button>
          {isViewingArchive && (
            <button
              onClick={goToToday}
              className="ml-2 text-xs px-2 py-0.5 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        {hasContent && (
          <div className="text-sm text-text-secondary mt-1">
            {totalSessions} session{totalSessions !== 1 ? 's' : ''} across {displayJournal.projects.length}{' '}
            project{displayJournal.projects.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Active work banner (only for today) */}
      {!isViewingArchive && <ActiveBanner />}

      {/* Project groups */}
      {hasContent ? (
        <div className="px-5 pb-5">
          {displayJournal.projects.map((project, idx) => {
            const entryCount = project.entries.length
            return (
              <div key={project.cwd} className="mb-6 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: PROJECT_COLOR_VARS[idx % PROJECT_COLOR_VARS.length] }}
                  >
                    {project.name}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    ({entryCount} session{entryCount !== 1 ? 's' : ''})
                  </span>
                </div>
                <div className="pl-1">
                  {project.entries.map((entry) => (
                    <EntryItem key={entry.sessionId} entry={entry} isArchive={isViewingArchive} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <CommandLineIcon className="w-10 h-10 text-text-tertiary/40 mx-auto mb-3" />
            <div className="text-sm text-text-tertiary">
              {isViewingArchive ? 'No sessions recorded' : 'No sessions yet today'}
            </div>
            <div className="text-xs text-text-tertiary mt-1 opacity-60">
              {isViewingArchive
                ? 'Nothing was logged on this day'
                : 'Sessions will appear here as you work'}
            </div>
            {!isViewingArchive && yesterdaySummary && yesterdaySummary.totalMinutes > 0 && (
              <button
                onClick={() => navigateDay('prev')}
                className="mt-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
              >
                Yesterday: {formatDuration(yesterdaySummary.totalMinutes)} across {yesterdaySummary.sessionCount} session{yesterdaySummary.sessionCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
