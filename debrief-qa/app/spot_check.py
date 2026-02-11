"""
Spot Check System - Selection Logic and Accuracy Calculations.

Handles:
- Daily automated selection of debriefs for spot checking (weighted 10%)
- Manual spot check creation
- Dispatcher accuracy score calculations
"""

import random
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from .database import (
    DebriefSession, SpotCheck, SpotCheckStatus,
    Dispatcher, TicketRaw
)


async def select_daily_spot_checks(
    db: Session,
    target_date: Optional[date] = None,
    target_percentage: float = 0.10
) -> Dict:
    """
    Select debriefs from a target date for spot check review.

    Selection Strategy (Weighted):
    1. Priority 1: All flagged/followup tickets (always selected)
    2. Priority 2: Random selection to fill remaining slots to reach target %

    Args:
        db: Database session
        target_date: Date to select debriefs from (defaults to yesterday)
        target_percentage: Target percentage of debriefs to select (default 10%)

    Returns:
        Dict with selection stats
    """
    # Use Central Time for determining "today" and date boundaries
    central = ZoneInfo("America/Chicago")
    utc = ZoneInfo("UTC")

    if target_date is None:
        # "Yesterday" in Central Time
        today_central = datetime.now(central).date()
        target_date = today_central - timedelta(days=1)

    # Get date range for the target date in Central Time, then convert to UTC
    day_start_central = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=central)
    day_end_central = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=central)
    # Convert to naive UTC for database comparison
    day_start = day_start_central.astimezone(utc).replace(tzinfo=None)
    day_end = day_end_central.astimezone(utc).replace(tzinfo=None)
    batch_id = target_date.isoformat()

    # Get all debriefs completed on target date
    debriefs = db.query(DebriefSession).filter(
        and_(
            DebriefSession.completed_at >= day_start,
            DebriefSession.completed_at <= day_end
        )
    ).all()

    if not debriefs:
        return {
            "batch_date": batch_id,
            "total_debriefs": 0,
            "selected_count": 0,
            "flagged_count": 0,
            "random_count": 0,
            "message": "No debriefs found for target date"
        }

    total_count = len(debriefs)
    target_count = max(1, int(total_count * target_percentage))  # At least 1

    # Separate into priority categories
    flagged = []
    regular = []

    for d in debriefs:
        # Skip if already has a spot check
        existing = db.query(SpotCheck).filter(
            SpotCheck.debrief_session_id == d.id
        ).first()
        if existing:
            continue

        if d.followup_required:
            flagged.append(d)
        else:
            regular.append(d)

    selected = []

    # Priority 1: All flagged tickets (up to target count)
    for d in flagged[:target_count]:
        selected.append((d, 'flagged'))

    # Priority 2: Random fill to reach target
    remaining_slots = target_count - len(selected)
    if remaining_slots > 0 and regular:
        random_picks = random.sample(regular, min(remaining_slots, len(regular)))
        for d in random_picks:
            selected.append((d, 'random'))

    # Create SpotCheck records
    created_ids = []
    for debrief, reason in selected:
        spot_check = SpotCheck(
            debrief_session_id=debrief.id,
            selection_reason=reason,
            selection_batch=batch_id,
            status=SpotCheckStatus.PENDING,
            selected_at=datetime.utcnow()
        )
        db.add(spot_check)
        db.flush()  # Get the ID
        created_ids.append(spot_check.id)

    db.commit()

    return {
        "batch_date": batch_id,
        "total_debriefs": total_count,
        "selected_count": len(selected),
        "flagged_count": len([s for s in selected if s[1] == 'flagged']),
        "random_count": len([s for s in selected if s[1] == 'random']),
        "spot_check_ids": created_ids,
        "message": f"Selected {len(selected)} debriefs for spot check"
    }


async def create_manual_spot_check(
    db: Session,
    debrief_session_id: int
) -> Dict:
    """
    Manually add a specific debrief to spot check queue.

    Args:
        db: Database session
        debrief_session_id: ID of the debrief session to spot check

    Returns:
        Dict with result
    """
    # Check if debrief exists
    debrief = db.query(DebriefSession).filter(
        DebriefSession.id == debrief_session_id
    ).first()

    if not debrief:
        return {
            "success": False,
            "message": "Debrief session not found"
        }

    # Check if spot check already exists
    existing = db.query(SpotCheck).filter(
        SpotCheck.debrief_session_id == debrief_session_id
    ).first()

    if existing:
        return {
            "success": False,
            "message": "Spot check already exists for this debrief",
            "spot_check_id": existing.id
        }

    # Create spot check (use Central Time for batch date)
    central = ZoneInfo("America/Chicago")
    today_central = datetime.now(central).date()
    spot_check = SpotCheck(
        debrief_session_id=debrief_session_id,
        selection_reason='manual',
        selection_batch=today_central.isoformat(),
        status=SpotCheckStatus.PENDING,
        selected_at=datetime.utcnow()
    )
    db.add(spot_check)
    db.commit()

    return {
        "success": True,
        "message": "Spot check created",
        "spot_check_id": spot_check.id
    }


