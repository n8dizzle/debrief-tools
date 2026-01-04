"""
Slack integration for debrief notifications.

Sends follow-up alerts to a designated channel when dispatchers
flag jobs requiring attention.
"""

import os
import httpx
from typing import Optional, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")  # For more advanced features
SLACK_FOLLOWUP_CHANNEL = os.getenv("SLACK_FOLLOWUP_CHANNEL", "#debrief-followups")


async def send_followup_notification(
    job_id: int,
    job_number: str,
    customer_name: str,
    tech_name: str,
    followup_type: str,
    followup_description: str,
    dispatcher_name: str,
    assigned_to: Optional[str] = None,
    debrief_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send a Slack notification for a debrief follow-up.
    
    Returns:
        {"success": bool, "thread_ts": str or None, "error": str or None}
    """
    if not SLACK_WEBHOOK_URL:
        return {"success": False, "thread_ts": None, "error": "Slack webhook not configured"}
    
    # Format follow-up type for display
    type_labels = {
        "tech_coaching": "🎓 Tech Coaching",
        "manager_review": "👔 Manager Review",
        "customer_callback": "📞 Customer Callback",
        "st_task": "📋 ST Task Created",
        "billing": "💰 Billing Issue",
        "quality": "⚠️ Quality Issue",
        "other": "📌 Other",
    }
    type_label = type_labels.get(followup_type, followup_type)
    
    # Build message blocks
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"🚨 Debrief Follow-up Required",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Job:*\n#{job_number}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Customer:*\n{customer_name}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Technician:*\n{tech_name}"
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Type:*\n{type_label}"
                }
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Description:*\n{followup_description or 'No details provided'}"
            }
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Flagged by *{dispatcher_name}* at {datetime.now().strftime('%I:%M %p')}"
                }
            ]
        }
    ]
    
    # Add assigned to if specified
    if assigned_to:
        blocks.insert(3, {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Assigned to:* {assigned_to}"
            }
        })
    
    # Add link to debrief if available
    if debrief_url:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "View Debrief",
                        "emoji": True
                    },
                    "url": debrief_url,
                    "action_id": "view_debrief"
                }
            ]
        })
    
    # Add divider at the end
    blocks.append({"type": "divider"})
    
    payload = {
        "blocks": blocks,
        "text": f"Follow-up required for Job #{job_number} - {type_label}",  # Fallback text
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                SLACK_WEBHOOK_URL,
                json=payload,
                timeout=10.0
            )
            
            if response.status_code == 200:
                return {"success": True, "thread_ts": None, "error": None}
            else:
                return {
                    "success": False, 
                    "thread_ts": None, 
                    "error": f"Slack API error: {response.status_code}"
                }
                
    except Exception as e:
        return {"success": False, "thread_ts": None, "error": str(e)}


async def send_simple_notification(message: str) -> bool:
    """Send a simple text notification to Slack."""
    if not SLACK_WEBHOOK_URL:
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                SLACK_WEBHOOK_URL,
                json={"text": message},
                timeout=10.0
            )
            return response.status_code == 200
    except:
        return False


async def send_daily_summary(
    total_jobs: int,
    debriefed: int,
    pending: int,
    followups_created: int,
) -> bool:
    """Send end-of-day summary to Slack."""
    if not SLACK_WEBHOOK_URL:
        return False
    
    completion_rate = (debriefed / total_jobs * 100) if total_jobs > 0 else 100
    emoji = "🎉" if completion_rate >= 100 else "⚠️" if completion_rate >= 90 else "🚨"
    
    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} Daily Debrief Summary",
                "emoji": True
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Jobs Completed:*\n{total_jobs}"},
                {"type": "mrkdwn", "text": f"*Debriefed:*\n{debriefed}"},
                {"type": "mrkdwn", "text": f"*Pending:*\n{pending}"},
                {"type": "mrkdwn", "text": f"*Completion Rate:*\n{completion_rate:.0f}%"},
            ]
        },
    ]
    
    if followups_created > 0:
        blocks.append({
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"📌 {followups_created} follow-ups flagged today"}
            ]
        })
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                SLACK_WEBHOOK_URL,
                json={"blocks": blocks},
                timeout=10.0
            )
            return response.status_code == 200
    except:
        return False
