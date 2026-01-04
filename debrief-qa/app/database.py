"""
Database models and connection management.

Tables:
- tickets_raw: Immutable snapshot of job data from ServiceTitan
- dispatcher_checks: Individual checklist item verifications
- debrief_sessions: Completed debrief records
- dispatchers: Dispatcher accounts and roles
"""

import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean, 
    DateTime, Float, ForeignKey, JSON, Enum as SQLEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from dotenv import load_dotenv
import enum

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./debrief.db")

# SQLite needs check_same_thread=False, PostgreSQL doesn't
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CheckStatus(str, enum.Enum):
    PENDING = "pending"
    PASS = "pass"
    FAIL = "fail"
    NA = "na"


class TicketStatus(str, enum.Enum):
    PENDING = "pending"      # In queue, not started
    IN_PROGRESS = "in_progress"  # Dispatcher opened it
    COMPLETED = "completed"  # All checks done
    

class TicketRaw(Base):
    """
    Immutable snapshot of job data pulled from ServiceTitan.
    This represents what the tech submitted - never modified after creation.
    """
    __tablename__ = "tickets_raw"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, unique=True, nullable=False, index=True)
    pulled_at = Column(DateTime, default=datetime.utcnow)
    
    # Job identifiers
    tenant_id = Column(Integer)
    job_number = Column(String(50))
    business_unit_id = Column(Integer)
    business_unit_name = Column(String(100))
    job_type_id = Column(Integer)
    job_type_name = Column(String(100))
    job_status = Column(String(50))
    
    # Categorization (derived from job type)
    job_category = Column(String(50))  # Service, Maintenance, Sales, Install
    trade_type = Column(String(50))    # HVAC, Plumbing

    # Opportunity tracking (for estimates/conversion)
    is_opportunity = Column(Boolean, default=False)  # Job has a tag with isConversionOpportunity=true
    tag_type_ids = Column(JSON)  # List of tag type IDs from ServiceTitan
    
    # Technician
    tech_id = Column(Integer)
    tech_name = Column(String(100))
    all_techs = Column(JSON)  # List of all techs: [{"id": 123, "name": "John Doe"}, ...]

    # Invoice author (who wrote the summary)
    invoice_author = Column(String(200))

    # Customer
    customer_id = Column(Integer)
    customer_name = Column(String(200))
    is_new_customer = Column(Boolean, default=False)
    
    # Location
    location_id = Column(Integer)
    location_address = Column(String(300))
    
    # Invoice data
    invoice_id = Column(Integer)
    invoice_number = Column(String(50))
    invoice_summary = Column(Text)
    invoice_total = Column(Float, default=0)
    invoice_balance = Column(Float, default=0)
    payment_collected = Column(Boolean, default=False)
    
    # Estimates
    estimate_count = Column(Integer, default=0)
    estimates_total = Column(Float, default=0)
    
    # Membership
    membership_sold = Column(Boolean, default=False)
    membership_type = Column(String(100))
    
    # Photos/Attachments
    photo_count = Column(Integer, default=0)

    # Forms completed
    form_count = Column(Integer, default=0)

    # Equipment (from your OCR system, populated later)
    equipment_age_years = Column(Integer, nullable=True)
    equipment_brand = Column(String(100), nullable=True)
    equipment_model = Column(String(100), nullable=True)
    
    # Timestamps from ST
    completed_at = Column(DateTime)
    created_at = Column(DateTime)
    
    # Full payload for future use
    raw_payload = Column(JSON)
    
    # Debrief status
    debrief_status = Column(SQLEnum(TicketStatus, values_callable=lambda x: [e.value for e in x]), default=TicketStatus.PENDING)
    
    # Relationships
    debrief_session = relationship("DebriefSession", back_populates="ticket", uselist=False)


class Dispatcher(Base):
    """Dispatcher accounts for tracking who verified what."""
    __tablename__ = "dispatchers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True)
    is_primary = Column(Boolean, default=False)  # Primary dispatcher for bonus tracking
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    debrief_sessions = relationship("DebriefSession", back_populates="dispatcher")


class DebriefSession(Base):
    """
    A completed debrief session containing all checklist responses.
    One per job, created when dispatcher completes the debrief.
    """
    __tablename__ = "debrief_sessions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("tickets_raw.job_id"), unique=True, nullable=False)
    dispatcher_id = Column(Integer, ForeignKey("dispatchers.id"), nullable=False)
    
    started_at = Column(DateTime)
    completed_at = Column(DateTime, default=datetime.utcnow)
    
    # Checklist items - all required
    # Photos
    photos_reviewed = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    photos_notes = Column(Text)
    
    # Invoice Summary (1-10 score)
    invoice_summary_score = Column(Integer)  # 1-10
    invoice_summary_notes = Column(Text)
    
    # Payment
    payment_verified = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    no_payment_reason = Column(Text)  # If not collected, why?
    
    # Estimates
    estimates_verified = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    estimates_notes = Column(Text)
    
    # Membership
    membership_verified = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    membership_notes = Column(Text)
    
    # Google Reviews
    google_reviews_discussed = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    google_reviews_notes = Column(Text)
    
    # Replacement Discussion (for aged equipment)
    replacement_discussed = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    no_replacement_reason = Column(Text)

    # Equipment Added to Location
    equipment_added = Column(SQLEnum(CheckStatus, values_callable=lambda x: [e.value for e in x]), default=CheckStatus.PENDING)
    equipment_added_notes = Column(Text)

    # G3 Contact
    g3_contact_needed = Column(Boolean, default=False)
    g3_notes = Column(Text)
    
    # General notes
    general_notes = Column(Text)
    
    # Follow-up tracking
    followup_required = Column(Boolean, default=False)
    followup_type = Column(String(50))  # 'tech_coaching', 'manager_review', 'customer_callback', 'st_task', 'other'
    followup_description = Column(Text)
    followup_assigned_to = Column(String(100))  # Tech name, manager, etc.
    followup_completed = Column(Boolean, default=False)
    followup_completed_at = Column(DateTime, nullable=True)
    followup_completed_by = Column(String(100), nullable=True)
    slack_notified = Column(Boolean, default=False)
    slack_thread_ts = Column(String(50), nullable=True)  # For threading follow-up replies
    
    # Relationships
    ticket = relationship("TicketRaw", back_populates="debrief_session")
    dispatcher = relationship("Dispatcher", back_populates="debrief_sessions")


class WebhookLog(Base):
    """Log of received webhooks for debugging and replay."""
    __tablename__ = "webhook_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    received_at = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String(100))
    job_id = Column(Integer, index=True)
    payload = Column(JSON)
    processed = Column(Boolean, default=False)
    error = Column(Text)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")


def get_db():
    """Dependency for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
