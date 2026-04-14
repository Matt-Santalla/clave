import { formatDuration } from '../work-tracker/utils'

interface DayStatCardsProps {
  totalMinutes: number
  totalSessions: number
  projectCount: number
}

function StatCard({
  label,
  value,
  sub
}: {
  label: string
  value: string
  sub: string
}): React.ReactNode {
  return (
    <div className="bg-surface-100 border border-border-subtle rounded-xl p-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-medium">
        {label}
      </span>
      <span className="text-lg font-semibold text-text-primary leading-tight">{value}</span>
      <span className="text-[11px] text-text-tertiary">{sub}</span>
    </div>
  )
}

export function DayStatCards({
  totalMinutes,
  totalSessions,
  projectCount
}: DayStatCardsProps): React.ReactNode {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        label="Time"
        value={totalMinutes > 0 ? formatDuration(totalMinutes) : '—'}
        sub={totalMinutes > 0 ? 'coding time' : 'not tracked'}
      />
      <StatCard
        label="Sessions"
        value={String(totalSessions)}
        sub={totalSessions === 1 ? 'session' : 'sessions'}
      />
      <StatCard
        label="Projects"
        value={String(projectCount)}
        sub={projectCount === 1 ? 'project' : 'projects'}
      />
    </div>
  )
}
