"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { PropertyData } from "@/lib/property-data-client"

export type CreateHomeInput = {
  // From Google Places
  placeId: string
  formattedAddress: string
  latitude: number
  longitude: number
  street?: string
  city: string
  state: string
  postalCode: string

  // From Rentcast/mock
  propertyData: PropertyData
}

export type CreateHomeResult = {
  home: {
    id: string
    formatted_address: string | null
  } | null
  error: string | null
}

/**
 * Creates a new home record for the authenticated user
 * Called after successful authentication during onboarding
 */
export async function createHome(input: CreateHomeInput): Promise<CreateHomeResult> {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error("[createHome] Auth error:", authError)
    return { home: null, error: "Unauthorized - please sign in" }
  }

  console.log("[createHome] Creating home for user:", user.id)
  console.log("[createHome] Address:", input.formattedAddress)

  // Map input to database schema
  const homeData = {
    user_id: user.id,
    street_address: input.street ?? input.formattedAddress.split(",")[0].trim(),
    city: input.city,
    state: input.state,
    zip_code: input.postalCode,
    formatted_address: input.formattedAddress,
    lat: input.latitude,
    lng: input.longitude,

    // Building details from PropertyData
    year_built: input.propertyData.yearBuilt ?? null,
    sqft: input.propertyData.sqft ?? null,
    beds: input.propertyData.beds ?? null,
    baths: input.propertyData.baths ?? null,
    stories: input.propertyData.stories ?? null,
    lot_size_sqft: input.propertyData.lotSizeSqft ?? null,
    property_type: input.propertyData.propertyType ?? null,
    building_style: input.propertyData.buildingStyle ?? null,
    construction_type: input.propertyData.constructionType ?? null,
    foundation_type: input.propertyData.foundationType ?? null,

    // Systems
    heating_type: input.propertyData.heatingType ?? null,
    heating_fuel: input.propertyData.heatingFuel ?? null,
    cooling_type: input.propertyData.coolingType ?? null,
    roof_type: input.propertyData.roofType ?? null,
    window_type: input.propertyData.windowType ?? null,
    siding_type: input.propertyData.sidingType ?? null,

    // Features
    pool: input.propertyData.pool ?? null,
    fireplace: input.propertyData.fireplace ?? null,
    basement: input.propertyData.basement ?? null,
    basement_sqft: input.propertyData.basementSqft ?? null,
    attic: input.propertyData.attic ?? null,
    garage_spaces: input.propertyData.garageSpaces ?? null,
    garage_type: input.propertyData.garageType ?? null,

    // Location
    county: input.propertyData.county ?? null,

    // Tax/Legal
    apn: input.propertyData.apn ?? null,
    assessor_id: input.propertyData.assessorId ?? null,
    parcel_number: input.propertyData.parcelNumber ?? null,
    zoning: input.propertyData.zoning ?? null,
    subdivision: input.propertyData.subdivision ?? null,
    legal_description: input.propertyData.legalDescription ?? null,
    tax_assessed_value: input.propertyData.taxAssessedValue ?? null,
    tax_assessed_year: input.propertyData.taxAssessedYear ?? null,
    tax_annual_amount: input.propertyData.taxAnnualAmount ?? null,
    tax_rate_area: input.propertyData.taxRateArea ?? null,

    // Sale history
    last_sale_date: input.propertyData.lastSaleDate ?? null,
    last_sale_price: input.propertyData.lastSalePrice ?? null,
    prior_sale_date: input.propertyData.priorSaleDate ?? null,
    prior_sale_price: input.propertyData.priorSalePrice ?? null,

    // Owner info (not exposing sensitive data)
    owner_occupied: input.propertyData.ownerOccupied ?? null,

    // Valuations
    estimated_value: input.propertyData.estimatedValue ?? null,
    estimated_rent: input.propertyData.estimatedRent ?? null,

    // Rentcast metadata
    rentcast_id: input.propertyData.rentcastId ?? null,
    rentcast_data_source: input.propertyData.source ?? null,
    rentcast_last_updated: new Date().toISOString(),

    // Additional features as JSON
    features: input.propertyData.features ?? null,
  }

  const { data: home, error } = await supabase
    .from("homes")
    .insert(homeData)
    .select("id, formatted_address")
    .single()

  if (error) {
    console.error("[createHome] Insert error:", error)
    return { home: null, error: error.message }
  }

  console.log("[createHome] Home created:", home.id)

  // Revalidate dashboard to show the new home
  revalidatePath("/dashboard")

  return { home, error: null }
}

/**
 * Get the user's homes
 */
export async function getUserHomes() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { homes: [], error: "Unauthorized" }
  }

  const { data: homes, error } = await supabase
    .from("homes")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[getUserHomes] Error:", error)
    return { homes: [], error: error.message }
  }

  return { homes, error: null }
}

/**
 * Check if user has any homes
 */
export async function userHasHomes(): Promise<boolean> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  const { count } = await supabase
    .from("homes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("deleted_at", null)

  return (count ?? 0) > 0
}
