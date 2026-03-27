"use server"

import { createClient } from "@/lib/supabase/server"
import type { PropertyData } from "@/lib/property-data-client"
import type { HomeData } from "@/types/flow"

interface SaveHomeResult {
  success: boolean
  homeId?: string
  error?: string
}

export async function saveHomeData(
  flowHomeData: HomeData,
  propertyData: PropertyData | null
): Promise<SaveHomeResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: "Not authenticated" }
    }

    // Parse address components
    const city = flowHomeData.city || propertyData?.city || ""
    const state = flowHomeData.state || propertyData?.state || ""
    const zipCode = flowHomeData.postalCode || propertyData?.zipCode || ""

    // Build the home data object
    const homeRecord = {
      user_id: user.id,
      street_address: flowHomeData.street || flowHomeData.formattedAddress.split(",")[0],
      city,
      state,
      zip_code: zipCode,
      formatted_address: flowHomeData.formattedAddress,
      property_type: propertyData?.propertyType ?? undefined,
      sqft: propertyData?.sqft ?? flowHomeData.sqft ?? undefined,
      year_built: propertyData?.yearBuilt ?? flowHomeData.yearBuilt ?? undefined,
      beds: propertyData?.beds ?? flowHomeData.beds ?? undefined,
      baths: propertyData?.baths ?? flowHomeData.baths ?? undefined,
      lot_size_sqft: propertyData?.lotSizeSqft ?? flowHomeData.lotSizeSqft ?? undefined,
      stories: propertyData?.stories ?? flowHomeData.stories ?? undefined,
      lat: flowHomeData.latitude ?? undefined,
      lng: flowHomeData.longitude ?? undefined,
      county: propertyData?.county ?? undefined,
      subdivision: propertyData?.subdivision ?? undefined,
      zoning: propertyData?.zoning ?? undefined,
      building_style: propertyData?.buildingStyle ?? undefined,
      construction_type: propertyData?.constructionType ?? undefined,
      foundation_type: propertyData?.foundationType ?? undefined,
      roof_type: propertyData?.roofType ?? undefined,
      window_type: propertyData?.windowType ?? undefined,
      siding_type: propertyData?.sidingType ?? undefined,
      garage_spaces: propertyData?.garageSpaces ?? undefined,
      garage_type: propertyData?.garageType ?? undefined,
      pool: propertyData?.pool ?? undefined,
      fireplace: propertyData?.fireplace ?? undefined,
      basement: propertyData?.basement ?? undefined,
      basement_sqft: propertyData?.basementSqft ?? undefined,
      attic: propertyData?.attic ?? undefined,
      cooling_type: propertyData?.coolingType ?? undefined,
      heating_type: propertyData?.heatingType ?? undefined,
      heating_fuel: propertyData?.heatingFuel ?? undefined,
      assessor_id: propertyData?.assessorId ?? undefined,
      tax_assessed_value: propertyData?.taxAssessedValue ?? undefined,
      tax_assessed_year: propertyData?.taxAssessedYear ?? undefined,
      tax_annual_amount: propertyData?.taxAnnualAmount ?? undefined,
      tax_rate_area: propertyData?.taxRateArea ?? undefined,
      last_sale_date: propertyData?.lastSaleDate ?? undefined,
      last_sale_price: propertyData?.lastSalePrice ?? undefined,
      prior_sale_date: propertyData?.priorSaleDate ?? undefined,
      prior_sale_price: propertyData?.priorSalePrice ?? undefined,
      owner_name: propertyData?.ownerName ?? undefined,
      owner_type: propertyData?.ownerType ?? undefined,
      owner_occupied: propertyData?.ownerOccupied ?? undefined,
      owner_mailing_address: propertyData?.ownerMailingAddress ?? undefined,
      owner_mailing_city: propertyData?.ownerMailingCity ?? undefined,
      owner_mailing_state: propertyData?.ownerMailingState ?? undefined,
      owner_mailing_zip: propertyData?.ownerMailingZip ?? undefined,
      legal_description: propertyData?.legalDescription ?? undefined,
      parcel_number: propertyData?.parcelNumber ?? undefined,
      apn: propertyData?.apn ?? undefined,
      estimated_value: propertyData?.estimatedValue ?? undefined,
      estimated_rent: propertyData?.estimatedRent ?? undefined,
      features: propertyData?.features as Record<string, unknown> | undefined,
      rentcast_id: propertyData?.rentcastId ?? undefined,
      rentcast_data_source: propertyData?.source ?? undefined,
      rentcast_last_updated: propertyData ? new Date().toISOString() : undefined,
    }

    // First, check if home already exists for this user at this address
    const { data: existingHome } = await supabase
      .from("homes")
      .select("id")
      .eq("user_id", user.id)
      .ilike("formatted_address", flowHomeData.formattedAddress)
      .maybeSingle()

    if (existingHome) {
      // Update existing home with latest data
      const { error: updateError } = await supabase
        .from("homes")
        .update({
          ...homeRecord,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingHome.id)

      if (updateError) {
        console.error("Error updating home:", updateError)
        return { success: false, error: updateError.message }
      }

      return { success: true, homeId: existingHome.id }
    }

    // Create new home record
    const { data: newHome, error: insertError } = await supabase
      .from("homes")
      .insert(homeRecord)
      .select("id")
      .single()

    if (insertError) {
      // Handle unique constraint violation gracefully (race condition)
      if (insertError.code === "23505") {
        // Duplicate - just fetch the existing home
        const { data: existingAfterRace } = await supabase
          .from("homes")
          .select("id")
          .eq("user_id", user.id)
          .ilike("formatted_address", flowHomeData.formattedAddress)
          .maybeSingle()

        if (existingAfterRace) {
          return { success: true, homeId: existingAfterRace.id }
        }
      }
      console.error("Error creating home:", insertError)
      return { success: false, error: insertError.message }
    }

    return { success: true, homeId: newHome.id }
  } catch (error) {
    console.error("Unexpected error saving home:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Database home record type (snake_case from Supabase)
 */
export type DatabaseHomeRecord = {
  id: string
  user_id: string
  street_address: string
  city: string
  state: string
  zip_code: string
  formatted_address: string | null
  property_type: string | null
  sqft: number | null
  year_built: number | null
  beds: number | null
  baths: number | null
  stories: number | null
  lot_size_sqft: number | null
  lat: number | null
  lng: number | null
  county: string | null
  subdivision: string | null
  cooling_type: string | null
  heating_type: string | null
  heating_fuel: string | null
  garage_spaces: number | null
  garage_type: string | null
  pool: boolean | null
  fireplace: boolean | null
  basement: boolean | null
  attic: boolean | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // Tax fields
  tax_assessed_value: number | null
  tax_assessed_year: number | null
  tax_annual_amount: number | null
  // Additional fields we might need
  apn: string | null
  assessor_id: string | null
  legal_description: string | null
}

/**
 * Fetch the user's primary (most recently created) home from the database
 */
export async function getUserPrimaryHome(): Promise<{
  home: DatabaseHomeRecord | null
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { home: null, error: "Not authenticated" }
    }

    const { data: home, error } = await supabase
      .from("homes")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("[getUserPrimaryHome] Error:", error)
      return { home: null, error: error.message }
    }

    return { home: home as DatabaseHomeRecord | null, error: null }
  } catch (error) {
    console.error("[getUserPrimaryHome] Unexpected error:", error)
    return {
      home: null,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Check if the user has any claimed homes
 */
export async function userHasClaimedHomes(): Promise<{
  hasHomes: boolean
  homeCount: number
  error: string | null
}> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { hasHomes: false, homeCount: 0, error: "Not authenticated" }
    }

    const { count, error } = await supabase
      .from("homes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)

    if (error) {
      return { hasHomes: false, homeCount: 0, error: error.message }
    }

    return { hasHomes: (count ?? 0) > 0, homeCount: count ?? 0, error: null }
  } catch (error) {
    return {
      hasHomes: false,
      homeCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
