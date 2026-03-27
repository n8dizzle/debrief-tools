/**
 * Gemini AI Client
 * Handles homepage triage, agent conversation and equipment photo scanning
 */

import { GoogleGenerativeAI, type Content } from "@google/generative-ai"
import type {
  HomeData,
  DiscoveryData,
  ChatButton,
  EquipmentData,
  TriageIntent,
  UrgencyLevel,
  NextAction,
} from "@/types/flow"
import { getDeterministicResponse } from "@/lib/chat-responses"

// Initialize the Gemini client (server-side only)
function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set")
  }
  return new GoogleGenerativeAI(apiKey)
}

// Homepage triage system prompt
function buildHomepageTriagePrompt(homeData: HomeData | null, discoveryData: DiscoveryData): string {
  return `You are Homework's AI assistant helping homeowners with home service needs.

Your personality:
- Calm, knowledgeable, efficient
- No exclamation points
- One question at a time
- Explain why you're asking when helpful
- Be conversational but focused

Current state:
- Intent: ${discoveryData.intent || 'Not yet determined'}
- Urgency: ${discoveryData.urgency || 'Not yet determined'}
- Problem summary: ${discoveryData.problemSummary || 'Not yet provided'}
- Address provided: ${homeData ? 'Yes' : 'No'}
${homeData ? `- Home: ${homeData.formattedAddress} (${homeData.sqft?.toLocaleString() || '?'} sqft, built ${homeData.yearBuilt || '?'})` : ''}

${discoveryData.intent === 'ac_replacement' ? buildACReplacementContext(homeData, discoveryData) : ''}

Your job:
1. If intent is unknown: Ask clarifying questions to understand what they need help with
2. If intent is determined but missing info: Gather necessary details (address, photos, etc.)
3. Route to the appropriate next step when ready

ROUTING RULES - Use these tags at the END of your message when ready:
- [NEXT:ADDRESS] - Need user's address to proceed
- [NEXT:PHOTO] - Need equipment/issue photos (for AC replacement, repairs)
- [NEXT:OPTIONS] - Ready to show pricing/service options
- [NEXT:SCHEDULE] - Ready to schedule service
- [NEXT:HANDOFF] - Need human support (complex issue, emergency, out of scope)

When you need clickable buttons, use this format as the LAST line:
[BUTTONS: option1 | option2 | option3]

Examples:
- [BUTTONS: AC not cooling | Strange noise | High energy bills]
- [BUTTONS: Take a photo | Skip for now]
- [BUTTONS: Yes | No]

Important rules:
- Keep responses concise (2-3 sentences max before buttons)
- Never repeat information the user already knows
- Always put buttons on the LAST line if using them
- Only use ONE [NEXT:*] tag per response
- For emergencies (gas leak, electrical fire, flooding), use [NEXT:HANDOFF] immediately
`
}

// AC replacement specific context (used when intent is ac_replacement)
function buildACReplacementContext(homeData: HomeData | null, discoveryData: DiscoveryData): string {
  const equipmentInfo = discoveryData.equipment
    ? [
        `  - Brand: ${discoveryData.equipment.brand || 'Unknown'}`,
        `  - Model: ${discoveryData.equipment.model || 'Unknown'}`,
        `  - Tonnage: ${discoveryData.equipment.tonnage || 'Unknown'}`,
        `  - Age: ${discoveryData.equipment.estimatedAge ? `~${discoveryData.equipment.estimatedAge} years` : 'Unknown'}`,
      ].join('\n')
    : ''

  const allergiesText = discoveryData.comfort.allergies !== null
    ? (discoveryData.comfort.allergies ? 'Yes' : 'No')
    : 'Not asked'

  return `
AC Replacement Context:
- Equipment scanned: ${discoveryData.equipment ? 'Yes' : 'No'}
${equipmentInfo}
- System size: ${discoveryData.sizing.tonnage} tons (${discoveryData.sizing.source})
- Comfort questions:
  - Temperature balance: ${discoveryData.comfort.tempBalance || 'Not asked'}
  - Allergies: ${allergiesText}

AC Flow:
1. If no equipment data: Ask for photo of outdoor unit data plate, or offer to estimate from home size
2. If equipment exists but comfort not answered: Ask ONE comfort question at a time
3. Once sizing + comfort answered: Use [NEXT:OPTIONS] to show pricing
`
}

// Convert chat history to Gemini format
function convertToGeminiHistory(
  messages: Array<{ role: "agent" | "user"; content: string }>
): Content[] {
  return messages.map((msg) => ({
    role: msg.role === "agent" ? "model" : "user",
    parts: [{ text: msg.content }],
  }))
}

