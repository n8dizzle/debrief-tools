#!/usr/bin/env python3
"""
Test script to download a photo from ServiceTitan.

Usage:
    python scripts/test_photo_download.py JOB_ID

Requires .env file with ST credentials.
"""

import os
import sys
import httpx
from dotenv import load_dotenv

load_dotenv()

# Config
CLIENT_ID = os.getenv("ST_CLIENT_ID")
CLIENT_SECRET = os.getenv("ST_CLIENT_SECRET")
TENANT_ID = os.getenv("ST_TENANT_ID")
APP_KEY = os.getenv("ST_APP_KEY")

BASE_URL = "https://api.servicetitan.io"
AUTH_URL = "https://auth.servicetitan.io/connect/token"


def get_token():
    """Get access token."""
    response = httpx.post(
        AUTH_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        }
    )
    response.raise_for_status()
    return response.json()["access_token"]


def get_attachments(token, job_id):
    """Get attachments for a job."""
    url = f"{BASE_URL}/forms/v2/tenant/{TENANT_ID}/jobs/{job_id}/attachments"
    headers = {
        "Authorization": f"Bearer {token}",
        "ST-App-Key": APP_KEY,
    }
    response = httpx.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


def get_form_submissions(token, job_id):
    """Get form submissions and filter by job."""
    url = f"{BASE_URL}/forms/v2/tenant/{TENANT_ID}/submissions"
    headers = {
        "Authorization": f"Bearer {token}",
        "ST-App-Key": APP_KEY,
    }
    params = {"pageSize": 200}
    response = httpx.get(url, headers=headers, params=params)
    response.raise_for_status()

    all_submissions = response.json().get("data", [])

    # Filter by job ID in owners array
    job_submissions = [
        s for s in all_submissions
        if any(
            o.get("type") == "Job" and o.get("id") == int(job_id)
            for o in s.get("owners", [])
        )
    ]
    return job_submissions


def download_attachment(token, attachment_url, filename):
    """Download an attachment to a file."""
    headers = {
        "Authorization": f"Bearer {token}",
        "ST-App-Key": APP_KEY,
    }
    response = httpx.get(attachment_url, headers=headers, follow_redirects=True)
    response.raise_for_status()

    with open(filename, "wb") as f:
        f.write(response.content)
    return filename


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_photo_download.py JOB_ID")
        print("\nExample: python scripts/test_photo_download.py 12345678")
        sys.exit(1)

    job_id = sys.argv[1]
    print(f"\n🔍 Testing photo download for Job ID: {job_id}")
    print("=" * 50)

    # Get token
    print("\n1. Getting access token...")
    token = get_token()
    print("   ✅ Token acquired")

    # Get attachments
    print(f"\n2. Fetching attachments from forms/v2/jobs/{job_id}/attachments...")
    attachments_data = get_attachments(token, job_id)
    attachments = attachments_data.get("data", [])
    print(f"   Found {len(attachments)} attachments")

    if attachments:
        print("\n   Attachments:")
        for i, att in enumerate(attachments):
            print(f"   [{i}] {att.get('name', 'unnamed')} - {att.get('contentType', 'unknown type')}")
            print(f"       URL: {att.get('url', 'no url')[:80]}...")

    # Get form submissions
    print(f"\n3. Fetching form submissions...")
    submissions = get_form_submissions(token, job_id)
    print(f"   Found {len(submissions)} form submissions for this job")

    if submissions:
        for sub in submissions:
            form_name = sub.get("formName", "Unknown Form")
            fields = sub.get("fields", [])
            photo_fields = [f for f in fields if f.get("type") == "Photo" or "photo" in f.get("name", "").lower()]
            print(f"   - {form_name}: {len(photo_fields)} photo fields")
            for pf in photo_fields:
                print(f"     → {pf.get('name')}: {pf.get('value', 'no value')[:60]}...")

    # Try to download first attachment
    if attachments:
        print("\n4. Attempting to download first attachment...")
        att = attachments[0]
        url = att.get("url")
        if url:
            ext = att.get("contentType", "").split("/")[-1] or "jpg"
            filename = f"test_photo.{ext}"
            try:
                download_attachment(token, url, filename)
                print(f"   ✅ Downloaded to: {filename}")
                print(f"   Open with: open {filename}")
            except Exception as e:
                print(f"   ❌ Download failed: {e}")
        else:
            print("   ❌ No URL in attachment")
    else:
        print("\n4. No attachments to download")

    print("\n" + "=" * 50)
    print("Done!")


if __name__ == "__main__":
    main()
