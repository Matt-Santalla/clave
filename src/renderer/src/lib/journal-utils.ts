// Shared helpers for the Daily Log feature.
// Keep in sync with PROJECT_COLORS length — referenced from the CSS variables
// --journal-project-1..8 defined in src/renderer/src/assets/main.css.

const PROJECT_COLOR_COUNT = 8

export function getProjectColor(index: number): string {
  const n = ((index % PROJECT_COLOR_COUNT) + PROJECT_COLOR_COUNT) % PROJECT_COLOR_COUNT
  return `var(--journal-project-${n + 1})`
}

export interface ParsedSummary {
  headline: string
  bullets: string[]
}

export function parseSummary(raw: string | undefined): ParsedSummary {
  if (!raw) return { headline: '', bullets: [] }
  const clean = raw.replace(/<[^>]*>/g, '').trim()
  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return { headline: '', bullets: [] }

  const headline = lines[0].replace(/^[-•*]\s*/, '')
  const bullets = lines
    .slice(1)
    .filter((l) => /^[-•*]\s/.test(l))
    .map((l) => l.replace(/^[-•*]\s*/, ''))

  return { headline, bullets }
}

export function formatClock(ts: number | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function entryDurationMinutes(startTime: number, endTime?: number): number {
  if (!startTime) return 0
  const end = endTime ?? Date.now()
  return Math.max(0, Math.round((end - startTime) / 60000))
}
