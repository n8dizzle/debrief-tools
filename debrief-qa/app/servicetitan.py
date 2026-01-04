"""
ServiceTitan API client for fetching job details.

Handles authentication, token caching, and API calls to enrich
webhook data with full job details.
"""

import os
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()


class ServiceTitanClient:
    """Client for ServiceTitan API interactions."""
    
    BASE_URL = "https://api.servicetitan.io"
    AUTH_URL = "https://auth.servicetitan.io/connect/token"
    
    def __init__(self):
        self.client_id = os.getenv("ST_CLIENT_ID")
        self.client_secret = os.getenv("ST_CLIENT_SECRET")
        self.tenant_id = os.getenv("ST_TENANT_ID")
        self.app_key = os.getenv("ST_APP_KEY")
        
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        
        self._http_client = httpx.AsyncClient(timeout=30.0)
    
    async def _get_access_token(self) -> str:
        """Get or refresh access token."""
        # Return cached token if still valid
        if self._access_token and self._token_expires_at:
            if datetime.utcnow() < self._token_expires_at - timedelta(minutes=1):
                return self._access_token
        
        # Request new token
        response = await self._http_client.post(
            self.AUTH_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }
        )
        response.raise_for_status()
        data = response.json()
        
        self._access_token = data["access_token"]
        # Token expires in 15 minutes per ST docs
        self._token_expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 900))
        
        return self._access_token
    
    async def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated API request."""
        token = await self._get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "ST-App-Key": self.app_key,
            "Content-Type": "application/json",
        }
        
        url = f"{self.BASE_URL}/{endpoint}"
        response = await self._http_client.request(method, url, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()
    
    async def get_job(self, job_id: int) -> Dict[str, Any]:
        """Get job details."""
        return await self._request("GET", f"jpm/v2/tenant/{self.tenant_id}/jobs/{job_id}")
    
    async def get_job_appointments(self, job_id: int) -> Dict[str, Any]:
        """Get appointments for a job."""
        return await self._request(
            "GET",
            f"jpm/v2/tenant/{self.tenant_id}/appointments",
            params={"jobId": job_id}
        )

    async def get_appointment_assignments(self, appointment_id: int) -> Dict[str, Any]:
        """Get technician assignments for an appointment."""
        return await self._request(
            "GET",
            f"dispatch/v2/tenant/{self.tenant_id}/appointment-assignments",
            params={"appointmentIds": str(appointment_id)}
        )

    async def get_invoice(self, invoice_id: int) -> Dict[str, Any]:
        """Get invoice details."""
        return await self._request("GET", f"accounting/v2/tenant/{self.tenant_id}/invoices/{invoice_id}")
    
    async def get_invoices_by_job(self, job_id: int) -> Dict[str, Any]:
        """Get all invoices for a job."""
        return await self._request(
            "GET",
            f"accounting/v2/tenant/{self.tenant_id}/invoices",
            params={"jobId": job_id}
        )
    
    async def get_estimates_by_job(self, job_id: int) -> Dict[str, Any]:
        """Get estimates for a job."""
        return await self._request(
            "GET",
            f"sales/v2/tenant/{self.tenant_id}/estimates",
            params={"jobId": job_id}
        )
    
    async def get_customer(self, customer_id: int) -> Dict[str, Any]:
        """Get customer details."""
        return await self._request("GET", f"crm/v2/tenant/{self.tenant_id}/customers/{customer_id}")
    
    async def get_location(self, location_id: int) -> Dict[str, Any]:
        """Get location details."""
        return await self._request("GET", f"crm/v2/tenant/{self.tenant_id}/locations/{location_id}")
    
    async def get_attachments_by_job(self, job_id: int) -> Dict[str, Any]:
        """Get attachments (photos/videos) for a job.

        Uses the Forms API endpoint which returns all job attachments
        including tech photos of data plates, equipment, etc.
        """
        return await self._request(
            "GET",
            f"forms/v2/tenant/{self.tenant_id}/jobs/{job_id}/attachments"
        )

    async def get_form_submissions_by_job(self, job_id: int) -> Dict[str, Any]:
        """Get form submissions for a job.

        The API's jobId parameter doesn't filter correctly, so we fetch
        all submissions and filter client-side by checking the owners array.
        """
        # Get all submissions (API doesn't filter by jobId properly)
        response = await self._request(
            "GET",
            f"forms/v2/tenant/{self.tenant_id}/submissions",
            params={"pageSize": 200}  # Get more to ensure we find the job's forms
        )

        all_submissions = response.get("data", [])

        # Filter by job ID in the owners array
        # Each submission has owners: [{"type": "Job", "id": 123456}, ...]
        job_submissions = [
            s for s in all_submissions
            if any(
                o.get("type") == "Job" and o.get("id") == job_id
                for o in s.get("owners", [])
            )
        ]

        # Return in same format as original API response
        return {"data": job_submissions}
    
    async def get_customer_memberships(self, customer_id: int) -> Dict[str, Any]:
        """Get memberships for a customer."""
        return await self._request(
            "GET",
            f"memberships/v2/tenant/{self.tenant_id}/memberships",
            params={"customerId": customer_id, "active": "true"}
        )
    
    async def get_technician(self, tech_id: int) -> Dict[str, Any]:
        """Get technician details."""
        return await self._request("GET", f"settings/v2/tenant/{self.tenant_id}/technicians/{tech_id}")
    
    async def get_business_unit(self, bu_id: int) -> Dict[str, Any]:
        """Get business unit details."""
        return await self._request("GET", f"settings/v2/tenant/{self.tenant_id}/business-units/{bu_id}")
    
    async def get_job_type(self, job_type_id: int) -> Dict[str, Any]:
        """Get job type details."""
        return await self._request("GET", f"jpm/v2/tenant/{self.tenant_id}/job-types/{job_type_id}")

    async def get_all_tag_types(self) -> list:
        """
        Get all tag types. Caches result for the session.
        Note: ServiceTitan doesn't have a GET /tag-types/{id} endpoint,
        so we must fetch all and filter locally.
        """
        if not hasattr(self, '_tag_types_cache') or self._tag_types_cache is None:
            result = await self._request(
                "GET",
                f"settings/v2/tenant/{self.tenant_id}/tag-types",
                params={"pageSize": 200}
            )
            self._tag_types_cache = result.get("data", [])
        return self._tag_types_cache

    async def get_opportunity_tag_ids(self) -> set:
        """
        Get set of tag type IDs that have isConversionOpportunity=true.
        Caches result for the session.
        """
        if not hasattr(self, '_opportunity_tag_ids') or self._opportunity_tag_ids is None:
            all_tags = await self.get_all_tag_types()
            self._opportunity_tag_ids = {
                tag["id"] for tag in all_tags
                if tag.get("isConversionOpportunity", False)
            }
        return self._opportunity_tag_ids

    async def check_tags_for_opportunity(self, tag_type_ids: list) -> bool:
        """
        Check if any of the given tag type IDs have isConversionOpportunity=true.
        Returns True if this job is considered an opportunity.
        """
        if not tag_type_ids:
            return False

        opportunity_ids = await self.get_opportunity_tag_ids()
        return any(tag_id in opportunity_ids for tag_id in tag_type_ids)

    async def get_completed_jobs(
        self,
        completed_on_or_after: str,  # ISO date: "2025-01-01"
        completed_before: str = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        """
        Get jobs completed within a date range.

        Args:
            completed_on_or_after: Start date (inclusive) in ISO format
            completed_before: End date (exclusive) in ISO format, defaults to now
            page: Page number for pagination
            page_size: Number of results per page (max 50)
        """
        params = {
            "completedOnOrAfter": completed_on_or_after,
            "jobStatus": "Completed",
            "page": page,
            "pageSize": page_size,
        }
        if completed_before:
            params["completedBefore"] = completed_before

        return await self._request(
            "GET",
            f"jpm/v2/tenant/{self.tenant_id}/jobs",
            params=params
        )

    async def enrich_job_data(self, job_id: int) -> Dict[str, Any]:
        """
        Pull all relevant data for a job into a single enriched object.
        This is what we store in tickets_raw.
        """
        job = await self.get_job(job_id)

        # Get related data
        customer = await self.get_customer(job["customerId"]) if job.get("customerId") else None
        location = await self.get_location(job["locationId"]) if job.get("locationId") else None

        # Fetch job type by ID if name not provided
        job_type_name = job.get("jobTypeName")
        if not job_type_name and job.get("jobTypeId"):
            try:
                job_type_data = await self.get_job_type(job["jobTypeId"])
                job_type_name = job_type_data.get("name")
            except:
                pass

        # Fetch business unit by ID if name not provided
        business_unit_name = job.get("businessUnitName")
        if not business_unit_name and job.get("businessUnitId"):
            try:
                bu_data = await self.get_business_unit(job["businessUnitId"])
                business_unit_name = bu_data.get("name")
            except:
                pass

        # Check if job is an opportunity (has tags with isConversionOpportunity=true)
        tag_type_ids = job.get("tagTypeIds", [])
        is_opportunity = await self.check_tags_for_opportunity(tag_type_ids)
        
        # Get invoices
        invoices_response = await self.get_invoices_by_job(job_id)
        invoices = invoices_response.get("data", [])
        primary_invoice = invoices[0] if invoices else None
        
        # Get estimates
        estimates_response = await self.get_estimates_by_job(job_id)
        estimates = estimates_response.get("data", [])
        
        # Get appointments and tech assignments
        appointments_response = await self.get_job_appointments(job_id)
        appointments = appointments_response.get("data", [])
        tech_name = "Unknown"
        tech_id = None
        all_techs = []  # List of all technicians on the job

        if appointments:
            # Get tech from appointment-assignments endpoint
            for appt in appointments:
                try:
                    assignments = await self.get_appointment_assignments(appt["id"])
                    assignment_data = assignments.get("data", [])
                    for assignment in assignment_data:
                        tech_info = {
                            "id": assignment.get("technicianId"),
                            "name": assignment.get("technicianName", "Unknown")
                        }
                        # Avoid duplicates
                        if tech_info not in all_techs:
                            all_techs.append(tech_info)
                        # Set primary tech as the first one found
                        if tech_id is None:
                            tech_id = assignment.get("technicianId")
                            tech_name = assignment.get("technicianName", "Unknown")
                except:
                    pass

        # Get invoice author (who wrote the summary)
        invoice_author = None
        if primary_invoice:
            employee_info = primary_invoice.get("employeeInfo", {})
            if employee_info:
                # Extract just the name part from email if needed
                author_name = employee_info.get("name", "")
                if "@" in author_name:
                    # Convert email to readable name: "jordans@christmasair.com" -> "Jordan S."
                    email_name = author_name.split("@")[0]
                    invoice_author = email_name
                else:
                    invoice_author = author_name
            elif primary_invoice.get("createdBy"):
                invoice_author = primary_invoice.get("createdBy").split("@")[0]
        
        # Get attachments (photos/videos) from Forms API
        try:
            attachments_response = await self.get_attachments_by_job(job_id)
            attachments = attachments_response.get("data", [])
        except:
            attachments = []

        # Get form submissions
        try:
            forms_response = await self.get_form_submissions_by_job(job_id)
            form_submissions = forms_response.get("data", [])
        except:
            form_submissions = []

        # Check for membership sold on this job
        membership_sold = False
        membership_type = None
        if customer:
            try:
                memberships_response = await self.get_customer_memberships(customer["id"])
                memberships = memberships_response.get("data", [])
                # Check if any membership was created around job completion time
                # This is a simplification - you might need more precise logic
                membership_sold = len(memberships) > 0
                if memberships:
                    membership_type = memberships[0].get("membershipTypeName")
            except:
                pass
        
        # Build enriched object
        return {
            "job_id": job_id,
            "tenant_id": self.tenant_id,
            "job_number": job.get("jobNumber"),
            "business_unit_id": job.get("businessUnitId"),
            "business_unit_name": business_unit_name,
            "job_type_id": job.get("jobTypeId"),
            "job_type_name": job_type_name,
            "job_status": job.get("jobStatus"),

            # Opportunity tracking
            "is_opportunity": is_opportunity,
            "tag_type_ids": tag_type_ids,

            # Tech
            "tech_id": tech_id,
            "tech_name": tech_name,
            "all_techs": all_techs,  # List of all techs: [{"id": 123, "name": "John Doe"}, ...]

            # Invoice author (who wrote the summary)
            "invoice_author": invoice_author,
            
            # Customer
            "customer_id": customer.get("id") if customer else None,
            "customer_name": customer.get("name") if customer else "Unknown",
            "is_new_customer": self._is_new_customer(customer, job),
            
            # Location
            "location_id": location.get("id") if location else None,
            "location_address": self._format_address(location) if location else "",
            
            # Invoice
            "invoice_id": primary_invoice.get("id") if primary_invoice else None,
            "invoice_number": primary_invoice.get("invoiceNumber") if primary_invoice else None,
            "invoice_summary": primary_invoice.get("summary", "") if primary_invoice else "",
            "invoice_total": float(primary_invoice.get("total", 0)) if primary_invoice else 0,
            "invoice_balance": float(primary_invoice.get("balance", 0)) if primary_invoice else 0,
            "payment_collected": (float(primary_invoice.get("balance", 0)) == 0) if primary_invoice else False,
            
            # Estimates
            "estimate_count": len(estimates),
            "estimates_total": sum(e.get("total", 0) for e in estimates),
            
            # Membership
            "membership_sold": membership_sold,
            "membership_type": membership_type,

            # Forms
            "form_count": len(form_submissions),

            # Photos/attachments from Forms API
            "photo_count": len(attachments),
            
            # Timestamps
            "completed_at": job.get("completedOn"),
            "created_at": job.get("createdOn"),
            
            # Raw payload for future use
            "raw_payload": {
                "job": job,
                "invoices": invoices,
                "estimates": estimates,
                "customer": customer,
                "location": location,
                "attachments": attachments,
                "form_submissions": form_submissions,
            }
        }
    
    def _is_new_customer(self, customer: Dict, job: Dict) -> bool:
        """Check if customer was created on or around job date."""
        if not customer or not job:
            return False
        # Simple check: customer created same day as job
        customer_created = customer.get("createdOn", "")[:10]
        job_created = job.get("createdOn", "")[:10]
        return customer_created == job_created
    
    def _format_address(self, location: Dict) -> str:
        """Format location into readable address."""
        if not location:
            return ""
        parts = [
            location.get("street", ""),
            location.get("city", ""),
            location.get("state", ""),
            location.get("zip", ""),
        ]
        return ", ".join(p for p in parts if p)
    
    async def close(self):
        """Close HTTP client."""
        await self._http_client.aclose()


# Legacy job type categorization (old naming convention)
LEGACY_JOB_TYPE_CATEGORIES = {
    # HVAC - Service
    "No Cool": ("Service", "HVAC"),
    "No Heat": ("Service", "HVAC"),
    "Troubleshoot": ("Service", "HVAC"),
    "Repair": ("Service", "HVAC"),
    "Water Leak": ("Service", "HVAC"),
    "Duct Cleaning": ("Service", "HVAC"),
    "Inspection (includes heat and cool)": ("Service", "HVAC"),

    # HVAC - Maintenance
    "Cooling Tune-up": ("Maintenance", "HVAC"),
    "Heating Tune-up": ("Maintenance", "HVAC"),

    # HVAC - Sales
    "Estimate": ("Sales", "HVAC"),

    # HVAC - Install
    "Install Full System Replacement": ("Install", "HVAC"),
    "Install Partial System Replacement": ("Install", "HVAC"),
    "Ductwork": ("Install", "HVAC"),
    "IAQ": ("Install", "HVAC"),
    "Install Other": ("Install", "HVAC"),
    "Insulation": ("Install", "HVAC"),

    # Plumbing - Service
    "No Hot Water": ("Service", "Plumbing"),
    "Gas Leak": ("Service", "Plumbing"),
    "Clogged Drain": ("Service", "Plumbing"),
    "Repair or WIP": ("Service", "Plumbing"),
    "Inspection": ("Service", "Plumbing"),

    # Plumbing - Maintenance
    "Annual Maintenance": ("Maintenance", "Plumbing"),

    # Plumbing - Install
    "Install Sewer Line": ("Install", "Plumbing"),
    "Install Water Heater": ("Install", "Plumbing"),
    "Install Gas Line": ("Install", "Plumbing"),
    "Install Water Line": ("Install", "Plumbing"),
    "Install Fixture": ("Install", "Plumbing"),
    "Install Filtration": ("Install", "Plumbing"),
}


def categorize_job_type(job_type_name: Optional[str]) -> tuple:
    """
    Get category and trade type for a job type name.

    Supports two formats:
    1. New format: "PREFIX - Description" (e.g., "SERVICE - T/U-Res-Mem", "PLUMBING - Recall")
    2. Legacy format: Simple names (e.g., "No Cool", "Cooling Tune-up")

    Returns (category, trade_type) or ("Unknown", "Unknown") if not found.
    """
    if not job_type_name:
        return ("Unknown", "Unknown")

    # Normalize for matching
    name_upper = job_type_name.upper()
    name_lower = job_type_name.lower()

    # ======================
    # NEW FORMAT: PREFIX - Description
    # ======================

    # Determine trade first based on prefix
    if name_upper.startswith("PLUMBING"):
        trade = "Plumbing"
        # Plumbing - Install
        if any(kw in name_lower for kw in ["tank install", "tankless install", "filtration system", "install gas line"]):
            return ("Install", trade)
        # Plumbing - Maintenance
        if "maintenance" in name_lower:
            return ("Maintenance", trade)
        # Plumbing - Sales
        if "estimate" in name_lower:
            return ("Sales", trade)
        # Plumbing - Service (default for plumbing prefix)
        return ("Service", trade)

    # INSTALL prefix (HVAC)
    if name_upper.startswith("INSTALL"):
        return ("Install", "HVAC")

    # SALES prefix (HVAC)
    if name_upper.startswith("SALES"):
        return ("Sales", "HVAC")

    # SERVICE prefix (HVAC)
    if name_upper.startswith("SERVICE"):
        # Tune-ups are Maintenance
        if "t/u" in name_lower or "tune" in name_lower:
            return ("Maintenance", "HVAC")
        # Everything else is Service
        return ("Service", "HVAC")

    # ======================
    # LEGACY FORMAT: Simple names
    # ======================

    # Exact match on legacy names
    if job_type_name in LEGACY_JOB_TYPE_CATEGORIES:
        return LEGACY_JOB_TYPE_CATEGORIES[job_type_name]

    # Fuzzy match - check if job type name contains a legacy key
    for key, value in LEGACY_JOB_TYPE_CATEGORIES.items():
        if key.lower() in name_lower:
            return value

    # ======================
    # FALLBACK: Keyword detection
    # ======================

    # Determine trade from keywords
    if "plumb" in name_lower:
        trade = "Plumbing"
    else:
        trade = "HVAC"

    if "install" in name_lower:
        return ("Install", trade)
    if "estimate" in name_lower or "est" in name_lower:
        return ("Sales", trade)
    if "maintenance" in name_lower or "tune" in name_lower:
        return ("Maintenance", trade)

    return ("Unknown", "Unknown")


# Singleton client instance
_client: Optional[ServiceTitanClient] = None


def get_st_client() -> ServiceTitanClient:
    """Get or create ServiceTitan client singleton."""
    global _client
    if _client is None:
        _client = ServiceTitanClient()
    return _client
