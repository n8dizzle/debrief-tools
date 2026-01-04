"""
Webhook handler for ServiceTitan events.

Receives job.updated events, filters for completed jobs,
and triggers the data enrichment pipeline.
"""

import os
import hmac
import hashlib
import json
from datetime import datetime
from typing import Optional
from fastapi import Request, HTTPException
from sqlalchemy.orm import Session

from .database import TicketRaw, WebhookLog, TicketStatus
from .servicetitan import get_st_client, categorize_job_type

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


async def verify_webhook_signature(request: Request) -> bool:
    """
    Verify HMAC signature from ServiceTitan webhook.
    Returns True if valid or if no secret configured (dev mode).
    """
    if not WEBHOOK_SECRET:
        # No secret configured - skip verification (dev mode)
        return True
    
    signature = request.headers.get("X-ServiceTitan-Signature", "")
    if not signature:
        return False
    
    body = await request.body()
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected)


async def process_webhook(payload: dict, db: Session) -> dict:
    """
    Process incoming webhook payload.
    
    Returns:
        {"processed": bool, "job_id": int or None, "message": str}
    """
    event_type = payload.get("eventType", "")
    
    # Log all webhooks for debugging
    log = WebhookLog(
        event_type=event_type,
        job_id=payload.get("data", {}).get("id"),
        payload=payload,
        processed=False,
    )
    db.add(log)
    db.commit()
    
    # Only process job.updated events
    if event_type != "job.updated":
        log.processed = True
        db.commit()
        return {
            "processed": False,
            "job_id": None,
            "message": f"Ignoring event type: {event_type}"
        }
    
    job_data = payload.get("data", {})
    job_id = job_data.get("id")
    job_status = job_data.get("jobStatus", "")
    
    if not job_id:
        log.error = "No job ID in payload"
        db.commit()
        return {
            "processed": False,
            "job_id": None,
            "message": "No job ID in payload"
        }
    
    # Only process completed jobs
    # ST job statuses: Pending, Dispatched, Working, Completed, Canceled, etc.
    if job_status.lower() != "completed":
        log.processed = True
        db.commit()
        return {
            "processed": False,
            "job_id": job_id,
            "message": f"Job {job_id} status is {job_status}, not completed"
        }
    
    # Check if we already have this job
    existing = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if existing:
        log.processed = True
        db.commit()
        return {
            "processed": False,
            "job_id": job_id,
            "message": f"Job {job_id} already in queue"
        }
    
    # Enrich job data from ST API
    try:
        st_client = get_st_client()
        enriched = await st_client.enrich_job_data(job_id)
        
        # Categorize job type
        category, trade = categorize_job_type(enriched.get("job_type_name", ""))
        
        # Create ticket record
        ticket = TicketRaw(
            job_id=job_id,
            tenant_id=enriched.get("tenant_id"),
            job_number=enriched.get("job_number"),
            business_unit_id=enriched.get("business_unit_id"),
            business_unit_name=enriched.get("business_unit_name"),
            job_type_id=enriched.get("job_type_id"),
            job_type_name=enriched.get("job_type_name"),
            job_status=enriched.get("job_status"),
            job_category=category,
            trade_type=trade,
            is_opportunity=enriched.get("is_opportunity", False),
            tag_type_ids=enriched.get("tag_type_ids"),
            tech_id=enriched.get("tech_id"),
            tech_name=enriched.get("tech_name"),
            all_techs=enriched.get("all_techs"),
            invoice_author=enriched.get("invoice_author"),
            customer_id=enriched.get("customer_id"),
            customer_name=enriched.get("customer_name"),
            is_new_customer=enriched.get("is_new_customer", False),
            location_id=enriched.get("location_id"),
            location_address=enriched.get("location_address"),
            invoice_id=enriched.get("invoice_id"),
            invoice_number=enriched.get("invoice_number"),
            invoice_summary=enriched.get("invoice_summary"),
            invoice_total=enriched.get("invoice_total", 0),
            invoice_balance=enriched.get("invoice_balance", 0),
            payment_collected=enriched.get("payment_collected", False),
            estimate_count=enriched.get("estimate_count", 0),
            estimates_total=enriched.get("estimates_total", 0),
            membership_sold=enriched.get("membership_sold", False),
            membership_type=enriched.get("membership_type"),
            photo_count=enriched.get("photo_count", 0),
            form_count=enriched.get("form_count", 0),
            completed_at=_parse_datetime(enriched.get("completed_at")),
            created_at=_parse_datetime(enriched.get("created_at")),
            raw_payload=enriched.get("raw_payload"),
            debrief_status=TicketStatus.PENDING,
        )

        db.add(ticket)
        log.processed = True
        db.commit()

        return {
            "processed": True,
            "job_id": job_id,
            "message": f"Job {job_id} added to debrief queue"
        }

    except Exception as e:
        log.error = str(e)
        db.commit()
        return {
            "processed": False,
            "job_id": job_id,
            "message": f"Error processing job {job_id}: {str(e)}"
        }


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse ISO datetime string."""
    if not value:
        return None
    try:
        # Handle various ISO formats
        if "." in value:
            value = value.split(".")[0]  # Remove microseconds
        if value.endswith("Z"):
            value = value[:-1]
        return datetime.fromisoformat(value)
    except:
        return None


async def manual_add_job(job_id: int, db: Session) -> dict:
    """
    Manually add a job to the queue (for testing or catching missed webhooks).
    """
    # Check if already exists
    existing = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if existing:
        return {
            "processed": False,
            "job_id": job_id,
            "message": f"Job {job_id} already in queue"
        }

    # Enrich and add
    try:
        st_client = get_st_client()
        enriched = await st_client.enrich_job_data(job_id)

        category, trade = categorize_job_type(enriched.get("job_type_name", ""))

        ticket = TicketRaw(
            job_id=job_id,
            tenant_id=enriched.get("tenant_id"),
            job_number=enriched.get("job_number"),
            business_unit_id=enriched.get("business_unit_id"),
            business_unit_name=enriched.get("business_unit_name"),
            job_type_id=enriched.get("job_type_id"),
            job_type_name=enriched.get("job_type_name"),
            job_status=enriched.get("job_status"),
            job_category=category,
            trade_type=trade,
            is_opportunity=enriched.get("is_opportunity", False),
            tag_type_ids=enriched.get("tag_type_ids"),
            tech_id=enriched.get("tech_id"),
            tech_name=enriched.get("tech_name"),
            all_techs=enriched.get("all_techs"),
            invoice_author=enriched.get("invoice_author"),
            customer_id=enriched.get("customer_id"),
            customer_name=enriched.get("customer_name"),
            is_new_customer=enriched.get("is_new_customer", False),
            location_id=enriched.get("location_id"),
            location_address=enriched.get("location_address"),
            invoice_id=enriched.get("invoice_id"),
            invoice_number=enriched.get("invoice_number"),
            invoice_summary=enriched.get("invoice_summary"),
            invoice_total=enriched.get("invoice_total", 0),
            invoice_balance=enriched.get("invoice_balance", 0),
            payment_collected=enriched.get("payment_collected", False),
            estimate_count=enriched.get("estimate_count", 0),
            estimates_total=enriched.get("estimates_total", 0),
            membership_sold=enriched.get("membership_sold", False),
            membership_type=enriched.get("membership_type"),
            photo_count=enriched.get("photo_count", 0),
            form_count=enriched.get("form_count", 0),
            completed_at=_parse_datetime(enriched.get("completed_at")),
            created_at=_parse_datetime(enriched.get("created_at")),
            raw_payload=enriched.get("raw_payload"),
            debrief_status=TicketStatus.PENDING,
        )
        
        db.add(ticket)
        db.commit()
        
        return {
            "processed": True,
            "job_id": job_id,
            "message": f"Job {job_id} manually added to debrief queue"
        }
        
    except Exception as e:
        return {
            "processed": False,
            "job_id": job_id,
            "message": f"Error adding job {job_id}: {str(e)}"
        }
