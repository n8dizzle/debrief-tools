"""
Debrief QA System - FastAPI Application

Main entry point for the application. Handles:
- Google OAuth authentication
- Webhook endpoint for ServiceTitan
- API endpoints for the dispatcher UI
- HTML template rendering
"""

import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Request, HTTPException, Depends, Form
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from dotenv import load_dotenv

from .database import (
    get_db, init_db, seed_business_units_from_tickets,
    TicketRaw, TicketStatus, CheckStatus,
    Dispatcher, DispatcherRole, DebriefSession, WebhookLog,
    SpotCheck, SpotCheckStatus,
    BusinessUnit, DispatcherBusinessUnit
)
from .models import (
    TicketSummary, TicketDetail, DebriefSubmission, DebriefResponse,
    DashboardResponse, DailyStats, DispatcherStats,
    DispatcherCreate, DispatcherResponse
)
from .webhook import verify_webhook_signature, process_webhook, manual_add_job
from .auth import (
    oauth, get_current_user_optional, require_auth, require_roles,
    is_admin, handle_google_callback, create_session, clear_session
)

load_dotenv()

app = FastAPI(
    title="Debrief QA System",
    description="Real-time job ticket quality assurance for dispatcher debrief workflow",
    version="1.0.0"
)

# Session middleware for authentication
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

# Mount static files and templates
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Timezone conversion filter for templates (UTC to Central Time)
from zoneinfo import ZoneInfo

def to_central(dt):
    """Convert UTC datetime to Central Time."""
    if dt is None:
        return None
    # Assume dt is naive UTC, make it aware then convert
    utc = ZoneInfo("UTC")
    central = ZoneInfo("America/Chicago")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=utc)
    return dt.astimezone(central)

templates.env.filters["central"] = to_central


# ----- Startup -----

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()
    # Seed business units from existing ticket data (one-time migration)
    seed_business_units_from_tickets()


# ----- Authentication Routes -----

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = None):
    """Login page with Google sign-in button."""
    # If already logged in, redirect to queue
    if request.session.get("user_id"):
        return RedirectResponse(url="/queue", status_code=302)

    error_messages = {
        "domain_error": "Only @christmasair.com emails are allowed.",
        "no_account": "Your account hasn't been set up yet. Please contact an administrator.",
        "inactive": "Your account has been deactivated. Please contact an administrator.",
        "token_error": "Authentication failed. Please try again.",
        "userinfo_error": "Could not get your information from Google. Please try again.",
    }
    error_text = error_messages.get(error, error)

    return templates.TemplateResponse("login.html", {
        "request": request,
        "error": error_text
    })


