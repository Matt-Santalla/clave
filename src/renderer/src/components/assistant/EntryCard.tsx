import { CheckCircleIcon } from '@heroicons/react/24/outline'
import type { JournalEntry } from '../../../../shared/journal-types'
import {
  entryDurationMinutes,
  formatClock,
  getProjectColor,
  parseSummary
} from '../../lib/journal-utils'
import { formatDuration } from '../work-tracker/utils'

interface EntryCardProps {
  entry: JournalEntry
  projectIdx: number
  /** Whether to show the project name/chip inline. True for chronological view. */
  showProject: boolean
  projectName?: string
}

function StatusDot({ active }: { active: boolean }): React.ReactNode {
  if (active) {
    return (
      <span
        className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
        style={{ backgroundColor: 'var(--journal-active-dot)' }}
        aria-label="Active session"
      />
    )
  }
  return (
    <CheckCircleIcon
      className="w-3 h-3 flex-shrink-0 text-text-tertiary"
      aria-label="Completed session"
    />
  )
}

export function EntryCard({
  entry,
  projectIdx,
  showProject,
  projectName
}: EntryCardProps): React.ReactNode {
  const isActive = entry.status === 'active' || !entry.endTime
  const { headline, bullets } = parseSummary(entry.summary)
  const displayName = entry.sessionName || 'Untitled session'
  const color = getProjectColor(projectIdx)
  const durationMin = entryDurationMinutes(entry.startTime, entry.endTime)
  const startStr = formatClock(entry.startTime)
  const endStr = isActive ? 'now' : formatClock(entry.endTime)

  return (
    <div className="floating-card p-3 bg-surface-0">
      {/* Header: status + project chip + entry name + active pill */}
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot active={isActive} />
        {showProject && projectName && (
          <span className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
            <span className="text-xs font-medium text-text-secondary">{projectName}</span>
            <span className="text-text-tertiary text-xs">·</span>
          </span>
        )}
        <span className="text-sm font-medium text-text-primary truncate min-w-0">
          {displayName}
        </span>
        {isActive && (
          <span
            className="badge flex-shrink-0 ml-auto"
            style={{
              color: 'var(--journal-active-text)',
              backgroundColor: 'var(--journal-active-bg)'
            }}
          >
            Active
          </span>
        )}
      </div>

      {/* Time row */}
      <div className="flex items-center gap-2 text-[11px] text-text-tertiary mt-1 pl-5">
        <span>{startStr}</span>
        <span className="opacity-50">–</span>
        <span>{endStr}</span>
        {durationMin > 0 && (
          <>
            <span className="opacity-40">·</span>
            <span>{formatDuration(durationMin)}</span>
          </>
        )}
      </div>

      {/* Summary */}
      <div className="pl-5 mt-2">
        {headline ? (
          <>
            <div className="text-sm text-text-primary leading-relaxed">{headline}</div>
            {bullets.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {bullets.map((bullet, i) => (
                  <li
                    key={i}
                    className="text-xs text-text-secondary leading-relaxed flex items-start gap-1.5"
                  >
                    <span className="text-text-tertiary mt-[3px] flex-shrink-0">·</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="text-xs text-text-tertiary italic">
            {isActive ? 'In progress…' : 'No summary available'}
          </div>
        )}
      </div>
    </div>
  )
}
