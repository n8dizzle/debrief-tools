'use client'

import { useState } from 'react'
import { Check, Plus, Minus, Wifi, Wind, Droplets, Shield, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Addon {
  id: string
  name: string
  description: string
  price: number
  icon: 'wifi' | 'wind' | 'droplets' | 'shield' | 'wrench'
  popular?: boolean
}

interface AddonsCardProps {
  addons?: Addon[]
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

// Mock data for development
const MOCK_ADDONS: Addon[] = [
  {
    id: 'thermostat',
    name: 'Smart Thermostat',
    description: 'Ecobee or Nest included with installation',
    price: 350,
    icon: 'wifi',
    popular: true,
  },
  {
    id: 'uv-light',
    name: 'UV Air Purifier',
    description: 'Kills 99% of airborne pathogens',
    price: 650,
    icon: 'wind',
  },
  {
    id: 'humidifier',
    name: 'Whole-Home Humidifier',
    description: 'Maintain optimal humidity levels',
    price: 850,
    icon: 'droplets',
  },
  {
    id: 'surge',
    name: 'Surge Protector',
    description: 'Protect your system from power surges',
    price: 250,
    icon: 'shield',
  },
  {
    id: 'maintenance',
    name: '2-Year Maintenance Plan',
    description: 'Bi-annual tune-ups included',
    price: 400,
    icon: 'wrench',
  },
]

const ICON_MAP = {
  wifi: Wifi,
  wind: Wind,
  droplets: Droplets,
  shield: Shield,
  wrench: Wrench,
}

export function AddonsCard({
  addons = MOCK_ADDONS,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: AddonsCardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    Array.isArray(selectedValue) ? selectedValue.map((a: any) => a.id) : []
  )

  const toggleAddon = (addon: Addon) => {
    if (completed) return

    const newSelectedIds = selectedIds.includes(addon.id)
      ? selectedIds.filter((id) => id !== addon.id)
      : [...selectedIds, addon.id]

    setSelectedIds(newSelectedIds)

    const selectedAddons = addons.filter((a) => newSelectedIds.includes(a.id))
    const displayText = selectedAddons.length
      ? selectedAddons.map((a) => a.name).join(', ')
      : 'No extras'
    onSelect?.(selectedAddons, displayText)
  }

  const totalPrice = addons
    .filter((a) => selectedIds.includes(a.id))
    .reduce((sum, a) => sum + a.price, 0)

  return (
    <div className={cn('space-y-3', className)}>
      {addons.map((addon, index) => {
        const isSelected = selectedIds.includes(addon.id)
        const Icon = ICON_MAP[addon.icon]

        return (
          <button
            key={addon.id}
            onClick={() => toggleAddon(addon)}
            disabled={completed}
            className={cn(
              'w-full text-left rounded-xl border p-3',
              'transition-all duration-200',
              'animate-in fade-in slide-in-from-bottom-2',
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/30',
              completed && 'cursor-default'
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                  isSelected ? 'bg-primary/20' : 'bg-muted'
                )}
              >
                <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground text-sm">{addon.name}</p>
                  {addon.popular && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{addon.description}</p>
              </div>

              {/* Price & Toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-medium text-foreground">
                  +${addon.price}
                </span>
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    'transition-colors duration-200',
                    isSelected ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  {isSelected ? (
                    <Check className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </button>
        )
      })}

      {/* Total */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} add-on{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <span className="text-sm font-semibold text-foreground">
            +${totalPrice.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