@app.get("/auth/google")
async def google_login(request: Request):
    """Initiate Google OAuth flow."""
    redirect_uri = os.getenv("BASE_URL", "http://localhost:8000") + "/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@app.get("/auth/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback."""
    result = await handle_google_callback(request, db)

    if not result["success"]:
        return RedirectResponse(url=f"/login?error={result['error_code']}", status_code=302)

    user = result["user"]
    create_session(request, user)

    # Redirect to the original URL or queue
    next_url = request.session.pop("next", "/queue")
    return RedirectResponse(url=next_url, status_code=302)


@app.get("/logout")
async def logout(request: Request):
    """Clear session and redirect to login."""
    clear_session(request)
    return RedirectResponse(url="/login", status_code=302)


# ----- Admin Routes -----

@app.get("/admin/users", response_class=HTMLResponse)
async def admin_users_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER)),
    error: str = None,
    success: str = None
):
    """User management page for admins."""
    users = db.query(Dispatcher).order_by(
        Dispatcher.role.desc(),  # Owners first, then admins, etc.
        Dispatcher.name
    ).all()

    return templates.TemplateResponse("admin_users.html", {
        "request": request,
        "current_user": current_user,
        "title": "Admin - Users",
        "active_page": "admin",
        "users": users,
        "error": error,
        "success": success
    })


@app.post("/admin/users")
async def add_user(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER)),
    email: str = Form(...),
    name: str = Form(...),
    role: str = Form(...)
):
    """Add a new user."""
    email = email.lower().strip()

    # Validate domain
    if not email.endswith("@christmasair.com"):
        return RedirectResponse(url="/admin/users?error=Email must be @christmasair.com", status_code=302)

    # Check if email already exists
    existing = db.query(Dispatcher).filter(Dispatcher.email == email).first()
    if existing:
        return RedirectResponse(url="/admin/users?error=User with this email already exists", status_code=302)

    # Only owner can create other owners
    if role == "owner" and current_user.role != DispatcherRole.OWNER:
        return RedirectResponse(url="/admin/users?error=Only owners can create other owners", status_code=302)

    # Create user
    new_user = Dispatcher(
        name=name.strip(),
        email=email,
        role=DispatcherRole(role),
        is_active=True,
        invited_by_id=current_user.id,
        invited_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()

    return RedirectResponse(url=f"/admin/users?success=Added {name}", status_code=302)


@app.post("/admin/users/{user_id}/toggle")
async def toggle_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))
):
    """Activate or deactivate a user."""
    user = db.query(Dispatcher).filter(Dispatcher.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Can't modify yourself or owners
    if user.id == current_user.id:
        return RedirectResponse(url="/admin/users?error=Cannot modify your own account", status_code=302)
    if user.role == DispatcherRole.OWNER:
        return RedirectResponse(url="/admin/users?error=Cannot modify owner accounts", status_code=302)

    user.is_active = not user.is_active
    db.commit()

    status = "activated" if user.is_active else "deactivated"
    return RedirectResponse(url=f"/admin/users?success={user.name} {status}", status_code=302)


@app.post("/admin/users/{user_id}/role")
async def change_user_role(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER)),
    role: str = Form(...)
):
    """Change a user's role."""
    user = db.query(Dispatcher).filter(Dispatcher.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Can't modify yourself or owners
    if user.id == current_user.id:
        return RedirectResponse(url="/admin/users?error=Cannot modify your own role", status_code=302)
    if user.role == DispatcherRole.OWNER:
        return RedirectResponse(url="/admin/users?error=Cannot modify owner accounts", status_code=302)

    # Only owner can promote to admin
    if role == "admin" and current_user.role != DispatcherRole.OWNER:
        return RedirectResponse(url="/admin/users?error=Only owners can create admins", status_code=302)

    user.role = DispatcherRole(role)
    db.commit()

    return RedirectResponse(url=f"/admin/users?success={user.name} is now {role}", status_code=302)


# ----- Admin Settings (Business Units) -----

@app.get("/admin/settings", response_class=HTMLResponse)
async def admin_settings_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER)),
    error: str = None,
    success: str = None
):
    """Business unit settings page for admins."""
    business_units = db.query(BusinessUnit).order_by(BusinessUnit.name).all()
    users = db.query(Dispatcher).filter(Dispatcher.is_active == True).order_by(
        Dispatcher.role.desc(),
        Dispatcher.name
    ).all()

    return templates.TemplateResponse("admin_settings.html", {
        "request": request,
        "current_user": current_user,
        "title": "Admin - Settings",
        "active_page": "admin",
        "business_units": business_units,
        "users": users,
        "error": error,
        "success": success
    })


@app.get("/api/admin/business-units")
async def list_business_units(
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))
):
    """List all business units."""
    bus = db.query(BusinessUnit).order_by(BusinessUnit.name).all()
    return [
        {
            "id": bu.id,
            "name": bu.name,
            "is_enabled": bu.is_enabled,
            "discovered_at": bu.discovered_at.isoformat() if bu.discovered_at else None,
            "last_seen_at": bu.last_seen_at.isoformat() if bu.last_seen_at else None,
        }
        for bu in bus
    ]


@app.post("/api/admin/business-units/{bu_id}/toggle")
async def toggle_business_unit(
    bu_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))
):
    """Toggle a business unit's enabled status."""
    bu = db.query(BusinessUnit).filter(BusinessUnit.id == bu_id).first()
    if not bu:
        raise HTTPException(status_code=404, detail="Business unit not found")

    bu.is_enabled = not bu.is_enabled
    db.commit()

    status = "enabled" if bu.is_enabled else "disabled"
    return RedirectResponse(url=f"/admin/settings?success={bu.name} {status}", status_code=303)


