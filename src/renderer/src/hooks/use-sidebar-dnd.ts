import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/session-store'

export interface DropIndicatorState {
  targetId: string
  position: 'before' | 'after' | 'inside'
}

interface DndRenderState {
  isDragging: boolean
  draggedIds: string[]
  dropIndicator: DropIndicatorState | null
}

interface DragRef {
  ids: string[]
  isGroup: boolean
  startX: number
  startY: number
  started: boolean
  sourceEl: HTMLElement | null
  currentIndicator: DropIndicatorState | null
  scrollAnimFrame: number | null
  overlayWidth: number
}

const DRAG_THRESHOLD = 5
const AUTO_SCROLL_ZONE = 40
const AUTO_SCROLL_SPEED = 10
const GAP_HEIGHT = 36

export { GAP_HEIGHT }

export function useSidebarDnd(opts: {
  containerRef: React.RefObject<HTMLElement | null>
  moveItems: (ids: string[], targetId: string, position: 'before' | 'after' | 'inside') => void
}) {
  const { containerRef, moveItems } = opts

  const [dndState, setDndState] = useState<DndRenderState>({
    isDragging: false,
    draggedIds: [],
    dropIndicator: null
  })

  const dragRef = useRef<DragRef | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)

  // Create/destroy overlay element
  const createOverlay = useCallback((sourceEl: HTMLElement) => {
    const overlay = document.createElement('div')
    overlay.className = 'sidebar-drag-overlay'

    // Clone the button content from the source
    const button = sourceEl.querySelector('button')
    if (button) {
      const clone = button.cloneNode(true) as HTMLElement
      // Strip event listeners by re-creating as innerHTML
      overlay.innerHTML = ''
      overlay.appendChild(clone)
      clone.style.pointerEvents = 'none'
      clone.style.opacity = '1'
      // Match the source width
      overlay.style.width = `${button.getBoundingClientRect().width}px`
    }

    Object.assign(overlay.style, {
      position: 'fixed',
      zIndex: '99999',
      pointerEvents: 'none',
      opacity: '0.9',
      transform: 'scale(1.02)',
      borderRadius: '8px',
      background: 'var(--color-surface-100)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)',
      transition: 'opacity 150ms, transform 150ms',
      willChange: 'left, top'
    })

    document.body.appendChild(overlay)
    overlayRef.current = overlay
  }, [])

  const destroyOverlay = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.remove()
      overlayRef.current = null
    }
  }, [])

  // Hit-test: find the sidebar item under the cursor and determine drop position
  const hitTest = useCallback(
    (clientX: number, clientY: number, drag: DragRef) => {
      const container = containerRef.current
      if (!container) return

      // Find all sidebar items using data attributes
      const items = container.querySelectorAll<HTMLElement>('[data-sidebar-item-id]')
      if (items.length === 0) return

      let newIndicator: DropIndicatorState | null = null

      // Check each item
      for (const itemEl of items) {
        const rect = itemEl.getBoundingClientRect()

        // Skip if cursor is not within horizontal bounds
        if (clientX < rect.left || clientX > rect.right) continue
        // Skip if cursor is not within vertical bounds (with some tolerance)
        if (clientY < rect.top - 2 || clientY > rect.bottom + 2) continue

        const itemId = itemEl.dataset.sidebarItemId!
        const isGroup = itemEl.dataset.sidebarItemType === 'group'

        // Don't allow dropping on self
        if (drag.ids.includes(itemId)) continue

        const y = clientY - rect.top
        const height = rect.height

        let position: 'before' | 'after' | 'inside'
        let targetId = itemId

        if (isGroup) {
          const state = useSessionStore.getState()
          const group = state.groups.find((g) => g.id === targetId)
          const isExpanded = group && !group.collapsed

          if (isExpanded) {
            if (y < height * 0.25) position = 'before'
            else position = 'inside'
          } else {
            if (y < height * 0.25) position = 'before'
            else if (y > height * 0.75) position = 'after'
            else position = 'inside'
          }

          // Don't allow dropping a group inside another group
          if (
            position === 'inside' &&
            drag.ids.some((id) => useSessionStore.getState().groups.some((g) => g.id === id))
          ) {
            position = y < height / 2 ? 'before' : 'after'
          }
        } else {
          position = y < height / 2 ? 'before' : 'after'

          const state = useSessionStore.getState()
          const parentGroup = state.groups.find((g) => g.sessionIds.includes(targetId))
          if (parentGroup) {
            const isFirst = parentGroup.sessionIds[0] === targetId
            const isLast =
              parentGroup.sessionIds[parentGroup.sessionIds.length - 1] === targetId

            const isDraggingGroup = drag.ids.some((id) =>
              state.groups.some((g) => g.id === id)
            )
            const isDraggingWithinGroup = drag.ids.every((id) =>
              parentGroup.sessionIds.includes(id)
            )

            if (!isDraggingGroup && !isDraggingWithinGroup) {
              if (isFirst && isLast) {
                if (y <= height * 0.75) {
                  targetId = parentGroup.id
                  position = 'inside'
                } else {
                  targetId = parentGroup.id
                  position = 'after'
                }
              } else if (isFirst) {
                if (y < height * 0.5) {
                  targetId = parentGroup.id
                  position = 'inside'
                }
              } else if (isLast) {
                if (y > height * 0.5 && y <= height * 0.75) {
                  targetId = parentGroup.id
                  position = 'inside'
                } else if (y > height * 0.75) {
                  targetId = parentGroup.id
                  position = 'after'
                }
              }
            } else {
              if (isLast && y > height * 0.75) {
                targetId = parentGroup.id
                position = 'after'
              }
            }
          }
        }

        newIndicator = { targetId, position }
        break
      }

      // If no item hit, check container edges and gaps between items
      if (!newIndicator && items.length > 0) {
        const containerRect = container.getBoundingClientRect()
        if (clientX >= containerRect.left && clientX <= containerRect.right) {
          const firstRect = items[0].getBoundingClientRect()
          const lastItem = items[items.length - 1]
          const lastRect = lastItem.getBoundingClientRect()

          // Helper: if the resolved item is inside a group, redirect "after" to the
          // group level so the drop lands outside the group, not appended inside it.
          const resolveAfter = (itemId: string): DropIndicatorState | null => {
            if (drag.ids.includes(itemId)) return null
            const state = useSessionStore.getState()
            const parentGroup = state.groups.find((g) => g.sessionIds.includes(itemId))
            if (parentGroup) {
              // Escape to after the entire group
              return { targetId: parentGroup.id, position: 'after' }
            }
            return { targetId: itemId, position: 'after' }
          }

          if (clientY < firstRect.top) {
            // Above all items
            const firstId = items[0].dataset.sidebarItemId!
            if (!drag.ids.includes(firstId)) {
              newIndicator = { targetId: firstId, position: 'before' }
            }
          } else if (clientY > lastRect.bottom) {
            // Below all items
            const lastId = lastItem.dataset.sidebarItemId!
            newIndicator = resolveAfter(lastId)
          } else {
            // Check gaps between items — find the closest item above the cursor
            let closestAbove: HTMLElement | null = null
            let closestAboveBottom = -Infinity
            for (const itemEl of items) {
              const rect = itemEl.getBoundingClientRect()
              if (rect.bottom <= clientY && rect.bottom > closestAboveBottom) {
                closestAbove = itemEl
                closestAboveBottom = rect.bottom
              }
            }
            if (closestAbove) {
              const id = closestAbove.dataset.sidebarItemId!
              newIndicator = resolveAfter(id)
            }
          }
        }
      }

      // Update indicator only if changed
      if (
        !drag.currentIndicator && !newIndicator
          ? false
          : !drag.currentIndicator ||
            !newIndicator ||
            drag.currentIndicator.targetId !== newIndicator.targetId ||
            drag.currentIndicator.position !== newIndicator.position
      ) {
        drag.currentIndicator = newIndicator
        setDndState((prev) => ({ ...prev, dropIndicator: newIndicator }))
      }
    },
    [containerRef]
  )

  // Auto-scroll when near container edges
  const autoScroll = useCallback(
    (clientY: number, drag: DragRef) => {
      const container = containerRef.current
      if (!container) return

      if (drag.scrollAnimFrame) {
        cancelAnimationFrame(drag.scrollAnimFrame)
        drag.scrollAnimFrame = null
      }

      const rect = container.getBoundingClientRect()
      const topDist = clientY - rect.top
      const bottomDist = rect.bottom - clientY

      let scrollDelta = 0
      if (topDist < AUTO_SCROLL_ZONE && topDist > 0) {
        scrollDelta = -AUTO_SCROLL_SPEED * (1 - topDist / AUTO_SCROLL_ZONE)
      } else if (bottomDist < AUTO_SCROLL_ZONE && bottomDist > 0) {
        scrollDelta = AUTO_SCROLL_SPEED * (1 - bottomDist / AUTO_SCROLL_ZONE)
      }

      if (scrollDelta !== 0) {
        const scroll = () => {
          container.scrollTop += scrollDelta
          drag.scrollAnimFrame = requestAnimationFrame(scroll)
        }
        drag.scrollAnimFrame = requestAnimationFrame(scroll)
      }
    },
    [containerRef]
  )

  // Pointer event handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, itemId: string, isGroup: boolean) => {
      // Only left button, not during editing
      if (e.button !== 0) return
      if ((e.target as HTMLElement).tagName === 'INPUT') return

      const state = useSessionStore.getState()
      let ids: string[]
      if (isGroup) {
        ids = [itemId]
      } else if (state.selectedSessionIds.includes(itemId)) {
        ids = state.selectedSessionIds.filter(
          (sid) => !state.groups.some((g) => g.id === sid)
        )
      } else {
        ids = [itemId]
      }

      dragRef.current = {
        ids,
        isGroup,
        startX: e.clientX,
        startY: e.clientY,
        started: false,
        sourceEl: e.currentTarget as HTMLElement,
        currentIndicator: null,
        scrollAnimFrame: null,
        overlayWidth: 0
      }
    },
    []
  )

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      if (!drag.started) {
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return

        // Start dragging
        drag.started = true
        if (drag.sourceEl) {
          createOverlay(drag.sourceEl)
          drag.overlayWidth = overlayRef.current?.getBoundingClientRect().width ?? 0
        }
        setDndState({
          isDragging: true,
          draggedIds: drag.ids,
          dropIndicator: null
        })

        // Prevent the click event that would fire on pointer up
        const preventClick = (evt: Event) => {
          evt.stopPropagation()
          evt.preventDefault()
        }
        document.addEventListener('click', preventClick, { capture: true, once: true })
        // Safety: remove if not fired within 500ms (click fires async after pointerup)
        setTimeout(() => document.removeEventListener('click', preventClick, { capture: true }), 500)
      }

      // Update overlay position (uses cached width to avoid layout thrashing)
      if (overlayRef.current) {
        overlayRef.current.style.left = `${e.clientX - drag.overlayWidth / 2}px`
        overlayRef.current.style.top = `${e.clientY - 20}px`
      }

      // Hit test
      hitTest(e.clientX, e.clientY, drag)

      // Auto-scroll
      autoScroll(e.clientY, drag)
    }

    const handlePointerUp = () => {
      const drag = dragRef.current
      if (!drag) return

      if (drag.scrollAnimFrame) {
        cancelAnimationFrame(drag.scrollAnimFrame)
      }

      if (drag.started && drag.currentIndicator) {
        moveItems(drag.ids, drag.currentIndicator.targetId, drag.currentIndicator.position)
      }

      dragRef.current = null
      destroyOverlay()
      setDndState({
        isDragging: false,
        draggedIds: [],
        dropIndicator: null
      })
    }

    // ESC to cancel drag
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current?.started) {
        e.preventDefault()
        if (dragRef.current.scrollAnimFrame) {
          cancelAnimationFrame(dragRef.current.scrollAnimFrame)
        }
        dragRef.current = null
        destroyOverlay()
        setDndState({
          isDragging: false,
          draggedIds: [],
          dropIndicator: null
        })
      }
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [createOverlay, destroyOverlay, hitTest, autoScroll, moveItems])

  return {
    isDragging: dndState.isDragging,
    draggedIds: dndState.draggedIds,
    dropIndicator: dndState.dropIndicator,
    handlePointerDown
  }
}