// Parse agent response for buttons, [NEXT:*] tags, and legacy signals
export function parseAgentResponse(response: string): {
  message: string
  buttons?: ChatButton[]
  nextAction: NextAction | null
  readyForPricing: boolean // backwards compatibility
} {
  let message = response
  let buttons: ChatButton[] | undefined
  let nextAction: NextAction | null = null

  // Parse [NEXT:*] tag
  const nextMatch = message.match(/\[NEXT:(ADDRESS|PHOTO|OPTIONS|SCHEDULE|HANDOFF)\]/)
  if (nextMatch) {
    nextAction = nextMatch[1] as NextAction
    message = message.replace(nextMatch[0], "").trim()
  }

  // Legacy: Check for [READY_FOR_PRICING] and convert to [NEXT:OPTIONS]
  if (message.includes("[READY_FOR_PRICING]")) {
    nextAction = "OPTIONS"
    message = message.replace("[READY_FOR_PRICING]", "").trim()
  }

  // Parse buttons (must be last line, so find and extract)
  const buttonMatch = message.match(/\[BUTTONS:\s*(.+?)\]\s*$/)
  if (buttonMatch) {
    const buttonLabels = buttonMatch[1].split("|").map((s) => s.trim())
    buttons = buttonLabels.map((label) => ({
      label,
      value: label.toLowerCase().replace(/\s+/g, "_"),
    }))
    message = message.replace(buttonMatch[0], "").trim()
  }

  return {
    message,
    buttons,
    nextAction,
    readyForPricing: nextAction === "OPTIONS", // backwards compatibility
  }
}

// Main chat function
export async function chatWithAgent(
  userMessage: string,
  homeData: HomeData | null,
  discoveryData: DiscoveryData,
  chatHistory: Array<{ role: "agent" | "user"; content: string }>
): Promise<{
  message: string
  buttons?: ChatButton[]
  nextAction: NextAction | null
  readyForPricing: boolean
}> {
  // FIRST: Check for deterministic response (consistent, no AI randomness)
  // This ensures actions like "new HVAC pricing" always return the same response
  const deterministicResponse = getDeterministicResponse(userMessage, homeData, discoveryData)
  if (deterministicResponse) {
    return {
      message: deterministicResponse.message,
      buttons: deterministicResponse.buttons,
      nextAction: deterministicResponse.nextAction ?? null,
      readyForPricing: deterministicResponse.readyForPricing ?? false,
    }
  }

  // FALLBACK: Use AI for complex/unknown queries
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const systemPrompt = buildHomepageTriagePrompt(homeData, discoveryData)

  // Start chat with system prompt as first model turn
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: [{ text: "System context: " + systemPrompt }],
      },
      {
        role: "model",
        parts: [{ text: "I understand. I'll help the homeowner with their home service needs in a calm, efficient manner." }],
      },
      ...convertToGeminiHistory(chatHistory),
    ],
  })

  const result = await chat.sendMessage(userMessage)
  const response = result.response.text()

  return parseAgentResponse(response)
}

// Equipment photo scanning with Gemini Vision
export async function scanEquipmentPhoto(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<{
  success: boolean
  equipment: EquipmentData
  confidence: number
  rawText?: string
}> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const prompt = `Analyze this image of an HVAC equipment data plate/label. Extract the following information if visible:

1. Brand/Manufacturer (e.g., Carrier, Trane, Lennox, Goodman, Rheem)
2. Model Number
3. Serial Number
4. Tonnage or BTU capacity (if tonnage not shown, calculate from BTU: BTU ÷ 12,000 = tons)
5. SEER rating (if shown)
6. Manufacturing date or age estimate (often encoded in serial number)

Return your analysis in this exact JSON format:
{
  "brand": "string or null",
  "model": "string or null",
  "serial": "string or null",
  "tonnage": number or null,
  "seer": number or null,
  "estimatedAge": number or null,
  "confidence": number between 0 and 1,
  "notes": "any additional observations"
}

If the image is not of HVAC equipment or is too blurry to read, return:
{
  "error": "description of the issue",
  "confidence": 0
}

Be precise about what you can actually read vs. what you're inferring.`

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ])

    const responseText = result.response.text()

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonStr.trim())

    if (parsed.error) {
      return {
        success: false,
        equipment: {
          method: "photo",
        },
        confidence: 0,
        rawText: parsed.error,
      }
    }

    return {
      success: true,
      equipment: {
        method: "photo",
        brand: parsed.brand || undefined,
        model: parsed.model || undefined,
        serial: parsed.serial || undefined,
        tonnage: parsed.tonnage || undefined,
        seer: parsed.seer || undefined,
        estimatedAge: parsed.estimatedAge || undefined,
      },
      confidence: parsed.confidence || 0.5,
      rawText: parsed.notes,
    }
  } catch (error) {
    console.error("Equipment scan error:", error)
    return {
      success: false,
      equipment: {
        method: "photo",
      },
      confidence: 0,
      rawText: error instanceof Error ? error.message : "Failed to analyze image",
    }
  }
}

// Homepage category buttons for initial triage
const HOMEPAGE_CATEGORY_BUTTONS: ChatButton[] = [
  { label: "AC not cooling", value: "ac_not_cooling", emoji: "❄️" },
  { label: "Heating issue", value: "heating_issue", emoji: "🔥" },
  { label: "Plumbing problem", value: "plumbing_problem", emoji: "🚿" },
  { label: "Electrical issue", value: "electrical_issue", emoji: "⚡" },
  { label: "Something else", value: "something_else", emoji: "🏠" },
]

