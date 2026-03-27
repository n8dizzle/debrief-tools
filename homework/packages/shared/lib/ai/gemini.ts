// @homework/shared AI Gemini helpers
// Intent classification and response parsing for the conversational UI.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  TriageIntent,
  UrgencyLevel,
  NextAction,
  ChatButton,
} from '../types';

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

/**
 * Parse an agent response for [NEXT:*] tags and [BUTTONS: ...] markup.
 */
export function parseAgentResponse(response: string): {
  message: string;
  buttons?: ChatButton[];
  nextAction: NextAction | null;
  readyForPricing: boolean;
} {
  let message = response;
  let buttons: ChatButton[] | undefined;
  let nextAction: NextAction | null = null;

  // Parse [NEXT:*] tag
  const nextMatch = message.match(/\[NEXT:(ADDRESS|PHOTO|OPTIONS|SCHEDULE|HANDOFF)\]/);
  if (nextMatch) {
    nextAction = nextMatch[1] as NextAction;
    message = message.replace(nextMatch[0], '').trim();
  }

  // Legacy: Convert [READY_FOR_PRICING] to [NEXT:OPTIONS]
  if (message.includes('[READY_FOR_PRICING]')) {
    nextAction = 'OPTIONS';
    message = message.replace('[READY_FOR_PRICING]', '').trim();
  }

  // Parse buttons (last line)
  const buttonMatch = message.match(/\[BUTTONS:\s*(.+?)\]\s*$/);
  if (buttonMatch) {
    const buttonLabels = buttonMatch[1].split('|').map((s) => s.trim());
    buttons = buttonLabels.map((label) => ({
      label,
      value: label.toLowerCase().replace(/\s+/g, '_'),
    }));
    message = message.replace(buttonMatch[0], '').trim();
  }

  return {
    message,
    buttons,
    nextAction,
    readyForPricing: nextAction === 'OPTIONS',
  };
}

// ---------------------------------------------------------------------------
// Intent Classification
// ---------------------------------------------------------------------------

export interface IntentClassification {
  intent: TriageIntent;
  urgency: UrgencyLevel;
  problemSummary: string;
  needsAddress: boolean;
  suggestedNextAction: NextAction;
  confidence: number;
}

/**
 * Classify a user's homepage message into an intent category.
 */
export async function classifyHomepageIntent(text: string): Promise<IntentClassification> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
- "HANDOFF": Emergency or complex issue needing human help`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      intent: parsed.intent || 'unknown',
      urgency: parsed.urgency || 'medium',
      problemSummary: parsed.problemSummary || text.slice(0, 100),
      needsAddress: parsed.needsAddress ?? true,
      suggestedNextAction: parsed.suggestedNextAction || 'ADDRESS',
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    console.error('Intent classification error:', error);
    return {
      intent: 'unknown',
      urgency: 'medium',
      problemSummary: text.slice(0, 100),
      needsAddress: true,
      suggestedNextAction: 'ADDRESS',
      confidence: 0,
    };
  }
}
