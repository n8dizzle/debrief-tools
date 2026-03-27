"use server"

/**
 * Server-side property data fetching
 * Avoids CORS issues by making Rentcast API calls from the server
 */

import type { PropertyData } from "./property-data-client"

type RentcastPropertyResponse = {
  id?: string
  formattedAddress?: string
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  county?: string
  latitude?: number
  longitude?: number
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  lotSize?: number
  yearBuilt?: number
  assessorID?: string
  legalDescription?: string
  subdivision?: string
  zoning?: string
  lastSaleDate?: string
  lastSalePrice?: number
  priorSaleDate?: string
  priorSalePrice?: number
  taxAssessedValue?: number
  taxAssessedYear?: number
  taxAnnualAmount?: number
  ownerName?: string
  ownerOccupied?: boolean
  ownerType?: string
  parcelNumber?: string
  apn?: string
  taxRateArea?: string
  taxAssessments?: Array<{
    year?: number
    value?: number
    land?: number
    improvements?: number
  }>
  propertyTaxes?: Array<{
    year?: number
    total?: number
  }>
  stories?: number
  pool?: boolean
  fireplace?: boolean
  basement?: boolean
  attic?: boolean
  garage?: {
    spaces?: number
    type?: string
  }
  heating?: {
    type?: string
    fuel?: string
  }
  cooling?: {
    type?: string
  }
  construction?: {
    type?: string
    style?: string
  }
  foundation?: {
    type?: string
  }
  roof?: {
    type?: string
  }
  window?: {
    type?: string
  }
  siding?: {
    type?: string
  }
  features?: {
    floorCount?: number
    pool?: boolean
    fireplace?: boolean
    garageSpaces?: number
    garageType?: string
    heatingType?: string
    coolingType?: string
    roofType?: string
    foundationType?: string
    architectureType?: string
    [key: string]: unknown
  }
  owner?: {
    name?: string
    type?: string
    occupied?: boolean
    mailingAddress?: {
      address?: string
      city?: string
      state?: string
      zipCode?: string
    }
  }
}

/**
 * Demo property data cache - prevents unnecessary API calls during testing
 */
const DEMO_PROPERTIES: Record<string, PropertyData> = {
  "8100 sunscape": {
    rentcastId: "8100-Sunscape-Ct,-Fort-Worth,-TX-76123",
    propertyType: "Single Family",
    formattedAddress: "8100 Sunscape Ct, Fort Worth, TX 76123",
    addressLine1: "8100 Sunscape Ct",
    city: "Fort Worth",
    state: "TX",
    zipCode: "76123",
    county: "Tarrant",
    latitude: 32.623164,
    longitude: -97.403678,
    yearBuilt: 1994,
    sqft: 3723,
    beds: 4,
    baths: 4,
    lotSizeSqft: 20573,
    stories: 2,
    pool: true,
    fireplace: false,
    garageSpaces: 3,
    garageType: "Garage",
    coolingType: "Central",
    heatingType: "Central",
    assessorId: "40671-11-27",
    taxAssessedValue: 463009,
    taxAssessedYear: 2024,
    taxAnnualAmount: 6842,
    taxAssessments: [
      { year: 2024, totalValue: 463009, landValue: 70000, improvements: 393009 },
      { year: 2023, totalValue: 454812, landValue: 70000, improvements: 384812 },
      { year: 2022, totalValue: 400044, landValue: 70000, improvements: 330044 },
      { year: 2021, totalValue: 363676, landValue: 70000, improvements: 293676 },
      { year: 2020, totalValue: 350073, landValue: 70000, improvements: 280073 },
      { year: 2019, totalValue: 353277, landValue: 70000, improvements: 283277 },
    ],
    taxHistory: [
      { year: 2023, amount: 6842, rate: 0.015 },
      { year: 2022, amount: 7856, rate: 0.0196 },
      { year: 2021, amount: 7815, rate: 0.0215 },
      { year: 2020, amount: 7856, rate: 0.0224 },
      { year: 2019, amount: 8394, rate: 0.0238 },
    ],
    lastSaleDate: "2013-10-02",
    subdivision: "SUMMER CREEK ADDITION",
    legalDescription: "SUMMER CREEK ADDITION BLOCK 11 LOT 27",
    apn: "40671-11-27",
    source: "api",
  },
}

/**
 * Check if address matches a cached demo property
 */
const getDemoProperty = (address: string): PropertyData | null => {
  const normalizedAddress = address.toLowerCase()

  for (const [key, data] of Object.entries(DEMO_PROPERTIES)) {
    if (normalizedAddress.includes(key)) {
      console.log("[PropertyData Server] Using cached demo data for:", address)
      return data
    }
  }

  return null
}

/**
 * Parse address components from a formatted address string
 */
const parseAddress = (formattedAddress: string) => {
  const parts = formattedAddress.split(",").map((p) => p.trim())

  let address = parts[0] || ""
  let city: string | undefined
  let state: string | undefined
  let zipCode: string | undefined

  if (parts.length >= 2) {
    city = parts[1]
  }

  if (parts.length >= 3) {
    const stateZipPart = parts[2]
    const stateZipMatch = stateZipPart.match(/^([A-Z]{2})\s*(\d{5})/)
    if (stateZipMatch) {
      state = stateZipMatch[1]
      zipCode = stateZipMatch[2]
    } else {
      state = stateZipPart
    }
  }

  return { address, city, state, zipCode }
}

/**
 * Returns mock property data for development/testing
 */
