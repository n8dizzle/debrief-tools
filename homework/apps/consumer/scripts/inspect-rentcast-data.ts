/**
 * Quick script to inspect the full Rentcast response with all nested data
 */

// Load environment variables
import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local") })

const address = "8100 Sunscape Court"
const city = "Fort Worth"
const state = "TX"
const zipCode = "76123"

async function inspectData() {
  const apiKey = process.env.NEXT_PUBLIC_RENTCAST_API_KEY

  if (!apiKey) {
    console.error("Missing NEXT_PUBLIC_RENTCAST_API_KEY")
    process.exit(1)
  }

  const url = new URL("https://api.rentcast.io/v1/properties")
  url.searchParams.set("address", address)
  url.searchParams.set("city", city)
  url.searchParams.set("state", state)
  url.searchParams.set("zipCode", zipCode)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
  })

  if (!response.ok) {
    console.error("API Error:", response.status)
    process.exit(1)
  }

  const data = await response.json()
  
  console.log("\n=== FULL RENTCAST RESPONSE ===\n")
  console.log(JSON.stringify(data, null, 2))
}

inspectData()
