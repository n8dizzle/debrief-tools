/**
 * Demo Home Seeder
 * 
 * Fetches real property data from Rentcast API for a demo address
 * and saves it to the database so you can explore what data is available
 * 
 * Usage:
 *   npm run seed-demo-home
 * 
 * Or with a custom address:
 *   npm run seed-demo-home -- "123 Main St, City, State ZIP"
 */

// Load environment variables from .env.local
import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local") })

import { createClient } from "@supabase/supabase-js"
import type { Database } from "../types/database"
import { fetchPropertyData } from "../lib/property-data-client"

// Default demo address (you can change this)
const DEFAULT_DEMO_ADDRESS = "1600 Pennsylvania Avenue NW, Washington, DC 20500"

// Demo user ID (you'll need to replace this with a real user ID from your auth.users table)
const DEMO_USER_ID = "0eec068b-d8c5-45a9-90e1-88541d3a9ca2"

async function seedDemoHome() {
  console.log("\n🏡 Demo Home Seeder\n")

  // Get address from command line or use default
  const address = process.argv[2] || DEFAULT_DEMO_ADDRESS
  console.log(`📍 Fetching property data for: ${address}\n`)

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials in environment variables")
    console.error("   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

  // Fetch property data
  console.log("⏳ Fetching data from Rentcast API...\n")
  const propertyData = await fetchPropertyData(address)

  if (propertyData.source === "mock") {
    console.log("⚠️  WARNING: Using mock data (no Rentcast API key found)")
    console.log("   Set NEXT_PUBLIC_RENTCAST_API_KEY to fetch real data\n")
  } else {
    console.log("✅ Real data fetched from Rentcast API\n")
  }

  // Display the data
  console.log("📊 Property Data Retrieved:\n")
  console.log(JSON.stringify(propertyData, null, 2))
  console.log("\n")

  // Parse address components
  const addressParts = address.split(",").map((p) => p.trim())
  const streetAddress = addressParts[0] || address
  const city = propertyData.city || addressParts[1] || "Unknown"
  const state = propertyData.state || addressParts[2]?.split(" ")[0] || "XX"
  const zipCode =
    propertyData.zipCode ||
    addressParts[2]?.match(/\d{5}/)?.[0] ||
    addressParts[3]?.match(/\d{5}/)?.[0] ||
    "00000"

  // Prepare database record
  const homeRecord: Database["public"]["Tables"]["homes"]["Insert"] = {
    user_id: DEMO_USER_ID,
    street_address: propertyData.addressLine1 || streetAddress,
    city,
    state,
    zip_code: zipCode,

    // Core details
    formatted_address: propertyData.formattedAddress || address,
    property_type: propertyData.propertyType,
    sqft: propertyData.sqft,
    year_built: propertyData.yearBuilt,
    beds: propertyData.beds,
    baths: propertyData.baths,
    lot_size_sqft: propertyData.lotSizeSqft,
    stories: propertyData.stories,

    // Location
    lat: propertyData.latitude,
    lng: propertyData.longitude,
    county: propertyData.county,
    subdivision: propertyData.subdivision,
    zoning: propertyData.zoning,

    // Building features
    building_style: propertyData.buildingStyle,
    construction_type: propertyData.constructionType,
    foundation_type: propertyData.foundationType,
    roof_type: propertyData.roofType,
    window_type: propertyData.windowType,
    siding_type: propertyData.sidingType,

    // Amenities
    garage_spaces: propertyData.garageSpaces,
    garage_type: propertyData.garageType,
    pool: propertyData.pool,
    fireplace: propertyData.fireplace,
    basement: propertyData.basement,
    basement_sqft: propertyData.basementSqft,
    attic: propertyData.attic,

    // Systems
    cooling_type: propertyData.coolingType,
    heating_type: propertyData.heatingType,
    heating_fuel: propertyData.heatingFuel,

    // Tax data
    assessor_id: propertyData.assessorId,
    tax_assessed_value: propertyData.taxAssessedValue,
    tax_assessed_year: propertyData.taxAssessedYear,
    tax_annual_amount: propertyData.taxAnnualAmount,
    tax_rate_area: propertyData.taxRateArea,

    // Sale history
    last_sale_date: propertyData.lastSaleDate,
    last_sale_price: propertyData.lastSalePrice,
    prior_sale_date: propertyData.priorSaleDate,
    prior_sale_price: propertyData.priorSalePrice ?? null,

    // Owner info
    owner_name: propertyData.ownerName,
    owner_type: propertyData.ownerType,
    owner_occupied: propertyData.ownerOccupied,
    owner_mailing_address: propertyData.ownerMailingAddress,
    owner_mailing_city: propertyData.ownerMailingCity,
    owner_mailing_state: propertyData.ownerMailingState,
    owner_mailing_zip: propertyData.ownerMailingZip,

    // Legal
    legal_description: propertyData.legalDescription,
    parcel_number: propertyData.parcelNumber,
    apn: propertyData.apn,

    // Valuations
    estimated_value: propertyData.estimatedValue,
    estimated_rent: propertyData.estimatedRent,

    // Additional features (JSON)
    features: propertyData.features as any,

    // Rentcast metadata
    rentcast_id: propertyData.rentcastId,
    rentcast_data_source: propertyData.source,
    rentcast_last_updated: new Date().toISOString(),
  }

  // Insert into database
  console.log("💾 Saving to database...\n")
  const { data, error } = await supabase
    .from("homes")
    .insert(homeRecord)
    .select()
    .single()

  if (error) {
    console.error("❌ Error saving to database:")
    console.error(error)
    process.exit(1)
  }

  console.log("✅ Demo home created successfully!\n")
  console.log("📝 Database Record ID:", data.id)
  console.log("\n🎉 Done! You can now explore this home in your app.\n")

  // Summary of what was saved
  console.log("📋 Summary of saved data:\n")
  console.log(`   Address: ${homeRecord.formatted_address}`)
  console.log(`   Property Type: ${homeRecord.property_type || "N/A"}`)
  console.log(`   Year Built: ${homeRecord.year_built || "N/A"}`)
  console.log(`   Bedrooms: ${homeRecord.beds || "N/A"}`)
  console.log(`   Bathrooms: ${homeRecord.baths || "N/A"}`)
  console.log(`   Square Feet: ${homeRecord.sqft?.toLocaleString() || "N/A"}`)
  console.log(`   Lot Size: ${homeRecord.lot_size_sqft?.toLocaleString() || "N/A"} sq ft`)
  console.log(`   Stories: ${homeRecord.stories || "N/A"}`)
  console.log(`   Pool: ${homeRecord.pool ? "Yes" : "No"}`)
  console.log(`   Fireplace: ${homeRecord.fireplace ? "Yes" : "No"}`)
  console.log(`   Garage Spaces: ${homeRecord.garage_spaces || "N/A"}`)
  console.log(`   Last Sale Price: ${homeRecord.last_sale_price ? `$${homeRecord.last_sale_price.toLocaleString()}` : "N/A"}`)
  console.log(`   Last Sale Date: ${homeRecord.last_sale_date || "N/A"}`)
  console.log(`   Tax Assessed Value: ${homeRecord.tax_assessed_value ? `$${homeRecord.tax_assessed_value.toLocaleString()}` : "N/A"}`)
  console.log(`   Annual Taxes: ${homeRecord.tax_annual_amount ? `$${homeRecord.tax_annual_amount.toLocaleString()}` : "N/A"}`)
  console.log(`   Owner Name: ${homeRecord.owner_name || "N/A"}`)
  console.log(`   Owner Occupied: ${homeRecord.owner_occupied ? "Yes" : "No"}`)
  console.log(`   Data Source: ${homeRecord.rentcast_data_source}`)
  console.log("\n")

  // Highlight "moments of delight" opportunities
  console.log("💡 Potential 'Moments of Delight' from this data:\n")

  if (homeRecord.year_built) {
    const age = new Date().getFullYear() - homeRecord.year_built
    console.log(`   • "Your home is ${age} years old, built in ${homeRecord.year_built}"`)
  }

  if (homeRecord.last_sale_price && homeRecord.estimated_value) {
    const appreciation = homeRecord.estimated_value - homeRecord.last_sale_price
    const appreciationPercent = ((appreciation / homeRecord.last_sale_price) * 100).toFixed(1)
    console.log(
      `   • "Your home has appreciated ${appreciationPercent}% since you bought it"`
    )
  }

  if (homeRecord.county && homeRecord.subdivision) {
    console.log(`   • "Welcome to ${homeRecord.subdivision} in ${homeRecord.county} County!"`)
  }

  if (homeRecord.pool) {
    console.log(`   • "Great news! Your home has a pool 🏊"`)
  }

  if (homeRecord.tax_annual_amount) {
    console.log(
      `   • "Your annual property taxes are $${homeRecord.tax_annual_amount.toLocaleString()}"`
    )
  }

  if (homeRecord.heating_type) {
    console.log(`   • "Your home uses ${homeRecord.heating_type} heating"`)
  }

  if (homeRecord.building_style) {
    console.log(`   • "Your home features ${homeRecord.building_style} architecture"`)
  }

  console.log("\n")
}

// Run the seeder
seedDemoHome().catch((error) => {
  console.error("❌ Unexpected error:")
  console.error(error)
  process.exit(1)
})

