'use client'

import Link from 'next/link'
import { Home, Calendar, Ruler, MapPin, ArrowRight, BedDouble, Bath } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HomeSummaryProps {
  property: {
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
  className?: string
}

export function HomeSummary({ property, className }: HomeSummaryProps) {
  const shortAddress = property.street || property.address?.split(',')[0] || 'Your Home'
  const cityState = [property.city, property.state].filter(Boolean).join(', ')
  const zipCode = property.postalCode

  // Build stats array from available data
  const stats = [
    property.yearBuilt && {
      icon: Calendar,
      value: property.yearBuilt.toString(),
      label: 'Built',
    },
    property.sqft && {
      icon: Ruler,
      value: property.sqft.toLocaleString(),
      label: 'Sq Ft',
    },
    property.stories && {
      icon: Home,
      value: property.stories.toString(),
      label: property.stories === 1 ? 'Story' : 'Stories',
    },
    property.beds && {
      icon: BedDouble,
      value: property.beds.toString(),
      label: property.beds === 1 ? 'Bed' : 'Beds',
    },
    property.baths && {
      icon: Bath,
      value: property.baths.toString(),
      label: property.baths === 1 ? 'Bath' : 'Baths',
    },
  ].filter(Boolean) as Array<{ icon: typeof Calendar; value: string; label: string }>

  return (
    <div className={cn('space-y-4', className)}>
      {/* Address header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 shrink-0">
          <MapPin className="w-5 h-5 text-teal-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">
            {shortAddress}
          </h3>
          {(cityState || zipCode) && (
            <p className="text-sm text-muted-foreground">
              {cityState}{zipCode ? ` ${zipCode}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      {stats.length > 0 && (
        <div className={cn(
          'grid gap-2',
          stats.length <= 3 ? 'grid-cols-3' : 'grid-cols-3'
        )}>
          {stats.slice(0, 6).map((stat, index) => (
            <div
              key={index}
              className="rounded-xl bg-muted/50 p-3 text-center"
            >
              <stat.icon className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="pt-2 border-t border-border">
        <Link
          href="/dashboard"
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'rounded-xl py-3 px-4',
            'text-sm font-medium',
            'bg-teal-600 text-white',
            'hover:bg-teal-700 active:scale-[0.98]',
            'transition-all duration-150',
            'min-h-[44px]'
          )}
        >
          View Full Dashboard
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
