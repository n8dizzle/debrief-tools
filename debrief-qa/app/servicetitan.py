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
        """Get attachments (photos) for a job."""
        # Note: This endpoint may vary - check your ST API docs
        return await self._request(
            "GET",
            f"jpm/v2/tenant/{self.tenant_id}/jobs/{job_id}/attachments"
        )
    
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
        primary_tech = None
        tech_name = "Unknown"
        tech_id = None

        if appointments:
            # Get tech from appointment-assignments endpoint
            for appt in appointments:
                try:
                    assignments = await self.get_appointment_assignments(appt["id"])
                    assignment_data = assignments.get("data", [])
                    if assignment_data:
                        # Get first assigned tech
                        first_assignment = assignment_data[0]
                        tech_id = first_assignment.get("technicianId")
                        tech_name = first_assignment.get("technicianName", "Unknown")
                        break
                except:
                    pass
        
        # Get attachments (photos)
        try:
            attachments_response = await self.get_attachments_by_job(job_id)
            attachments = attachments_response.get("data", [])
        except:
            attachments = []
        
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
            
            # Tech
            "tech_id": tech_id,
            "tech_name": tech_name,
            
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
            "invoice_total": primary_invoice.get("total", 0) if primary_invoice else 0,
            "invoice_balance": primary_invoice.get("balance", 0) if primary_invoice else 0,
            "payment_collected": (primary_invoice.get("balance", 0) == 0) if primary_invoice else False,
            
            # Estimates
            "estimate_count": len(estimates),
            "estimates_total": sum(e.get("total", 0) for e in estimates),
            
            # Membership
            "membership_sold": membership_sold,
            "membership_type": membership_type,
            
            # Photos
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


# Job type categorization based on your provided list
JOB_TYPE_CATEGORIES = {
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
    Returns (category, trade_type) or ("Unknown", "Unknown") if not found.
    """
    if not job_type_name:
        return ("Unknown", "Unknown")

    # Exact match
    if job_type_name in JOB_TYPE_CATEGORIES:
        return JOB_TYPE_CATEGORIES[job_type_name]

    # Fuzzy match - check if job type name contains a key
    for key, value in JOB_TYPE_CATEGORIES.items():
        if key.lower() in job_type_name.lower():
            return value

    return ("Unknown", "Unknown")


# Singleton client instance
_client: Optional[ServiceTitanClient] = None


def get_st_client() -> ServiceTitanClient:
    """Get or create ServiceTitan client singleton."""
    global _client
    if _client is None:
        _client = ServiceTitanClient()
    return _client
