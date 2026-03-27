/**
 * Minimal Google Places client helpers for browser-only usage.
 * Handles script loading, predictions, and place detail parsing.
 */

type GooglePlacePrediction = {
  description: string
  place_id: string
  structured_formatting?: {
    main_text: string
    secondary_text?: string
  }
}

type GoogleGeometryLocation = {
  lat: () => number
  lng: () => number
}

type GooglePlaceDetails = {
  formatted_address?: string
  place_id?: string
  geometry?: { location?: GoogleGeometryLocation }
  address_components?: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
}

type GoogleAutocompleteService = {
  getPlacePredictions: (
    options: { input: string; types?: string[] },
    callback: (predictions: GooglePlacePrediction[] | null, status: string) => void
  ) => void
}

type GooglePlacesService = {
  getDetails: (
    options: { placeId: string; fields: string[] },
    callback: (place: GooglePlaceDetails | null, status: string) => void
  ) => void
}

type GoogleMapsApi = {
  maps: {
    places: {
      AutocompleteService: new () => GoogleAutocompleteService
      PlacesService: new (element: HTMLElement | null) => GooglePlacesService
      PlacesServiceStatus: {
        OK: string
        ZERO_RESULTS: string
      }
    }
  }
}

export type PlacePrediction = {
  id: string
  description: string
  mainText: string
  secondaryText?: string
}

export type ParsedPlace = {
  placeId: string
  formattedAddress: string
  latitude: number
  longitude: number
  street?: string
  city?: string
  state?: string
  postalCode?: string
}

export type PlacesClients = {
  autocomplete: GoogleAutocompleteService
  places: GooglePlacesService
  status: {
    OK: string
    ZERO_RESULTS: string
  }
}

declare global {
  interface Window {
    google?: GoogleMapsApi
  }
}

const GOOGLE_FIELDS = ["place_id", "formatted_address", "address_components", "geometry"]
let googleMapsPromise: Promise<GoogleMapsApi> | null = null

const ensureScriptTag = (resolve: () => void, reject: () => void, apiKey: string) => {
  const existing = document.querySelector<HTMLScriptElement>("script[data-google-places]")
  if (existing) {
    existing.addEventListener("load", resolve, { once: true })
    existing.addEventListener("error", reject, { once: true })
    return
  }

  const script = document.createElement("script")
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  script.async = true
  script.defer = true
  script.dataset.googlePlaces = "true"
  script.addEventListener("load", resolve, { once: true })
  script.addEventListener("error", reject, { once: true })
  document.head.appendChild(script)
}

export const loadGooglePlacesApi = async (apiKey: string): Promise<GoogleMapsApi> => {
  if (typeof window === "undefined") {
    throw new Error("Google Places can only load in the browser.")
  }

  // Debug: log key presence (not value for security)
   
  console.log("[Places] API key present:", Boolean(apiKey), "length:", apiKey?.length ?? 0)

  if (window.google?.maps?.places) {
     
    console.log("[Places] Already loaded, reusing.")
    return window.google
  }

  if (!googleMapsPromise) {
    if (!apiKey) {
      throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.")
    }

    googleMapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
       
      console.log("[Places] Loading script…")
      ensureScriptTag(
        () => {
           
          console.log("[Places] Script loaded. Checking window.google…", Boolean(window.google?.maps?.places))
          if (window.google?.maps?.places) {
            resolve(window.google)
          } else {
            reject(new Error("Google Maps loaded but Places is unavailable."))
          }
        },
        () => {
           
          console.error("[Places] Script failed to load. Check console for Google errors.")
          reject(new Error("Failed to load Google Maps script."))
        },
        apiKey
      )
    })
  }

  return googleMapsPromise
}

export const createPlacesClients = (google: GoogleMapsApi): PlacesClients => ({
  autocomplete: new google.maps.places.AutocompleteService(),
  places: new google.maps.places.PlacesService(document.createElement("div")),
  status: google.maps.places.PlacesServiceStatus,
})

export const fetchPredictions = (
  clients: PlacesClients,
  input: string
): Promise<PlacePrediction[]> =>
  new Promise((resolve, reject) => {
    try {
      clients.autocomplete.getPlacePredictions(
        { input, types: ["address"] },
        (predictions, status) => {
          if (status !== clients.status.OK || !predictions) {
            resolve([])
            return
          }

          const mapped = predictions.map((prediction) => ({
            id: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting?.main_text ?? prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text,
          }))

          resolve(mapped)
        }
      )
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Failed to fetch predictions."))
    }
  })

export const fetchPlaceDetails = (
  clients: PlacesClients,
  placeId: string
): Promise<ParsedPlace> =>
  new Promise((resolve, reject) => {
    console.log("[Places] Fetching details for placeId:", placeId)

    clients.places.getDetails(
      { placeId, fields: GOOGLE_FIELDS },
      (place, status) => {
        console.log("[Places] getDetails response - status:", status, "place:", place)

        if (status !== clients.status.OK) {
          console.error("[Places] API returned non-OK status:", status)
          reject(new Error(`Places API error: ${status}`))
          return
        }

        if (!place) {
          console.error("[Places] No place data returned")
          reject(new Error("No place data returned from API."))
          return
        }

        const geometry = place.geometry?.location
        if (!geometry) {
          console.error("[Places] Place is missing geometry:", place)
          reject(new Error("Place is missing location geometry."))
          return
        }

        console.log("[Places] Successfully parsed place details")
        resolve(parsePlaceDetails(place, placeId))
      }
    )
  })

export const parsePlaceDetails = (
  place: GooglePlaceDetails,
  fallbackPlaceId?: string
): ParsedPlace => {
  const components = place.address_components ?? []

  const pick = (types: string[]): string | undefined =>
    components.find((component) => types.some((type) => component.types.includes(type)))
      ?.long_name

  const streetNumber = pick(["street_number"])
  const route = pick(["route"])
  const street = [streetNumber, route].filter(Boolean).join(" ").trim() || undefined

  return {
    placeId: place.place_id ?? fallbackPlaceId ?? "",
    formattedAddress: place.formatted_address ?? "",
    latitude: place.geometry?.location?.lat() ?? 0,
    longitude: place.geometry?.location?.lng() ?? 0,
    street,
    city: pick(["locality", "postal_town"]),
    state: pick(["administrative_area_level_1"]),
    postalCode: pick(["postal_code"]),
  }
}

