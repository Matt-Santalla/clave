// src/renderer/src/components/assistant/AssistantPanel.tsx
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useAssistantStore } from '../../store/assistant-store'
import { useWorkTrackerStore } from '../../store/work-tracker-store'
import type { JournalEntry } from '../../../../shared/journal-types'
import { cn } from '../../lib/utils'
import { getProjectColor } from '../../lib/journal-utils'
import { DayStatCards } from './DayStatCards'
import { DayTimeline } from './DayTimeline'
import { EntryCard } from './EntryCard'
import { WeekStrip } from './WeekStrip'

type ViewMode = 'timeline' | 'projects'

function formatLongDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function sumMinutes(entries: JournalEntry[]): number {
  let total = 0
  for (const e of entries) {
    if (e.endTime && e.startTime) total += Math.round((e.endTime - e.startTime) / 60000)
  }
  return total
}

export function AssistantPanel(): React.ReactNode {
  const journal = useAssistantStore((s) => s.journal)
  const loaded = useAssistantStore((s) => s.loaded)
  const enabled = useAssistantStore((s) => s.enabled)
  const viewingDate = useAssistantStore((s) => s.viewingDate)
  const archivedJournal = useAssistantStore((s) => s.archivedJournal)
  const availableArchiveDates = useAssistantStore((s) => s.availableArchiveDates)
  const weekSummaries = useAssistantStore((s) => s.weekSummaries)
  const navigateDay = useAssistantStore((s) => s.navigateDay)
  const jumpToDate = useAssistantStore((s) => s.jumpToDate)
  const goToToday = useAssistantStore((s) => s.goToToday)
  const loadArchiveDates = useAssistantStore((s) => s.loadArchiveDates)
  const loadWeekSummaries = useAssistantStore((s) => s.loadWeekSummaries)
  const todayTotalMinutes = useWorkTrackerStore((s) => s.todayTotalMinutes)

  const [viewMode, setViewMode] = useState<ViewMode>('timeline')

  useEffect(() => {
    loadArchiveDates()
    loadWeekSummaries()
  }, [loadArchiveDates, loadWeekSummaries])

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const isViewingArchive = viewingDate !== null
  const displayJournal = isViewingArchive && archivedJournal ? archivedJournal : journal
  const selectedDate = viewingDate ?? todayStr

  const allDates = useMemo(
    () => [...new Set([...availableArchiveDates, todayStr])].sort(),
    [availableArchiveDates, todayStr]
  )
  const currentIndex = allDates.indexOf(selectedDate)
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < allDates.length - 1

  const todaySummary = useMemo(() => {
    const projects = journal.projects
    const count = projects.reduce((sum, p) => sum + p.entries.length, 0)
    // Today's tracked minutes come from the work-tracker (accurate for live
    // sessions); past days derive minutes from entry timestamps.
    return { count, minutes: todayTotalMinutes }
  }, [journal, todayTotalMinutes])

  const displayTotalMinutes = useMemo(() => {
    if (!isViewingArchive) return todayTotalMinutes
    return displayJournal.projects.reduce((sum, p) => sum + sumMinutes(p.entries), 0)
  }, [displayJournal, isViewingArchive, todayTotalMinutes])

  const totalSessions = displayJournal.projects.reduce((sum, p) => sum + p.entries.length, 0)
  const projectCount = displayJournal.projects.length
  const hasContent = displayJournal.projects.length > 0

  const flatEntries = useMemo(() => {
    return displayJournal.projects
      .flatMap((p, projectIdx) =>
        p.entries.map((entry) => ({
          entry,
          projectIdx,
          projectName: p.name
        }))
      )
      .sort((a, b) => {
        const aTime = a.entry.endTime || a.entry.startTime
        const bTime = b.entry.endTime || b.entry.startTime
        return bTime - aTime
      })
  }, [displayJournal])

  if (!enabled) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 bg-surface-50">
        <div className="text-center animate-fade-in">
          <div className="p-4 rounded-2xl bg-surface-100 inline-flex mb-3">
            <SparklesIcon className="w-8 h-8 text-text-tertiary" />
          </div>
          <div className="text-sm font-medium text-text-primary mb-1">Daily Log is disabled</div>
          <div className="text-xs text-text-tertiary">Enable it in Settings to track your work</div>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-50">
        <span className="text-sm text-text-tertiary">Loading daily log…</span>
      </div>
    )
  }

  const dateLabel = isViewingArchive ? formatLongDate(viewingDate) : formatLongDate(todayStr)

  return (
    <div className="flex-1 overflow-y-auto bg-surface-50">
      <div className="max-w-3xl mx-auto w-full px-5 pt-5 pb-8 space-y-4">
        {/* Eyebrow + date */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-medium mb-1">
            Daily Log
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-text-primary">
              {isViewingArchive ? dateLabel : `Today, ${dateLabel}`}
            </h2>
            <div className="flex items-center gap-0.5 ml-auto">
              <button
                onClick={() => navigateDay('prev')}
                disabled={!canGoPrev}
                className="btn-icon btn-icon-sm disabled:opacity-30 disabled:cursor-default"
                title="Previous day"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateDay('next')}
                disabled={!canGoNext}
                className="btn-icon btn-icon-sm disabled:opacity-30 disabled:cursor-default"
                title="Next day"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
              {isViewingArchive && (
                <button
                  onClick={goToToday}
                  className="ml-1 text-[11px] px-2 py-0.5 rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                >
                  Go to today
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Week strip */}
        <WeekStrip
          todayStr={todayStr}
          todaySummary={todaySummary}
          pastSummaries={weekSummaries}
          selectedDate={selectedDate}
          onJump={jumpToDate}
        />

        {hasContent ? (
          <>
            <DayStatCards
              totalMinutes={displayTotalMinutes}
              totalSessions={totalSessions}
              projectCount={projectCount}
            />

            <DayTimeline journal={displayJournal} isToday={!isViewingArchive} />

            {/* Entries section: header + view toggle */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-medium">
                Entries
              </span>
              <div className="flex items-center gap-0.5 bg-surface-100 border border-border-subtle rounded-md p-0.5">
                {(['timeline', 'projects'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'px-2 py-0.5 text-[11px] rounded transition-colors capitalize',
                      viewMode === mode
                        ? 'bg-surface-300 text-text-primary'
                        : 'text-text-tertiary hover:text-text-secondary'
                    )}
                  >
                    {mode === 'timeline' ? 'Timeline' : 'By project'}
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'timeline' ? (
              <div className="space-y-2">
                {flatEntries.map(({ entry, projectIdx, projectName }) => (
                  <EntryCard
                    key={entry.sessionId}
                    entry={entry}
                    projectIdx={projectIdx}
                    showProject
                    projectName={projectName}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {displayJournal.projects.map((project, projectIdx) => (
                  <div key={project.cwd} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getProjectColor(projectIdx) }}
                        aria-hidden
                      />
                      <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-medium">
                        {project.name}
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        ({project.entries.length} session
                        {project.entries.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {project.entries.map((entry) => (
                        <EntryCard
                          key={entry.sessionId}
                          entry={entry}
                          projectIdx={projectIdx}
                          showProject={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <DailyLogEmptyState
            isViewingArchive={isViewingArchive}
            canGoPrev={canGoPrev}
            onPrev={() => navigateDay('prev')}
          />
        )}
      </div>
    </div>
  )
}

function DailyLogEmptyState({
  isViewingArchive,
  canGoPrev,
  onPrev
}: {
  isViewingArchive: boolean
  canGoPrev: boolean
  onPrev: () => void
}): React.ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 text-center animate-fade-in py-12">
      <div className="p-4 rounded-2xl bg-surface-100">
        <SparklesIcon className="w-8 h-8 text-text-tertiary" />
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">
          {isViewingArchive ? 'No sessions recorded' : 'No sessions yet today'}
        </h3>
        <p className="text-xs text-text-tertiary">
          {isViewingArchive
            ? 'Nothing was logged on this day'
            : 'Sessions will appear here as you work'}
        </p>
      </div>
      {!isViewingArchive && canGoPrev && (
        <button
          onClick={onPrev}
          className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
        >
          View yesterday →
        </button>
      )}
    </div>
  )
}
