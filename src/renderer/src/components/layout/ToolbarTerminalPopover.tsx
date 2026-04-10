import { useState, useEffect, useRef, useCallback } from 'react'
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useToolbarTerminal, type ToolbarTerminalStatus } from '../../hooks/use-toolbar-terminal'

interface ToolbarTerminalPopoverProps {
  cwd: string
  command: string
  persistent?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  header: React.ReactNode
}

function TerminalBody({
  sessionId,
  persistent,
  onStatusChange
}: {
  sessionId: string
  persistent?: boolean
  onStatusChange: (status: ToolbarTerminalStatus) => void
}): React.JSX.Element {
  const { containerRef, status } = useToolbarTerminal({ sessionId, persistent })

  useEffect(() => {
    onStatusChange(status)
  }, [status, onStatusChange])

  return <div ref={containerRef} className="w-full h-full" style={{ minHeight: 0 }} />
}

export function ToolbarTerminalPopover({
  cwd,
  command,
  persistent,
  open,
  onOpenChange,
  children,
  header
}: ToolbarTerminalPopoverProps): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<ToolbarTerminalStatus>('running')
  const persistentSessionRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Spawn PTY when popover opens
  useEffect(() => {
    if (!open) return

    // Reattach to persistent session if still alive
    if (persistent && persistentSessionRef.current) {
      setSessionId(persistentSessionRef.current)
      return
    }

    let cancelled = false
    let spawnedId: string | null = null
    let exitCleanup: (() => void) | null = null

    window.electronAPI
      .spawnSession(cwd, {
        claudeMode: false,
        initialCommand: command || undefined,
        autoExecute: true
      })
      .then((info) => {
        if (cancelled) {
          window.electronAPI.killSession(info.id)
          return
        }
        spawnedId = info.id

        // Listen for exit immediately so we don't miss fast-exiting commands
        exitCleanup = window.electronAPI.onSessionExit(info.id, () => {
          setStatus('exited')
          if (persistent) {
            persistentSessionRef.current = null
          }
        })

        setSessionId(info.id)
        if (persistent) {
          persistentSessionRef.current = info.id
        }
      })
      .catch((err) => {
        console.error('[toolbar-popover] spawn failed:', err)
      })

    return () => {
      cancelled = true
      exitCleanup?.()
      if (spawnedId && !persistent) {
        window.electronAPI.killSession(spawnedId)
      }
    }
  }, [open, cwd, command, persistent])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !persistent) {
        setSessionId(null)
        setStatus('running')
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, persistent]
  )

  const handleStatusChange = useCallback(
    (s: ToolbarTerminalStatus) => {
      setStatus(s)
      if (s === 'exited' && persistent) {
        persistentSessionRef.current = null
      }
    },
    [persistent]
  )

  const statusColor = status === 'running' ? 'bg-green-500' : 'bg-red-400'

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        animated
        open={open}
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-[500px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {header}
            <span className="text-xs text-text-secondary truncate flex-1">{command}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
            <button
              onClick={() => handleOpenChange(false)}
              className="btn-icon btn-icon-xs"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div className="h-[300px] overflow-hidden" style={{ backgroundColor: 'var(--surface-0)' }}>
          {sessionId && (
            <TerminalBody
              sessionId={sessionId}
              persistent={persistent}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