def calculate_dispatcher_accuracy(spot_checks: List[SpotCheck]) -> Dict:
    """
    Calculate dispatcher accuracy based on completed spot check results.

    Weights (aligned with composite score):
    - Photos (2x), Payment (2x), Estimates (2x), Invoice (4x)
    - Non-scored items (1x): replacement, equipment

    Args:
        spot_checks: List of completed SpotCheck records

    Returns:
        Dict with accuracy metrics
    """
    if not spot_checks:
        return {
            "overall_accuracy": None,
            "sample_size": 0,
            "avg_grade": None
        }

    # Define items with weights (matching composite score weights)
    items = {
        "photos": {"correct": 0, "total": 0, "weight": 2},
        "invoice_score": {"correct": 0, "total": 0, "weight": 4},
        "payment": {"correct": 0, "total": 0, "weight": 2},
        "estimates": {"correct": 0, "total": 0, "weight": 2},
        "membership": {"correct": 0, "total": 0, "weight": 1},
        "reviews": {"correct": 0, "total": 0, "weight": 1},
        "replacement": {"correct": 0, "total": 0, "weight": 1},
        "equipment": {"correct": 0, "total": 0, "weight": 1},
    }

    grades = []

    for sc in spot_checks:
        # Count each item
        if sc.photos_correct is not None:
            items["photos"]["total"] += 1
            if sc.photos_correct:
                items["photos"]["correct"] += 1

        if sc.invoice_score_correct is not None:
            items["invoice_score"]["total"] += 1
            if sc.invoice_score_correct:
                items["invoice_score"]["correct"] += 1

        if sc.payment_correct is not None:
            items["payment"]["total"] += 1
            if sc.payment_correct:
                items["payment"]["correct"] += 1

        if sc.estimates_correct is not None:
            items["estimates"]["total"] += 1
            if sc.estimates_correct:
                items["estimates"]["correct"] += 1

        if sc.membership_correct is not None:
            items["membership"]["total"] += 1
            if sc.membership_correct:
                items["membership"]["correct"] += 1

        if sc.reviews_correct is not None:
            items["reviews"]["total"] += 1
            if sc.reviews_correct:
                items["reviews"]["correct"] += 1

        if sc.replacement_correct is not None:
            items["replacement"]["total"] += 1
            if sc.replacement_correct:
                items["replacement"]["correct"] += 1

        if sc.equipment_correct is not None:
            items["equipment"]["total"] += 1
            if sc.equipment_correct:
                items["equipment"]["correct"] += 1

        # Collect grades
        if sc.overall_grade is not None:
            grades.append(sc.overall_grade)

    # Calculate weighted overall accuracy
    total_weight = 0
    weighted_sum = 0

    results = {
        "sample_size": len(spot_checks),
        "items_checked": sum(data["total"] for data in items.values())
    }

    for name, data in items.items():
        if data["total"] > 0:
            accuracy = (data["correct"] / data["total"]) * 100
            results[f"{name}_accuracy"] = round(accuracy, 1)
            results[f"{name}_total"] = data["total"]
            weighted_sum += accuracy * data["weight"]
            total_weight += data["weight"]
        else:
            results[f"{name}_accuracy"] = None
            results[f"{name}_total"] = 0

    if total_weight > 0:
        results["overall_accuracy"] = round(weighted_sum / total_weight, 1)
    else:
        results["overall_accuracy"] = None

    # Calculate average grade
    if grades:
        results["avg_grade"] = round(sum(grades) / len(grades), 1)
    else:
        results["avg_grade"] = None

    # Count coaching needed
    results["coaching_needed_count"] = sum(1 for sc in spot_checks if sc.coaching_needed)

    return results


def get_dispatcher_accuracy_stats(db: Session, dispatcher_id: int) -> Dict:
    """
    Get accuracy stats for a specific dispatcher.

    Args:
        db: Database session
        dispatcher_id: ID of the dispatcher

    Returns:
        Dict with accuracy stats
    """
    # Get all completed spot checks for debriefs done by this dispatcher
    spot_checks = db.query(SpotCheck).join(
        DebriefSession, SpotCheck.debrief_session_id == DebriefSession.id
    ).filter(
        and_(
            DebriefSession.dispatcher_id == dispatcher_id,
            SpotCheck.status == SpotCheckStatus.COMPLETED
        )
    ).all()

    return calculate_dispatcher_accuracy(spot_checks)


def get_all_dispatcher_accuracy_stats(db: Session) -> List[Dict]:
    """
    Get accuracy stats for all dispatchers.

    Args:
        db: Database session

    Returns:
        List of dicts with dispatcher info and accuracy stats
    """
    dispatchers = db.query(Dispatcher).filter(Dispatcher.is_active == True).all()

    results = []
    for d in dispatchers:
        stats = get_dispatcher_accuracy_stats(db, d.id)
        results.append({
            "dispatcher_id": d.id,
            "dispatcher_name": d.name,
            "role": d.role.value if d.role else "dispatcher",
            "is_primary": d.is_primary,
            **stats
        })

    # Sort by overall accuracy (None values at the end)
    results.sort(
        key=lambda x: (x["overall_accuracy"] is None, -(x["overall_accuracy"] or 0))
    )

    return results
