/**
 * Local storage utilities for managing pending home data during onboarding
 * Stores home and equipment data before user authenticates
 *
 * Note: Uses localStorage (not sessionStorage) because OAuth redirects
 * leave the domain entirely (app → Google → Supabase → app) which clears sessionStorage
 */

import type { PropertyData } from "@/lib/property-data-client"

const PENDING_HOME_KEY = "homework_pending_home"
const SCANNED_EQUIPMENT_KEY = "homework_scanned_equipment"
const EXPIRY_HOURS = 1

export type PendingHomeData = {
  // From Google Places
  placeId: string
  formattedAddress: string
  latitude: number
  longitude: number
  street?: string
  city?: string
  state?: string
  postalCode?: string

  // From Rentcast/mock
  propertyData: PropertyData

  // Meta
  createdAt: number
}

export type ScannedEquipment = {
  id: string
  type: string
  brand?: string
  model?: string
  serialNumber?: string
  photoUrl?: string
  scannedAt: number
}

/**
 * Check if localStorage is available
 * Using localStorage instead of sessionStorage because OAuth redirects
 * leave the domain (app → Google → Supabase → app) which clears sessionStorage
 */
const isLocalStorageAvailable = (): boolean => {
  if (typeof window === "undefined") return false
  try {
    const test = "__storage_test__"
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Store pending home data in localStorage
 */
export const storePendingHome = (data: Omit<PendingHomeData, "createdAt">): boolean => {
  if (!isLocalStorageAvailable()) {
    console.warn("[PendingHome] localStorage not available")
    return false
  }

  const pendingData: PendingHomeData = {
    ...data,
    createdAt: Date.now(),
  }

  try {
    localStorage.setItem(PENDING_HOME_KEY, JSON.stringify(pendingData))
    console.log("[PendingHome] Stored pending home:", pendingData.formattedAddress)
    return true
  } catch (error) {
    console.error("[PendingHome] Failed to store:", error)
    return false
  }
}

/**
 * Retrieve pending home data from localStorage
 * Returns null if data is expired or not found
 */
export const getPendingHome = (): PendingHomeData | null => {
  if (!isLocalStorageAvailable()) return null

  try {
    const raw = localStorage.getItem(PENDING_HOME_KEY)
    if (!raw) return null

    const data: PendingHomeData = JSON.parse(raw)

    // Check if expired
    const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000
    if (Date.now() - data.createdAt > expiryMs) {
      console.log("[PendingHome] Data expired, clearing")
      clearPendingHome()
      return null
    }

    return data
  } catch (error) {
    console.error("[PendingHome] Failed to retrieve:", error)
    return null
  }
}

/**
 * Clear pending home data
 */
export const clearPendingHome = (): void => {
  if (!isLocalStorageAvailable()) return
  localStorage.removeItem(PENDING_HOME_KEY)
  console.log("[PendingHome] Cleared pending home")
}

/**
 * Check if there's pending home data
 */
export const hasPendingHome = (): boolean => {
  return getPendingHome() !== null
}

/**
 * Store scanned equipment (can be multiple)
 */
export const storeScannedEquipment = (equipment: Omit<ScannedEquipment, "id" | "scannedAt">): boolean => {
  if (!isLocalStorageAvailable()) return false

  try {
    const existing = getScannedEquipment()
    const newEquipment: ScannedEquipment = {
      ...equipment,
      id: crypto.randomUUID(),
      scannedAt: Date.now(),
    }

    const updated = [...existing, newEquipment]
    localStorage.setItem(SCANNED_EQUIPMENT_KEY, JSON.stringify(updated))
    console.log("[PendingHome] Stored scanned equipment:", newEquipment.type)
    return true
  } catch (error) {
    console.error("[PendingHome] Failed to store equipment:", error)
    return false
  }
}

/**
 * Retrieve all scanned equipment
 */
export const getScannedEquipment = (): ScannedEquipment[] => {
  if (!isLocalStorageAvailable()) return []

  try {
    const raw = localStorage.getItem(SCANNED_EQUIPMENT_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * Clear scanned equipment
 */
export const clearScannedEquipment = (): void => {
  if (!isLocalStorageAvailable()) return
  localStorage.removeItem(SCANNED_EQUIPMENT_KEY)
  console.log("[PendingHome] Cleared scanned equipment")
}

/**
 * Clear all pending onboarding data
 */
export const clearAllPendingData = (): void => {
  clearPendingHome()
  clearScannedEquipment()
}