const generateMockData = (address: string): PropertyData => {
  const hash = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)

  const yearBuilt = 1950 + ((hash % 70) as number)
  const sqft = 1200 + ((hash % 3000) as number)
  const beds = 2 + ((hash % 4) as number)
  const baths = 1 + ((hash % 3) as number)
  const lotSizeSqft = 4000 + ((hash % 16000) as number)
  const stories = 1 + ((hash % 2) as number)

  console.log("[PropertyData Server] Using mock data for:", address)

  return {
    formattedAddress: address,
    yearBuilt,
    sqft,
    beds,
    baths,
    lotSizeSqft,
    stories,
    propertyType: "Single Family",
    pool: hash % 5 === 0,
    fireplace: hash % 3 === 0,
    garageSpaces: 1 + ((hash % 3) as number),
    source: "mock",
  }
}

/**
 * Fetches property data from Rentcast.io API (server-side)
 */
const fetchFromRentcastApi = async (
  address: string,
  city?: string,
  state?: string,
  zipCode?: string
): Promise<PropertyData | null> => {
  const apiKey = process.env.NEXT_PUBLIC_RENTCAST_API_KEY

  if (!apiKey) {
    console.log("[PropertyData Server] No Rentcast API key found")
    return null
  }

  try {
    console.log("[PropertyData Server] Fetching from Rentcast API for:", address)

    const url = new URL("https://api.rentcast.io/v1/properties")
    url.searchParams.set("address", address)
    if (city) url.searchParams.set("city", city)
    if (state) url.searchParams.set("state", state)
    if (zipCode) url.searchParams.set("zipCode", zipCode)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    })

    if (!response.ok) {
      console.error("[PropertyData Server] Rentcast API error:", response.status, response.statusText)
      const errorText = await response.text()
      console.error("[PropertyData Server] Error response:", errorText)
      return null
    }

    const data: RentcastPropertyResponse = await response.json()

    // Rentcast returns an array, so get the first result
    const property = Array.isArray(data) ? data[0] : data

    if (!property || !property.id) {
      console.log("[PropertyData Server] No property data found in Rentcast response")
      return null
    }

    // Map all Rentcast fields to our PropertyData type
    return {
      rentcastId: property.id,
      propertyType: property.propertyType,
      formattedAddress: property.formattedAddress,
      addressLine1: property.addressLine1,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      county: property.county,
      latitude: property.latitude,
      longitude: property.longitude,
      yearBuilt: property.yearBuilt,
      sqft: property.squareFootage,
      beds: property.bedrooms,
      baths: property.bathrooms,
      lotSizeSqft: property.lotSize,
      stories: property.features?.floorCount,
      buildingStyle: property.features?.architectureType ?? property.construction?.style,
      constructionType: property.construction?.type,
      foundationType: property.features?.foundationType ?? property.foundation?.type,
      garageSpaces: property.features?.garageSpaces ?? property.garage?.spaces,
      garageType: property.features?.garageType ?? property.garage?.type,
      pool: property.features?.pool ?? property.pool,
      fireplace: property.features?.fireplace ?? property.fireplace,
      basement: property.basement,
      attic: property.attic,
      coolingType: property.features?.coolingType ?? property.cooling?.type,
      heatingType: property.features?.heatingType ?? property.heating?.type,
      heatingFuel: property.heating?.fuel,
      roofType: property.features?.roofType ?? property.roof?.type,
      windowType: property.window?.type,
      sidingType: property.siding?.type,
      assessorId: property.assessorID,
      taxAssessedValue: property.taxAssessedValue,
      taxAssessedYear: property.taxAssessedYear,
      taxAnnualAmount: property.taxAnnualAmount,
      taxRateArea: property.taxRateArea,
      taxAssessments: property.taxAssessments?.map((a: { year?: number; value?: number; land?: number; improvements?: number }) => ({
        year: a.year ?? 0,
        totalValue: a.value ?? 0,
        landValue: a.land,
        improvements: a.improvements,
      })),
      taxHistory: property.propertyTaxes?.map((t: { year?: number; total?: number }) => ({
        year: t.year ?? 0,
        amount: t.total ?? 0,
      })),
      lastSaleDate: property.lastSaleDate,
      lastSalePrice: property.lastSalePrice,
      priorSaleDate: property.priorSaleDate,
      priorSalePrice: property.priorSalePrice,
      ownerName: property.owner?.name || property.ownerName,
      ownerType: property.owner?.type || property.ownerType,
      ownerOccupied: property.owner?.occupied ?? property.ownerOccupied,
      ownerMailingAddress: property.owner?.mailingAddress?.address,
      ownerMailingCity: property.owner?.mailingAddress?.city,
      ownerMailingState: property.owner?.mailingAddress?.state,
      ownerMailingZip: property.owner?.mailingAddress?.zipCode,
      legalDescription: property.legalDescription,
      parcelNumber: property.parcelNumber,
      apn: property.apn,
      subdivision: property.subdivision,
      zoning: property.zoning,
      features: property.features,
      source: "api",
    }
  } catch (error) {
    console.error("[PropertyData Server] Error fetching from Rentcast:", error)
    return null
  }
}

/**
 * Server action to fetch property data
 * Called from client components to avoid CORS issues
 */
export async function getPropertyData(formattedAddress: string): Promise<PropertyData> {
  // Check demo cache first
  const demoData = getDemoProperty(formattedAddress)
  if (demoData) {
    return demoData
  }

  // Try Rentcast API
  const { address, city, state, zipCode } = parseAddress(formattedAddress)
  const apiData = await fetchFromRentcastApi(address, city, state, zipCode)
  if (apiData) {
    return apiData
  }

  // Fallback to mock data
  return generateMockData(formattedAddress)
}
