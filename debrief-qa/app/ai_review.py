"""
AI Invoice Review Module

Uses Google Gemini Flash to analyze invoice summaries and provide
quality scores and feedback for the debrief QA process.
"""

import os
from datetime import datetime
from typing import Dict, Optional
import google.generativeai as genai
from .database import TicketRaw

# Configure Gemini API
GOOGLE_AI_API_KEY = os.getenv("GOOGLE_AI_API_KEY")

# Scoring weights
SCORING_WEIGHTS = {
    "problem_diagnosis": 0.25,    # Describes what was wrong
    "work_performed": 0.25,       # Specific actions taken
    "parts_materials": 0.15,      # Lists parts used
    "recommendations": 0.15,      # Future work suggestions
    "professionalism": 0.10,      # Grammar, tone
    "length_adequacy": 0.10,      # Not too short
}

# Minimum lengths by job category
MIN_LENGTHS = {
    "Service": 100,
    "Maintenance": 80,
    "Install": 120,
    "Sales": 50,
    "Default": 50,
}

# Job type specific requirements
JOB_TYPE_REQUIREMENTS = {
    "Service": "MUST describe the problem/diagnosis AND the repair/fix performed",
    "Maintenance": "MUST describe system condition AND checks/tests performed",
    "Install": "MUST describe what was installed AND testing/startup performed",
    "Sales": "Should describe customer needs and recommendations discussed",
}


def _get_model():
    """Get configured Gemini model."""
    if not GOOGLE_AI_API_KEY:
        return None
    genai.configure(api_key=GOOGLE_AI_API_KEY)
    # Use gemini-2.0-flash-lite for cost efficiency (~$0.075/1M tokens)
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
    Review an invoice summary using Gemini Flash and return score/feedback.

    Args:
        invoice_summary: The technician's invoice summary text
        job_type: Full job type name (e.g., "Service HVAC")
        job_category: Category (Service, Maintenance, Install, Sales)
        trade_type: Trade (HVAC, Plumbing)
        invoice_materials_count: Number of materials on invoice
        invoice_equipment_count: Number of equipment items on invoice
        tech_name: Technician name for personalized feedback

    Returns:
        {
            "score": 7,          # 1-10 score
            "notes": "...",      # Feedback notes for reviewer
            "breakdown": {...},  # Optional detailed breakdown
            "error": None        # Error message if failed
        }
    """
    # Handle missing or empty summary
    if not invoice_summary or not invoice_summary.strip():
        return {
            "score": 1,
            "notes": "No invoice summary provided. Tech must write a summary describing the work performed.",
            "breakdown": None,
            "error": None,
        }

    # Check minimum length first (quick validation)
    min_len = MIN_LENGTHS.get(job_category, MIN_LENGTHS["Default"])
    summary_len = len(invoice_summary.strip())
    if summary_len < min_len:
        return {
            "score": max(1, int(summary_len / min_len * 5)),
            "notes": f"Summary too short ({summary_len} chars, minimum {min_len}). Needs more detail about work performed.",
            "breakdown": {"length_adequacy": summary_len / min_len},
            "error": None,
        }

    # Get Gemini model
    model = _get_model()
    if not model:
        # API key not configured - return basic length-based score
        length_score = min(10, int(summary_len / min_len * 6) + 4)
        return {
            "score": length_score,
            "notes": "AI review not available (API key not configured). Manual review required.",
            "breakdown": None,
            "error": "API key not configured",
        }

    # Build the prompt
    job_requirements = JOB_TYPE_REQUIREMENTS.get(job_category, JOB_TYPE_REQUIREMENTS["Service"])

    prompt = f"""You are a quality reviewer for an HVAC/Plumbing company's invoice summaries.
Review this invoice summary and score it 1-10 based on the criteria below.

JOB CONTEXT:
- Job Type: {job_type}
- Category: {job_category}
- Trade: {trade_type}
- Materials on Invoice: {invoice_materials_count}
- Equipment on Invoice: {invoice_equipment_count}

JOB TYPE REQUIREMENT: {job_requirements}

INVOICE SUMMARY TO REVIEW:
---
{invoice_summary}
---

SCORING CRITERIA (score each 1-10):
1. Problem/Diagnosis (25%): Does it describe what was wrong or the customer's complaint?
2. Work Performed (25%): Does it describe specific actions taken and repairs made?
3. Parts/Materials (15%): Does it mention parts or materials used? (Cross-reference: {invoice_materials_count} materials, {invoice_equipment_count} equipment on invoice)
4. Recommendations (15%): Does it include future work suggestions or preventive advice?
5. Professionalism (10%): Is it written in complete sentences with professional tone?
6. Length Adequacy (10%): Is it detailed enough for this job type?

Respond in this EXACT format (no markdown, just plain text):
SCORE: [1-10]
NOTES: [2-3 sentences of specific, actionable feedback for the reviewer. Focus on what's missing or could be improved. Be direct but constructive.]

Example good response:
SCORE: 7
NOTES: Summary describes the repair well but is missing specific parts used. Tech should list the capacitor value replaced and mention any recommendations for future maintenance.

Example bad response (too vague):
SCORE: 5
NOTES: Could be better.

Now review the summary:"""

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        # Parse the response
        score = 5  # Default
        notes = "Unable to parse AI review response"

        lines = response_text.split('\n')
        for line in lines:
            line = line.strip()
            if line.upper().startswith('SCORE:'):
                try:
                    score_str = line.split(':', 1)[1].strip()
                    # Handle "7/10" format
                    if '/' in score_str:
                        score_str = score_str.split('/')[0]
                    score = int(float(score_str))
                    score = max(1, min(10, score))  # Clamp to 1-10
                except (ValueError, IndexError):
                    pass
            elif line.upper().startswith('NOTES:'):
                notes = line.split(':', 1)[1].strip()

        return {
            "score": score,
            "notes": notes,
            "breakdown": None,
            "error": None,
        }

    except Exception as e:
        # Log error and return graceful failure
        print(f"AI review error: {e}")
        return {
            "score": 5,
            "notes": f"AI review failed. Manual review required.",
            "breakdown": None,
            "error": str(e),
        }


async def review_ticket(ticket: TicketRaw) -> Dict:
    """
    Convenience function to review a ticket's invoice summary.

    Args:
        ticket: TicketRaw database object

    Returns:
        Same as review_invoice_summary()
    """
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

    ticket.ai_invoice_score = result["score"]
    ticket.ai_invoice_notes = result["notes"]
    ticket.ai_reviewed_at = datetime.utcnow()

    db_session.commit()

    return result["error"] is None
