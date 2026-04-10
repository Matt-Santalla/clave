import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowPathIcon, ClockIcon, PlayIcon } from '@heroicons/react/24/outline'
import { cn } from '../../lib/utils'
import { MarkdownRenderer } from '../files/MarkdownRenderer'
import { useHistoryStore } from '../../store/history-store'
import { useSessionStore } from '../../store/session-store'
import {
  filterMetaSessions,
  getProjectDisplayName,
  getProjectColor,
  groupSessionsByDate
} from '../../lib/history-utils'

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return date.toLocaleString()
}

function highlightText(content: string, needle: string): ReactNode {
  if (!needle.trim()) return <>{content}</>

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'ig')
  const parts = content.split(regex)

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="bg-yellow-300/70 text-current rounded">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  )
}

function roleClasses(role: string): string {
  if (role === 'user') return 'bg-surface-100 border-border-subtle'
  if (role === 'assistant') return 'bg-surface-50 border-border'
  if (role === 'tool') return 'bg-surface-200/60 border-border-subtle'
  return 'bg-surface-100/80 border-border-subtle'
}

function ToolMessageContent({
  content,
  renderedContent
}: {
  content: string
  renderedContent: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    const measure = () => {
      const node = contentRef.current
      if (!node) return
      setIsOverflowing(node.scrollHeight > node.clientHeight + 1)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [content])

  useEffect(() => {
    setExpanded(false)
  }, [content])

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          'text-sm leading-6 text-text-primary whitespace-pre-wrap break-words',
          !expanded && 'line-clamp-1'
        )}
      >
        {renderedContent}
      </div>
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-2 text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  )
}

