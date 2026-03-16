import { useCallback } from 'react'
import { useRemoteTerminal } from '../../hooks/use-remote-terminal'
import { useSessionStore } from '../../store/session-store'
import { useLocationStore } from '../../store/location-store'
import { TerminalHeader } from './TerminalHeader'
import { cn } from '../../lib/utils'
import { GlobeAltIcon } from '@heroicons/react/24/outline'

interface RemoteTerminalPanelProps {
  sessionId: string
  shellId: string
  locationId: string
}

export function RemoteTerminalPanel({ sessionId, shellId, locationId }: RemoteTerminalPanelProps) {
  const { containerRef, focus } = useRemoteTerminal(shellId)
  const focusedSessionId = useSessionStore((s) => s.focusedSessionId)
  const setFocusedSession = useSessionStore((s) => s.setFocusedSession)
  const location = useLocationStore((s) => s.locations.find((l) => l.id === locationId))
  const isFocused = focusedSessionId === sessionId

  const handleClick = useCallback(() => {
    if (focusedSessionId !== sessionId) {
      setFocusedSession(sessionId)
    }
    focus()
  }, [sessionId, focusedSessionId, setFocusedSession, focus])

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-surface-50 transition-shadow',
        isFocused ? 'ring-1 ring-accent/30' : ''
      )}
      onMouseDown={handleClick}
    >
      <TerminalHeader sessionId={sessionId} />
      {location && (
        <div className="flex items-center gap-2 px-3 py-1 bg-accent/5 border-b border-border-subtle text-xs text-text-tertiary">
          <GlobeAltIcon className="w-3.5 h-3.5" />
          <span>
            Connected to {location.name} &middot; {location.host} via SSH
          </span>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  )
}
