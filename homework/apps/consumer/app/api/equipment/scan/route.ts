import { NextRequest, NextResponse } from "next/server"
import { scanEquipmentPhoto } from "@/lib/gemini"
import type { EquipmentData } from "@/types/flow"

export interface EquipmentScanRequest {
  imageBase64: string
  mimeType?: string
}

export interface EquipmentScanResponse {
  success: boolean
  equipment: EquipmentData
  confidence: number
  rawText?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: EquipmentScanRequest = await request.json()
    const { imageBase64, mimeType = "image/jpeg" } = body

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      )
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")

    const result = await scanEquipmentPhoto(base64Data, mimeType)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Equipment Scan Error]", error)
    return NextResponse.json(
      {
        success: false,
        equipment: { method: "photo" as const },
        confidence: 0,
        rawText: error instanceof Error ? error.message : "Failed to analyze image",
      },
      { status: 200 } // Return 200 so UI can handle gracefully
    )
  }
}
