import {
  ChevronUpDownIcon,
  Cog6ToothIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { useUserStore, getInitials } from '../../store/user-store'
import { useSessionStore, type ActiveView } from '../../store/session-store'
import { cn } from '../../lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover'

export function SidebarFooter() {
  const name = useUserStore((s) => s.name)
  const avatarPath = useUserStore((s) => s.avatarPath)
  const setActiveView = useSessionStore((s) => s.setActiveView)
  const activeView = useSessionStore((s) => s.activeView)

  const initials = getInitials(name)

  const items: { view: ActiveView; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string }[] = [
    { view: 'usage', icon: ChartBarIcon, label: 'Usage' },
    { view: 'settings', icon: Cog6ToothIcon, label: 'Settings' }
  ]

  return (
    <div className="relative flex-shrink-0 px-2 pb-2 pt-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors',
              'hover:bg-surface-100 text-text-primary data-[state=open]:bg-surface-200'
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {avatarPath ? (
                <img
                  src={`file://${avatarPath}`}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-text-secondary">
                  {initials}
                </span>
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <span className="text-[13px] font-semibold truncate block">{name}</span>
            </div>
            <ChevronUpDownIcon className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" sideOffset={8} className="min-w-[200px]">
          {/* User header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {avatarPath ? (
                <img
                  src={`file://${avatarPath}`}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-text-secondary">
                  {initials}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold text-text-primary truncate block">{name}</span>
            </div>
          </div>
          <div className="h-px bg-border-subtle" />
          {/* Menu items */}
          <div className="py-1">
            {items.map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors',
                  activeView === view
                    ? 'bg-surface-200 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-200/50'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-text-tertiary" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
