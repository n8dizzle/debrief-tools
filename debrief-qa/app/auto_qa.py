"""
Auto QA Suggestions Module

Calculates auto-suggestions for debrief questions based on available
ServiceTitan data. These are suggestions only - humans review and adjust.
"""

from typing import Dict, Optional
from .database import TicketRaw


def calculate_auto_suggestions(ticket: TicketRaw) -> Dict[str, Optional[str]]:
    """
    Calculate auto-suggestions for debrief questions based on ticket data.

    Returns a dict with question keys and suggested values:
    - "pass": Suggest Pass
    - "na": Suggest N/A
    - None: Cannot auto-suggest, requires human judgment

    Questions that CAN be auto-suggested:
    - photos_reviewed: Based on photo_count > 0
    - payment_verified: Based on payment_collected == True
    - estimates_verified: Based on estimate_count > 0 or is_opportunity == False
    - membership_verified: Based on membership_sold == True or customer has membership
    - materials_on_invoice: Based on invoice_materials_count > 0 or invoice_equipment_count > 0

    Questions that CANNOT be auto-suggested (require human judgment):
    - google_reviews_discussed
    - replacement_discussed
    - equipment_added
    - happy_call
    - g3_contact_needed
    """
    suggestions = {
        "photos_reviewed": None,
        "payment_verified": None,
        "estimates_verified": None,
        "membership_verified": None,
        "materials_on_invoice": None,
        # These always require human judgment
        "google_reviews_discussed": None,
        "replacement_discussed": None,
        "equipment_added": None,
        "happy_call": None,
    }

    # 1. Photos Reviewed
    # Pass if photos exist, otherwise no suggestion (could be N/A for phone consults)
    if ticket.photo_count and ticket.photo_count > 0:
        suggestions["photos_reviewed"] = "pass"

    # 2. Payment Verified
    # Pass if payment was collected
    if ticket.payment_collected:
        suggestions["payment_verified"] = "pass"

    # 3. Estimates Verified
    # Pass if estimates exist
    # N/A if not an opportunity job (no tag indicating conversion opportunity)
    if ticket.estimate_count and ticket.estimate_count > 0:
        suggestions["estimates_verified"] = "pass"
    elif ticket.is_opportunity is False:
        # Not an opportunity job - N/A is appropriate
        suggestions["estimates_verified"] = "na"

    # 4. Membership Verified
    # Pass if membership was sold on this job
    # N/A if customer already has an active membership
    if ticket.membership_sold:
        suggestions["membership_verified"] = "pass"
    elif ticket.membership_type and not ticket.membership_sold:
        # Customer already has membership (membership_type is set from existing membership)
        # Only suggest N/A if they have an active membership but didn't sell one
        if ticket.membership_expires:
            # Has an active membership with expiration date
            suggestions["membership_verified"] = "na"

    # 5. Materials on Invoice
    # Pass if materials or equipment are on invoice
    # For maintenance/diagnostic jobs with no materials, might be N/A but we can't auto-suggest that
    has_materials = (ticket.invoice_materials_count or 0) > 0
    has_equipment = (ticket.invoice_equipment_count or 0) > 0
    if has_materials or has_equipment:
        suggestions["materials_on_invoice"] = "pass"

    return suggestions


def get_suggestion_confidence(question: str, suggestion: Optional[str], ticket: TicketRaw) -> str:
    """
    Get confidence level for a suggestion.

    Returns: "high", "medium", or "low"
    """
    if suggestion is None:
        return "none"

    if question == "photos_reviewed":
        # High confidence if photos exist
        if suggestion == "pass" and ticket.photo_count and ticket.photo_count > 0:
            return "high"
        return "medium"

    if question == "payment_verified":
        # High confidence if payment collected with known method
        if suggestion == "pass" and ticket.payment_collected:
            if ticket.payment_method:
                return "high"
            return "medium"
        return "medium"

    if question == "estimates_verified":
        # High confidence if estimates exist
        if suggestion == "pass" and ticket.estimate_count and ticket.estimate_count > 0:
            return "high"
        # Medium confidence for N/A (opportunity detection not perfect)
        if suggestion == "na":
            return "medium"
        return "medium"

    if question == "membership_verified":
        # High confidence if membership was sold
        if suggestion == "pass" and ticket.membership_sold:
            return "high"
        # Medium confidence for N/A (customer might need upgrade)
        if suggestion == "na":
            return "medium"
        return "medium"

    if question == "materials_on_invoice":
        # High confidence if materials/equipment present
        has_materials = (ticket.invoice_materials_count or 0) > 0
        has_equipment = (ticket.invoice_equipment_count or 0) > 0
        if suggestion == "pass" and (has_materials or has_equipment):
            return "high"
        return "medium"

    return "medium"


def format_suggestions_for_template(suggestions: Dict[str, Optional[str]], ticket: TicketRaw) -> Dict:
    """
    Format suggestions for template rendering with confidence levels.

    Returns a dict with:
    {
        "photos_reviewed": {"value": "pass", "confidence": "high"},
        "payment_verified": {"value": "pass", "confidence": "high"},
        ...
    }
    """
    formatted = {}
    for question, suggestion in suggestions.items():
        if suggestion:
            formatted[question] = {
                "value": suggestion,
                "confidence": get_suggestion_confidence(question, suggestion, ticket),
            }
    return formatted
