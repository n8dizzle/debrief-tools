'use client'

import { useState, useEffect } from 'react'
import {
  Home,
  X,
  ChevronRight,
  MapPin,
  Calendar,
  Ruler,
  BedDouble,
  Bath,
  Building2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AddressMap } from '@/components/flow/address-map'
import type { HomeData } from '@/types/flow'

interface ArtifactsPanelProps {
  homeData: HomeData | null
  isOpen: boolean
  isOnboarding?: boolean
  onClose: () => void
  onToggle: () => void
  className?: string
}

// Fun commentary for onboarding reveal
const REVEAL_COMMENTS = [
  { key: 'address', comment: 'Found it. Nice place.' },
  { key: 'yearBuilt', comment: (year: number) => year < 2000 ? 'A classic. They built them solid back then.' : 'Pretty recent. Nice.' },
  { key: 'sqft', comment: (sqft: number) => sqft > 3000 ? 'Plenty of room to breathe.' : sqft > 2000 ? 'Good size. Not too big, not too cramped.' : 'Cozy. Efficient.' },
  { key: 'taxes', comment: 'Sorry about the taxes. Ouch.' },
]

export function ArtifactsPanel({
  homeData,
  isOpen,
  isOnboarding = false,
  onClose,
  onToggle,
  className,
}: ArtifactsPanelProps) {
  const [revealStage, setRevealStage] = useState(0)
  const [activeComment, setActiveComment] = useState<string | null>(null)

  // Onboarding reveal animation
  useEffect(() => {
    if (isOnboarding && homeData && isOpen) {
      const stages = 5
      let current = 0

      const interval = setInterval(() => {
        current++
        setRevealStage(current)

        // Show fun comments at certain stages
        if (current === 1) setActiveComment('Found it. Nice place.')
        if (current === 2) {
          const year = homeData.yearBuilt
          if (year) {
            setActiveComment(year < 2000 ? 'A classic. They built them solid back then.' : 'Pretty recent build. Nice.')
          }
        }
        if (current === 3) {
          const sqft = homeData.sqft
          if (sqft) {
            setActiveComment(sqft > 3000 ? 'Plenty of room to breathe.' : sqft > 2000 ? 'Good size.' : 'Cozy. Efficient.')
          }
        }
        if (current === 4) setActiveComment('Sorry about the taxes. Ouch.')
        if (current === 5) setActiveComment(null)

        if (current >= stages) {
          clearInterval(interval)
        }
      }, 800)

      return () => clearInterval(interval)
    } else if (!isOnboarding) {
      // If not onboarding, show everything immediately
      setRevealStage(10)
    }
  }, [isOnboarding, homeData, isOpen])

  if (!homeData) return null

  const shortAddress = homeData.street || homeData.formattedAddress?.split(',')[0] || 'Your Home'
  const cityState = [homeData.city, homeData.state].filter(Boolean).join(', ')

  // Stats to display
  const stats = [
    homeData.yearBuilt && {
      icon: Calendar,
      value: homeData.yearBuilt.toString(),
      label: 'Built',
    },
    homeData.sqft && {
      icon: Ruler,
      value: homeData.sqft.toLocaleString(),
      label: 'Sq Ft',
    },
    homeData.stories && {
      icon: Building2,
      value: homeData.stories.toString(),
      label: homeData.stories === 1 ? 'Story' : 'Stories',
    },
    homeData.beds && {
      icon: BedDouble,
      value: homeData.beds.toString(),
      label: homeData.beds === 1 ? 'Bed' : 'Beds',
    },
    homeData.baths && {
      icon: Bath,
      value: homeData.baths.toString(),
      label: homeData.baths === 1 ? 'Bath' : 'Baths',
    },
  ].filter(Boolean) as Array<{ icon: typeof Calendar; value: string; label: string }>

  // Collapsed tab (always visible when panel is closed)
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-40',
          'flex items-center gap-1.5 px-2 py-4',
          'bg-slate-900 text-slate-300 rounded-l-lg',
          'hover:bg-slate-800 hover:text-white transition-colors',
          'shadow-lg border-l border-t border-b border-slate-700/50',
          'writing-mode-vertical',
          className
        )}
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        <Home className="w-4 h-4 rotate-90" />
        <span className="text-sm font-medium">Your Home</span>
        <ChevronRight className="w-4 h-4 rotate-90" />
      </button>
    )
  }

  return (
    <div
      className={cn(
        'w-80 h-full flex flex-col',
        'bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800',
        'animate-in slide-in-from-right duration-300',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <Home className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <span className="font-semibold text-slate-900 dark:text-white">Your Home</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fun comment banner (onboarding only) */}
      {activeComment && (
        <div className="px-4 py-3 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-900/30 animate-in fade-in duration-300">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-teal-700 dark:text-teal-300">{activeComment}</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Map */}
        {homeData.latitude && homeData.longitude && revealStage >= 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <AddressMap
              latitude={homeData.latitude}
              longitude={homeData.longitude}
              address={homeData.formattedAddress || ''}
              className="h-40 rounded-xl overflow-hidden"
            />
          </div>
        )}

        {/* Address */}
        {revealStage >= 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                <MapPin className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                  {shortAddress}
                </h3>
                {cityState && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {cityState} {homeData.postalCode}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        {stats.length > 0 && revealStage >= 2 && (
          <div className={cn(
            'grid grid-cols-3 gap-2',
            'animate-in fade-in slide-in-from-bottom-2 duration-500'
          )}>
            {stats.map((stat, index) => (
              <div
                key={index}
                className={cn(
                  'rounded-xl bg-white dark:bg-slate-800 p-3 text-center',
                  'border border-slate-200 dark:border-slate-700',
                  'animate-in fade-in duration-300'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <stat.icon className="w-4 h-4 mx-auto mb-1.5 text-slate-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        {revealStage >= 4 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <a
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
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
