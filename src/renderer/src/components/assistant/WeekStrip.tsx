import { useMemo } from 'react'
import { cn } from '../../lib/utils'
import type { DaySummary } from '../../store/assistant-store'
import { formatDuration } from '../work-tracker/utils'

interface WeekStripProps {
  todayStr: string
  /** Summary for today (live, derived from in-memory journal). */
  todaySummary: DaySummary
  /** Summaries for the 6 days preceding today, keyed by YYYY-MM-DD. Missing keys render as zero. */
  pastSummaries: Record<string, DaySummary>
  /** The currently-displayed date (today if archive view is closed). */
  selectedDate: string
  onJump: (date: string) => void
}

interface DayCell {
  date: string
  dow: number // 0=Sun
  dayOfMonth: number
  summary: DaySummary
  isToday: boolean
  level: 0 | 1 | 2 | 3 | 4
}

const DOW_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function buildCells(
  todayStr: string,
  todaySummary: DaySummary,
  pastSummaries: Record<string, DaySummary>
): DayCell[] {
  const base = new Date(todayStr + 'T12:00:00')
  const raw: Omit<DayCell, 'level'>[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    const isToday = date === todayStr
    const summary = isToday ? todaySummary : (pastSummaries[date] ?? { count: 0, minutes: 0 })
    raw.push({
      date,
      dow: d.getDay(),
      dayOfMonth: d.getDate(),
      summary,
      isToday
    })
  }

  // Quartile levels from non-zero counts across the 7-day window.
  const counts = raw
    .map((r) => r.summary.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b)
  let q1 = 1
  let q2 = 2
  let q3 = 3
  if (counts.length > 0) {
    q1 = counts[Math.floor(counts.length * 0.25)] || 1
    q2 = counts[Math.floor(counts.length * 0.5)] || q1 + 1
    q3 = counts[Math.floor(counts.length * 0.75)] || q2 + 1
  }
  function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
    if (count === 0) return 0
    if (count <= q1) return 1
    if (count <= q2) return 2
    if (count <= q3) return 3
    return 4
  }

  return raw.map((r) => ({ ...r, level: levelFor(r.summary.count) }))
}

const LEVEL_COLORS = [
  'var(--heatmap-0, var(--surface-200))',
  'var(--heatmap-1)',
  'var(--heatmap-2)',
  'var(--heatmap-3)',
  'var(--heatmap-4)'
]

function describeCell(cell: DayCell): string {
  const { count, minutes } = cell.summary
  if (count === 0) return 'No sessions'
  const sessions = `${count} session${count !== 1 ? 's' : ''}`
  if (minutes === 0) return sessions
  return `${sessions} · ${formatDuration(minutes)}`
}

export function WeekStrip({
  todayStr,
  todaySummary,
  pastSummaries,
  selectedDate,
  onJump
}: WeekStripProps): React.ReactNode {
  const cells = useMemo(
    () => buildCells(todayStr, todaySummary, pastSummaries),
    [todayStr, todaySummary, pastSummaries]
  )

  return (
    <div className="bg-surface-100 border border-border-subtle rounded-xl p-3">
      <div className="flex items-end gap-1.5">
        {cells.map((cell) => {
          const isSelected = cell.date === selectedDate
          return (
            <button
              key={cell.date}
              onClick={() => onJump(cell.date)}
              title={`${describeCell(cell)} · ${cell.date}`}
              className={cn(
                'flex-1 flex flex-col items-center gap-1.5 py-1.5 px-1 rounded-md transition-colors',
                isSelected
                  ? 'bg-surface-200 text-text-primary'
                  : 'text-text-secondary hover:bg-surface-200/60 hover:text-text-primary'
              )}
              style={isSelected ? { boxShadow: '0 0 0 1.5px var(--color-accent)' } : undefined}
            >
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                {DOW_LETTER[cell.dow]}
              </span>
              <span
                className={cn('text-xs font-medium', cell.isToday && !isSelected && 'text-accent')}
              >
                {cell.dayOfMonth}
              </span>
              <div
                className="w-full h-1 rounded-full"
                style={{ backgroundColor: LEVEL_COLORS[cell.level] }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
