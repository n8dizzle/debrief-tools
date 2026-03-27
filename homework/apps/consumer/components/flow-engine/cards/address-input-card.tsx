'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  loadGooglePlacesApi,
  createPlacesClients,
  fetchPredictions,
  fetchPlaceDetails,
  type PlacePrediction,
  type PlacesClients,
} from '@/lib/places-client'

interface AddressInputCardProps {
  onSelect: (address: string, details: AddressDetails) => void
  autoFocus?: boolean
  className?: string
}

export interface AddressDetails {
  formattedAddress: string
  latitude: number
  longitude: number
  placeId: string
  street?: string
  city?: string
  state?: string
  zipCode?: string
}

export function AddressInputCard({
  onSelect,
  autoFocus = true,
  className,
}: AddressInputCardProps) {
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showPredictions, setShowPredictions] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [clients, setClients] = useState<PlacesClients | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize Google Places API
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setApiError('Address lookup unavailable')
      return
    }

    loadGooglePlacesApi(apiKey)
      .then((google) => {
        setClients(createPlacesClients(google))
      })
      .catch((err) => {
        console.error('[AddressInputCard] Failed to load Google Places:', err)
        setApiError('Address lookup unavailable')
      })
  }, [])

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [autoFocus])

  // Fetch predictions with debounce
  const fetchPredictionsDebounced = useCallback(
    (input: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (!clients || input.length < 3) {
        setPredictions([])
        setShowPredictions(false)
        return
      }

      debounceRef.current = setTimeout(async () => {
        setIsLoading(true)
        try {
          const results = await fetchPredictions(clients, input)
          setPredictions(results)
          setShowPredictions(results.length > 0)
          setSelectedIndex(-1)
        } catch (err) {
          console.error('[AddressInputCard] Prediction error:', err)
          setPredictions([])
        } finally {
          setIsLoading(false)
        }
      }, 200)
    },
    [clients]
  )

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setQuery(newValue)
      fetchPredictionsDebounced(newValue)
    },
    [fetchPredictionsDebounced]
  )

  // Handle selection
  const handleSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setIsSelecting(true)
      setShowPredictions(false)
      setQuery(prediction.mainText)

      try {
        if (clients) {
          const details = await fetchPlaceDetails(clients, prediction.id)
          onSelect(prediction.description, {
            formattedAddress: details.formattedAddress,
            latitude: details.latitude,
            longitude: details.longitude,
            placeId: details.placeId,
            street: details.street,
            city: details.city,
            state: details.state,
            zipCode: details.postalCode,
          })
        }
      } catch (error) {
        console.error('Failed to get place details:', error)
        setIsSelecting(false)
      }
    },
    [clients, onSelect]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showPredictions && predictions.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setSelectedIndex((prev) =>
              prev < predictions.length - 1 ? prev + 1 : prev
            )
            break
          case 'ArrowUp':
            e.preventDefault()
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
            break
          case 'Enter':
            e.preventDefault()
            if (selectedIndex >= 0) {
              handleSelectPrediction(predictions[selectedIndex])
            }
            break
          case 'Escape':
            setShowPredictions(false)
            setSelectedIndex(-1)
            break
        }
      }
    },
    [showPredictions, predictions, selectedIndex, handleSelectPrediction]
  )

  return (
    <div
      className={cn(
        'space-y-2',
        'animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
    >
      {/* API Error Notice */}
      {apiError && (
        <p className="text-xs text-amber-600">{apiError}</p>
      )}

      {/* Address input card */}
      <div
        className={cn(
          'rounded-2xl border bg-white overflow-hidden',
          'shadow-sm',
          'transition-all duration-200',
          isSelecting
            ? 'border-teal-300 bg-teal-50/30'
            : 'border-slate-200 focus-within:border-teal-300 focus-within:shadow-md'
        )}
      >
        <div className="flex items-center gap-3 p-4">
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl',
            isSelecting ? 'bg-teal-100' : 'bg-slate-100'
          )}>
            {isSelecting ? (
              <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            ) : (
              <MapPin className={cn(
                'h-5 w-5',
                showPredictions ? 'text-teal-600' : 'text-slate-500'
              )} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => predictions.length > 0 && setShowPredictions(true)}
            placeholder="Enter your address..."
            disabled={isSelecting}
            className={cn(
              'flex-1 bg-transparent text-base',
              'placeholder:text-slate-400',
              'focus:outline-none disabled:opacity-60',
              'text-[16px]' // Prevent iOS zoom
            )}
            autoComplete="off"
            aria-label="Address search"
            aria-autocomplete="list"
            aria-expanded={showPredictions}
          />

          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
        </div>

        {/* Predictions dropdown - inside the card */}
        {showPredictions && predictions.length > 0 && (
          <div className="border-t border-slate-100">
            {predictions.map((prediction, index) => (
              <button
                key={prediction.id}
                type="button"
                onClick={() => handleSelectPrediction(prediction)}
                onMouseEnter={() => setSelectedIndex(index)}
                role="option"
                aria-selected={selectedIndex === index}
                className={cn(
                  'w-full text-left px-4 py-3',
                  'flex items-start gap-3',
                  'transition-colors duration-100',
                  'min-h-[52px]',
                  'border-b border-slate-50 last:border-b-0',
                  selectedIndex === index
                    ? 'bg-teal-50'
                    : 'hover:bg-slate-50'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg mt-0.5',
                  selectedIndex === index ? 'bg-teal-100' : 'bg-slate-100'
                )}>
                  <MapPin className={cn(
                    'h-4 w-4',
                    selectedIndex === index ? 'text-teal-600' : 'text-slate-400'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    selectedIndex === index ? 'text-teal-900' : 'text-slate-900'
                  )}>
                    {prediction.mainText}
                  </p>
                  {prediction.secondaryText && (
                    <p className="text-xs text-slate-500 truncate">
                      {prediction.secondaryText}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Help text */}
      {!showPredictions && !isSelecting && (
        <p className="text-xs text-slate-500 text-center">
          Start typing to search for your address
        </p>
      )}
    </div>
  )
}
