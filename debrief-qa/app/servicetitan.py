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

    async def get_payments_by_invoice(self, invoice_id: int, customer_id: int = None) -> Dict[str, Any]:
        """Get all payments applied to an invoice.

        Note: The ServiceTitan API's invoiceId filter doesn't work reliably,
        so we filter by customer (if provided) and then filter client-side
        by the appliedTo array.

        Args:
            invoice_id: The invoice ID to find payments for
            customer_id: Optional customer ID to narrow the search (recommended)
        """
        params = {"pageSize": 100}

        # If we have a customer ID, filter by that (much more efficient)
        if customer_id:
            params["customerId"] = customer_id
        else:
            # Fallback to recent payments if no customer ID
            from datetime import datetime, timedelta, timezone
            recent_date = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
            params["modifiedOnOrAfter"] = recent_date
            params["pageSize"] = 500

        result = await self._request(
            "GET",
            f"accounting/v2/tenant/{self.tenant_id}/payments",
            params=params
        )

        all_payments = result.get("data", [])

        # Filter by checking if payment's appliedTo array contains this invoice
        matching_payments = []
        for payment in all_payments:
            applied_to_list = payment.get("appliedTo", [])
            for applied in applied_to_list:
                # appliedTo field in each item is the invoice ID
                if applied.get("appliedTo") == invoice_id:
                    matching_payments.append(payment)
                    break

        return {"data": matching_payments}

    async def get_payment_types(self) -> Dict[str, Any]:
        """Get all payment types (Check, Credit Card, Online Payment, etc.)."""
        if not hasattr(self, '_payment_types_cache') or self._payment_types_cache is None:
            result = await self._request(
                "GET",
                f"accounting/v2/tenant/{self.tenant_id}/payment-types",
                params={"pageSize": 100}
            )
            self._payment_types_cache = {pt["id"]: pt["name"] for pt in result.get("data", [])}
        return self._payment_types_cache

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

    async def get_installed_equipment(self, location_id: int) -> Dict[str, Any]:
        """Get installed equipment for a location.

        Note: ServiceTitan API ignores the locationId filter, so we fetch multiple
        pages of data to increase the chance of finding equipment for any location.
        Client-side filtering is done in enrich_job_data().
        """
        all_equipment = []
        page = 1
        max_pages = 10  # Fetch up to 5000 items (500 per page)

        while page <= max_pages:
            response = await self._request(
                "GET",
                f"equipmentsystems/v2/tenant/{self.tenant_id}/installed-equipment",
                params={"locationId": location_id, "pageSize": 500, "page": page}
            )
            items = response.get("data", [])
            all_equipment.extend(items)

            # Stop if no more pages
            if not response.get("hasMore", False):
                break
            page += 1

        return {"data": all_equipment}

    async def export_installed_equipment(
        self,
        location_id: int,
        export_format: str = "Json",
        include_fields: Optional[list] = None,
    ) -> Dict[str, Any]:
        """
        Export installed equipment filtered by location.

        Uses the ExportInstalledEquipment endpoint which supports location-based filters.
        Response typically includes a file/download reference.
        """
        payload: Dict[str, Any] = {
            "filters": {"locationIds": [location_id]},
            "format": export_format,
        }
        if include_fields:
            payload["includeFields"] = include_fields

        return await self._request(
            "POST",
            f"equipmentsystems/v2/tenant/{self.tenant_id}/installed-equipment/export",
            json=payload,
        )

    async def get_invoice_with_items(self, invoice_id: int) -> Dict[str, Any]:
        """Get invoice details including line items."""
        return await self._request("GET", f"accounting/v2/tenant/{self.tenant_id}/invoices/{invoice_id}")
    
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

    async def get_membership_invoices(self, membership_id: int, limit: int = 10) -> Dict[str, Any]:
        """Get invoices/payments for a specific membership."""
        return await self._request(
            "GET",
            f"memberships/v2/tenant/{self.tenant_id}/membership-invoices",
            params={
                "membershipId": membership_id,
                "pageSize": limit,
                "status": "Paid"  # Only get paid invoices
            }
        )

    async def get_location_recurring_services(self, location_id: int) -> Dict[str, Any]:
        """Get recurring services for a location (what's included in membership)."""
        return await self._request(
            "GET",
            f"memberships/v2/tenant/{self.tenant_id}/recurring-services",
            params={"locationId": location_id, "active": "true"}
        )

    async def get_recurring_service_events(self, location_id: int, year: int = None) -> Dict[str, Any]:
        """Get recurring service events (scheduled/completed tune-ups) for a location."""
        if year is None:
            year = datetime.utcnow().year

        return await self._request(
            "GET",
            f"memberships/v2/tenant/{self.tenant_id}/recurring-service-events",
            params={
                "locationId": location_id,
                "startsOnOrAfter": f"{year}-01-01",
                "startsOnOrBefore": f"{year}-12-31"
            }
        )

    async def get_customer_jobs_history(self, customer_id: int, months_back: int = 12) -> Dict[str, Any]:
        """Get completed jobs for a customer in the last N months (for cross-referencing tune-ups)."""
        from_date = (datetime.utcnow() - timedelta(days=months_back * 30)).strftime("%Y-%m-%d")

        return await self._request(
            "GET",
            f"jpm/v2/tenant/{self.tenant_id}/jobs",
            params={
                "customerId": customer_id,
                "completedOnOrAfter": from_date,
                "jobStatus": "Completed",
                "pageSize": 100
            }
        )

    async def get_technician(self, tech_id: int) -> Dict[str, Any]:
        """Get technician details."""
        return await self._request("GET", f"settings/v2/tenant/{self.tenant_id}/technicians/{tech_id}")
    
    async def get_business_unit(self, bu_id: int) -> Dict[str, Any]:
        """Get business unit details."""
        return await self._request("GET", f"settings/v2/tenant/{self.tenant_id}/business-units/{bu_id}")

    async def get_all_business_units(self) -> Dict[str, Any]:
        """Get all business units for the tenant."""
        return await self._request(
            "GET",
            f"settings/v2/tenant/{self.tenant_id}/business-units",
            params={"pageSize": 100}
        )

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

        # Get payments for the invoice to determine actual payment status
        payments = []
        payment_methods = []
        total_payments = 0.0
        if primary_invoice:
            try:
                # Pass customer_id for efficient filtering
                payments_response = await self.get_payments_by_invoice(
                    primary_invoice.get("id"),
                    job.get("customerId")
                )
                payments = payments_response.get("data", [])

                # Get payment types to resolve names
                payment_types = await self.get_payment_types()

                for payment in payments:
                    amount = float(payment.get("total", 0))
                    if amount > 0:  # Only count positive payments (not refunds)
                        total_payments += amount
                        # Get payment type name
                        type_id = payment.get("typeId")
                        type_name = payment_types.get(type_id, payment.get("type", "Unknown"))
                        if type_name and type_name not in payment_methods:
                            payment_methods.append(type_name)
            except:
                pass

        # Determine payment status - consider paid if we have payments OR balance is 0
        invoice_total = float(primary_invoice.get("total", 0)) if primary_invoice else 0
        invoice_balance = float(primary_invoice.get("balance", 0)) if primary_invoice else 0
        # Payment is collected if: balance is 0, OR we have payments >= 90% of total (to handle small rounding)
        payment_collected = False
        if primary_invoice:
            if invoice_balance == 0:
                payment_collected = True
            elif total_payments > 0 and total_payments >= (invoice_total * 0.9):
                payment_collected = True

        # Format payment method string
        payment_method = ", ".join(payment_methods) if payment_methods else None

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

        # Get installed equipment for the location
        # Note: ServiceTitan API ignores locationId filter, so we filter client-side
        installed_equipment = []
        installed_equipment_count = 0
        if location:
            try:
                location_id = location.get("id")
                equipment_response = await self.get_installed_equipment(location_id)
                equipment_data = equipment_response.get("data", [])
                # Filter by locationId client-side (API ignores the filter parameter)
                for eq in equipment_data:
                    # Only include equipment that matches this location
                    if eq.get("locationId") == location_id:
                        installed_equipment.append({
                            "id": eq.get("id"),
                            "name": eq.get("name") or eq.get("equipmentType") or "Unknown Equipment",
                            "serialNumber": eq.get("serialNumber"),
                            "installedOn": eq.get("installedOn"),
                            "manufacturer": eq.get("manufacturer"),
                            "model": eq.get("model"),
                        })
                installed_equipment_count = len(installed_equipment)
            except:
                pass

        # Get invoice line items
        invoice_items = []
        invoice_materials_count = 0
        invoice_equipment_count = 0
        invoice_services_count = 0
        if primary_invoice:
            try:
                # Items should be included in the invoice response
                items = primary_invoice.get("items", [])
                for item in items:
                    item_type = item.get("type", "").lower()
                    invoice_items.append({
                        "id": item.get("id"),
                        "skuId": item.get("skuId"),
                        "skuName": item.get("skuName") or item.get("description") or "Unknown Item",
                        "type": item.get("type"),  # Material, Equipment, Service, etc.
                        "quantity": item.get("quantity", 1),
                        "unitPrice": item.get("unitPrice", 0),
                        "totalPrice": item.get("totalPrice") or item.get("total", 0),
                    })
                    # Count by type
                    if "material" in item_type:
                        invoice_materials_count += 1
                    elif "equipment" in item_type:
                        invoice_equipment_count += 1
                    elif "service" in item_type or "labor" in item_type:
                        invoice_services_count += 1
            except:
                pass

        # Check for membership and calculate visit context
        membership_sold = False
        membership_id = None
        membership_type = None
        membership_expires = None
        membership_price = None
        membership_billing_frequency = None
        membership_last_payment_date = None
        membership_last_payment_amount = None
        completed_date = job.get("completedOn")
        membership_visit_type = determine_visit_type(job_type_name, completed_date)
        membership_visits_included = 0
        membership_visits_used = 0
        membership_visit_number = 0
        membership_visit_covered = True
        membership_data_warning = None

        if customer:
            try:
                memberships_response = await self.get_customer_memberships(customer["id"])
                memberships = memberships_response.get("data", [])
                membership_sold = len(memberships) > 0

                if memberships:
                    # Find first active (non-expired) membership, or fall back to first one
                    primary_membership = None
                    for m in memberships:
                        if m.get("status") == "Active":
                            primary_membership = m
                            break
                    if not primary_membership:
                        primary_membership = memberships[0]

                    # Capture membership ID for linking to ST
                    membership_id = primary_membership.get("id")

                    # Get membership type name (API returns membershipTypeId, not name)
                    membership_type_id = primary_membership.get("membershipTypeId")
                    if membership_type_id:
                        try:
                            # Fetch membership type details
                            mt_response = await self._request(
                                "GET",
                                f"memberships/v2/tenant/{self.tenant_id}/membership-types/{membership_type_id}"
                            )
                            membership_type = mt_response.get("name")
                        except:
                            membership_type = f"Membership #{membership_type_id}"
                    membership_expires = primary_membership.get("to")  # End date

                    # Get billing frequency from membership
                    membership_billing_frequency = primary_membership.get("billingFrequency")

                    # Get price from membership type's durationBilling array
                    if membership_type_id:
                        try:
                            mt_response = await self._request(
                                "GET",
                                f"memberships/v2/tenant/{self.tenant_id}/membership-types/{membership_type_id}"
                            )
                            duration_billing = mt_response.get("durationBilling", [])
                            # Find the matching billing frequency price
                            for billing in duration_billing:
                                if billing.get("billingFrequency") == membership_billing_frequency:
                                    membership_price = billing.get("billingPrice") or billing.get("salePrice")
                                    break
                            # Fallback to first price if no match
                            if not membership_price and duration_billing:
                                membership_price = duration_billing[0].get("billingPrice") or duration_billing[0].get("salePrice")
                        except:
                            pass

                    # Get last payment from customer payment history
                    # Look for payments matching the membership price
                    customer_id = customer.get("id")
                    if customer_id:
                        try:
                            payments_response = await self._request(
                                "GET",
                                f"accounting/v2/tenant/{self.tenant_id}/payments",
                                params={"customerId": customer_id, "pageSize": 20}
                            )
                            payments = payments_response.get("data", [])
                            # Find most recent payment (they come sorted by date desc)
                            # Prefer payments matching membership price
                            for payment in payments:
                                payment_total = float(payment.get("total", 0))
                                payment_date = payment.get("date")
                                # Check if this payment matches membership price (within $1 tolerance)
                                if membership_price and abs(payment_total - membership_price) < 1.0:
                                    membership_last_payment_date = payment_date
                                    membership_last_payment_amount = payment_total
                                    break
                            # If no membership price match, just use most recent payment as context
                            if not membership_last_payment_date and payments:
                                membership_last_payment_date = payments[0].get("date")
                                membership_last_payment_amount = float(payments[0].get("total", 0))
                        except:
                            pass

                    # Only calculate visit context if this is a tune-up job
                    if membership_visit_type != "unknown" and location:
                        location_id = location.get("id")
                        customer_id = customer.get("id")
                        is_hvac = membership_visit_type in ("hvac_heat", "hvac_cool")

                        # Get recurring service events from ST
                        recurring_events_count = 0
                        try:
                            events_response = await self.get_recurring_service_events(location_id)
                            events = events_response.get("data", [])
                            # Count completed events
                            for event in events:
                                event_status = event.get("status", "")
                                if event_status == "Done" or event_status == "Completed":
                                    event_name = event.get("name", "").lower()
                                    # For HVAC, count BOTH heat and cool visits together
                                    if is_hvac:
                                        if any(kw in event_name for kw in ["heat", "furnace", "cool", "ac", "a/c", "tune", "maint"]):
                                            recurring_events_count += 1
                                    elif membership_visit_type == "plumbing" and "plumb" in event_name:
                                        recurring_events_count += 1
                        except:
                            pass

                        # Cross-reference with actual job history
                        job_history_count = 0
                        try:
                            jobs_response = await self.get_customer_jobs_history(customer_id, months_back=12)
                            past_jobs = jobs_response.get("data", [])
                            for past_job in past_jobs:
                                # Don't count the current job
                                if past_job.get("id") == job_id:
                                    continue
                                past_job_type = determine_visit_type(past_job.get("jobTypeName", ""))
                                # For HVAC, count both heat AND cool visits together
                                if is_hvac and past_job_type in ("hvac_heat", "hvac_cool"):
                                    job_history_count += 1
                                elif past_job_type == membership_visit_type:
                                    job_history_count += 1
                        except:
                            pass

                        # Use higher count as source of truth
                        if job_history_count > recurring_events_count:
                            membership_visits_used = job_history_count
                            if recurring_events_count > 0:
                                membership_data_warning = f"ST shows {recurring_events_count} recurring events but found {job_history_count} tune-up jobs in history"
                        else:
                            membership_visits_used = recurring_events_count

                        # Determine visits included based on visit type
                        # Annual plan: 2 HVAC visits (heat + cool combined), 1 plumbing
                        if is_hvac:
                            membership_visits_included = 2  # 2 total HVAC visits per year
                        elif membership_visit_type == "plumbing":
                            membership_visits_included = 1

                        # This visit is the next one
                        membership_visit_number = membership_visits_used + 1
                        membership_visit_covered = membership_visit_number <= membership_visits_included

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
            "invoice_total": invoice_total,
            "invoice_balance": invoice_balance,
            "payment_collected": payment_collected,
            "payment_method": payment_method,
            "total_payments": total_payments,

            # Estimates
            "estimate_count": len(estimates),
            "estimates_total": sum(e.get("total", 0) for e in estimates),
            
            # Membership
            "membership_sold": membership_sold,
            "membership_id": membership_id,
            "membership_type": membership_type,
            "membership_expires": membership_expires,
            "membership_price": membership_price,
            "membership_billing_frequency": membership_billing_frequency,
            "membership_last_payment_date": membership_last_payment_date,
            "membership_last_payment_amount": membership_last_payment_amount,

            # Membership Visit Context
            "membership_visit_type": membership_visit_type,
            "membership_visits_included": membership_visits_included,
            "membership_visits_used": membership_visits_used,
            "membership_visit_number": membership_visit_number,
            "membership_visit_covered": membership_visit_covered,
            "membership_data_warning": membership_data_warning,

            # Forms
            "form_count": len(form_submissions),

            # Photos/attachments from Forms API
            "photo_count": len(attachments),

            # Installed Equipment at Location
            "installed_equipment": installed_equipment,
            "installed_equipment_count": installed_equipment_count,

            # Invoice Line Items
            "invoice_items": invoice_items,
            "invoice_materials_count": invoice_materials_count,
            "invoice_equipment_count": invoice_equipment_count,
            "invoice_services_count": invoice_services_count,

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
                "installed_equipment": installed_equipment,
                "invoice_items": invoice_items,
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
    
    async def test_task_management_access(self) -> Dict[str, Any]:
        """
        Test if the API credentials have Task Management access.
        Returns task sources, types, and resolutions if accessible.
        """
        try:
            result = await self._request(
                "GET",
                f"taskmanagement/v2/tenant/{self.tenant_id}/data"
            )
            return {
                "has_access": True,
                "task_sources": result.get("taskSources", []),
                "task_types": result.get("taskTypes", []),
                "task_resolutions": result.get("taskResolutions", []),
            }
        except httpx.HTTPStatusError as e:
            return {
                "has_access": False,
                "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}",
            }
        except Exception as e:
            return {
                "has_access": False,
                "error": str(e),
            }

    async def get_employees(self) -> Dict[str, Any]:
        """Get list of employees (for task assignment)."""
        return await self._request(
            "GET",
            f"settings/v2/tenant/{self.tenant_id}/employees",
            params={"active": "true", "pageSize": 200}
        )

    async def create_task(
        self,
        job_id: int,
        task_type_id: int,
        title: str,
        description: str = "",
        due_date: Optional[datetime] = None,
        assigned_to_id: Optional[int] = None,
        reported_by_id: Optional[int] = None,
        business_unit_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Create a task in ServiceTitan Task Management.

        Args:
            job_id: The job ID to associate the task with
            task_type_id: The task type ID (from task management data)
            title: Short title for the task (maps to 'name')
            description: Detailed description/notes (maps to 'body')
            due_date: Optional due date (defaults to tomorrow)
            assigned_to_id: Employee ID to assign task to (required by ST)
            reported_by_id: Employee ID who reported/created the task
            business_unit_id: Business unit ID (will fetch from job if not provided)

        Returns:
            Created task data or error info
        """
        # Task source: "Job" = 27838436
        TASK_SOURCE_JOB = 27838436

        # Get job details for business unit if not provided
        if not business_unit_id:
            try:
                job_data = await self.get_job(job_id)
                business_unit_id = job_data.get("businessUnitId")
            except:
                pass

        # If no assignee provided, we need to get a default employee
        if not assigned_to_id or not reported_by_id:
            try:
                employees_response = await self.get_employees()
                employees = employees_response.get("data", [])
                if employees:
                    default_employee_id = employees[0].get("id")
                    if not assigned_to_id:
                        assigned_to_id = default_employee_id
                    if not reported_by_id:
                        reported_by_id = default_employee_id
            except:
                pass

        # Still need these - if we couldn't get required fields, fail gracefully
        if not assigned_to_id or not reported_by_id:
            return {
                "success": False,
                "error": "Could not determine assignee or reporter for task",
            }

        if not business_unit_id:
            return {
                "success": False,
                "error": "Could not determine business unit for task",
            }

        # Default due date to tomorrow if not specified
        if due_date is None:
            due_date = datetime.utcnow() + timedelta(days=1)

        now = datetime.utcnow()

        # Ensure description is not empty
        task_body = description[:2000] if description else "Follow-up required from debrief"

        payload = {
            "jobId": job_id,
            "taskTypeId": task_type_id,
            "taskSourceId": TASK_SOURCE_JOB,
            "employeeTaskTypeId": task_type_id,
            "employeeTaskSourceId": TASK_SOURCE_JOB,
            "name": title[:100],
            "body": task_body,
            "dueDate": due_date.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "reportedDate": now.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "isClosed": False,
            "priority": "Low",  # Low, Medium, High - using Low as default
            "assignedToId": assigned_to_id,
            "reportedById": reported_by_id,
            "businessUnitId": business_unit_id,
        }

        try:
            result = await self._request(
                "POST",
                f"taskmanagement/v2/tenant/{self.tenant_id}/tasks",
                json=payload
            )
            return {
                "success": True,
                "task_id": result.get("id"),
                "data": result,
            }
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"HTTP {e.response.status_code}: {e.response.text[:500]}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    async def close(self):
        """Close HTTP client."""
        await self._http_client.aclose()


def determine_visit_type(job_type_name: Optional[str], completed_date: Optional[str] = None) -> str:
    """
    Detect if this is a heat tune-up, cool tune-up, or plumbing maintenance.

    For generic HVAC tune-ups (like "T/U-Res-Mem"), uses season to determine type:
    - Nov-Mar: heat tune-up
    - Apr-Oct: cool tune-up

    Note: "inspection" is NOT a tune-up - those are for home sales or plumbing diagnostics.

    Returns: "hvac_heat", "hvac_cool", "plumbing", or "unknown"
    """
    if not job_type_name:
        return "unknown"

    name = job_type_name.lower()

    # Must be a maintenance/tune-up type job (NOT inspection - that's different)
    is_tuneup = any(kw in name for kw in ["tune", "t/u", "maint"])

    if not is_tuneup:
        return "unknown"

    # Heat tune-up - explicit
    if any(kw in name for kw in ["heat", "heating", "furnace"]):
        return "hvac_heat"

    # Cool tune-up - explicit
    if any(kw in name for kw in ["cool", "cooling", "ac", "a/c", "air condition"]):
        return "hvac_cool"

    # Plumbing maintenance
    if "plumb" in name:
        return "plumbing"

    # Generic HVAC tune-up/maintenance - use season to determine heat vs cool
    # Covers: "Maintenance", "Maintenance Commercial", "T/U-Res-Mem", etc.
    # If it's a maintenance job without explicit heat/cool/plumb, it's HVAC
    # Try to determine by season from completed date
    if completed_date:
        try:
            # Parse ISO date like "2025-01-07T15:00:00Z"
            month = int(completed_date[5:7])
            # Nov-Mar = heating season, Apr-Oct = cooling season
            if month in (11, 12, 1, 2, 3):
                return "hvac_heat"
            else:
                return "hvac_cool"
        except:
            pass
    # Default to current season if no date
    from datetime import datetime
    month = datetime.now().month
    if month in (11, 12, 1, 2, 3):
        return "hvac_heat"
    else:
        return "hvac_cool"


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
