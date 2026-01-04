"""
Debrief QA System - FastAPI Application

Main entry point for the application. Handles:
- Webhook endpoint for ServiceTitan
- API endpoints for the dispatcher UI
- HTML template rendering
"""

import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Request, HTTPException, Depends, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from dotenv import load_dotenv

from .database import (
    get_db, init_db,
    TicketRaw, TicketStatus, CheckStatus,
    Dispatcher, DispatcherRole, DebriefSession, WebhookLog,
    SpotCheck, SpotCheckStatus
)
from .models import (
    TicketSummary, TicketDetail, DebriefSubmission, DebriefResponse,
    DashboardResponse, DailyStats, DispatcherStats,
    DispatcherCreate, DispatcherResponse
)
from .webhook import verify_webhook_signature, process_webhook, manual_add_job

load_dotenv()

app = FastAPI(
    title="Debrief QA System",
    description="Real-time job ticket quality assurance for dispatcher debrief workflow",
    version="1.0.0"
)

# Mount static files and templates
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


# ----- Startup -----

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


# ----- Webhook Endpoint -----

@app.post("/webhook/servicetitan")
async def servicetitan_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receive webhooks from ServiceTitan.
    Immediately returns 200 to acknowledge receipt, then processes asynchronously.
    """
    # Verify signature
    if not await verify_webhook_signature(request):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    payload = await request.json()
    result = await process_webhook(payload, db)
    
    return JSONResponse(content=result, status_code=200)


# ----- HTML Pages -----

@app.get("/")
async def home():
    """Home page - redirect to queue."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/queue", status_code=302)


@app.get("/queue", response_class=HTMLResponse)
async def queue_page(request: Request, db: Session = Depends(get_db)):
    """Dispatcher queue view."""
    pending = db.query(TicketRaw).filter(
        TicketRaw.debrief_status == TicketStatus.PENDING
    ).order_by(TicketRaw.completed_at.desc()).all()

    in_progress = db.query(TicketRaw).filter(
        TicketRaw.debrief_status == TicketStatus.IN_PROGRESS
    ).order_by(TicketRaw.completed_at.desc()).all()

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Jobs completed in ServiceTitan today (based on job completion time)
    jobs_completed_today = db.query(TicketRaw).filter(
        TicketRaw.completed_at >= today_start
    ).count()

    # Debriefs submitted today (based on debrief submission time)
    debriefs_completed_today = db.query(DebriefSession).filter(
        DebriefSession.completed_at >= today_start
    ).count()

    return templates.TemplateResponse("queue.html", {
        "request": request,
        "title": "Debrief Queue",
        "pending_tickets": pending,
        "in_progress_tickets": in_progress,
        "pending_count": len(pending),
        "jobs_completed_today": jobs_completed_today,
        "debriefs_completed_today": debriefs_completed_today,
    })


@app.get("/debrief/{job_id}", response_class=HTMLResponse)
async def debrief_page(job_id: int, request: Request, db: Session = Depends(get_db)):
    """Single job debrief form."""
    from .servicetitan import get_st_client

    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")

    # Mark as in progress if pending
    if ticket.debrief_status == TicketStatus.PENDING:
        ticket.debrief_status = TicketStatus.IN_PROGRESS
        db.commit()

    # Get existing debrief if any
    existing_debrief = db.query(DebriefSession).filter(
        DebriefSession.job_id == job_id
    ).first()

    # Get dispatchers for dropdown
    dispatchers = db.query(Dispatcher).filter(Dispatcher.is_active == True).all()

    # Fetch form submissions for this job (fresh from API)
    form_submissions = []
    if ticket.form_count and ticket.form_count > 0:
        try:
            client = get_st_client()
            forms_response = await client.get_form_submissions_by_job(job_id)
            form_submissions = forms_response.get("data", [])
        except Exception:
            pass  # Forms will just be empty if fetch fails

    return templates.TemplateResponse("debrief.html", {
        "request": request,
        "title": f"Debrief - Job #{ticket.job_number}",
        "ticket": ticket,
        "debrief": existing_debrief,
        "dispatchers": dispatchers,
        "form_submissions": form_submissions,
    })


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request, db: Session = Depends(get_db)):
    """Completion tracking dashboard."""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "title": "Dashboard"
    })


# ----- API Endpoints -----