@app.post("/api/admin/business-units/refresh")
async def refresh_business_units(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))
):
    """Refresh business units from ServiceTitan API."""
    from .servicetitan import get_st_client

    client = get_st_client()

    try:
        response = await client.get_all_business_units()
        st_bus = response.get("data", [])

        added = 0
        updated = 0

        for st_bu in st_bus:
            bu_id = st_bu.get("id")
            bu_name = st_bu.get("name", f"Business Unit {bu_id}")

            existing = db.query(BusinessUnit).filter(BusinessUnit.id == bu_id).first()
            if existing:
                existing.name = bu_name
                existing.last_seen_at = datetime.utcnow()
                updated += 1
            else:
                new_bu = BusinessUnit(
                    id=bu_id,
                    name=bu_name,
                    is_enabled=True,  # New BUs enabled by default
                    discovered_at=datetime.utcnow(),
                    last_seen_at=datetime.utcnow()
                )
                db.add(new_bu)
                added += 1

        db.commit()

        return RedirectResponse(
            url=f"/admin/settings?success=Refreshed: {added} added, {updated} updated",
            status_code=303
        )

    except Exception as e:
        return RedirectResponse(
            url=f"/admin/settings?error=Failed to refresh: {str(e)[:100]}",
            status_code=303
        )