export function HistoryPanel() {
  const selectedSession = useHistoryStore((s) => s.selectedSession)
  const messages = useHistoryStore((s) => s.messages)
  const isLoadingMessages = useHistoryStore((s) => s.isLoadingMessages)
  const targetMessageId = useHistoryStore((s) => s.targetMessageId)
  const clearTargetMessage = useHistoryStore((s) => s.clearTargetMessage)
  const refresh = useHistoryStore((s) => s.refresh)
  const searchQuery = useHistoryStore((s) => s.searchQuery)
  const sessionsByProject = useHistoryStore((s) => s.sessionsByProject)
  const isLoadingProjects = useHistoryStore((s) => s.isLoadingProjects)
  const projects = useHistoryStore((s) => s.projects)
  const selectSession = useHistoryStore((s) => s.selectSession)
  const addSession = useSessionStore((s) => s.addSession)
  const selectTerminalSession = useSessionStore((s) => s.selectSession)
  const setFocusedSession = useSessionStore((s) => s.setFocusedSession)
  const setActiveView = useSessionStore((s) => s.setActiveView)
  const setSidebarSearchQuery = useSessionStore((s) => s.setSearchQuery)

  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (!targetMessageId) return
    const card = messageRefs.current[targetMessageId]
    if (!card) return

    // Prefer scrolling to the highlighted <mark> inside the card (for long messages),
    // fall back to the card itself if no highlight exists.
    const scrollTarget = card.querySelector('mark') ?? card

    let cancelled = false
    const scrollContainer = card.closest('.overflow-y-auto')

    const isInView = () => {
      if (!scrollContainer) return false
      const containerRect = scrollContainer.getBoundingClientRect()
      const rect = scrollTarget.getBoundingClientRect()
      return rect.top >= containerRect.top && rect.bottom <= containerRect.bottom
    }

    const attemptScroll = (remaining: number) => {
      if (cancelled) return
      scrollTarget.scrollIntoView({ behavior: 'instant', block: 'center' })
      if (remaining > 0 && !isInView()) {
        setTimeout(() => attemptScroll(remaining - 1), 100)
      }
    }

    requestAnimationFrame(() => attemptScroll(3))

    const timer = window.setTimeout(() => {
      clearTargetMessage()
    }, 1800)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [targetMessageId, clearTargetMessage, messages])

  const restoreSession = async () => {
    if (!selectedSession) return
    try {
      const sessionInfo = await window.electronAPI.spawnSession(selectedSession.cwd, {
        claudeMode: true,
        resumeSessionId: selectedSession.sessionId
      })
      addSession({
        id: sessionInfo.id,
        cwd: sessionInfo.cwd,
        folderName: sessionInfo.folderName,
        name: selectedSession.title || sessionInfo.folderName,
        alive: sessionInfo.alive,
        activityStatus: 'idle',
        promptWaiting: null,
        claudeMode: true,
        dangerousMode: false,
        claudeSessionId: sessionInfo.claudeSessionId,
        sessionType: 'local'
      })
      setSidebarSearchQuery('')
      setFocusedSession(sessionInfo.id)
      selectTerminalSession(sessionInfo.id, false)
      setActiveView('terminals')
    } catch (error) {
      console.error('Failed to restore Claude session:', error)
    }
  }

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [messages]
  )

  const allSessions = useMemo(() => {
    const all = Object.values(sessionsByProject)
      .flat()
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
    return filterMetaSessions(all)
  }, [sessionsByProject])

  const groupedSessions = useMemo(() => groupSessionsByDate(allSessions), [allSessions])

  // Trigger load if we land here with no data yet (e.g. direct "History" click with no prior expand)
  useEffect(() => {
    if (!selectedSession && !isLoadingProjects && projects.length === 0) {
      refresh().catch(console.error)
    }
  }, [selectedSession, isLoadingProjects, projects.length, refresh])

  if (!selectedSession) {
    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface-50">
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Title */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-text-primary">Chats</h1>
              <button
                type="button"
                onClick={() => refresh()}
                className="btn-icon btn-icon-md"
                title="Refresh"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isLoadingProjects ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Session list */}
            {isLoadingProjects && allSessions.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-text-tertiary gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Scanning history…
              </div>
            ) : allSessions.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-text-tertiary">
                No history found on this machine.
              </div>
            ) : (
              <div>
                {groupedSessions.map((group) => (
                  <div key={group.label} className="mb-1">
                    <div className="sticky top-0 z-10 py-2 bg-surface-50/95 backdrop-blur-sm">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                        {group.label}
                      </span>
                    </div>
                    <div>
                      {group.sessions.map((session) => {
                        const projectName = getProjectDisplayName(session.projectName)
                        const date = new Date(session.lastModified)
                        const isToday = date.toDateString() === new Date().toDateString()
                        const timeStr = isToday
                          ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                          : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => selectSession(session).catch(console.error)}
                            className="w-full flex items-center gap-4 px-3 py-3 -mx-3 rounded-lg text-left hover:bg-surface-100 transition-colors group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-medium text-text-primary truncate">
                                {session.title}
                              </div>
                              <div className="flex items-center gap-0 text-xs text-text-tertiary mt-0.5">
                                <span className="truncate max-w-[65%]">
                                  {session.summary && session.summary !== session.title
                                    ? session.summary
                                    : `${session.messageCount} messages`}
                                </span>
                                <span className="mx-1.5 opacity-40 flex-shrink-0">·</span>
                                <span className="flex-shrink-0 whitespace-nowrap">{timeStr}</span>
                                <span className="mx-1.5 opacity-40 flex-shrink-0">·</span>
                                <span className="flex-shrink-0 whitespace-nowrap tabular-nums">{session.messageCount} msg</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <span
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded max-w-[120px] truncate block"
                                style={{
                                  color: getProjectColor(projectName),
                                  backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)'
                                }}
                              >
                                {projectName}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface-50">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4 border-b border-border bg-surface-100/80">
        <div className="min-w-0 flex-1 basis-0">
          <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary mb-1">
            Claude History
          </div>
          <h2 className="text-lg font-semibold text-text-primary truncate">
            {selectedSession.title}
          </h2>
          <div className="text-sm text-text-secondary truncate mt-1">
            {selectedSession.cwd}
          </div>
          {selectedSession.summary && (
            <p className="text-sm text-text-tertiary mt-2 line-clamp-2">
              {selectedSession.summary}
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => refresh()}
            className="btn-icon btn-icon-md"
            title="Refresh"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={restoreSession}
            className="h-7 px-2.5 rounded text-xs font-medium bg-accent text-accent-foreground hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
          >
            <PlayIcon className="w-3 h-3" />
            Resume
          </button>
        </div>
      </div>

      <div className="px-6 py-3 border-b border-border bg-surface-50/80 text-xs text-text-tertiary flex items-center gap-5">
        <span>{selectedSession.messageCount} messages</span>
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className="w-3.5 h-3.5" />
          Last updated {formatTimestamp(selectedSession.lastModified)}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-3">
        {isLoadingMessages ? (
          <div className="text-sm text-text-tertiary">Loading session messages...</div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-sm text-text-tertiary">No visible messages in this session.</div>
        ) : (
          sortedMessages.map((message) => (
            <div
              key={message.id}
              ref={(node) => {
                messageRefs.current[message.id] = node
              }}
              className={cn(
                'rounded-xl border p-4 transition-colors',
                roleClasses(message.role),
                targetMessageId === message.id && 'ring-2 ring-accent shadow-[0_0_0_1px_rgba(0,0,0,0.04)]'
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-secondary">
                  {message.role}
                </span>
                <span className="text-xs text-text-tertiary">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
              {message.role === 'tool' ? (
                <ToolMessageContent
                  content={message.content}
                  renderedContent={highlightText(message.content, searchQuery)}
                />
              ) : message.role === 'assistant' && !searchQuery.trim() ? (
                <div className="text-sm leading-6 text-text-primary prose-sm max-w-none">
                  <MarkdownRenderer content={message.content} />
                </div>
              ) : (
                <div className="text-sm leading-6 text-text-primary whitespace-pre-wrap break-words">
                  {highlightText(message.content, searchQuery)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