@app.get("/api/queue", response_model=List[TicketSummary])
async def get_queue(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get jobs in debrief queue."""
    query = db.query(TicketRaw)
    
    if status:
        query = query.filter(TicketRaw.debrief_status == status)
    else:
        query = query.filter(TicketRaw.debrief_status != TicketStatus.COMPLETED)
    
    tickets = query.order_by(TicketRaw.completed_at.desc()).all()
    return tickets


@app.get("/api/job/{job_id}", response_model=TicketDetail)
async def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get full job details."""
    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")
    return ticket


@app.post("/api/job/{job_id}/debrief", response_model=DebriefResponse)
async def submit_debrief(
    job_id: int,
    debrief: DebriefSubmission,
    db: Session = Depends(get_db)
):
    """Submit completed debrief checklist."""
    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Check dispatcher exists
    dispatcher = db.query(Dispatcher).filter(Dispatcher.id == debrief.dispatcher_id).first()
    if not dispatcher:
        raise HTTPException(status_code=400, detail="Invalid dispatcher ID")
    
    # Create or update debrief session
    existing = db.query(DebriefSession).filter(DebriefSession.job_id == job_id).first()
    
    if existing:
        # Update existing
        for key, value in debrief.dict().items():
            setattr(existing, key, value)
        existing.completed_at = datetime.utcnow()
        session = existing
    else:
        # Create new
        session = DebriefSession(
            job_id=job_id,
            dispatcher_id=debrief.dispatcher_id,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            **debrief.dict(exclude={"dispatcher_id"})
        )
        db.add(session)
    
    # Mark ticket as completed
    ticket.debrief_status = TicketStatus.COMPLETED
    db.commit()
    
    return DebriefResponse(
        success=True,
        job_id=job_id,
        message="Debrief completed successfully",
        completed_at=session.completed_at
    )


@app.post("/api/job/{job_id}/debrief/form")
async def submit_debrief_form(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Submit debrief via HTML form (non-JSON)."""
    form_data = await request.form()
    
    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Parse form data
    dispatcher_id = int(form_data.get("dispatcher_id", 0))
    dispatcher = db.query(Dispatcher).filter(Dispatcher.id == dispatcher_id).first()
    if not dispatcher:
        raise HTTPException(status_code=400, detail="Please select a dispatcher")
    
    # Check if follow-up is required
    followup_required = form_data.get("followup_required") == "true"
    
    # Create debrief session
    session = DebriefSession(
        job_id=job_id,
        dispatcher_id=dispatcher_id,
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        
        photos_reviewed=form_data.get("photos_reviewed", "pending"),
        photos_notes=form_data.get("photos_notes"),
        
        invoice_summary_score=int(form_data.get("invoice_summary_score", 5)),
        invoice_summary_notes=form_data.get("invoice_summary_notes"),
        
        payment_verified=form_data.get("payment_verified", "pending"),
        no_payment_reason=form_data.get("no_payment_reason"),
        
        estimates_verified=form_data.get("estimates_verified", "pending"),
        estimates_notes=form_data.get("estimates_notes"),
        
        membership_verified=form_data.get("membership_verified", "pending"),
        membership_notes=form_data.get("membership_notes"),
        
        google_reviews_discussed=form_data.get("google_reviews_discussed", "pending"),
        google_reviews_notes=form_data.get("google_reviews_notes"),
        
        replacement_discussed=form_data.get("replacement_discussed", "pending"),
        no_replacement_reason=form_data.get("no_replacement_reason"),

        equipment_added=form_data.get("equipment_added", "pending"),
        equipment_added_notes=form_data.get("equipment_added_notes"),

        materials_on_invoice=form_data.get("materials_on_invoice", "pending"),
        materials_on_invoice_notes=form_data.get("materials_on_invoice_notes"),

        g3_contact_needed=form_data.get("g3_contact_needed") == "true",
        g3_notes=form_data.get("g3_notes"),
        
        general_notes=form_data.get("general_notes"),
        
        # Follow-up fields
        followup_required=followup_required,
        followup_type=form_data.get("followup_type") if followup_required else None,
        followup_description=form_data.get("followup_description") if followup_required else None,
        followup_assigned_to=form_data.get("followup_assigned_to") if followup_required else None,
        followup_completed=False,
    )
    
    # Check for existing and update if needed
    existing = db.query(DebriefSession).filter(DebriefSession.job_id == job_id).first()
    if existing:
        for key, value in session.__dict__.items():
            if not key.startswith("_"):
                setattr(existing, key, value)
        session = existing
    else:
        db.add(session)
    
    ticket.debrief_status = TicketStatus.COMPLETED
    db.commit()
    
    # Send Slack notification if follow-up required
    if followup_required and form_data.get("followup_type"):
        from .slack import send_followup_notification
        
        # Build debrief URL
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        debrief_url = f"{base_url}/debrief/{job_id}"
        
        slack_result = await send_followup_notification(
            job_id=job_id,
            job_number=ticket.job_number,
            customer_name=ticket.customer_name,
            tech_name=ticket.tech_name,
            followup_type=form_data.get("followup_type"),
            followup_description=form_data.get("followup_description", ""),
            dispatcher_name=dispatcher.name,
            assigned_to=form_data.get("followup_assigned_to"),
            debrief_url=debrief_url,
        )
        
        if slack_result.get("success"):
            session.slack_notified = True
            if slack_result.get("thread_ts"):
                session.slack_thread_ts = slack_result["thread_ts"]
            db.commit()
    
    # Redirect back to queue
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/queue", status_code=303)


@app.get("/api/dashboard")
async def get_dashboard(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    def get_stats(start_date: datetime, label: str) -> dict:
        total_jobs = db.query(TicketRaw).filter(
            TicketRaw.completed_at >= start_date
        ).count()

        debriefed = db.query(TicketRaw).filter(
            and_(
                TicketRaw.completed_at >= start_date,
                TicketRaw.debrief_status == TicketStatus.COMPLETED
            )
        ).count()

        pending = total_jobs - debriefed
        rate = (debriefed / total_jobs * 100) if total_jobs > 0 else 100

        return {
            "date": label,
            "total_completed_jobs": total_jobs,
            "total_debriefed": debriefed,
            "pending_debrief": pending,
            "completion_rate": round(rate, 1)
        }

    def get_trade_performance(start_date: datetime) -> dict:
        """Calculate performance metrics by trade (HVAC vs Plumbing)."""
        # Query all debriefed jobs with their sessions for the period
        results = db.query(
            TicketRaw.trade_type,
            DebriefSession.photos_reviewed,
            DebriefSession.payment_verified,
            DebriefSession.estimates_verified,
            DebriefSession.invoice_summary_score,
            DebriefSession.equipment_added,
            DebriefSession.materials_on_invoice,
        ).join(
            DebriefSession, TicketRaw.job_id == DebriefSession.job_id
        ).filter(
            DebriefSession.completed_at >= start_date
        ).all()

        # Initialize trade data
        trade_data = {
            "HVAC": {"count": 0, "photos_pass": 0, "payment_pass": 0, "estimates_pass": 0, "invoice_scores": [], "equipment_pass": 0, "materials_pass": 0},
            "Plumbing": {"count": 0, "photos_pass": 0, "payment_pass": 0, "estimates_pass": 0, "invoice_scores": [], "equipment_pass": 0, "materials_pass": 0},
        }

        for row in results:
            trade = row.trade_type or "Unknown"
            if trade not in trade_data:
                continue  # Skip unknown trades

            trade_data[trade]["count"] += 1
            if row.photos_reviewed == "pass":
                trade_data[trade]["photos_pass"] += 1
            if row.payment_verified == "pass":
                trade_data[trade]["payment_pass"] += 1
            if row.estimates_verified == "pass":
                trade_data[trade]["estimates_pass"] += 1
            if row.invoice_summary_score:
                trade_data[trade]["invoice_scores"].append(row.invoice_summary_score)
            if row.equipment_added == "pass":
                trade_data[trade]["equipment_pass"] += 1
            if row.materials_on_invoice == "pass":
                trade_data[trade]["materials_pass"] += 1

        # Calculate percentages for each trade
        trade_performance = {}
        for trade, data in trade_data.items():
            count = data["count"]
            scores = data["invoice_scores"]

            trade_performance[trade.lower()] = {
                "total_debriefed": count,
                "photos_pass_rate": round(data["photos_pass"] / count * 100) if count else 0,
                "payment_pass_rate": round(data["payment_pass"] / count * 100) if count else 0,
                "estimates_pass_rate": round(data["estimates_pass"] / count * 100) if count else 0,
                "avg_invoice_score": round(sum(scores) / len(scores), 1) if scores else 0,
                "equipment_added_rate": round(data["equipment_pass"] / count * 100) if count else 0,
                "materials_on_invoice_rate": round(data["materials_pass"] / count * 100) if count else 0,
            }

        return trade_performance

    # Dispatcher stats
    dispatchers = db.query(Dispatcher).filter(Dispatcher.is_active == True).all()
    dispatcher_stats = []
    for d in dispatchers:
        today_count = db.query(DebriefSession).filter(
            and_(
                DebriefSession.dispatcher_id == d.id,
                DebriefSession.completed_at >= today_start
            )
        ).count()

        week_count = db.query(DebriefSession).filter(
            and_(
                DebriefSession.dispatcher_id == d.id,
                DebriefSession.completed_at >= week_start
            )
        ).count()

        month_count = db.query(DebriefSession).filter(
            and_(
                DebriefSession.dispatcher_id == d.id,
                DebriefSession.completed_at >= month_start
            )
        ).count()

        dispatcher_stats.append({
            "dispatcher_id": d.id,
            "dispatcher_name": d.name,
            "is_primary": d.is_primary,
            "debriefs_completed_today": today_count,
            "debriefs_completed_this_week": week_count,
            "debriefs_completed_this_month": month_count,
        })

    # Pending jobs count (no longer sending full list)
    pending_count = db.query(TicketRaw).filter(
        TicketRaw.debrief_status != TicketStatus.COMPLETED
    ).count()

    return {
        "today": get_stats(today_start, "Today"),
        "this_week": get_stats(week_start, "This Week"),
        "this_month": get_stats(month_start, "This Month"),
        "dispatchers": dispatcher_stats,
        "pending_count": pending_count,
        "trade_performance": get_trade_performance(month_start),
    }


# ----- Dispatcher Management -----

@app.get("/api/dispatchers", response_model=List[DispatcherResponse])
async def list_dispatchers(db: Session = Depends(get_db)):
    """List all dispatchers."""
    return db.query(Dispatcher).all()


@app.post("/api/dispatchers", response_model=DispatcherResponse)
async def create_dispatcher(
    dispatcher: DispatcherCreate,
    db: Session = Depends(get_db)
):
    """Create a new dispatcher."""
    d = Dispatcher(**dispatcher.dict())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@app.post("/api/dispatchers/setup")
async def setup_dispatchers(db: Session = Depends(get_db)):
    """Quick setup - create default dispatchers."""
    # Check if any exist
    if db.query(Dispatcher).count() > 0:
        return {"message": "Dispatchers already exist"}
    
    # Create primary dispatcher
    primary = Dispatcher(
        name="Primary Dispatcher",
        email="dispatcher@example.com",
        is_primary=True,
        is_active=True
    )
    db.add(primary)
    
    # Create fill-in dispatcher
    fill_in = Dispatcher(
        name="Fill-In Dispatcher",
        email="fillin@example.com",
        is_primary=False,
        is_active=True
    )
    db.add(fill_in)
    
    db.commit()
    return {"message": "Default dispatchers created"}


# ----- Technician Performance -----

@app.get("/api/technician-stats")
async def get_technician_stats(db: Session = Depends(get_db)):
    """Get technician performance statistics."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    def get_tech_stats(start_date: datetime):
        """Get stats for all technicians from a start date."""
        # Get all debriefed tickets with their debrief sessions from the period
        results = db.query(
            TicketRaw.tech_name,
            TicketRaw.tech_id,
            DebriefSession.invoice_summary_score,
            DebriefSession.photos_reviewed,
            DebriefSession.payment_verified,
            DebriefSession.estimates_verified,
            DebriefSession.replacement_discussed,
            DebriefSession.membership_verified,
            DebriefSession.google_reviews_discussed,
            DebriefSession.g3_contact_needed,
            DebriefSession.followup_required,
        ).join(
            DebriefSession, TicketRaw.job_id == DebriefSession.job_id
        ).filter(
            DebriefSession.completed_at >= start_date
        ).all()

        # Aggregate by technician
        tech_data = {}
        for row in results:
            tech_name = row.tech_name or "Unknown"
            if tech_name not in tech_data:
                tech_data[tech_name] = {
                    "tech_id": row.tech_id,
                    "jobs_count": 0,
                    "invoice_scores": [],
                    "photos_pass": 0,
                    "payment_pass": 0,
                    "estimates_pass": 0,
                    "replacement_pass": 0,
                    "membership_pass": 0,
                    "google_reviews_pass": 0,
                    "g3_needed": 0,
                    "followup_required": 0,
                }

            tech_data[tech_name]["jobs_count"] += 1
            if row.invoice_summary_score:
                tech_data[tech_name]["invoice_scores"].append(row.invoice_summary_score)
            if row.photos_reviewed == "pass":
                tech_data[tech_name]["photos_pass"] += 1
            if row.payment_verified == "pass":
                tech_data[tech_name]["payment_pass"] += 1
            if row.estimates_verified == "pass":
                tech_data[tech_name]["estimates_pass"] += 1
            if row.replacement_discussed == "pass":
                tech_data[tech_name]["replacement_pass"] += 1
            if row.membership_verified == "pass":
                tech_data[tech_name]["membership_pass"] += 1
            if row.google_reviews_discussed == "pass":
                tech_data[tech_name]["google_reviews_pass"] += 1
            if row.g3_contact_needed:
                tech_data[tech_name]["g3_needed"] += 1
            if row.followup_required:
                tech_data[tech_name]["followup_required"] += 1

        # Calculate percentages and composite score
        tech_stats = []
        for tech_name, data in tech_data.items():
            count = data["jobs_count"]
            scores = data["invoice_scores"]

            # Calculate individual metrics
            avg_invoice = round(sum(scores) / len(scores), 1) if scores else None
            photos_rate = round(data["photos_pass"] / count * 100) if count else 0
            payment_rate = round(data["payment_pass"] / count * 100) if count else 0
            estimates_rate = round(data["estimates_pass"] / count * 100) if count else 0
            membership_rate = round(data["membership_pass"] / count * 100) if count else 0
            reviews_rate = round(data["google_reviews_pass"] / count * 100) if count else 0

            # Calculate composite score with weights:
            # HIGH (2x): Photos, Payment, Estimates, Invoice Summary
            # NORMAL (1x): Membership, Google Reviews
            # Invoice is 1-10, convert to percentage (x10)
            invoice_pct = (avg_invoice * 10) if avg_invoice else 50  # Default 50% if no score

            # Weighted calculation: total weights = 10
            composite = (
                (photos_rate * 2) +      # HIGH
                (payment_rate * 2) +      # HIGH
                (estimates_rate * 2) +    # HIGH
                (invoice_pct * 2) +       # HIGH (converted to %)
                (membership_rate * 1) +   # NORMAL
                (reviews_rate * 1)        # NORMAL
            ) / 10

            tech_stats.append({
                "tech_name": tech_name,
                "tech_id": data["tech_id"],
                "jobs_debriefed": count,
                "composite_score": round(composite, 1),
                "avg_invoice_score": avg_invoice,
                # Critical metrics (HIGH weight)
                "photos_pass_rate": photos_rate,
                "payment_pass_rate": payment_rate,
                "estimates_pass_rate": estimates_rate,
                # Normal metrics
                "membership_pass_rate": membership_rate,
                "google_reviews_pass_rate": reviews_rate,
            })

        # Sort by composite_score descending
        return sorted(tech_stats, key=lambda x: x["composite_score"], reverse=True)

    return {
        "today": get_tech_stats(today_start),
        "this_week": get_tech_stats(week_start),
        "this_month": get_tech_stats(month_start),
    }


# ----- Debrief History / Job Log -----

@app.get("/history", response_class=HTMLResponse)
async def history_page(request: Request, db: Session = Depends(get_db)):
    """Job history/log view - all debriefed jobs in a table."""
    return templates.TemplateResponse("history.html", {
        "request": request,
        "title": "Job History"
    })


@app.get("/api/debrief-history")
async def get_debrief_history(
    limit: int = 100,
    offset: int = 0,
    tech_name: Optional[str] = None,
    dispatcher_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get history of all debriefed jobs with scores."""
    query = db.query(
        TicketRaw,
        DebriefSession,
        Dispatcher.name.label("dispatcher_name")
    ).join(
        DebriefSession, TicketRaw.job_id == DebriefSession.job_id
    ).outerjoin(
        Dispatcher, DebriefSession.dispatcher_id == Dispatcher.id
    )

    # Apply filters
    if tech_name:
        query = query.filter(TicketRaw.tech_name == tech_name)
    if dispatcher_id:
        query = query.filter(DebriefSession.dispatcher_id == dispatcher_id)
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query = query.filter(DebriefSession.completed_at >= from_date)
        except ValueError:
            pass
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            # Add one day to include the entire end date
            to_date = to_date + timedelta(days=1)
            query = query.filter(DebriefSession.completed_at < to_date)
        except ValueError:
            pass

    # Get total count for pagination
    total = query.count()

    # Get paginated results, most recent first
    results = query.order_by(
        DebriefSession.completed_at.desc()
    ).offset(offset).limit(limit).all()

    # Build response with composite scores
    history = []
    for ticket, debrief, dispatcher_name in results:
        # Calculate composite score for this job
        photos_pass = 1 if debrief.photos_reviewed == "pass" else 0
        payment_pass = 1 if debrief.payment_verified == "pass" else 0
        estimates_pass = 1 if debrief.estimates_verified == "pass" else 0
        membership_pass = 1 if debrief.membership_verified == "pass" else 0
        reviews_pass = 1 if debrief.google_reviews_discussed == "pass" else 0
        invoice_score = debrief.invoice_summary_score or 5

        invoice_pct = invoice_score * 10
        composite = (
            (photos_pass * 100 * 2) +
            (payment_pass * 100 * 2) +
            (estimates_pass * 100 * 2) +
            (invoice_pct * 2) +
            (membership_pass * 100 * 1) +
            (reviews_pass * 100 * 1)
        ) / 10

        # Check if a spot check exists for this debrief
        has_spot_check = db.query(SpotCheck).filter(
            SpotCheck.debrief_session_id == debrief.id
        ).first() is not None

        history.append({
            "job_id": ticket.job_id,
            "job_number": ticket.job_number,
            "customer_name": ticket.customer_name,
            "tech_name": ticket.tech_name or "Unknown",
            "tech_id": ticket.tech_id,
            "job_type": ticket.job_type_name or "Unknown",
            "trade_type": ticket.trade_type or "Unknown",
            "invoice_total": float(ticket.invoice_total or 0),
            "invoice_summary": ticket.invoice_summary,
            "completed_at": ticket.completed_at.isoformat() if ticket.completed_at else None,
            "debriefed_at": debrief.completed_at.isoformat() if debrief.completed_at else None,
            "dispatcher_name": dispatcher_name or "Unknown",
            "composite_score": round(composite, 1),
            "invoice_score": invoice_score,
            "photos": debrief.photos_reviewed,
            "payment": debrief.payment_verified,
            "estimates": debrief.estimates_verified,
            "membership": debrief.membership_verified,
            "reviews": debrief.google_reviews_discussed,
            "followup_required": debrief.followup_required,
            "has_notes": bool(debrief.general_notes),
            "debrief_session_id": debrief.id,
            "has_spot_check": has_spot_check,
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": history
    }


# ----- Manual Job Addition (for testing/catchup) -----

@app.post("/api/job/manual-add/{job_id}")
async def manually_add_job(job_id: int, db: Session = Depends(get_db)):
    """Manually add a job to the queue (for testing or catching missed webhooks)."""
    result = await manual_add_job(job_id, db)
    return result


# ----- Sync / Polling Endpoint -----

@app.post("/api/sync")
async def sync_completed_jobs(
    hours_back: int = 24,
    db: Session = Depends(get_db)
):
    """
    Poll ServiceTitan for recently completed jobs and add new ones to queue.
    Use this instead of webhooks if you don't have webhook access.

    Args:
        hours_back: How many hours back to look for completed jobs (default 24)
    """
    from .servicetitan import get_st_client

    client = get_st_client()

    # Calculate date range
    now = datetime.utcnow()
    start_date = (now - timedelta(hours=hours_back)).strftime("%Y-%m-%d")

    added = []
    skipped = []
    errors = []

    try:
        # Fetch completed jobs from ServiceTitan
        page = 1
        while True:
            response = await client.get_completed_jobs(
                completed_on_or_after=start_date,
                page=page,
                page_size=50
            )

            jobs = response.get("data", [])
            if not jobs:
                break

            for job in jobs:
                job_id = job.get("id")

                # Check if already in database
                existing = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
                if existing:
                    skipped.append(job_id)
                    continue

                # Add to queue
                try:
                    result = await manual_add_job(job_id, db)
                    if result.get("status") == "added":
                        added.append(job_id)
                    else:
                        skipped.append(job_id)
                except Exception as e:
                    errors.append({"job_id": job_id, "error": str(e)})

            # Check if more pages
            if not response.get("hasMore", False):
                break
            page += 1

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "added": added,
            "skipped": skipped,
            "errors": errors
        }

    return {
        "status": "success",
        "message": f"Sync complete. Added {len(added)} jobs, skipped {len(skipped)} existing.",
        "added_count": len(added),
        "skipped_count": len(skipped),
        "added_job_ids": added,
        "errors": errors
    }


@app.post("/api/re-enrich")
async def re_enrich_tickets(
    limit: int = 50,
    status: Optional[str] = None,
    force: bool = False,
    db: Session = Depends(get_db)
):
    """
    Re-fetch photo/form counts for existing tickets (heavy API calls).
    Use /api/update-opportunities for lighter opportunity-only updates.

    Args:
        limit: Max number of tickets to update (default 50)
        status: Only update tickets with this status (pending, in_progress, completed)
        force: Update all tickets even if values unchanged (useful for testing)
    """
    from .servicetitan import get_st_client

    client = get_st_client()

    # Query tickets to update
    query = db.query(TicketRaw)
    if status:
        try:
            status_enum = TicketStatus(status)
            query = query.filter(TicketRaw.debrief_status == status_enum)
        except ValueError:
            pass

    tickets = query.order_by(TicketRaw.pulled_at.desc()).limit(limit).all()

    updated = []
    errors = []

    for ticket in tickets:
        try:
            old_photo_count = ticket.photo_count or 0
            old_form_count = ticket.form_count or 0

            # Fetch current photo count
            attachments_response = await client.get_attachments_by_job(ticket.job_id)
            photo_count = len(attachments_response.get("data", []))

            # Fetch current form count
            forms_response = await client.get_form_submissions_by_job(ticket.job_id)
            form_count = len(forms_response.get("data", []))

            # Update if changed or force mode
            changed = (
                ticket.photo_count != photo_count or
                ticket.form_count != form_count
            )

            if changed or force:
                ticket.photo_count = photo_count
                ticket.form_count = form_count
                db.commit()
                updated.append({
                    "job_id": ticket.job_id,
                    "job_number": ticket.job_number,
                    "old_photo_count": old_photo_count,
                    "new_photo_count": photo_count,
                    "old_form_count": old_form_count,
                    "new_form_count": form_count,
                    "changed": changed
                })

        except Exception as e:
            errors.append({
                "job_id": ticket.job_id,
                "error": str(e)
            })

    return {
        "status": "success",
        "message": f"Re-enriched {len(updated)} tickets.",
        "updated_count": len(updated),
        "updated": updated,
        "errors": errors
    }


@app.post("/api/update-opportunities")
async def update_opportunities(
    limit: int = 200,
    db: Session = Depends(get_db)
):
    """
    Lightweight endpoint to update is_opportunity field for existing tickets.
    Only fetches job data (1 API call per ticket) - much faster than re-enrich.
    """
    from .servicetitan import get_st_client

    client = get_st_client()

    # Get tickets that don't have opportunity data yet
    tickets = db.query(TicketRaw).filter(
        TicketRaw.is_opportunity == None
    ).order_by(TicketRaw.pulled_at.desc()).limit(limit).all()

    # If all have is_opportunity set, get all tickets
    if not tickets:
        tickets = db.query(TicketRaw).order_by(
            TicketRaw.pulled_at.desc()
        ).limit(limit).all()

    updated = []
    errors = []

    for ticket in tickets:
        try:
            old_is_opportunity = ticket.is_opportunity

            # Fetch job to get tag IDs (1 API call)
            job = await client.get_job(ticket.job_id)
            tag_type_ids = job.get("tagTypeIds", [])
            is_opportunity = await client.check_tags_for_opportunity(tag_type_ids)

            # Update
            ticket.is_opportunity = is_opportunity
            ticket.tag_type_ids = tag_type_ids
            db.commit()

            updated.append({
                "job_id": ticket.job_id,
                "job_number": ticket.job_number,
                "old_is_opportunity": old_is_opportunity,
                "new_is_opportunity": is_opportunity,
                "tag_count": len(tag_type_ids)
            })

        except Exception as e:
            errors.append({
                "job_id": ticket.job_id,
                "error": str(e)
            })

    # Count results
    new_opportunities = sum(1 for u in updated if u["new_is_opportunity"])

    return {
        "status": "success",
        "message": f"Updated {len(updated)} tickets. {new_opportunities} are opportunities.",
        "updated_count": len(updated),
        "opportunity_count": new_opportunities,
        "updated": updated[:20],  # Only show first 20 in response
        "errors": errors
    }


# ----- Spot Check System -----

@app.get("/spot-checks", response_class=HTMLResponse)
async def spot_checks_page(request: Request, db: Session = Depends(get_db)):
    """Spot check queue page for managers."""
    # Get pending spot checks
    pending = db.query(SpotCheck).filter(
        SpotCheck.status == SpotCheckStatus.PENDING
    ).order_by(SpotCheck.selected_at.desc()).all()

    # Get in-progress spot checks
    in_progress = db.query(SpotCheck).filter(
        SpotCheck.status == SpotCheckStatus.IN_PROGRESS
    ).order_by(SpotCheck.started_at.desc()).all()

    # Get today's completed spot checks
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = db.query(SpotCheck).filter(
        and_(
            SpotCheck.status == SpotCheckStatus.COMPLETED,
            SpotCheck.completed_at >= today_start
        )
    ).count()

    # Get dispatcher accuracy stats
    from .spot_check import get_all_dispatcher_accuracy_stats
    dispatcher_stats = get_all_dispatcher_accuracy_stats(db)

    # Get dispatchers for reviewer dropdown
    dispatchers = db.query(Dispatcher).filter(
        Dispatcher.is_active == True,
        Dispatcher.role.in_([DispatcherRole.MANAGER, DispatcherRole.ADMIN, DispatcherRole.OWNER])
    ).all()

    return templates.TemplateResponse("spot_checks.html", {
        "request": request,
        "title": "Spot Checks",
        "pending_spot_checks": pending,
        "in_progress_spot_checks": in_progress,
        "pending_count": len(pending),
        "in_progress_count": len(in_progress),
        "completed_today": completed_today,
        "dispatcher_stats": dispatcher_stats,
        "reviewers": dispatchers,
    })


@app.get("/spot-check/{spot_check_id}", response_class=HTMLResponse)
async def spot_check_form_page(spot_check_id: int, request: Request, db: Session = Depends(get_db)):
    """Spot check review form."""
    spot_check = db.query(SpotCheck).filter(SpotCheck.id == spot_check_id).first()
    if not spot_check:
        raise HTTPException(status_code=404, detail="Spot check not found")

    # Get the debrief session and ticket
    debrief = spot_check.debrief_session
    ticket = debrief.ticket
    original_dispatcher = debrief.dispatcher

    # Mark as in progress if pending
    if spot_check.status == SpotCheckStatus.PENDING:
        spot_check.status = SpotCheckStatus.IN_PROGRESS
        spot_check.started_at = datetime.utcnow()
        db.commit()

    # Get reviewers (managers+)
    reviewers = db.query(Dispatcher).filter(
        Dispatcher.is_active == True,
        Dispatcher.role.in_([DispatcherRole.MANAGER, DispatcherRole.ADMIN, DispatcherRole.OWNER])
    ).all()

    return templates.TemplateResponse("spot_check_form.html", {
        "request": request,
        "title": f"Spot Check - Job #{ticket.job_number}",
        "spot_check": spot_check,
        "debrief": debrief,
        "ticket": ticket,
        "original_dispatcher": original_dispatcher,
        "reviewers": reviewers,
    })


@app.post("/api/spot-check/{spot_check_id}/submit")
async def submit_spot_check(
    spot_check_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Submit completed spot check review."""
    form_data = await request.form()

    spot_check = db.query(SpotCheck).filter(SpotCheck.id == spot_check_id).first()
    if not spot_check:
        raise HTTPException(status_code=404, detail="Spot check not found")

    # Parse form data
    reviewer_id = form_data.get("reviewer_id")
    if reviewer_id:
        spot_check.reviewer_id = int(reviewer_id)

    # Item-by-item verification
    spot_check.photos_correct = form_data.get("photos_correct") == "true"
    spot_check.invoice_score_correct = form_data.get("invoice_score_correct") == "true"
    spot_check.payment_correct = form_data.get("payment_correct") == "true"
    spot_check.estimates_correct = form_data.get("estimates_correct") == "true"
    spot_check.membership_correct = form_data.get("membership_correct") == "true"
    spot_check.reviews_correct = form_data.get("reviews_correct") == "true"
    spot_check.replacement_correct = form_data.get("replacement_correct") == "true"
    spot_check.equipment_correct = form_data.get("equipment_correct") == "true"

    # Corrected invoice score if provided
    corrected_score = form_data.get("corrected_invoice_score")
    if corrected_score:
        spot_check.corrected_invoice_score = int(corrected_score)

    # Item notes
    spot_check.photos_notes = form_data.get("photos_notes")
    spot_check.invoice_notes = form_data.get("invoice_notes")
    spot_check.payment_notes = form_data.get("payment_notes")
    spot_check.estimates_notes = form_data.get("estimates_notes")
    spot_check.membership_notes = form_data.get("membership_notes")
    spot_check.reviews_notes = form_data.get("reviews_notes")
    spot_check.replacement_notes = form_data.get("replacement_notes")
    spot_check.equipment_notes = form_data.get("equipment_notes")

    # Overall assessment
    overall_grade = form_data.get("overall_grade")
    if overall_grade:
        spot_check.overall_grade = int(overall_grade)
    spot_check.feedback_notes = form_data.get("feedback_notes")
    spot_check.coaching_needed = form_data.get("coaching_needed") == "true"

    # Mark as completed
    spot_check.status = SpotCheckStatus.COMPLETED
    spot_check.completed_at = datetime.utcnow()

    db.commit()

    # Redirect back to queue
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/spot-checks", status_code=303)


@app.get("/spot-checks/history", response_class=HTMLResponse)
async def spot_check_history_page(request: Request, db: Session = Depends(get_db)):
    """Spot check history page."""
    # Get dispatchers for filters
    dispatchers = db.query(Dispatcher).filter(Dispatcher.is_active == True).all()

    return templates.TemplateResponse("spot_check_history.html", {
        "request": request,
        "title": "Spot Check History",
        "dispatchers": dispatchers,
    })


@app.get("/api/spot-checks/history")
async def get_spot_check_history(
    limit: int = 100,
    offset: int = 0,
    dispatcher_id: Optional[int] = None,
    reviewer_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get spot check history with filters."""
    query = db.query(SpotCheck).filter(
        SpotCheck.status == SpotCheckStatus.COMPLETED
    )

    # Apply filters
    if dispatcher_id:
        query = query.join(DebriefSession).filter(
            DebriefSession.dispatcher_id == dispatcher_id
        )
    if reviewer_id:
        query = query.filter(SpotCheck.reviewer_id == reviewer_id)
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query = query.filter(SpotCheck.completed_at >= from_date)
        except ValueError:
            pass
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            to_date = to_date + timedelta(days=1)
            query = query.filter(SpotCheck.completed_at < to_date)
        except ValueError:
            pass

    total = query.count()
    results = query.order_by(SpotCheck.completed_at.desc()).offset(offset).limit(limit).all()

    history = []
    for sc in results:
        debrief = sc.debrief_session
        ticket = debrief.ticket
        dispatcher = debrief.dispatcher
        reviewer = sc.reviewer

        # Count incorrect items
        incorrect_count = sum([
            1 for correct in [
                sc.photos_correct, sc.invoice_score_correct, sc.payment_correct,
                sc.estimates_correct, sc.membership_correct, sc.reviews_correct,
                sc.replacement_correct, sc.equipment_correct
            ] if correct is False
        ])

        history.append({
            "id": sc.id,
            "job_id": ticket.job_id,
            "job_number": ticket.job_number,
            "customer_name": ticket.customer_name,
            "dispatcher_name": dispatcher.name if dispatcher else "Unknown",
            "dispatcher_id": dispatcher.id if dispatcher else None,
            "reviewer_name": reviewer.name if reviewer else "Unknown",
            "reviewer_id": reviewer.id if reviewer else None,
            "overall_grade": sc.overall_grade,
            "incorrect_count": incorrect_count,
            "coaching_needed": sc.coaching_needed,
            "selection_reason": sc.selection_reason,
            "completed_at": sc.completed_at.isoformat() if sc.completed_at else None,
        })

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": history
    }


@app.get("/api/spot-checks/dispatcher-stats")
async def get_spot_check_dispatcher_stats(db: Session = Depends(get_db)):
    """Get dispatcher accuracy stats for dashboard."""
    from .spot_check import get_all_dispatcher_accuracy_stats
    return get_all_dispatcher_accuracy_stats(db)


@app.post("/api/spot-checks/select-daily")
async def trigger_daily_spot_check_selection(
    target_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Manually trigger daily spot check selection."""
    from .spot_check import select_daily_spot_checks
    from datetime import date as date_type

    if target_date:
        try:
            parsed_date = date_type.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        parsed_date = None

    result = await select_daily_spot_checks(db, target_date=parsed_date)
    return result


@app.post("/api/spot-checks/manual/{debrief_session_id}")
async def create_manual_spot_check_endpoint(
    debrief_session_id: int,
    db: Session = Depends(get_db)
):
    """Manually add a specific debrief to spot check queue."""
    from .spot_check import create_manual_spot_check
    result = await create_manual_spot_check(db, debrief_session_id)
    return result


# ----- Health Check -----

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
