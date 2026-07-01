// AI-assisted root-cause suggestion (on-demand, suggest-only).
// Calls Claude Haiku 4.5 with a forced strict tool so the output is always a
// validated {category, rationale, questions} object. The suggestion is shown to a
// human who confirms it — it is NEVER auto-applied to an investigation.

import Anthropic from '@anthropic-ai/sdk';
import { ROOT_CAUSE_CATEGORIES } from './qc-recalls';

export interface RcaContext {
  trade: string | null;
  jobType: string | null;
  daysToRecall: number | null;
  businessUnit: string | null;
  equipment: { manufacturer: string | null; model: string | null; type: string | null; installedOn: string | null } | null;
  originalSummary: string | null;
  recallSummary: string | null;
}

export interface RcaSuggestion {
  root_cause_category: string;
  rationale: string;
  research_questions: string[];
}

const SYSTEM = `You are a quality-control analyst for an HVAC and plumbing service company.
A "recall" is a job where a technician had to return because earlier work wasn't right.
Given the context of a recall and its original job, suggest the single most likely root-cause
category, a one-to-two sentence rationale, and 2-3 specific research questions a manager should
investigate to confirm the cause. Base the suggestion only on the context provided; if signal is
thin, say so in the rationale and pick the best-supported category. This is a SUGGESTION for a
human to confirm — be honest about uncertainty.`;

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
  lines.push(`Recall job summary: ${c.recallSummary?.trim() || '(none)'}`);
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
    model: 'claude-haiku-4-5', // cheap classification/extraction tier (explicitly chosen)
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
            research_questions: {
              type: 'array',
              items: { type: 'string' },
              description: '2-3 specific questions a manager should investigate to confirm the cause.',
            },
          },
          required: ['root_cause_category', 'rationale', 'research_questions'],
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
  return {
    root_cause_category: out.root_cause_category,
    rationale: out.rationale,
    research_questions: (out.research_questions || []).slice(0, 3),
  };
}
