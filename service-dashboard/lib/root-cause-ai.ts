// AI-assisted root-cause suggestion (on-demand, suggest-only).
// Calls Claude Haiku 4.5 with a forced strict tool so the output is always a
// validated {category, rationale, questions} object. The suggestion is shown to a
// human who confirms it — it is NEVER auto-applied to an investigation.

import Anthropic from '@anthropic-ai/sdk';
import { ROOT_CAUSE_CATEGORIES } from './qc-recalls';

// Cheap classification/extraction tier (explicitly chosen). Exported so callers that
// persist a suggestion can record which model produced it.
export const AI_MODEL_ID = 'claude-haiku-4-5';

export interface RcaContext {
  trade: string | null;
  jobType: string | null;
  daysToRecall: number | null;
  businessUnit: string | null;
  equipment: { manufacturer: string | null; model: string | null; type: string | null; installedOn: string | null } | null;
  originalSummary: string | null;
  recallSummary: string | null;
  // Notes are optional context. When present, the AI may quote them as evidence;
  // when absent, it must NOT fabricate quotes (see SYSTEM prompt + evidence schema).
  originalNotes?: string[];
  recallNotes?: string[];
}

// A single piece of evidence the AI used to reach its conclusion. `source` says where
// it came from (e.g. "Original job note", "Timing", "Equipment"); `quote` is verbatim
// text from the context — REQUIRED to be real, omitted when nothing quotable was given.
export interface RcaEvidence {
  claim: string;
  source: string;
  quote?: string;
}

export type RcaConfidence = 'high' | 'med' | 'low';

export interface RcaSuggestion {
  root_cause_category: string;
  rationale: string;
  confidence: RcaConfidence;
  evidence: RcaEvidence[];
  research_questions: string[];
}

const SYSTEM = `You are a quality-control analyst for an HVAC and plumbing service company.
A "recall" is a job where a technician had to return because earlier work wasn't right.
Given the context of a recall and its original job, suggest the single most likely root-cause
category, a one-to-two sentence rationale, a confidence level, the evidence you used, and 2-3
specific research questions a manager should investigate to confirm the cause.

Rules:
- Base everything ONLY on the context provided. Never invent facts.
- confidence: "high" only when the original/recall summaries or notes directly support the
  category. "med" when timing/equipment/trade point one way but the write-ups are thin.
  "low" when signal is weak or contradictory — say so in the rationale.
- evidence: list the concrete signals behind your pick. Each item has a "claim" (what it tells
  you), a "source" (e.g. "Original job note", "Timing", "Equipment", "Recall summary"), and,
  ONLY when you are quoting text that literally appears in the context, a "quote" with that exact
  text. If the context gives you no quotable text, omit "quote" — do NOT paraphrase into a quote
  or fabricate one.
This is a SUGGESTION for a human to confirm — be honest about uncertainty.`;

function buildContext(c: RcaContext): string {
  const lines: string[] = [];
  lines.push(`Trade: ${c.trade ?? 'unknown'}`);
  lines.push(`Job type: ${c.jobType ?? 'unknown'}`);
  lines.push(`Business unit: ${c.businessUnit ?? 'unknown'}`);
  lines.push(`Days from original job to recall: ${c.daysToRecall ?? 'unknown'}`);
  if (c.equipment) {
    lines.push(`Equipment: ${[c.equipment.manufacturer, c.equipment.model, c.equipment.type].filter(Boolean).join(' ') || 'unknown'}${c.equipment.installedOn ? ` (installed ${c.equipment.installedOn})` : ''}`);
  } else {
    lines.push('Equipment: none on file');
  }
  lines.push(`Original job summary: ${c.originalSummary?.trim() || '(none)'}`);
  const origNotes = (c.originalNotes || []).map(n => n.trim()).filter(Boolean);
  if (origNotes.length) lines.push(`Original job notes:\n${origNotes.map(n => `- ${n}`).join('\n')}`);
  lines.push(`Recall job summary: ${c.recallSummary?.trim() || '(none)'}`);
  const recNotes = (c.recallNotes || []).map(n => n.trim()).filter(Boolean);
  if (recNotes.length) lines.push(`Recall job notes:\n${recNotes.map(n => `- ${n}`).join('\n')}`);
  return lines.join('\n');
}

/**
 * Returns a validated root-cause suggestion, or throws. Caller renders it as a
 * suggestion the user accepts/edits — never writes it to the investigation directly.
 */
export async function suggestRootCause(ctx: RcaContext): Promise<RcaSuggestion> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI suggestions are not configured (ANTHROPIC_API_KEY missing).');
  }
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const response = await client.messages.create({
    model: AI_MODEL_ID,
    max_tokens: 1024,
    system: SYSTEM,
    tool_choice: { type: 'tool', name: 'submit_root_cause_analysis' },
    tools: [
      {
        name: 'submit_root_cause_analysis',
        description: 'Submit the suggested root cause, rationale, and research questions.',
        // strict guarantees the input validates exactly against this schema
        strict: true,
        input_schema: {
          type: 'object',
          properties: {
            root_cause_category: {
              type: 'string',
              enum: [...ROOT_CAUSE_CATEGORIES],
              description: 'The single most likely root-cause category.',
            },
            rationale: {
              type: 'string',
              description: 'One to two sentences explaining the suggestion, noting uncertainty if signal is thin.',
            },
            confidence: {
              type: 'string',
              enum: ['high', 'med', 'low'],
              description: 'How well the provided context supports the category. Be honest — "low" when signal is thin.',
            },
            evidence: {
              type: 'array',
              description: 'The concrete signals behind the pick. Include a verbatim "quote" ONLY when quoting text that literally appears in the context.',
              items: {
                type: 'object',
                properties: {
                  claim: { type: 'string', description: 'What this signal tells you about the cause.' },
                  source: { type: 'string', description: 'Where it came from, e.g. "Original job note", "Timing", "Equipment", "Recall summary".' },
                  quote: { type: 'string', description: 'Exact text from the context. Omit entirely if nothing quotable was provided.' },
                },
                required: ['claim', 'source'],
                additionalProperties: false,
              },
            },
            research_questions: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 specific questions a manager should investigate to confirm the cause.',
            },
          },
          required: ['root_cause_category', 'rationale', 'confidence', 'evidence', 'research_questions'],
          additionalProperties: false,
        },
      },
    ],
    messages: [{ role: 'user', content: buildContext(ctx) }],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('AI did not return a structured suggestion.');
  }
  const out = block.input as RcaSuggestion;
  // Defensive: strict mode guarantees the enum, but verify before trusting it downstream.
  if (!ROOT_CAUSE_CATEGORIES.includes(out.root_cause_category as never)) {
    throw new Error(`AI returned an unknown category: ${out.root_cause_category}`);
  }
  const confidence: RcaConfidence = (['high', 'med', 'low'] as const).includes(out.confidence)
    ? out.confidence : 'low';
  const evidence: RcaEvidence[] = (out.evidence || [])
    .filter(e => e && e.claim && e.source)
    .slice(0, 6)
    .map(e => ({ claim: e.claim, source: e.source, ...(e.quote ? { quote: e.quote } : {}) }));
  return {
    root_cause_category: out.root_cause_category,
    rationale: out.rationale,
    confidence,
    evidence,
    research_questions: (out.research_questions || []).slice(0, 3),
  };
}
