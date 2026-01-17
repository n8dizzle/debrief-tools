"""
Pydantic models for API request/response schemas.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class CheckStatus(str, Enum):
    PENDING = "pending"
    PASS = "pass"
    FAIL = "fail"
    NA = "na"


class TicketStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


# ----- Ticket Schemas -----

class TicketSummary(BaseModel):
    """Compact ticket info for queue view."""
    job_id: int
    job_number: Optional[str] = None
    customer_name: Optional[str] = None
    location_address: Optional[str] = None
    job_type_name: Optional[str] = None
    job_category: Optional[str] = None
    trade_type: Optional[str] = None
    job_status: Optional[str] = None
    tech_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    debrief_status: TicketStatus

    # Quick stats for queue
    photo_count: int = 0
    form_count: int = 0
    payment_collected: bool = False
    invoice_total: float = 0.0
    estimate_count: int = 0
    invoice_summary: Optional[str] = None

    class Config:
        from_attributes = True


class TicketDetail(BaseModel):
    """Full ticket details for debrief view."""
    job_id: int
    job_number: Optional[str] = None
    pulled_at: Optional[datetime] = None

    # Job info
    business_unit_name: Optional[str] = None
    job_type_name: Optional[str] = None
    job_category: Optional[str] = None
    trade_type: Optional[str] = None
    job_status: Optional[str] = None

    # Tech
    tech_id: Optional[int] = None
    tech_name: Optional[str] = None

    # Customer
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    is_new_customer: bool = False
    location_id: Optional[int] = None
    location_address: Optional[str] = None

    # Invoice
    invoice_id: Optional[int] = None
    invoice_number: Optional[str] = None
    invoice_summary: Optional[str] = None
    invoice_total: float = 0.0
    invoice_balance: float = 0.0
    payment_collected: bool = False

    # Estimates
    estimate_count: int = 0
    estimates_total: float = 0.0

    # Membership
    membership_sold: bool = False
    membership_type: Optional[str] = None

    # Photos
    photo_count: int = 0

    # Equipment
    equipment_age_years: Optional[int] = None
    equipment_brand: Optional[str] = None
    equipment_model: Optional[str] = None

    # Installed Equipment at Location
    installed_equipment: Optional[list] = None
    installed_equipment_count: Optional[int] = None

    # Invoice Line Items
    invoice_items: Optional[list] = None
    invoice_materials_count: Optional[int] = None
    invoice_equipment_count: Optional[int] = None
    invoice_services_count: Optional[int] = None

    # Timestamps
    completed_at: Optional[datetime] = None

    # Status
    debrief_status: TicketStatus

    class Config:
        from_attributes = True


# ----- Debrief Schemas -----

class DebriefSubmission(BaseModel):
    """Dispatcher submits completed debrief."""
    dispatcher_id: Optional[int] = None  # Now derived from logged-in user

    # All checklist items
    photos_reviewed: CheckStatus
    photos_notes: Optional[str] = None
    
    invoice_summary_score: int = Field(..., ge=1, le=10)
    invoice_summary_notes: Optional[str] = None
    
    payment_verified: CheckStatus
    no_payment_reason: Optional[str] = None
    
    estimates_verified: CheckStatus
    estimates_notes: Optional[str] = None
    
    membership_verified: CheckStatus
    membership_notes: Optional[str] = None
    
    google_reviews_discussed: CheckStatus
    google_reviews_notes: Optional[str] = None
    
    replacement_discussed: CheckStatus
    no_replacement_reason: Optional[str] = None
    
    g3_contact_needed: bool = False
    g3_notes: Optional[str] = None
    
    general_notes: Optional[str] = None


class DebriefResponse(BaseModel):
    """Response after submitting debrief."""
    success: bool
    job_id: int
    message: str
    completed_at: datetime


# ----- Dashboard Schemas -----

class DailyStats(BaseModel):
    """Daily completion statistics."""
    date: str
    total_completed_jobs: int
    total_debriefed: int
    pending_debrief: int
    completion_rate: float


class DispatcherStats(BaseModel):
    """Stats for a single dispatcher."""
    dispatcher_id: int
    dispatcher_name: str
    is_primary: bool
    debriefs_completed_today: int
    debriefs_completed_this_week: int
    debriefs_completed_this_month: int


class DashboardResponse(BaseModel):
    """Full dashboard data."""
    today: DailyStats
    this_week: DailyStats
    this_month: DailyStats
    dispatchers: List[DispatcherStats]
    pending_jobs: List[TicketSummary]


# ----- Webhook Schemas -----

class WebhookPayload(BaseModel):
    """ServiceTitan webhook payload structure."""
    eventType: str
    tenantId: int
    timestamp: str
    data: dict


# ----- Dispatcher Schemas -----

class DispatcherCreate(BaseModel):
    """Create a new dispatcher."""
    name: str
    email: str
    is_primary: bool = False


class DispatcherResponse(BaseModel):
    """Dispatcher info."""
    id: int
    name: str
    email: str
    is_primary: bool
    is_active: bool

    class Config:
        from_attributes = True


# ----- Business Unit Schemas -----

class BusinessUnitResponse(BaseModel):
    """Business unit info for admin settings."""
    id: int
    name: str
    is_enabled: bool
    discovered_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BusinessUnitToggle(BaseModel):
    """Toggle a business unit's enabled status."""
    is_enabled: bool


class DispatcherBusinessUnitsUpdate(BaseModel):
    """Update a user's assigned business units."""
    business_unit_ids: List[int]  # Empty list = user sees all BUs


class DispatcherWithBusinessUnits(BaseModel):
    """Dispatcher with their assigned business units."""
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    assigned_business_unit_ids: List[int]  # Empty = sees all

    class Config:
        from_attributes = True
