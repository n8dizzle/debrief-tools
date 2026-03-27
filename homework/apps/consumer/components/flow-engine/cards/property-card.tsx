'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Home, Calendar, Ruler, BedDouble, Bath, MapPin } from 'lucide-react'
import { AddressMap } from '@/components/flow/address-map'
import { cn } from '@/lib/utils'
import type { PropertyData } from '@/lib/flows'

interface PropertyCardProps {
  property?: PropertyData
  showMap?: boolean
  onSelect?: (value: unknown, displayText: string) => void
  completed?: boolean
  selectedValue?: unknown
  className?: string
}

export function PropertyCard({
  property,
  showMap = true,
  onSelect,
  completed = false,
  selectedValue,
  className,
}: PropertyCardProps) {
  const [isLoading, setIsLoading] = useState(!completed)
  const [showDetails, setShowDetails] = useState(completed)

  // Simulate loading animation for new cards
  useEffect(() => {
    if (completed) return

    const timer = setTimeout(() => {
      setIsLoading(false)
      setShowDetails(true)
    }, 1200)

    return () => clearTimeout(timer)
  }, [completed])

  // Loading state
  if (!property) {
    return (
      <div className={cn(
        'rounded-2xl bg-white border border-slate-200 shadow-sm p-5',
        'animate-in fade-in duration-300',
        className
      )}>
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <span className="text-sm">Looking up property details...</span>
        </div>
      </div>
    )
  }

  const shortAddress = property.street || property.formattedAddress?.split(',')[0] || property.address
  const cityState = [property.city, property.state].filter(Boolean).join(', ')
  const zipCode = property.postalCode

  const stats = [
    { icon: Calendar, value: property.yearBuilt, label: 'Built' },
    { icon: Ruler, value: property.sqft?.toLocaleString(), label: 'Sq Ft' },
    { icon: Home, value: property.stories, label: 'Stories' },
    { icon: BedDouble, value: property.beds, label: 'Beds' },
    { icon: Bath, value: property.baths, label: 'Baths' },
  ].filter(stat => stat.value)

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        completed
          ? 'bg-teal-50/50 border border-teal-200 shadow-sm'
          : 'bg-white border border-slate-200 shadow-sm',
        className
      )}
    >
      {/* Map */}
      {showMap && property.latitude && property.longitude && (
        <div className="relative">
          <AddressMap
            latitude={property.latitude}
            longitude={property.longitude}
            address={property.formattedAddress || property.address}
            className="h-36 w-full"
          />
          {/* Map overlay gradient */}
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/80 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Address header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {completed ? (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-500 flex-shrink-0">
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
              ) : (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 flex-shrink-0">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                </div>
              )}
              <p className={cn(
                'font-semibold truncate',
                completed ? 'text-teal-900' : 'text-slate-900'
              )}>
                {shortAddress}
              </p>
            </div>
            {(cityState || zipCode) && (
              <p className="text-sm text-slate-500 ml-8">
                {cityState}{zipCode ? ` ${zipCode}` : ''}
              </p>
            )}
          </div>
          {!completed && isLoading && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 flex-shrink-0">
              <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
              <span className="text-xs text-slate-500">Loading</span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        {showDetails && stats.length > 0 && (
          <div className={cn(
            'grid gap-2',
            stats.length <= 3 ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-5',
            'animate-in fade-in duration-300'
          )}>
            {stats.slice(0, 5).map((stat, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl p-3 text-center',
                  completed ? 'bg-teal-100/50' : 'bg-slate-50'
                )}
              >
                <stat.icon className={cn(
                  'h-4 w-4 mx-auto mb-1.5',
                  completed ? 'text-teal-600' : 'text-slate-400'
                )} />
                <p className={cn(
                  'text-sm font-semibold',
                  completed ? 'text-teal-900' : 'text-slate-900'
                )}>
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