@app.get("/api/admin/dispatchers/{user_id}/business-units")
async def get_dispatcher_business_units(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))
):
    """Get a user's assigned business units."""
    user = db.query(Dispatcher).filter(Dispatcher.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    assignments = db.query(DispatcherBusinessUnit).filter(
        DispatcherBusinessUnit.dispatcher_id == user_id
    ).all()

    return {
        "user_id": user_id,
        "user_name": user.name,
        "business_unit_ids": [a.business_unit_id for a in assignments]
    }


@app.post("/api/admin/dispatchers/{user_id}/business-units")
async def update_dispatcher_business_units(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))
):
    """Update a user's assigned business units."""
    user = db.query(Dispatcher).filter(Dispatcher.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get form data - checkboxes come as multiple values with same name
    form_data = await request.form()
    bu_ids = form_data.getlist("business_unit_ids")
    bu_ids = [int(id) for id in bu_ids if id]

    # Delete existing assignments
    db.query(DispatcherBusinessUnit).filter(
        DispatcherBusinessUnit.dispatcher_id == user_id
    ).delete()

    # Add new assignments
    for bu_id in bu_ids:
        assignment = DispatcherBusinessUnit(
            dispatcher_id=user_id,
            business_unit_id=bu_id
        )
        db.add(assignment)

    db.commit()

    count = len(bu_ids)
    if count == 0:
        msg = f"{user.name} now sees all business units"
    else:
        msg = f"{user.name} assigned to {count} business unit{'s' if count != 1 else ''}"

    return RedirectResponse(url=f"/admin/settings?success={msg}", status_code=303)


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
async def home(request: Request):
    """Home page - redirect to queue or login."""
    if not request.session.get("user_id"):
        return RedirectResponse(url="/login", status_code=302)
    return RedirectResponse(url="/queue", status_code=302)


@app.get("/queue", response_class=HTMLResponse)
async def queue_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Dispatcher queue view."""
    # Get user's assigned business unit IDs (empty = sees all)
    user_bu_ids = [a.business_unit_id for a in current_user.business_unit_assignments]

    # Build base queries
    pending_query = db.query(TicketRaw).filter(
        TicketRaw.debrief_status == TicketStatus.PENDING
    )
    in_progress_query = db.query(TicketRaw).filter(
        TicketRaw.debrief_status == TicketStatus.IN_PROGRESS
    )

    # Apply BU filter if user has specific assignments
    if user_bu_ids:
        pending_query = pending_query.filter(TicketRaw.business_unit_id.in_(user_bu_ids))
        in_progress_query = in_progress_query.filter(TicketRaw.business_unit_id.in_(user_bu_ids))

    pending = pending_query.order_by(TicketRaw.completed_at.desc()).all()
    in_progress = in_progress_query.order_by(TicketRaw.completed_at.desc()).all()

    # Calculate "today" in Central Time, then convert to UTC for database comparison
    # This ensures "Jobs Today" matches what users see in the queue (Central Time dates)
    central = ZoneInfo("America/Chicago")
    now_central = datetime.now(central)
    today_start_central = now_central.replace(hour=0, minute=0, second=0, microsecond=0)
    # Convert to naive UTC for database comparison (DB stores naive UTC datetimes)
    today_start = today_start_central.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

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
        "current_user": current_user,
        "title": "Debrief Queue",
        "active_page": "queue",
        "pending_tickets": pending,
        "in_progress_tickets": in_progress,
        "pending_count": len(pending),
        "jobs_completed_today": jobs_completed_today,
        "debriefs_completed_today": debriefs_completed_today,
    })


@app.get("/debrief/{job_id}", response_class=HTMLResponse)
async def debrief_page(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Single job debrief form."""
    from .servicetitan import get_st_client

    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")

    # Don't auto-change status on view - only change when user submits the form

    # Get existing debrief if any
    existing_debrief = db.query(DebriefSession).filter(
        DebriefSession.job_id == job_id
    ).first()

    # Check if spot check exists for this debrief
    existing_spot_check = None
    if existing_debrief:
        existing_spot_check = db.query(SpotCheck).filter(
            SpotCheck.debrief_session_id == existing_debrief.id
        ).first()

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
        "current_user": current_user,
        "title": f"Debrief - Job #{ticket.job_number}",
        "active_page": "queue",
        "ticket": ticket,
        "debrief": existing_debrief,
        "spot_check": existing_spot_check,
        "form_submissions": form_submissions,
    })


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Completion tracking dashboard."""
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "current_user": current_user,
        "active_page": "dashboard",
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
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Submit completed debrief checklist."""
    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")

    # Use the logged-in user as the dispatcher
    dispatcher_id = current_user.id

    # Create or update debrief session
    existing = db.query(DebriefSession).filter(DebriefSession.job_id == job_id).first()

    if existing:
        # Update existing
        for key, value in debrief.dict(exclude={"dispatcher_id"}).items():
            setattr(existing, key, value)
        existing.dispatcher_id = dispatcher_id
        existing.completed_at = datetime.utcnow()
        session = existing
    else:
        # Create new
        session = DebriefSession(
            job_id=job_id,
            dispatcher_id=dispatcher_id,
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
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Submit debrief via HTML form (non-JSON)."""
    form_data = await request.form()

    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")

    # Use the logged-in user as the dispatcher
    dispatcher_id = current_user.id
    
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

        happy_call=form_data.get("happy_call", "pending"),
        happy_call_notes=form_data.get("happy_call_notes"),

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

        # Create ServiceTitan task for follow-up
        from .servicetitan import get_st_client

        # Map follow-up types to ST task type IDs
        FOLLOWUP_TO_TASK_TYPE = {
            "tech_coaching": 161707050,      # Tech Follow Up
            "customer_callback": 160520468,  # Call Customer
            "manager_review": 169624604,     # Management Question
            "billing": 173285912,            # Correct ticket
            "quality": 317,                  # Customer Complaints
            "other": 27930468,               # Customer Follow-Up (general)
        }

        followup_type = form_data.get("followup_type", "other")
        task_type_id = FOLLOWUP_TO_TASK_TYPE.get(followup_type, 27930468)

        # Build task title and description
        task_title = f"Debrief Follow-up: Job #{ticket.job_number}"
        task_description = f"""Follow-up from Debrief QA

Customer: {ticket.customer_name}
Technician: {ticket.tech_name}
Flagged by: {dispatcher.name}

Type: {followup_type.replace('_', ' ').title()}
Details: {form_data.get('followup_description', 'No details provided')}

View debrief: {base_url}/debrief/{job_id}"""

        try:
            st_client = get_st_client()
            task_result = await st_client.create_task(
                job_id=job_id,
                task_type_id=task_type_id,
                title=task_title,
                description=task_description,
            )

            if task_result.get("success"):
                session.st_task_id = task_result.get("task_id")
                session.st_task_created_at = datetime.utcnow()
                db.commit()
        except Exception as e:
            # Log error but don't fail the submission
            print(f"Failed to create ST task: {e}")

    # Redirect back to queue
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/queue", status_code=303)


@app.get("/api/dashboard")
async def get_dashboard(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    # Calculate date boundaries in Central Time, then convert to UTC for database comparison
    central = ZoneInfo("America/Chicago")
    now_central = datetime.now(central)
    today_start_central = now_central.replace(hour=0, minute=0, second=0, microsecond=0)

    # Week starts on Monday in Central Time
    week_start_central = today_start_central - timedelta(days=today_start_central.weekday())
    month_start_central = today_start_central.replace(day=1)

    # Convert to naive UTC for database comparison
    utc = ZoneInfo("UTC")
    today_start = today_start_central.astimezone(utc).replace(tzinfo=None)
    week_start = week_start_central.astimezone(utc).replace(tzinfo=None)
    month_start = month_start_central.astimezone(utc).replace(tzinfo=None)

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

    # Dispatcher stats - only include dispatchers who have completed at least one debrief
    # First, get dispatcher IDs who have any debrief sessions
    dispatchers_with_data = db.query(DebriefSession.dispatcher_id).distinct().all()
    dispatcher_ids_with_data = [d[0] for d in dispatchers_with_data]

    # Only query active dispatchers who have done at least one debrief
    dispatchers = db.query(Dispatcher).filter(
        and_(
            Dispatcher.is_active == True,
            Dispatcher.id.in_(dispatcher_ids_with_data)
        )
    ).all()

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

        # Get all-time count for sorting
        total_count = db.query(DebriefSession).filter(
            DebriefSession.dispatcher_id == d.id
        ).count()

        # Get happy call counts (where happy_call = 'pass')
        happy_call_today = db.query(DebriefSession).filter(
            and_(
                DebriefSession.dispatcher_id == d.id,
                DebriefSession.completed_at >= today_start,
                DebriefSession.happy_call == CheckStatus.PASS
            )
        ).count()

        happy_call_week = db.query(DebriefSession).filter(
            and_(
                DebriefSession.dispatcher_id == d.id,
                DebriefSession.completed_at >= week_start,
                DebriefSession.happy_call == CheckStatus.PASS
            )
        ).count()

        happy_call_month = db.query(DebriefSession).filter(
            and_(
                DebriefSession.dispatcher_id == d.id,
                DebriefSession.completed_at >= month_start,
                DebriefSession.happy_call == CheckStatus.PASS
            )
        ).count()

        dispatcher_stats.append({
            "dispatcher_id": d.id,
            "dispatcher_name": d.name,
            "is_primary": d.is_primary,
            "debriefs_completed_today": today_count,
            "debriefs_completed_this_week": week_count,
            "debriefs_completed_this_month": month_count,
            "debriefs_completed_total": total_count,
            "happy_calls_today": happy_call_today,
            "happy_calls_this_week": happy_call_week,
            "happy_calls_this_month": happy_call_month,
        })

    # Sort by total debriefs completed (most active first)
    dispatcher_stats.sort(key=lambda x: x["debriefs_completed_total"], reverse=True)

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
    # Calculate date boundaries in Central Time, then convert to UTC for database comparison
    central = ZoneInfo("America/Chicago")
    now_central = datetime.now(central)
    today_start_central = now_central.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start_central = today_start_central - timedelta(days=today_start_central.weekday())
    month_start_central = today_start_central.replace(day=1)

    utc = ZoneInfo("UTC")
    today_start = today_start_central.astimezone(utc).replace(tzinfo=None)
    week_start = week_start_central.astimezone(utc).replace(tzinfo=None)
    month_start = month_start_central.astimezone(utc).replace(tzinfo=None)

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
async def history_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Job history/log view - all debriefed jobs in a table."""
    return templates.TemplateResponse("history.html", {
        "request": request,
        "current_user": current_user,
        "active_page": "history",
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
            # Status fields
            "photos": debrief.photos_reviewed,
            "payment": debrief.payment_verified,
            "estimates": debrief.estimates_verified,
            "membership": debrief.membership_verified,
            "reviews": debrief.google_reviews_discussed,
            "replacement": debrief.replacement_discussed,
            "equipment_added": debrief.equipment_added,
            "materials_on_invoice": debrief.materials_on_invoice,
            # All notes fields
            "photos_notes": debrief.photos_notes,
            "invoice_summary_notes": debrief.invoice_summary_notes,
            "no_payment_reason": debrief.no_payment_reason,
            "estimates_notes": debrief.estimates_notes,
            "membership_notes": debrief.membership_notes,
            "google_reviews_notes": debrief.google_reviews_notes,
            "no_replacement_reason": debrief.no_replacement_reason,
            "equipment_added_notes": debrief.equipment_added_notes,
            "materials_on_invoice_notes": debrief.materials_on_invoice_notes,
            "general_notes": debrief.general_notes,
            # G3 contact
            "g3_contact_needed": debrief.g3_contact_needed,
            "g3_notes": debrief.g3_notes,
            # Follow-up details
            "followup_required": debrief.followup_required,
            "followup_type": debrief.followup_type,
            "followup_description": debrief.followup_description,
            "followup_assigned_to": debrief.followup_assigned_to,
            "followup_completed": debrief.followup_completed,
            # Meta
            "has_notes": bool(debrief.general_notes or debrief.photos_notes or debrief.invoice_summary_notes or
                             debrief.no_payment_reason or debrief.estimates_notes or debrief.membership_notes or
                             debrief.google_reviews_notes or debrief.no_replacement_reason or debrief.g3_notes or
                             debrief.equipment_added_notes or debrief.materials_on_invoice_notes),
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


@app.post("/api/job/{job_id}/reset-status")
async def reset_job_status(job_id: int, db: Session = Depends(get_db)):
    """Reset a job's debrief status back to pending."""
    ticket = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Job not found")

    # Only allow reset if not completed (has no debrief session)
    existing_debrief = db.query(DebriefSession).filter(
        DebriefSession.job_id == job_id
    ).first()

    if existing_debrief:
        return {
            "success": False,
            "message": "Cannot reset - job has a completed debrief"
        }

    old_status = ticket.debrief_status
    ticket.debrief_status = TicketStatus.PENDING
    db.commit()

    return {
        "success": True,
        "job_id": job_id,
        "old_status": old_status.value if old_status else None,
        "new_status": "pending"
    }


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

    # Get enabled business unit IDs for filtering
    enabled_bus = db.query(BusinessUnit).filter(BusinessUnit.is_enabled == True).all()
    enabled_bu_ids = {bu.id for bu in enabled_bus}

    added = []
    skipped = []
    skipped_disabled_bu = []
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
                job_bu_id = job.get("businessUnitId")

                # Skip jobs from disabled business units (if we have BU config)
                if enabled_bu_ids and job_bu_id and job_bu_id not in enabled_bu_ids:
                    skipped_disabled_bu.append(job_id)
                    continue

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
            "skipped_disabled_bu": skipped_disabled_bu,
            "errors": errors
        }

    return {
        "status": "success",
        "message": f"Sync complete. Added {len(added)} jobs, skipped {len(skipped)} existing, {len(skipped_disabled_bu)} from disabled BUs.",
        "added_count": len(added),
        "skipped_count": len(skipped),
        "skipped_disabled_bu_count": len(skipped_disabled_bu),
        "added_job_ids": added,
        "errors": errors
    }


@app.get("/api/test-task-management")
async def test_task_management_access():
    """
    Test if API credentials have access to ServiceTitan Task Management.
    Returns available task sources, types, and resolutions if accessible.
    """
    from .servicetitan import get_st_client

    client = get_st_client()
    result = await client.test_task_management_access()

    return result


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


@app.post("/api/re-enrich-payments")
async def re_enrich_payments(
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Re-fetch payment data for existing tickets from ServiceTitan.
    Updates payment_collected and payment_method fields.

    Args:
        limit: Max number of tickets to update (default 100)
        status: Only update tickets with this status (pending, in_progress, completed)
    """
    from .servicetitan import get_st_client

    client = get_st_client()

    # Query tickets to update - prioritize those without payment_method
    query = db.query(TicketRaw)
    if status:
        try:
            status_enum = TicketStatus(status)
            query = query.filter(TicketRaw.debrief_status == status_enum)
        except ValueError:
            pass

    # Order by: tickets without payment_method first, then by pulled_at
    tickets = query.order_by(
        TicketRaw.payment_method.is_(None).desc(),
        TicketRaw.pulled_at.desc()
    ).limit(limit).all()

    updated = []
    errors = []

    for ticket in tickets:
        try:
            old_payment_collected = ticket.payment_collected
            old_payment_method = ticket.payment_method

            # Skip if no invoice
            if not ticket.invoice_id:
                continue

            # Fetch payments for this invoice (use customer_id for efficient filtering)
            payments_response = await client.get_payments_by_invoice(ticket.invoice_id, ticket.customer_id)
            payments = payments_response.get("data", [])

            # Get payment types to resolve names
            payment_types = await client.get_payment_types()

            # Process payments
            payment_methods = []
            total_payments = 0.0

            for payment in payments:
                amount = float(payment.get("total", 0))
                if amount > 0:
                    total_payments += amount
                    type_id = payment.get("typeId")
                    type_name = payment_types.get(type_id, payment.get("type", "Unknown"))
                    if type_name and type_name not in payment_methods:
                        payment_methods.append(type_name)

            # Determine if payment collected
            # Payment is collected if: balance is 0, OR we have payments >= 90% of total
            invoice_total = float(ticket.invoice_total or 0)
            invoice_balance = float(ticket.invoice_balance or 0)

            payment_collected = False
            if invoice_balance == 0:
                payment_collected = True
            elif total_payments > 0 and invoice_total > 0 and total_payments >= (invoice_total * 0.9):
                payment_collected = True

            payment_method = ", ".join(payment_methods) if payment_methods else None

            # Update ticket
            ticket.payment_collected = payment_collected
            ticket.payment_method = payment_method
            db.commit()

            updated.append({
                "job_id": ticket.job_id,
                "job_number": ticket.job_number,
                "invoice_id": ticket.invoice_id,
                "old_payment_collected": old_payment_collected,
                "new_payment_collected": payment_collected,
                "old_payment_method": old_payment_method,
                "new_payment_method": payment_method,
                "payments_found": len(payments),
                "total_payments": total_payments,
            })

        except Exception as e:
            errors.append({
                "job_id": ticket.job_id,
                "error": str(e)
            })

    # Count changes
    changed_count = sum(
        1 for u in updated
        if u["old_payment_collected"] != u["new_payment_collected"] or u["old_payment_method"] != u["new_payment_method"]
    )

    return {
        "status": "success",
        "message": f"Re-enriched {len(updated)} tickets. {changed_count} had payment data changes.",
        "updated_count": len(updated),
        "changed_count": changed_count,
        "updated": updated[:30],  # Show first 30 in response
        "errors": errors
    }


# ----- Spot Check System -----

@app.get("/spot-checks", response_class=HTMLResponse)
async def spot_checks_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Spot check queue page for managers."""
    # Get pending spot checks
    pending = db.query(SpotCheck).filter(
        SpotCheck.status == SpotCheckStatus.PENDING
    ).order_by(SpotCheck.selected_at.desc()).all()

    # Get in-progress spot checks
    in_progress = db.query(SpotCheck).filter(
        SpotCheck.status == SpotCheckStatus.IN_PROGRESS
    ).order_by(SpotCheck.started_at.desc()).all()

    # Get today's completed spot checks (using Central Time for "today")
    central = ZoneInfo("America/Chicago")
    now_central = datetime.now(central)
    today_start_central = now_central.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start = today_start_central.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
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
        "current_user": current_user,
        "title": "Spot Checks",
        "active_page": "spot_checks",
        "pending_spot_checks": pending,
        "in_progress_spot_checks": in_progress,
        "pending_count": len(pending),
        "in_progress_count": len(in_progress),
        "completed_today": completed_today,
        "dispatcher_stats": dispatcher_stats,
        "reviewers": dispatchers,
    })


@app.get("/spot-check/{spot_check_id}", response_class=HTMLResponse)
async def spot_check_form_page(
    spot_check_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
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
        "current_user": current_user,
        "title": f"Spot Check - Job #{ticket.job_number}",
        "active_page": "spot_checks",
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
async def spot_check_history_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dispatcher = Depends(require_auth)
):
    """Spot check history page."""
    # Get dispatchers for filters
    dispatchers = db.query(Dispatcher).filter(Dispatcher.is_active == True).all()

    return templates.TemplateResponse("spot_check_history.html", {
        "request": request,
        "current_user": current_user,
        "title": "Spot Check History",
        "active_page": "spot_checks",
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