// Generate initial greeting from agent (homepage-first)
export function getInitialAgentMessage(
  homeData: HomeData | null,
  discoveryData?: DiscoveryData
): {
  message: string
  buttons: ChatButton[]
} {
  // If we already have an intent, continue that flow
  if (discoveryData?.intent === "ac_replacement") {
    return getACReplacementInitialMessage(homeData)
  }

  // Homepage triage - start fresh
  return {
    message: "Hey there. Tell me what's going on with your home — I can help with AC, heating, plumbing, electrical, and more.",
    buttons: HOMEPAGE_CATEGORY_BUTTONS,
  }
}

// AC replacement specific initial message (used when intent is known)
function getACReplacementInitialMessage(homeData: HomeData | null): {
  message: string
  buttons: ChatButton[]
} {
  if (!homeData) {
    return {
      message: "Let's get you some AC replacement pricing. First, can you tell me your address so I can pull up your home's details?",
      buttons: [],
    }
  }

  const sqftText = homeData.sqft ? `${homeData.sqft.toLocaleString()} sq ft` : "your home"
  const yearText = homeData.yearBuilt ? `built in ${homeData.yearBuilt}` : ""
  const descriptor = [sqftText, yearText].filter(Boolean).join(", ")

  return {
    message: `Got it — nice place${descriptor ? ` (${descriptor})` : ""}. Let's figure out what AC system fits. Can you snap a photo of your outdoor unit's data plate? It helps me get the exact sizing and check warranty status.`,
    buttons: [
      { label: "Take a photo", value: "take_photo" },
      { label: "Upload a photo", value: "upload_photo" },
      { label: "Skip for now", value: "skip" },
    ],
  }
}

// Intent classification result
export interface IntentClassification {
  intent: TriageIntent
  urgency: UrgencyLevel
  problemSummary: string
  needsAddress: boolean
  suggestedNextAction: NextAction
  confidence: number
}

// Classify homepage intent from user text
export async function classifyHomepageIntent(text: string): Promise<IntentClassification> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

  const prompt = `Classify this home service request into a category and extract key details.

User said: "${text}"

Respond with ONLY valid JSON in this exact format:
{
  "intent": "ac_replacement" | "ac_repair" | "heating" | "plumbing" | "electrical" | "general_maintenance" | "emergency" | "unknown",
  "urgency": "low" | "medium" | "high" | "emergency",
  "problemSummary": "brief one-line summary of the issue",
  "needsAddress": true | false,
  "suggestedNextAction": "ADDRESS" | "PHOTO" | "OPTIONS" | "SCHEDULE" | "HANDOFF",
  "confidence": 0.0 to 1.0
}

Classification rules:
- "ac_replacement": User wants to replace AC, mentions old/broken AC needing replacement, or high energy bills with old AC
- "ac_repair": AC not cooling, strange noises, needs fixing but not necessarily replacement
- "heating": Furnace, heater, heat pump issues
- "plumbing": Leaks, drains, water heater, pipes
- "electrical": Outlets, wiring, panels, lights
- "general_maintenance": Tune-ups, inspections, seasonal maintenance
- "emergency": Gas leak, electrical fire, major flooding, no heat in freezing weather
- "unknown": Can't determine from the text

Urgency rules:
- "emergency": Safety hazard, gas leak, electrical fire, flooding, no AC in extreme heat with vulnerable people
- "high": No cooling/heating, major discomfort, time-sensitive issue
- "medium": Inconvenient but livable, planning ahead
- "low": General inquiry, maintenance, future planning

Next action rules:
- "ADDRESS": Need address to provide quotes or service
- "PHOTO": Need photos of equipment or issue
- "OPTIONS": Ready to show pricing/options (rare on first message)
- "SCHEDULE": Ready to schedule (rare on first message)
- "HANDOFF": Emergency or complex issue needing human help`

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonStr.trim())

    return {
      intent: parsed.intent || "unknown",
      urgency: parsed.urgency || "medium",
      problemSummary: parsed.problemSummary || text.slice(0, 100),
      needsAddress: parsed.needsAddress ?? true,
      suggestedNextAction: parsed.suggestedNextAction || "ADDRESS",
      confidence: parsed.confidence || 0.5,
    }
  } catch (error) {
    console.error("Intent classification error:", error)
    // Return safe defaults on error
    return {
      intent: "unknown",
      urgency: "medium",
      problemSummary: text.slice(0, 100),
      needsAddress: true,
      suggestedNextAction: "ADDRESS",
      confidence: 0,
    }
  }
}

// Update discoveryData with classified intent
export function applyIntentClassification(
  discoveryData: DiscoveryData,
  classification: IntentClassification
): DiscoveryData {
  return {
    ...discoveryData,
    intent: classification.intent,
    urgency: classification.urgency,
    problemSummary: classification.problemSummary,
    needsAddress: classification.needsAddress,
    nextAction: classification.suggestedNextAction,
  }
}
