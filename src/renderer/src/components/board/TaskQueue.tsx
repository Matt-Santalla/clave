import { useState, useCallback, useMemo } from 'react'
import { PlusIcon, FolderIcon } from '@heroicons/react/24/outline'
import { useBoardStore } from '../../store/board-store'
import { useSessionStore } from '../../store/session-store'
import { useBoardPersistence } from '../../hooks/use-board-persistence'
import { TaskForm } from './TaskForm'
import { ContextMenu } from '../ui/ContextMenu'
import { cn } from '../../lib/utils'
import type { BoardTask } from '../../../../preload/index.d'

function shortenCwd(cwd: string): string {
  const parts = cwd.split('/')
  if (parts.length <= 3) return cwd
  return '~/' + parts.slice(-2).join('/')
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TaskQueue() {
  const tasks = useBoardStore((s) => s.tasks)
  const removeTask = useBoardStore((s) => s.removeTask)
  const deleteTask = useBoardStore((s) => s.deleteTask)

  const addSession = useSessionStore((s) => s.addSession)

  const [formOpen, setFormOpen] = useState(false)
  const [editTask, setEditTask] = useState<BoardTask | null>(null)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: { label: string; onClick: () => void; danger?: boolean }[]
  } | null>(null)

  useBoardPersistence()

  const handleEdit = useCallback((task: BoardTask) => {
    setEditTask(task)
    setFormOpen(true)
  }, [])

  const handleNewTask = useCallback(() => {
    setEditTask(null)
    setFormOpen(true)
  }, [])

  const handleCloseForm = useCallback(() => {
    setFormOpen(false)
    setEditTask(null)
  }, [])

  const runTask = useCallback(
    async (task: BoardTask) => {
      if (!window.electronAPI?.spawnSession) return

      const dangerousMode = task.dangerousMode ?? false
      const sessionInfo = await window.electronAPI.spawnSession(task.cwd, {
        dangerousMode,
        claudeMode: true
      })

      addSession({
        id: sessionInfo.id,
        cwd: sessionInfo.cwd,
        folderName: sessionInfo.folderName,
        name: task.title || task.prompt.slice(0, 40),
        alive: sessionInfo.alive,
        activityStatus: 'idle',
        promptWaiting: null,
        claudeMode: true,
        dangerousMode,
        claudeSessionId: sessionInfo.claudeSessionId,
        sessionType: 'local'
      })

      removeTask(task.id)
      useSessionStore.getState().selectSession(sessionInfo.id, false)

      if (task.prompt) {
        let sent = false
        let debounceTimer: ReturnType<typeof setTimeout> | null = null

        const sendPrompt = (): void => {
          if (sent) return
          sent = true
          if (debounceTimer) clearTimeout(debounceTimer)
          window.electronAPI?.writeSession(sessionInfo.id, task.prompt)
          setTimeout(() => {
            window.electronAPI?.writeSession(sessionInfo.id, '\r')
          }, 150)
          cleanup?.()
        }

        const cleanup = window.electronAPI?.onSessionData(sessionInfo.id, () => {
          if (sent) return
          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(sendPrompt, 2000)
        })

        setTimeout(sendPrompt, 20000)
      }
    },
    [addSession, removeTask]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, task: BoardTask) => {
      e.preventDefault()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: 'Edit', onClick: () => handleEdit(task) },
          { label: 'Delete', onClick: () => deleteTask(task.id), danger: true }
        ]
      })
    },
    [handleEdit, deleteTask]
  )

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-surface-50">
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Title */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold text-text-primary">Queue</h1>
            <button
              onClick={handleNewTask}
              className="btn-icon btn-icon-md"
              title="Add task"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Task list */}
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-text-tertiary">
              No tasks queued yet.
            </div>
          ) : (
            <div>
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => runTask(task)}
                  onContextMenu={(e) => handleContextMenu(e, task)}
                  className="w-full flex items-center gap-4 px-3 py-3 -mx-3 rounded-lg text-left hover:bg-surface-100 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-text-primary truncate">
                        {task.title || task.prompt}
                      </span>
                      {task.dangerousMode && (
                        <span className="badge flex-shrink-0 bg-red-500/10 text-red-400">
                          skip-perms
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0 text-xs text-text-tertiary mt-0.5">
                      {task.title && task.prompt && (
                        <>
                          <span className="truncate max-w-[65%]">{task.prompt}</span>
                          <span className="mx-1.5 opacity-40 flex-shrink-0">·</span>
                        </>
                      )}
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <FolderIcon className="w-3 h-3" />
                        <span className="truncate max-w-[160px]" title={task.cwd}>
                          {shortenCwd(task.cwd)}
                        </span>
                      </span>
                      <span className="mx-1.5 opacity-40 flex-shrink-0">·</span>
                      <span className="flex-shrink-0 whitespace-nowrap">{formatDate(task.createdAt)}</span>
                    </div>
                  </div>
                  <div className={cn(
                    'flex-shrink-0 h-7 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5',
                    'bg-green-500/10 text-green-500 group-hover:bg-green-500/20',
                    'opacity-0 group-hover:opacity-100 transition-opacity'
                  )}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M3 1.5L10 6L3 10.5V1.5Z" fill="currentColor" />
                    </svg>
                    Run
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <TaskForm isOpen={formOpen} onClose={handleCloseForm} editTask={editTask} />

      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
