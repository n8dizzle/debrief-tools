'use client'

import { cn } from '@/lib/utils'
import type { ChipButton } from '@/types/conversation'

interface ChipMessageProps {
  buttons: ChipButton[]
  onSelect: (button: ChipButton) => void
  disabled?: boolean
  isNew?: boolean
  className?: string
}

export function ChipMessage({
  buttons,
  onSelect,
  disabled = false,
  isNew = false,
  className,
}: ChipMessageProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        isNew && 'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {buttons.map((button, index) => (
        <button
          key={button.value}
          onClick={() => onSelect(button)}
          disabled={disabled}
          className={cn(
            // Touch target - min 44px
            'min-h-[44px] px-4 py-2.5',
            // Shape
            'rounded-full',
            // Border
            'border border-border',
            // Background
            'bg-card',
            // Typography
            'text-sm font-medium text-foreground',
            // Hover state
            'hover:bg-muted hover:border-primary/30',
            // Active/pressed state
            'active:scale-[0.98] active:bg-primary/5',
            // Focus state
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
            // Transitions
            'transition-all duration-150',
            // Disabled
            'disabled:opacity-50 disabled:pointer-events-none',
            // Staggered animation for multiple chips
            isNew && 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both',
            isNew && `[animation-delay:${index * 50}ms]`
          )}
          style={{
            animationDelay: isNew ? `${index * 50}ms` : undefined,
          }}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}

// Variant for prompt tags (initial suggestions)
interface PromptTagsProps {
  tags: Array<{ label: string; value: string; icon?: React.ComponentType<{ className?: string }> }>
  onSelect: (value: string) => void
  className?: string
}

export function PromptTags({ tags, onSelect, className }: PromptTagsProps) {
  return (
    <div className={cn('flex flex-wrap justify-center gap-2', className)}>
      {tags.map((tag, index) => {
        const Icon = tag.icon
        return (
          <button
            key={tag.value}
            onClick={() => onSelect(tag.value)}
            className={cn(
              // Touch target
              'min-h-[44px] px-4 py-2.5',
              // Shape
              'rounded-full',
              // Border
              'border border-border',
              // Background
              'bg-card',
              // Typography
              'text-sm font-medium text-foreground',
              // Flex for icon
              'inline-flex items-center gap-2',
              // Hover state
              'hover:bg-muted hover:border-primary/30',
              // Active state
              'active:scale-[0.98]',
              // Focus
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              // Transitions
              'transition-all duration-150',
              // Staggered entrance animation
              'animate-in fade-in slide-in-from-bottom-4 fill-mode-both',
              `[animation-delay:${index * 75 + 200}ms]`
            )}
            style={{
              animationDelay: `${index * 75 + 200}ms`,
            }}
          >
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {tag.label}
          </button>
        )
      })}
    </div>
  )
}
