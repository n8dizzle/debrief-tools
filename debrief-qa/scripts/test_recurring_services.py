"""
Test: Get clean membership recurring services view for a specific membership.
"""

import asyncio
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.servicetitan import get_st_client

async def test_membership_view():
    """Get the data needed for a membership recurring services display."""
    client = get_st_client()

    # Use one of our tune-up jobs
    job_id = 170101262  # Phil Schupp
    print(f"\n=== Job {job_id} ===")

    job = await client.get_job(job_id)
    customer_id = job.get("customerId")
    location_id = job.get("locationId")

    print(f"Customer ID: {customer_id}")
    print(f"Location ID: {location_id}")

    # Get memberships for this customer, find one for this location
    memberships_response = await client.get_customer_memberships(customer_id)
    memberships = memberships_response.get("data", [])

    # Find membership for this location
    location_membership = None
    for m in memberships:
        if m.get("locationId") == location_id:
            location_membership = m
            break

    # If no exact match, find first active membership
    if not location_membership:
        print(f"\nNo membership found for location {location_id}")
        print(f"Looking for any active membership...")
        for m in memberships:
            if m.get("status") == "Active":
                location_membership = m
                print(f"Found active membership at location {m.get('locationId')}")
                break

    if not location_membership:
        # Just use first membership to test the display
        location_membership = memberships[0] if memberships else None
        print(f"Using first membership: {location_membership.get('id')}" if location_membership else "No memberships found")

    if location_membership:
        m_id = location_membership.get("id")
        m_location = location_membership.get("locationId")

        print(f"\n=== Membership {m_id} ===")
        print(f"Location: {m_location}")
        print(f"Status: {location_membership.get('status')}")

        # Get recurring services ONLY for this membership's location
        services_response = await client._request(
            "GET",
            f"memberships/v2/tenant/{client.tenant_id}/recurring-services",
            params={"locationId": m_location, "active": "true", "pageSize": 20}
        )
        all_services = services_response.get("data", [])

        # Filter to only this membership's services
        membership_services = [s for s in all_services if s.get("membershipId") == m_id]

        print(f"\n--- Recurring Services for this membership ({len(membership_services)}) ---")
        for svc in membership_services:
            status = "Completed" if svc.get("firstVisitComplete") else "Pending"
            print(f"\n  {svc.get('name')}")
            print(f"    Status: {status}")
            print(f"    From: {svc.get('from')[:10] if svc.get('from') else 'N/A'}")
            print(f"    Recurrence: Every {svc.get('recurrenceInterval')} months")

        # Get recurring service events ONLY for this location
        events_response = await client._request(
            "GET",
            f"memberships/v2/tenant/{client.tenant_id}/recurring-service-events",
            params={"locationId": m_location, "pageSize": 20}
        )
        all_events = events_response.get("data", [])

        # Filter to this membership
        membership_events = [e for e in all_events if e.get("membershipId") == m_id]

        print(f"\n--- Recurring Service Events ({len(membership_events)}) ---")
        for event in membership_events:
            job_id = event.get("jobId")
            status = event.get("status")
            # Get job details to find the date
            job_date = "Unknown"
            job_type = "Unknown"
            if job_id:
                try:
                    job_details = await client.get_job(job_id)
                    job_date = job_details.get("completedOn", job_details.get("createdOn", ""))[:10] if job_details.get("completedOn") or job_details.get("createdOn") else "Unknown"
                    job_type = job_details.get("jobTypeName", "Unknown")
                except:
                    pass

            print(f"\n  Job #{job_id}")
            print(f"    Status: {status}")
            print(f"    Date: {job_date}")
            print(f"    Type: {job_type}")

    await client.close()

if __name__ == "__main__":
    asyncio.run(test_membership_view())
