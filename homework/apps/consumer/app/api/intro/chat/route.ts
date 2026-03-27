/**
 * API Route: Intro Chat
 * Handles the conversational intro flow on the homepage using Gemini
 */

import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getDeterministicResponse } from "@/lib/chat-responses"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

// System prompt for the intro conversation
const SYSTEM_PROMPT = `You are Homework's friendly AI assistant. You're having an initial conversation with a homeowner who just landed on the site.

Your personality:
- Warm, calm, and confident
- No exclamation points (ever)
- Conversational but efficient
- Empathetic without being over-the-top
- You explain things clearly, like a knowledgeable friend

Your goal in this conversation:
1. Understand what they need (AC replacement, repair, water heater, etc.)
2. Show you're listening by acknowledging their situation
3. Briefly explain how Homework works (weave it naturally, don't dump info)
4. Build confidence that they'll get real pricing, not the usual runaround
5. When they seem ready, offer to get their address to pull up their home details

Key value props to weave in naturally (don't list them all at once):
- We pull up your home's details automatically (size, age, etc.)
- You see real installed prices, not "starting at" estimates
- All our contractors are vetted, licensed, and background-checked
- Standardized scopes mean every quote includes the same work
- No sales calls or runaround

When showing clickable options, use this format at the END of your message:
[BUTTONS: option1 | option2 | option3]

IMPORTANT - Asking for the address:
When you're ready to get their address, you MUST:
1. First, clearly explain WHY you need it (e.g., "To show you real pricing for your home, I need to look up a few details about your property")
2. Then explicitly ask for it (e.g., "What's your address?")
3. End your message with EXACTLY: [READY_FOR_ADDRESS]

This triggers an address input field to appear, so make sure your message naturally leads into that.

Examples:
- After they describe their issue: Acknowledge and ask a follow-up
- After 2-3 exchanges: Share a relevant insight about how you can help
- When they express interest: Transition to address by explaining the value, then ask for it

Important:
- Keep responses to 2-4 sentences max
- Don't repeat yourself
- Match their energy level
- If they say they're "just exploring", that's fine - no pressure
- Never use phrases like "I'd be happy to" or "Absolutely" - just help them`

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set")
  }
  return new GoogleGenerativeAI(apiKey)
}

function parseResponse(response: string): {
  message: string
  buttons?: Array<{ label: string; value: string }>
  readyForAddress: boolean
} {
  let message = response
  let buttons: Array<{ label: string; value: string }> | undefined
  let readyForAddress = false

  // Check for address ready signal
  if (message.includes("[READY_FOR_ADDRESS]")) {
    readyForAddress = true
    message = message.replace("[READY_FOR_ADDRESS]", "").trim()
  }

  // Parse buttons
  const buttonMatch = message.match(/\[BUTTONS:\s*(.+?)\]/)
  if (buttonMatch) {
    const buttonLabels = buttonMatch[1].split("|").map((s) => s.trim())
    buttons = buttonLabels.map((label) => ({
      label,
      value: label.toLowerCase().replace(/\s+/g, "_"),
    }))
    message = message.replace(buttonMatch[0], "").trim()
  }

  return { message, buttons, readyForAddress }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, chatHistory } = body as {
      message: string
      chatHistory: ChatMessage[]
    }

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    // FIRST: Check for deterministic response (consistent, no AI randomness)
    // This ensures actions like "new HVAC pricing" always return the same response
    const deterministicResponse = getDeterministicResponse(message)
    if (deterministicResponse) {
      return NextResponse.json({
        message: deterministicResponse.message,
        buttons: deterministicResponse.buttons,
        readyForAddress: deterministicResponse.readyForAddress ?? false,
      })
    }

    // FALLBACK: Use AI for complex/unknown queries
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    // Convert chat history to Gemini format
    const geminiHistory = chatHistory.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }))

    // Start chat with system prompt
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: "System instructions: " + SYSTEM_PROMPT }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I'll have a natural, helpful conversation with the homeowner." }],
        },
        ...geminiHistory,
      ],
    })

    const result = await chat.sendMessage(message)
    const responseText = result.response.text()

    const parsed = parseResponse(responseText)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error("Intro chat error:", error)

    // Fallback response if Gemini fails
    return NextResponse.json({
      message: "Thanks for sharing that. To get you accurate pricing, I'll need to know a bit about your home. Ready to enter your address?",
      buttons: [
        { label: "Yes, let's do it", value: "ready" },
        { label: "Tell me more first", value: "more_info" },
      ],
      readyForAddress: false,
    })
  }
}
