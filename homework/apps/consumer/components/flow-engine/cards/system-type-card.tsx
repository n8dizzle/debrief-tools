'use client'

import { useState } from 'react'
import { Check, Snowflake, Flame, Wind, Thermometer } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SystemType {
  id: string
  label: string
  description: string
  icon: 'snowflake' | 'flame' | 'wind' | 'thermometer'
  recommended?: boolean
}

interface SystemTypeCardProps {
  systemTypes?: SystemType[]
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

// Default system types for HVAC
const DEFAULT_SYSTEM_TYPES: SystemType[] = [
  {
    id: 'central_ac',
    label: 'Central AC',
    description: 'Air conditioning only',
    icon: 'snowflake',
  },
  {
    id: 'heat_pump',
    label: 'Heat Pump',
    description: 'Heating and cooling in one system',
    icon: 'thermometer',
    recommended: true,
  },
  {
    id: 'furnace_ac',
    label: 'Furnace + AC',
    description: 'Gas furnace with air conditioning',
    icon: 'flame',
  },
  {
    id: 'air_handler',
    label: 'Air Handler',
    description: 'Indoor unit for heat pump systems',
    icon: 'wind',
  },
]

const ICON_MAP = {
  snowflake: Snowflake,
  flame: Flame,
  wind: Wind,
  thermometer: Thermometer,
}

export function SystemTypeCard({
  systemTypes = DEFAULT_SYSTEM_TYPES,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: SystemTypeCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof selectedValue === 'string' ? selectedValue : null
  )

  const handleSelect = (systemType: SystemType) => {
    if (completed) return

    setSelectedId(systemType.id)
    onSelect?.(systemType.id, systemType.label)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {systemTypes.map((systemType, index) => {
        const isSelected = selectedId === systemType.id
        const Icon = ICON_MAP[systemType.icon]

        return (
          <button
            key={systemType.id}
            onClick={() => handleSelect(systemType)}
            disabled={completed}
            className={cn(
              'w-full text-left rounded-2xl border p-4',
              'transition-all duration-200',
              'animate-in fade-in slide-in-from-bottom-2',
              isSelected
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-primary/30 hover:bg-muted/50',
              completed && !isSelected && 'opacity-50',
              completed && 'cursor-default'
            )}
            style={{ animationDelay: `${index * 75}ms` }}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl shrink-0',
                  isSelected
                    ? 'bg-primary/20'
                    : 'bg-gradient-to-br from-primary/10 to-primary/5'
                )}
              >
                <Icon
                  className={cn(
                    'h-6 w-6',
                    isSelected ? 'text-primary' : 'text-primary/70'
                  )}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{systemType.label}</p>
                  {systemType.recommended && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-xs font-medium text-primary">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {systemType.description}
                </p>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary shrink-0">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
