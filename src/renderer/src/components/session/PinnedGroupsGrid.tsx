import { forwardRef, useMemo } from 'react'
import { usePinnedStore, getPinnedState, togglePinnedGroup, findPinnedByGroupId, type PinnedGroup } from '../../store/pinned-store'
import { resolveColorHex } from '../../store/session-types'
import { useSessionStore } from '../../store/session-store'

interface PinnedGroupsGridProps {
  collapsed: boolean
  onContextMenu: (e: React.MouseEvent, pinnedId: string) => void
  isOverPinnedZone?: boolean
  draggedGroupId?: string | null
}

function getGridColumns(count: number, sidebarWidth: number): string {
  if (count <= 0) return '1fr'
  if (count === 1) return '1fr'
  if (count === 2) return 'repeat(2, 1fr)'
  if (count === 3) return 'repeat(3, 1fr)'
  if (count === 4) return sidebarWidth < 240 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'
  return 'repeat(3, 1fr)'
}

export const PinnedGroupsGrid = forwardRef<HTMLDivElement, PinnedGroupsGridProps>(
  function PinnedGroupsGrid({ collapsed, onContextMenu, isOverPinnedZone, draggedGroupId }, ref) {
    const pinnedGroups = usePinnedStore((s) => s.pinnedGroups)
    const sidebarWidth = useSessionStore((s) => s.sidebarWidth)

    // Check if the dragged group is already pinned
    const alreadyPinnedId = useMemo(() => {
      if (!draggedGroupId) return null
      const pg = findPinnedByGroupId(draggedGroupId)
      return pg?.id ?? null
    }, [draggedGroupId])

    // Show placeholder when dragging a group that isn't already pinned
    const showPlaceholder = !!draggedGroupId && !alreadyPinnedId
    const totalCards = pinnedGroups.length + (showPlaceholder ? 1 : 0)
    const gridColumns = useMemo(() => getGridColumns(totalCards, sidebarWidth), [totalCards, sidebarWidth])

    // Force expand when dragging a group over
    const effectiveCollapsed = collapsed && !draggedGroupId

    return (
      <div
        ref={ref}
        className="grid transition-[grid-template-rows,opacity,transform] duration-250 ease-out flex-shrink-0"
        style={{
          gridTemplateRows: effectiveCollapsed ? '0fr' : '1fr',
          opacity: effectiveCollapsed ? 0 : 1,
          transform: effectiveCollapsed ? 'translateY(-4px)' : 'translateY(0)'
        }}
      >
        <div className="overflow-hidden">
          <div className="px-2 pt-0.5 pb-1">
            <div className="grid gap-1.5" style={{ gridTemplateColumns: gridColumns }}>
              {pinnedGroups.map((pg) => (
                <PinnedGroupButton
                  key={pg.id}
                  pinnedGroup={pg}
                  onContextMenu={onContextMenu}
                  highlighted={isOverPinnedZone && pg.id === alreadyPinnedId}
                />
              ))}
              {showPlaceholder && (
                <div className={`
                  flex items-center justify-center px-2 py-2 rounded-lg border-2 border-dashed
                  text-[12px] font-medium transition-all duration-150
                  ${isOverPinnedZone
                    ? 'border-accent/60 text-accent/80 bg-accent/10'
                    : 'border-border-subtle/60 text-text-tertiary/50'
                  }
                `}>
                  <span className="truncate">{isOverPinnedZone ? 'Drop to pin' : 'Pin'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
)

function PinnedGroupButton({
  pinnedGroup,
  onContextMenu,
  highlighted
}: {
  pinnedGroup: PinnedGroup
  onContextMenu: (e: React.MouseEvent, pinnedId: string) => void
  highlighted?: boolean
}) {
  const state = getPinnedState(pinnedGroup)
  const colorHex = resolveColorHex(pinnedGroup.color)

  const handleClick = () => {
    togglePinnedGroup(pinnedGroup.id)
  }

  const bgStyle: React.CSSProperties = colorHex
    ? highlighted
      ? { backgroundColor: `${colorHex}40`, borderColor: `${colorHex}60` }
      : state === 'active-visible'
        ? { backgroundColor: `${colorHex}25`, borderColor: `${colorHex}40` }
        : state === 'active-hidden'
          ? { backgroundColor: `${colorHex}15`, borderColor: `${colorHex}20` }
          : { backgroundColor: `${colorHex}10`, borderColor: `${colorHex}15` }
    : {}

  return (
    <button
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, pinnedGroup.id)
      }}
      className={`
        flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg
        border text-[12px] font-medium truncate transition-all duration-150
        ${highlighted
          ? colorHex ? 'text-text-primary ring-2 ring-accent/50' : 'bg-accent/25 border-accent/40 text-text-primary ring-2 ring-accent/50'
          : state === 'active-visible'
            ? colorHex ? 'text-text-primary' : 'bg-accent/15 border-accent/30 text-text-primary'
            : state === 'active-hidden'
              ? colorHex ? 'text-text-secondary' : 'bg-surface-100 border-border-subtle text-text-secondary'
              : colorHex ? 'text-text-tertiary hover:text-text-secondary' : 'bg-surface-100/50 border-border-subtle text-text-tertiary hover:bg-surface-200 hover:text-text-secondary'
        }
      `}
      style={bgStyle}
    >
      <span className="truncate">{pinnedGroup.name}</span>
      {state === 'active-hidden' && !highlighted && (
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorHex || 'var(--accent)' }}
        />
      )}
    </button>
  )
}
