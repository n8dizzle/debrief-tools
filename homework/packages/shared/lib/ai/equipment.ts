// @homework/shared AI equipment scanning
// Gemini Vision-based HVAC equipment photo analysis.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EquipmentData } from '../types';

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Scan an HVAC equipment data plate photo using Gemini Vision.
 * Extracts brand, model, serial, tonnage, SEER rating, and estimated age.
 */
export async function scanEquipmentPhoto(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<{
  success: boolean;
  equipment: EquipmentData;
  confidence: number;
  rawText?: string;
}> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Analyze this image of an HVAC equipment data plate/label. Extract the following information if visible:

1. Brand/Manufacturer (e.g., Carrier, Trane, Lennox, Goodman, Rheem)
2. Model Number
3. Serial Number
4. Tonnage or BTU capacity (if tonnage not shown, calculate from BTU: BTU / 12,000 = tons)
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

Be precise about what you can actually read vs. what you're inferring.`;

  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ]);

    const responseText = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    if (parsed.error) {
      return {
        success: false,
        equipment: { method: 'photo' },
        confidence: 0,
        rawText: parsed.error,
      };
    }

    return {
      success: true,
      equipment: {
        method: 'photo',
        brand: parsed.brand || undefined,
        model: parsed.model || undefined,
        serial: parsed.serial || undefined,
        tonnage: parsed.tonnage || undefined,
        seer: parsed.seer || undefined,
        estimatedAge: parsed.estimatedAge || undefined,
      },
      confidence: parsed.confidence || 0.5,
      rawText: parsed.notes,
    };
  } catch (error) {
    console.error('Equipment scan error:', error);
    return {
      success: false,
      equipment: { method: 'photo' },
      confidence: 0,
      rawText: error instanceof Error ? error.message : 'Failed to analyze image',
    };
  }
}
