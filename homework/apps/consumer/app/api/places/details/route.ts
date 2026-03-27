/**
 * API Route: Google Places Details
 * Returns detailed information about a place including lat/lng
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const placeId = searchParams.get("place_id")

  if (!placeId) {
    return NextResponse.json(
      { error: "place_id is required" },
      { status: 400 }
    )
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    )
  }

  try {
    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/details/json"
    )
    url.searchParams.set("place_id", placeId)
    url.searchParams.set("fields", "formatted_address,geometry,address_components")
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== "OK") {
      console.error("Places Details API error:", data.status, data.error_message)
      return NextResponse.json(
        { error: data.error_message || "Failed to fetch place details" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      result: data.result,
    })
  } catch (error) {
    console.error("Places details error:", error)
    return NextResponse.json(
      { error: "Failed to fetch place details" },
      { status: 500 }
    )
  }
}
