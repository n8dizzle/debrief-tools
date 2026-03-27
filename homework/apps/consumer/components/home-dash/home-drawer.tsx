'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Home } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HomeSummary } from './home-summary'
import { MinimizedTab } from './minimized-tab'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'

interface PropertyData {
  address: string
  formattedAddress?: string
  street?: string
  city?: string
  state?: string
  postalCode?: string
  sqft?: number
  yearBuilt?: number
  stories?: number
  beds?: number
  baths?: number
  latitude?: number
  longitude?: number
}

interface HomeDrawerProps {
  /** Property data to display */
  property: PropertyData | null
  /** Whether the drawer should be shown (after property confirmation) */
  isEnabled?: boolean
  /** Auto-minimize delay in ms (default: 3000) */
  autoMinimizeDelay?: number
  /** Callback when drawer is expanded */
  onExpand?: () => void
  /** Callback when drawer is minimized */
  onMinimize?: () => void
  className?: string
}

type DrawerState = 'hidden' | 'expanded' | 'minimized'

export function HomeDrawer({
  property,
  isEnabled = false,
  autoMinimizeDelay = 3000,
  onExpand,
  onMinimize,
  className,
}: HomeDrawerProps) {
  const [state, setState] = useState<DrawerState>('hidden')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Show drawer when enabled and property is set
  useEffect(() => {
    if (isEnabled && property && state === 'hidden') {
      setState('expanded')
      onExpand?.()
    } else if (!isEnabled && state !== 'hidden') {
      setState('hidden')
    }
  }, [isEnabled, property, state, onExpand])

  // Auto-minimize after delay
  useEffect(() => {
    if (state !== 'expanded' || autoMinimizeDelay <= 0) return

    const timer = setTimeout(() => {
      setState('minimized')
      onMinimize?.()
    }, autoMinimizeDelay)

    return () => clearTimeout(timer)
  }, [state, autoMinimizeDelay, onMinimize])

  const handleExpand = useCallback(() => {
    setState('expanded')
    onExpand?.()
  }, [onExpand])

  const handleMinimize = useCallback(() => {
    setState('minimized')
    onMinimize?.()
  }, [onMinimize])

  // Don't render anything if hidden or no property
  if (state === 'hidden' || !property) {
    return null
  }

  // Minimized state - show tab
  if (state === 'minimized') {
    return (
      <MinimizedTab
        onClick={handleExpand}
        address={property.street || property.address}
        orientation={isDesktop ? 'vertical' : 'horizontal'}
        className={isDesktop ? undefined : 'fixed bottom-0 left-0 right-0 z-40'}
      />
    )
  }

  // Expanded state - show drawer/sheet
  return (
    <Sheet open={state === 'expanded'} onOpenChange={(open) => !open && handleMinimize()}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className={cn(
          isDesktop
            ? 'w-[320px] sm:max-w-[320px]'
            : 'h-auto max-h-[70vh] rounded-t-2xl',
          'p-0 flex flex-col',
          className
        )}
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 flex flex-row items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100">
              <Home className="w-4 h-4 text-teal-600" />
            </div>
            <SheetTitle className="text-left">Your Home</SheetTitle>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Minimize</span>
            </Button>
          </SheetClose>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <HomeSummary property={property} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// =============================================================================
// Hook for managing home drawer state externally
// =============================================================================

interface UseHomeDrawerOptions {
  autoMinimizeDelay?: number
}

export function useHomeDrawer(options: UseHomeDrawerOptions = {}) {
  const [property, setProperty] = useState<PropertyData | null>(null)
  const [isEnabled, setIsEnabled] = useState(false)

  const showDrawer = useCallback((propertyData: PropertyData) => {
    setProperty(propertyData)
    setIsEnabled(true)
  }, [])

  const hideDrawer = useCallback(() => {
    setIsEnabled(false)
  }, [])

  const updateProperty = useCallback((updates: Partial<PropertyData>) => {
    setProperty((prev) => (prev ? { ...prev, ...updates } : null))
  }, [])

  return {
    property,
    isEnabled,
    showDrawer,
    hideDrawer,
    updateProperty,
    drawerProps: {
      property,
      isEnabled,
      autoMinimizeDelay: options.autoMinimizeDelay,
    },
  }
}
