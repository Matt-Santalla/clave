import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

const ContextMenuRoot = ContextMenuPrimitive.Root
const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const contextMenuTransition = {
  duration: 0.15,
  ease: [0.2, 0, 0, 1] as const
}

const ContextMenuContent = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content> & {
    animated?: boolean
    open?: boolean
  }
>(({ className, animated, open, children, ...props }, ref) => {
  if (animated) {
    return (
      <AnimatePresence>
        {open && (
          <ContextMenuPrimitive.Portal forceMount>
            <ContextMenuPrimitive.Content
              ref={ref}
              forceMount
              className="z-50 outline-none"
              {...props}
              asChild
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={contextMenuTransition}
                className={cn(
                  'min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface-100 py-1 shadow-xl',
                  className
                )}
              >
                {children}
              </motion.div>
            </ContextMenuPrimitive.Content>
          </ContextMenuPrimitive.Portal>
        )}
      </AnimatePresence>
    )
  }

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        ref={ref}
        className={cn(
          'z-50 min-w-[160px] overflow-hidden rounded-lg border border-border bg-surface-100 py-1 shadow-xl',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className
        )}
        {...props}
      >
        {children}
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  )
})
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & { danger?: boolean }
>(({ className, danger, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center justify-between px-3 py-1.5 text-sm font-medium outline-none transition-colors',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      danger
        ? 'text-red-400 hover:text-red-300 focus:bg-surface-200'
        : 'text-text-primary hover:bg-surface-200 focus:bg-surface-200',
      className
    )}
    {...props}
  />
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof ContextMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn('my-1 h-px bg-border-subtle', className)}
    {...props}
  />
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

export {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator
}
