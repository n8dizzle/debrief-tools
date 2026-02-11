"""
AI Invoice Review Module

Uses Google Gemini Flash to analyze invoice summaries and evaluate
3 pass/fail criteria for the debrief QA process:
1. Situation - What was the job / what situation did the tech arrive to?
2. Work Done - What did the tech do / what state was the system left in?
3. Customer Discussion - What was discussed with the customer?
"""

import os
from datetime import datetime
from typing import Dict, Optional
import google.generativeai as genai
from .database import TicketRaw

# Configure Gemini API
GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY")

# Minimum lengths by job category
MIN_LENGTHS = {
    "Service": 100,
    "Maintenance": 80,
    "Install": 120,
    "Sales": 50,
    "Default": 50,
}


def _get_model():
    """Get configured Gemini model."""
    if not GOOGLE_AI_API_KEY:
        return None
    genai.configure(api_key=GOOGLE_AI_API_KEY)
    return genai.GenerativeModel('gemini-2.0-flash-lite')


async def review_invoice_summary(
    invoice_summary: str,
    job_type: str,
    job_category: str,
    trade_type: str,
    invoice_materials_count: int = 0,
    invoice_equipment_count: int = 0,
    tech_name: str = "",
) -> Dict:
    """
    Review an invoice summary using Gemini Flash and evaluate 3 criteria.

    Returns:
        {
            "situation": {"pass": bool, "notes": str},
            "work_done": {"pass": bool, "notes": str},
            "customer_discussion": {"pass": bool, "notes": str},
            "overall_pass": bool,
            "legacy_score": int,  # 1-10 for backward compat
            "legacy_notes": str,
            "error": None
        }
    """
    # Handle missing or empty summary
    if not invoice_summary or not invoice_summary.strip():
        return {
            "situation": {"pass": False, "notes": "No invoice summary provided."},
            "work_done": {"pass": False, "notes": "No invoice summary provided."},
            "customer_discussion": {"pass": False, "notes": "No invoice summary provided."},
            "overall_pass": False,
            "legacy_score": 1,
            "legacy_notes": "No invoice summary provided. Tech must write a summary describing the work performed.",
            "error": None,
        }

    # Check minimum length
    min_len = MIN_LENGTHS.get(job_category, MIN_LENGTHS["Default"])
    summary_len = len(invoice_summary.strip())
    if summary_len < min_len:
        return {
            "situation": {"pass": False, "notes": f"Summary too short ({summary_len} chars, minimum {min_len})."},
            "work_done": {"pass": False, "notes": "Insufficient detail to evaluate."},
            "customer_discussion": {"pass": False, "notes": "Insufficient detail to evaluate."},
            "overall_pass": False,
            "legacy_score": max(1, int(summary_len / min_len * 5)),
            "legacy_notes": f"Summary too short ({summary_len} chars, minimum {min_len}). Needs more detail.",
            "error": None,
        }

    # Get Gemini model
    model = _get_model()
    if not model:
        return {
            "situation": {"pass": True, "notes": "AI review not available. Manual review required."},
            "work_done": {"pass": True, "notes": "AI review not available. Manual review required."},
            "customer_discussion": {"pass": True, "notes": "AI review not available. Manual review required."},
            "overall_pass": True,
            "legacy_score": 5,
            "legacy_notes": "AI review not available (API key not configured). Manual review required.",
            "error": "API key not configured",
        }

    prompt = f"""You are a quality reviewer for an HVAC/Plumbing company's invoice summaries.
Evaluate this invoice summary on 3 criteria. Each criterion is PASS or FAIL.

JOB CONTEXT:
- Job Type: {job_type}
- Category: {job_category}
- Trade: {trade_type}
- Materials on Invoice: {invoice_materials_count}
- Equipment on Invoice: {invoice_equipment_count}

INVOICE SUMMARY TO REVIEW:
---
{invoice_summary}
---

CRITERIA TO EVALUATE:

1. SITUATION: Does the summary describe what the job was about or what situation the tech arrived to? (Customer complaint, system condition, reason for visit)
   - PASS if it mentions the problem, customer request, or reason for the visit
   - FAIL if it jumps straight into work without any context

2. WORK_DONE: Does the summary describe what the tech did and/or what state the system was left in?
   - PASS if it describes specific actions taken, repairs made, or system status after work
   - FAIL if it's vague ("completed service") or missing work details

3. CUSTOMER_DISCUSSION: Does the summary mention what was discussed with the customer? (Recommendations, findings explained, next steps, options presented)
   - PASS if it mentions ANY communication with customer about findings, recommendations, or next steps
   - FAIL if there's no mention of customer interaction or discussion

Respond in this EXACT format (no markdown, plain text only):
SITUATION: PASS or FAIL
SITUATION_NOTES: [1 sentence explaining your assessment]
WORK_DONE: PASS or FAIL
WORK_DONE_NOTES: [1 sentence explaining your assessment]
CUSTOMER_DISCUSSION: PASS or FAIL
CUSTOMER_DISCUSSION_NOTES: [1 sentence explaining your assessment]

Now evaluate:"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Parse response
        result = {
            "situation": {"pass": False, "notes": ""},
            "work_done": {"pass": False, "notes": ""},
            "customer_discussion": {"pass": False, "notes": ""},
        }

        lines = response_text.split('\n')
        for line in lines:
            line = line.strip()
            upper = line.upper()

            if upper.startswith('SITUATION:') and not upper.startswith('SITUATION_NOTES:'):
                result["situation"]["pass"] = 'PASS' in upper.split(':', 1)[1]
            elif upper.startswith('SITUATION_NOTES:'):
                result["situation"]["notes"] = line.split(':', 1)[1].strip()
            elif upper.startswith('WORK_DONE:') and not upper.startswith('WORK_DONE_NOTES:'):
                result["work_done"]["pass"] = 'PASS' in upper.split(':', 1)[1]
            elif upper.startswith('WORK_DONE_NOTES:'):
                result["work_done"]["notes"] = line.split(':', 1)[1].strip()
            elif upper.startswith('CUSTOMER_DISCUSSION:') and not upper.startswith('CUSTOMER_DISCUSSION_NOTES:'):
                result["customer_discussion"]["pass"] = 'PASS' in upper.split(':', 1)[1]
            elif upper.startswith('CUSTOMER_DISCUSSION_NOTES:'):
                result["customer_discussion"]["notes"] = line.split(':', 1)[1].strip()

        overall_pass = all([
            result["situation"]["pass"],
            result["work_done"]["pass"],
            result["customer_discussion"]["pass"],
        ])

        # Derive legacy score for backward compat
        pass_count = sum([
            result["situation"]["pass"],
            result["work_done"]["pass"],
            result["customer_discussion"]["pass"],
        ])
        legacy_score = {0: 2, 1: 4, 2: 7, 3: 9}[pass_count]

        # Build legacy notes from criterion notes
        notes_parts = []
        for key, label in [("situation", "Situation"), ("work_done", "Work Done"), ("customer_discussion", "Discussion")]:
            status = "PASS" if result[key]["pass"] else "FAIL"
            if result[key]["notes"]:
                notes_parts.append(f"{label}: {status} - {result[key]['notes']}")
        legacy_notes = " | ".join(notes_parts)

        result["overall_pass"] = overall_pass
        result["legacy_score"] = legacy_score
        result["legacy_notes"] = legacy_notes
        result["error"] = None

        return result

    except Exception as e:
        print(f"AI review error: {e}")
        return {
            "situation": {"pass": True, "notes": "AI review failed."},
            "work_done": {"pass": True, "notes": "AI review failed."},
            "customer_discussion": {"pass": True, "notes": "AI review failed."},
            "overall_pass": True,
            "legacy_score": 5,
            "legacy_notes": "AI review failed. Manual review required.",
            "error": str(e),
        }


async def review_ticket(ticket: TicketRaw) -> Dict:
    """Convenience function to review a ticket's invoice summary."""
    return await review_invoice_summary(
        invoice_summary=ticket.invoice_summary or "",
        job_type=ticket.job_type_name or "Service",
        job_category=ticket.job_category or "Service",
        trade_type=ticket.trade_type or "HVAC",
        invoice_materials_count=ticket.invoice_materials_count or 0,
        invoice_equipment_count=ticket.invoice_equipment_count or 0,
        tech_name=ticket.tech_name or "",
    )


async def update_ticket_ai_review(ticket: TicketRaw, db_session) -> bool:
    """
    Run AI review on a ticket and update the database fields.

    Args:
        ticket: TicketRaw object to review
        db_session: SQLAlchemy session

    Returns:
        True if review was successful, False otherwise
    """
    result = await review_ticket(ticket)

    # Write new 3-criteria fields
    ticket.ai_invoice_situation = result["situation"]["pass"]
    ticket.ai_invoice_work_done = result["work_done"]["pass"]
    ticket.ai_invoice_customer_discussion = result["customer_discussion"]["pass"]
    ticket.ai_invoice_situation_notes = result["situation"]["notes"]
    ticket.ai_invoice_work_done_notes = result["work_done"]["notes"]
    ticket.ai_invoice_customer_discussion_notes = result["customer_discussion"]["notes"]

    # Write legacy fields for backward compat
    ticket.ai_invoice_score = result["legacy_score"]
    ticket.ai_invoice_notes = result["legacy_notes"]
    ticket.ai_reviewed_at = datetime.utcnow()

    db_session.commit()

    return result["error"] is None
