'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MapPin, X, Loader2, ArrowUp, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  loadGooglePlacesApi,
  createPlacesClients,
  fetchPredictions,
  fetchPlaceDetails,
  type PlacePrediction,
  type PlacesClients,
} from '@/lib/places-client'

interface AddressAutocompleteProps {
  onSelect: (address: string, placeId?: string) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  initialValue?: string
  className?: string
}

export function AddressAutocomplete({
  onSelect,
  placeholder = 'Enter your address...',
  disabled = false,
  isLoading = false,
  initialValue = '',
  className,
}: AddressAutocompleteProps) {
  const [value, setValue] = useState(initialValue)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [clients, setClients] = useState<PlacesClients | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
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
        console.error('[AddressAutocomplete] Failed to load Google Places:', err)
        setApiError('Address lookup unavailable')
      })
  }, [])

  // Fetch predictions with debounce
  const fetchPredictionsDebounced = useCallback(
    (input: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (!clients || input.length < 3) {
        setPredictions([])
        setShowDropdown(false)
        return
      }

      debounceRef.current = setTimeout(async () => {
        setIsFetching(true)
        setValidationError(null)
        try {
          const results = await fetchPredictions(clients, input)
          setPredictions(results)
          setShowDropdown(results.length > 0)
          setSelectedIndex(-1)
          setHasSearched(true)
        } catch (err) {
          console.error('[AddressAutocomplete] Prediction error:', err)
          setPredictions([])
          setHasSearched(true)
        } finally {
          setIsFetching(false)
        }
      }, 200)
    },
    [clients]
  )

  // Handle input change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setValue(newValue)
      setValidationError(null)
      setHasSearched(false)
      fetchPredictionsDebounced(newValue)
    },
    [fetchPredictionsDebounced]
  )

  // Handle prediction selection
  const handleSelectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      setValue(prediction.description)
      setPredictions([])
      setShowDropdown(false)

      // Fetch full details and send to parent
      if (clients) {
        try {
          const details = await fetchPlaceDetails(clients, prediction.id)
          onSelect(details.formattedAddress, details.placeId)
        } catch {
          // Fallback to just the description
          onSelect(prediction.description, prediction.id)
        }
      } else {
        onSelect(prediction.description, prediction.id)
      }
    },
    [clients, onSelect]
  )

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If dropdown is showing with predictions, handle navigation
      if (showDropdown && predictions.length > 0) {
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
            } else {
              // No selection - prompt user to select from dropdown
              setValidationError('Please select an address from the dropdown')
            }
            break
          case 'Escape':
            setShowDropdown(false)
            setSelectedIndex(-1)
            break
        }
        return
      }

      // No dropdown showing
      if (e.key === 'Enter' && value.trim()) {
        e.preventDefault()

        // If still fetching, wait
        if (isFetching) {
          setValidationError('Searching for address...')
          return
        }

        // If we haven't searched yet (user typed quickly), trigger search
        if (!hasSearched && clients && value.length >= 3) {
          setValidationError('Searching for address...')
          // Force immediate search
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
          }
          setIsFetching(true)
          fetchPredictions(clients, value)
            .then((results) => {
              setPredictions(results)
              setHasSearched(true)
              if (results.length > 0) {
                setShowDropdown(true)
                setValidationError('Please select your address from the dropdown')
              } else {
                setValidationError('No addresses found. Please try a different search.')
              }
            })
            .catch(() => {
              setValidationError('Could not verify address. Please try again.')
            })
            .finally(() => {
              setIsFetching(false)
            })
          return
        }

        // If searched but no predictions, show error
        if (hasSearched && predictions.length === 0) {
          setValidationError('No addresses found. Please check your spelling and try again.')
          return
        }

        // If API not available, allow raw text
        if (apiError) {
          onSelect(value.trim())
          return
        }

        // Default: prompt to select from dropdown
        if (predictions.length > 0) {
          setShowDropdown(true)
          setValidationError('Please select your address from the dropdown')
        }
      }
    },
    [showDropdown, predictions, selectedIndex, handleSelectPrediction, value, isFetching, hasSearched, clients, apiError, onSelect]
  )

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle clear
  const handleClear = useCallback(() => {
    setValue('')
    setPredictions([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }, [])

  // Handle direct submit (button click)
  const handleSubmit = useCallback(() => {
    if (!value.trim() || disabled || isLoading) return

    // If still fetching, wait
    if (isFetching) {
      setValidationError('Searching for address...')
      return
    }

    // If we have predictions showing, prompt to select
    if (predictions.length > 0) {
      setShowDropdown(true)
      setValidationError('Please select your address from the dropdown')
      return
    }

    // If we haven't searched yet, trigger search
    if (!hasSearched && clients && value.length >= 3) {
      setValidationError('Searching for address...')
      setIsFetching(true)
      fetchPredictions(clients, value)
        .then((results) => {
          setPredictions(results)
          setHasSearched(true)
          if (results.length > 0) {
            setShowDropdown(true)
            setValidationError('Please select your address from the dropdown')
          } else {
            setValidationError('No addresses found. Please try a different search.')
          }
        })
        .catch(() => {
          setValidationError('Could not verify address. Please try again.')
        })
        .finally(() => {
          setIsFetching(false)
        })
      return
    }

    // If searched but no predictions
    if (hasSearched && predictions.length === 0) {
      setValidationError('No addresses found. Please check your spelling and try again.')
      return
    }

    // If API not available, allow raw text
    if (apiError) {
      onSelect(value.trim())
      return
    }
  }, [value, disabled, isLoading, isFetching, predictions, hasSearched, clients, apiError, onSelect])

  const canSend = value.trim().length > 0 && !disabled && !isLoading

  return (
    <div className={cn('relative w-full', className)}>
      {/* API Error Notice */}
      {apiError && (
        <p className="text-xs text-amber-600 mb-2">{apiError}</p>
      )}

      {/* Input Container - refined styling */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-2xl',
          'bg-white border border-slate-200',
          'shadow-[0_4px_20px_rgba(0,0,0,0.06)]',
          'p-2.5',
          'transition-all duration-200',
          'focus-within:shadow-[0_4px_24px_rgba(13,148,136,0.12)]',
          'focus-within:border-teal-300'
        )}
      >
        {/* Location icon */}
        <div
          className={cn(
            'flex items-center justify-center',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'rounded-xl',
            'text-muted-foreground'
          )}
        >
          <MapPin className="h-5 w-5" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label="Address input"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          className={cn(
            'flex-1',
            'min-h-[44px]',
            'py-3 px-1',
            'text-base leading-snug',
            'placeholder:text-muted-foreground/60',
            'bg-transparent',
            'focus:outline-none',
            'disabled:opacity-50',
            'border-none'
          )}
          style={{ fontSize: '16px' }}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className={cn(
              'flex items-center justify-center',
              'h-8 w-8',
              'rounded-lg',
              'text-muted-foreground',
              'hover:bg-muted hover:text-foreground',
              'transition-colors'
            )}
            aria-label="Clear address"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Send button - refined styling */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Submit address"
          className={cn(
            'flex items-center justify-center',
            'h-11 w-11 min-h-[44px] min-w-[44px]',
            'rounded-xl',
            'bg-slate-100 text-slate-400',
            canSend && 'bg-teal-600 text-white shadow-sm',
            canSend && 'hover:bg-teal-700 active:scale-95',
            'transition-all duration-150',
            'disabled:opacity-100'
          )}
        >
          {isLoading || isFetching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Predictions Dropdown - refined styling */}
      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className={cn(
            'absolute left-0 right-0 top-full mt-2 z-50',
            'bg-white border border-slate-200 rounded-xl',
            'shadow-lg shadow-slate-200/50 overflow-hidden',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
          role="listbox"
        >
          {predictions.map((prediction, index) => (
            <button
              key={prediction.id}
              type="button"
              onClick={() => handleSelectPrediction(prediction)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={selectedIndex === index}
              className={cn(
                'w-full text-left px-4 py-3.5',
                'flex items-start gap-3',
                'transition-colors duration-100',
                'min-h-[48px]',
                selectedIndex === index
                  ? 'bg-teal-50 border-l-2 border-l-teal-500'
                  : 'hover:bg-slate-50 border-l-2 border-l-transparent'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg',
                selectedIndex === index ? 'bg-teal-100' : 'bg-slate-100'
              )}>
                <MapPin className={cn(
                  'h-4 w-4',
                  selectedIndex === index ? 'text-teal-600' : 'text-slate-500'
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

      {/* Validation error */}
      {validationError && (
        <p className={cn(
          'text-sm text-center mt-3 animate-in fade-in slide-in-from-top-1 duration-200',
          validationError.includes('Searching')
            ? 'text-muted-foreground'
            : 'text-amber-600'
        )}>
          {validationError}
        </p>
      )}

      {/* Help text */}
      {!validationError && (
        <p className="text-xs text-muted-foreground/70 text-center mt-2">
          Start typing your address
        </p>
      )}
    </div>
  )
}
