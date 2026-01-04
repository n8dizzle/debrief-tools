#!/usr/bin/env python3
"""
Bulk import completed jobs from ServiceTitan.

This script pulls all completed jobs for a date range and imports them
into the tickets_raw table for debrief review.

Usage:
    python scripts/import_ytd_jobs.py                    # Import YTD (Jan 1 to today)
    python scripts/import_ytd_jobs.py --days 30          # Last 30 days
    python scripts/import_ytd_jobs.py --start 2025-06-01 # From specific date
    python scripts/import_ytd_jobs.py --start 2025-01-01 --end 2025-03-31  # Date range
"""

import asyncio
import argparse
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.servicetitan import get_st_client, categorize_job_type
from app.database import SessionLocal, TicketRaw, TicketStatus, Dispatcher
from dateutil.parser import parse as parse_date


async def fetch_all_completed_jobs(client, start_date: str, end_date: str = None):
    """Fetch all completed jobs in date range with pagination."""
    all_jobs = []
    page = 1
    page_size = 50

    print(f"Fetching completed jobs from {start_date} to {end_date or 'now'}...")

    while True:
        try:
            response = await client.get_completed_jobs(
                completed_on_or_after=start_date,
                completed_before=end_date,
                page=page,
                page_size=page_size
            )
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break

        jobs = response.get("data", [])
        if not jobs:
            break

        all_jobs.extend(jobs)
        print(f"  Page {page}: {len(jobs)} jobs (total: {len(all_jobs)})")

        # Check if there are more pages
        has_more = response.get("hasMore", False)
        if not has_more or len(jobs) < page_size:
            break

        page += 1
        # Small delay to avoid rate limiting
        await asyncio.sleep(0.1)

    return all_jobs


async def import_job(client, job_id: int, db) -> bool:
    """Import a single job, enriching with full details. Returns True if imported."""
    # Check if already imported
    existing = db.query(TicketRaw).filter(TicketRaw.job_id == job_id).first()
    if existing:
        return False

    try:
        # Enrich with full job details
        enriched = await client.enrich_job_data(job_id)

        # Categorize job type
        category, trade = categorize_job_type(enriched.get("job_type_name"))

        # Parse dates
        completed_at = None
        if enriched.get("completed_at"):
            try:
                completed_at = parse_date(enriched["completed_at"])
            except:
                pass

        created_at = None
        if enriched.get("created_at"):
            try:
                created_at = parse_date(enriched["created_at"])
            except:
                pass

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
            tech_id=enriched.get("tech_id"),
            tech_name=enriched.get("tech_name"),
            customer_id=enriched.get("customer_id"),
            customer_name=enriched.get("customer_name"),
            is_new_customer=enriched.get("is_new_customer", False),
            location_id=enriched.get("location_id"),
            location_address=enriched.get("location_address"),
            invoice_id=enriched.get("invoice_id"),
            invoice_number=enriched.get("invoice_number"),
            invoice_summary=enriched.get("invoice_summary", ""),
            invoice_total=enriched.get("invoice_total", 0),
            invoice_balance=enriched.get("invoice_balance", 0),
            payment_collected=enriched.get("payment_collected", False),
            estimate_count=enriched.get("estimate_count", 0),
            estimates_total=enriched.get("estimates_total", 0),
            membership_sold=enriched.get("membership_sold", False),
            membership_type=enriched.get("membership_type"),
            photo_count=enriched.get("photo_count", 0),
            completed_at=completed_at,
            created_at=created_at,
            raw_payload=enriched.get("raw_payload"),
            debrief_status=TicketStatus.PENDING,
        )

        db.add(ticket)
        db.commit()
        return True

    except Exception as e:
        print(f"Error importing job {job_id}: {e}")
        db.rollback()
        return False


async def main():
    parser = argparse.ArgumentParser(description="Import completed jobs from ServiceTitan")
    parser.add_argument("--start", help="Start date (YYYY-MM-DD), defaults to Jan 1 of current year")
    parser.add_argument("--end", help="End date (YYYY-MM-DD), defaults to today")
    parser.add_argument("--days", type=int, help="Import last N days instead of date range")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually import, just show what would be imported")

    args = parser.parse_args()

    # Determine date range
    today = datetime.now()

    if args.days:
        start_date = (today - timedelta(days=args.days)).strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        start_date = args.start or f"{today.year}-01-01"
        end_date = args.end or (today + timedelta(days=1)).strftime("%Y-%m-%d")

    print(f"\n{'='*60}")
    print(f"ServiceTitan Job Import")
    print(f"{'='*60}")
    print(f"Date range: {start_date} to {end_date}")
    if args.dry_run:
        print("DRY RUN - no data will be imported")
    print()

    # Initialize client and database
    client = get_st_client()
    db = SessionLocal()

    try:
        # Ensure we have at least one dispatcher
        dispatcher = db.query(Dispatcher).first()
        if not dispatcher:
            print("Creating default dispatcher...")
            dispatcher = Dispatcher(
                name="Dispatcher",
                email="dispatch@christmasair.com",
                is_primary=True,
                is_active=True
            )
            db.add(dispatcher)
            db.commit()

        # Fetch all jobs in range
        jobs = await fetch_all_completed_jobs(client, start_date, end_date)
        print(f"\nFound {len(jobs)} completed jobs in range")

        if args.dry_run:
            print("\nDry run complete. Would import the above jobs.")
            return

        # Import each job
        imported = 0
        skipped = 0
        errors = 0

        print("\nImporting jobs...")
        for i, job in enumerate(jobs, 1):
            job_id = job.get("id")
            job_number = job.get("jobNumber", "?")

            try:
                result = await import_job(client, job_id, db)
                if result:
                    imported += 1
                    print(f"  [{i}/{len(jobs)}] Job #{job_number} (ID: {job_id}) - imported")
                else:
                    skipped += 1
                    print(f"  [{i}/{len(jobs)}] Job #{job_number} (ID: {job_id}) - skipped (already exists)")
            except Exception as e:
                errors += 1
                print(f"  [{i}/{len(jobs)}] Job #{job_number} (ID: {job_id}) - ERROR: {e}")

            # Small delay to avoid rate limiting
            if i % 10 == 0:
                await asyncio.sleep(0.5)

        print(f"\n{'='*60}")
        print(f"Import complete!")
        print(f"  Imported: {imported}")
        print(f"  Skipped (existing): {skipped}")
        print(f"  Errors: {errors}")
        print(f"{'='*60}")

    finally:
        db.close()
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
