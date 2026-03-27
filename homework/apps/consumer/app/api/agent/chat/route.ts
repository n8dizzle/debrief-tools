import { NextRequest, NextResponse } from "next/server"
import { chatWithAgent } from "@/lib/gemini"
import type { HomeData, DiscoveryData, ChatButton, NextAction } from "@/types/flow"

export interface AgentChatRequest {
  message: string
  homeData: HomeData | null
  discoveryData: DiscoveryData
  chatHistory: Array<{ role: "agent" | "user"; content: string }>
}

export interface AgentChatResponse {
  message: string
  buttons?: ChatButton[]
  nextAction: NextAction | null
  readyForPricing: boolean // backwards compatibility
}

export async function POST(request: NextRequest) {
  try {
    const body: AgentChatRequest = await request.json()
    const { message, homeData, discoveryData, chatHistory } = body

    const response = await chatWithAgent(message, homeData, discoveryData, chatHistory)

    return NextResponse.json(response)
  } catch (error) {
    console.error("[Agent Chat Error]", error)
    return NextResponse.json(
      {
        message: "I'm having trouble connecting right now. Let me try again.",
        buttons: [
          { label: "Try again", value: "retry" },
          { label: "Skip to pricing", value: "skip_to_pricing" },
        ],
        nextAction: null,
        readyForPricing: false,
      },
      { status: 200 } // Return 200 so UI doesn't break
    )
  }
}
