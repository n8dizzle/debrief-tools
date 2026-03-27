/**
 * useMediaQuery Hook
 * Responsive detection for mobile vs desktop layouts
 */

import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)

    // Set initial value
    setMatches(media.matches)

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add listener
    media.addEventListener("change", listener)

    // Cleanup
    return () => {
      media.removeEventListener("change", listener)
    }
  }, [query])

  return matches
}

/**
 * Preset breakpoints matching Tailwind defaults
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)")
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px)")
}

export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)")
}
