"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ChevronRight, Lock, MapPin, MessageCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFlowStore } from "@/lib/flow-state"
import {
  createPlacesClients,
  fetchPlaceDetails,
  fetchPredictions,
  loadGooglePlacesApi,
  type ParsedPlace,
  type PlacePrediction,
  type PlacesClients,
} from "@/lib/places-client"
import { cn } from "@/lib/utils"

type LoadState = {
  isLoading: boolean
  error?: string
}

const usePlacesClients = (apiKey: string | undefined): {
  clients: PlacesClients | null
  loadState: LoadState
} => {
  const [clients, setClients] = useState<PlacesClients | null>(null)
  const [loadState, setLoadState] = useState<LoadState>(() =>
    apiKey
      ? { isLoading: true }
      : { isLoading: false, error: "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable autocomplete." }
  )

  useEffect(() => {
    let cancelled = false
    if (!apiKey) return () => {}

    loadGooglePlacesApi(apiKey)
      .then((google) => {
        if (cancelled) return
        setClients(createPlacesClients(google))
        setLoadState({ isLoading: false })
      })
      .catch((error) => {
        if (cancelled) return
        setLoadState({
          isLoading: false,
          error: error instanceof Error ? error.message : "Unable to load Places.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [apiKey])

  return { clients, loadState }
}

export default function AddressPage() {
  const router = useRouter()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { clients, loadState } = usePlacesClients(apiKey)

  const userIntent = useFlowStore((s) => s.userIntent)
  const setHomeData = useFlowStore((s) => s.setHomeData)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const [query, setQuery] = useState("")
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<ParsedPlace | null>(null)
  const [isFetchingPredictions, setIsFetchingPredictions] = useState(false)
  const [isResolvingPlace, setIsResolvingPlace] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!clients || query.trim().length < 3) {
      setPredictions([])
      setHighlightedIndex(null)
      setIsFetchingPredictions(false)
      return
    }

    setIsFetchingPredictions(true)
    const handle = window.setTimeout(() => {
      fetchPredictions(clients, query)
        .then((results) => {
          setPredictions(results)
          setHighlightedIndex(null)
          if (results.length > 0 && document.activeElement === inputRef.current) {
            setIsDropdownOpen(true)
          }
        })
        .catch(() => {
          setErrorMessage("Connection issue — try again.")
        })
        .finally(() => {
          setIsFetchingPredictions(false)
        })
    }, 200)

    return () => {
      window.clearTimeout(handle)
    }
  }, [clients, query])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        !listRef.current ||
        listRef.current.contains(event.target as Node) ||
        inputRef.current?.contains(event.target as Node)
      ) {
        return
      }
      setIsDropdownOpen(false)
    }

    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [])

  const selectPrediction = async (prediction: PlacePrediction) => {
    if (!clients) {
      setErrorMessage("Address lookup not ready. Please wait and try again.")
      return
    }

    setIsDropdownOpen(false)
    setHighlightedIndex(null)
    setPredictions([])
    setErrorMessage(null)
    setStatusMessage(null)
    setIsResolvingPlace(true)
    setQuery(prediction.mainText)

    if (inputRef.current) {
      inputRef.current.blur()
    }

    try {
      const details = await fetchPlaceDetails(clients, prediction.id)
      setSelectedPlace(details)
      setQuery(details.formattedAddress)
      setStatusMessage("Nice, we can work with that.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to fetch place details."
      )
      setQuery(prediction.mainText)
    } finally {
      setIsResolvingPlace(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && selectedPlace && !isDropdownOpen) {
      event.preventDefault()
      handleContinue()
      return
    }

    if (event.key === "Tab" && isDropdownOpen && highlightedIndex !== null && predictions[highlightedIndex]) {
      event.preventDefault()
      void selectPrediction(predictions[highlightedIndex])
      return
    }

    if (event.key === "Escape") {
      if (isDropdownOpen) {
        event.preventDefault()
        setIsDropdownOpen(false)
        setHighlightedIndex(null)
      }
      return
    }

    if (!isDropdownOpen || !predictions.length) {
      if (event.key === "Enter" && predictions.length > 0) {
        event.preventDefault()
        setIsDropdownOpen(true)
      }
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlightedIndex((prev) => {
        if (prev === null) return 0
        return Math.min(prev + 1, predictions.length - 1)
      })
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlightedIndex((prev) => {
        if (prev === null) return predictions.length - 1
        return Math.max(prev - 1, 0)
      })
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (highlightedIndex !== null && predictions[highlightedIndex]) {
        void selectPrediction(predictions[highlightedIndex])
      } else if (predictions.length > 0) {
        void selectPrediction(predictions[0])
      }
    }
  }

  const handleContinue = () => {
    if (!selectedPlace) return

    setHomeData({
      address: selectedPlace.formattedAddress,
      formattedAddress: selectedPlace.formattedAddress,
      placeId: selectedPlace.placeId,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      street: selectedPlace.street,
      city: selectedPlace.city,
      state: selectedPlace.state,
      postalCode: selectedPlace.postalCode,
      sqft: null,
      yearBuilt: null,
      beds: null,
      baths: null,
      lotSizeSqft: null,
      stories: null,
    })

    router.push("/flow/loading")
  }

  const loadingCopy = useMemo(() => {
    if (loadState.error) return loadState.error
    if (loadState.isLoading) return "Loading autocomplete…"
    return null
  }, [loadState])

  return (
    <div className="flex flex-col items-center">
      {/* Context card showing user intent */}
      {userIntent && (
        <div className="w-full max-w-xl mb-8">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">You mentioned</p>
                <p className="text-sm text-foreground">{userIntent}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="w-full max-w-xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <Sparkles className="h-4 w-4" />
          Step 1 of 3
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          What's your address?
        </h1>
        <p className="mb-8 text-muted-foreground">
          We'll look up your home details to get you accurate pricing.
        </p>

        {/* Address input */}
        <div className="relative">
          <div
            className={cn(
              "flex cursor-text items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-lg shadow-primary/5 transition-all",
              selectedPlace
                ? "border-primary/50 ring-2 ring-primary/20"
                : "border-border hover:border-primary/30"
            )}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <Input
              ref={inputRef}
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="address-suggestions"
              aria-label="Start typing your address"
              placeholder="Start typing your address..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedPlace(null)
                setHighlightedIndex(null)
                setStatusMessage(null)
                setErrorMessage(null)
              }}
              onFocus={() => {
                if (predictions.length) {
                  setIsDropdownOpen(true)
                }
              }}
              onClick={() => {
                if (predictions.length && !isDropdownOpen) {
                  setIsDropdownOpen(true)
                }
              }}
              onKeyDown={handleKeyDown}
              className="h-10 flex-1 border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Predictions dropdown */}
          {isDropdownOpen && predictions.length > 0 && (
            <div
              ref={listRef}
              id="address-suggestions"
              role="listbox"
              className="absolute left-0 right-0 z-50 mt-2 max-h-[300px] overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
            >
              {predictions.map((prediction, index) => (
                <button
                  key={prediction.id}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseLeave={() => setHighlightedIndex(null)}
                  onClick={() => void selectPrediction(prediction)}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-start justify-center px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 first:rounded-t-xl last:rounded-b-xl",
                    highlightedIndex === index ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{prediction.mainText}</span>
                  {prediction.secondaryText && (
                    <span className="text-xs text-muted-foreground">{prediction.secondaryText}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status messages */}
        <div className="mt-4 space-y-2">
          {statusMessage && (
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="text-sm text-destructive">{errorMessage}</div>
          )}
          {isFetchingPredictions && (
            <div className="text-xs text-muted-foreground">Searching...</div>
          )}
          {loadingCopy && (
            <div className="text-xs text-muted-foreground">{loadingCopy}</div>
          )}
        </div>

        {/* Continue button */}
        <div className="mt-6">
          <Button
            size="lg"
            className="w-full rounded-xl"
            disabled={!selectedPlace || isResolvingPlace || Boolean(loadState.error)}
            onClick={handleContinue}
          >
            {isResolvingPlace ? "Loading..." : "Continue"}
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
        </div>

        {/* Privacy note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Private and secure. Takes about 2 minutes.</span>
        </div>
      </div>
    </div>
  )
}
