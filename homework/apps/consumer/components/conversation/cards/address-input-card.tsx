'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddressPrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

interface AddressInputCardProps {
  onSelect: (prediction: AddressPrediction, details: AddressDetails) => void
  autoFocus?: boolean
  className?: string
}

interface AddressDetails {
  formattedAddress: string
  latitude: number
  longitude: number
  street?: string
  city?: string
  state?: string
  postalCode?: string
}

export function AddressInputCard({
  onSelect,
  autoFocus = true,
  className,
}: AddressInputCardProps) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<AddressPrediction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showPredictions, setShowPredictions] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [autoFocus])

  // Fetch predictions with debounce
  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([])
      setShowPredictions(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(input)}`
      )
      const data = await response.json()
      if (data.predictions) {
        setPredictions(data.predictions)
        setShowPredictions(true)
      }
    } catch (error) {
      console.error('Failed to fetch predictions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) fetchPredictions(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, fetchPredictions])

  // Handle selection
  const handleSelect = async (prediction: AddressPrediction) => {
    setIsSelecting(true)
    setShowPredictions(false)
    setQuery(prediction.structured_formatting.main_text)

    try {
      const response = await fetch(
        `/api/places/details?place_id=${prediction.place_id}`
      )
      const data = await response.json()

      if (data.result) {
        const result = data.result
        const components = result.address_components || []
        const getComponent = (type: string) =>
          components.find((c: { types: string[] }) => c.types.includes(type))?.long_name || undefined

        const street = `${getComponent('street_number') || ''} ${getComponent('route') || ''}`.trim() || undefined

        const details: AddressDetails = {
          formattedAddress: result.formatted_address,
          latitude: result.geometry?.location?.lat || 0,
          longitude: result.geometry?.location?.lng || 0,
          street,
          city: getComponent('locality') || getComponent('sublocality'),
          state: getComponent('administrative_area_level_1'),
          postalCode: getComponent('postal_code'),
        }

        onSelect(prediction, details)
      }
    } catch (error) {
      console.error('Failed to get place details:', error)
      setIsSelecting(false)
    }
  }

  return (
    <div
      className={cn(
        'space-y-2',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {/* Address input */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border-2 bg-background p-3',
          'transition-colors duration-200',
          isSelecting
            ? 'border-primary/50 bg-primary/5'
            : 'border-primary focus-within:border-primary'
        )}
      >
        <MapPin className="h-5 w-5 text-primary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your address..."
          disabled={isSelecting}
          className={cn(
            'flex-1 bg-transparent text-base placeholder:text-muted-foreground/60',
            'focus:outline-none disabled:opacity-60',
            // Prevent iOS zoom
            'text-[16px]'
          )}
          autoComplete="off"
          aria-label="Address search"
        />
        {(isLoading || isSelecting) && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Predictions dropdown */}
      {showPredictions && predictions.length > 0 && (
        <div
          className={cn(
            'rounded-xl border border-border bg-card shadow-lg',
            'max-h-60 overflow-y-auto',
            'animate-in fade-in slide-in-from-top-2 duration-200'
          )}
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              onClick={() => handleSelect(prediction)}
              className={cn(
                'w-full px-4 py-3 text-left',
                'hover:bg-muted transition-colors',
                'border-b border-border last:border-b-0',
                'first:rounded-t-xl last:rounded-b-xl',
                'min-h-[44px]' // Touch target
              )}
            >
              <p className="text-sm font-medium text-foreground">
                {prediction.structured_formatting.main_text}
              </p>
              <p className="text-xs text-muted-foreground">
                {prediction.structured_formatting.secondary_text}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
