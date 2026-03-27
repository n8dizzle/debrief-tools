/**
 * API Route: Google Places Autocomplete
 * Returns address suggestions for the autocomplete input
 */

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const input = searchParams.get("input")

  if (!input || input.length < 3) {
    return NextResponse.json({ predictions: [] })
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
      "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    )
    url.searchParams.set("input", input)
    url.searchParams.set("types", "address")
    url.searchParams.set("components", "country:us")
    url.searchParams.set("key", apiKey)

    const response = await fetch(url.toString())
    const data = await response.json()

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Places API error:", data.status, data.error_message)
      return NextResponse.json(
        { error: data.error_message || "Failed to fetch predictions" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      predictions: data.predictions || [],
    })
  } catch (error) {
    console.error("Places autocomplete error:", error)
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    )
  }
}
