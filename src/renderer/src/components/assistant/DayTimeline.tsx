import { useEffect, useMemo, useState } from 'react'
import type { JournalData, JournalProject } from '../../../../shared/journal-types'
import { cn } from '../../lib/utils'
import { formatClock, getProjectColor } from '../../lib/journal-utils'
import { formatDuration } from '../work-tracker/utils'

interface DayTimelineProps {
  journal: JournalData
  /** True if the journal represents today (affects tick-forward for live entries). */
  isToday: boolean
}

interface Block {
  entryId: string
  projectIdx: number
  projectName: string
  entryName: string
  startTime: number
  endTime: number
  isActive: boolean
  row: 0 | 1
}

interface FlatEntry {
  entryId: string
  projectIdx: number
  projectName: string
  entryName: string
  startTime: number
  endTime?: number
  isActive: boolean
}

function flattenEntries(projects: JournalProject[]): FlatEntry[] {
  const out: FlatEntry[] = []
  projects.forEach((project, projectIdx) => {
    project.entries.forEach((entry) => {
      out.push({
        entryId: entry.sessionId,
        projectIdx,
        projectName: project.name,
        entryName: entry.sessionName || 'Untitled session',
        startTime: entry.startTime,
        endTime: entry.endTime,
        isActive: entry.status === 'active' || !entry.endTime
      })
    })
  })
  return out.filter((e) => e.startTime)
}

/** Greedy two-row packing: sorted by start, each entry takes row 0 if free, else row 1. */
function packRows(entries: FlatEntry[], now: number): Block[] {
  const sorted = [...entries].sort((a, b) => a.startTime - b.startTime)
  let row0End = 0
  let row1End = 0
  return sorted.map((e): Block => {
    const endTime = e.endTime ?? now
    let row: 0 | 1 = 0
    if (e.startTime < row0End) {
      row = 1
      row1End = Math.max(row1End, endTime)
    } else {
      row0End = Math.max(row0End, endTime)
    }
    return {
      entryId: e.entryId,
      projectIdx: e.projectIdx,
      projectName: e.projectName,
      entryName: e.entryName,
      startTime: e.startTime,
      endTime,
      isActive: e.isActive,
      row
    }
  })
}

export function DayTimeline({ journal, isToday }: DayTimelineProps): React.ReactNode {
  const [now, setNow] = useState(() => Date.now())
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Tick every minute if viewing today and an active entry needs to grow.
  useEffect(() => {
    if (!isToday) return
    const hasActive = journal.projects.some((p) => p.entries.some((e) => e.status === 'active'))
    if (!hasActive) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [isToday, journal])

  const { blocks, rangeStart, rangeEnd, hasAnyRow1 } = useMemo(() => {
    const entries = flattenEntries(journal.projects)
    if (entries.length === 0) {
      return { blocks: [], rangeStart: 0, rangeEnd: 0, hasAnyRow1: false }
    }
    const blocks = packRows(entries, now)
    const minStart = Math.min(...blocks.map((b) => b.startTime))
    const maxEnd = Math.max(...blocks.map((b) => b.endTime))
    // Pad ~4% either side so edge blocks don't touch the card border.
    const span = Math.max(maxEnd - minStart, 60_000)
    const pad = span * 0.04
    const hasAnyRow1 = blocks.some((b) => b.row === 1)
    return {
      blocks,
      rangeStart: minStart - pad,
      rangeEnd: maxEnd + pad,
      hasAnyRow1
    }
  }, [journal, now])

  if (blocks.length === 0) return null

  const totalSpan = rangeEnd - rangeStart
  const hovered = hoverId ? blocks.find((b) => b.entryId === hoverId) : undefined
  const rowHeight = 16
  const rowGap = 4
  const trackHeight = hasAnyRow1 ? rowHeight * 2 + rowGap : rowHeight

  return (
    <div className="bg-surface-100 border border-border-subtle rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-medium">
          Timeline
        </span>
        {hovered ? (
          <span className="text-[11px] text-text-secondary truncate max-w-[70%] text-right">
            <span className="text-text-primary font-medium">{hovered.entryName}</span>
            <span className="text-text-tertiary">
              {' · '}
              {formatClock(hovered.startTime)}
              {hovered.isActive ? ' · now' : ` – ${formatClock(hovered.endTime)}`}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-text-tertiary">
            {formatClock(rangeStart + totalSpan * 0.04)}
            {' – '}
            {formatClock(rangeEnd - totalSpan * 0.04)}
          </span>
        )}
      </div>

      <div className="relative w-full" style={{ height: trackHeight }}>
        {blocks.map((block) => {
          const leftPct = ((block.startTime - rangeStart) / totalSpan) * 100
          const widthPct = Math.max(((block.endTime - block.startTime) / totalSpan) * 100, 0.8)
          const color = getProjectColor(block.projectIdx)
          const top = block.row * (rowHeight + rowGap)
          const isHovered = hoverId === block.entryId
          return (
            <div
              key={block.entryId}
              className={cn(
                'absolute rounded-sm transition-opacity',
                block.isActive && 'animate-pulse'
              )}
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top,
                height: rowHeight,
                backgroundColor: color,
                opacity: hoverId && !isHovered ? 0.45 : 0.85,
                cursor: 'default'
              }}
              onMouseEnter={() => setHoverId(block.entryId)}
              onMouseLeave={() => setHoverId(null)}
              title={`${block.projectName} · ${block.entryName} · ${formatClock(block.startTime)}${
                block.isActive ? ' · now' : ` – ${formatClock(block.endTime)}`
              } · ${formatDuration(
                Math.max(1, Math.round((block.endTime - block.startTime) / 60000))
              )}`}
            />
          )
        })}
      </div>
    </div>
  )
}
