"""
Google OAuth authentication module.

Handles:
- Google OAuth flow (login, callback)
- Session management via signed cookies
- User authentication dependencies
- Role-based access control
"""

import os
from datetime import datetime
from typing import Optional
from functools import wraps

from fastapi import Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy.orm import Session

from .database import get_db, Dispatcher, DispatcherRole

# OAuth configuration
oauth = OAuth()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
ALLOWED_DOMAIN = "christmasair.com"

# Register Google OAuth
oauth.register(
    name='google',
    client_id=GOOGLE_CLIENT_ID,
    client_secret=GOOGLE_CLIENT_SECRET,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[Dispatcher]:
    """
    Get the current user from session, or None if not logged in.
    Use this for routes that work both logged in and out.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return None

    user = db.query(Dispatcher).filter(
        Dispatcher.id == user_id,
        Dispatcher.is_active == True
    ).first()

    return user


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Dispatcher:
    """
    Get the current user from session. Raises 401 if not logged in.
    Use this as a dependency for protected routes.
    """
    user = get_current_user_optional(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def require_auth(request: Request, db: Session = Depends(get_db)) -> Dispatcher:
    """
    Dependency that redirects to login if not authenticated.
    Use for HTML page routes.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        # Store the original URL to redirect back after login
        request.session["next"] = str(request.url)
        raise HTTPException(
            status_code=302,
            headers={"Location": "/login"}
        )

    user = db.query(Dispatcher).filter(
        Dispatcher.id == user_id,
        Dispatcher.is_active == True
    ).first()

    if not user:
        request.session.clear()
        raise HTTPException(
            status_code=302,
            headers={"Location": "/login?error=inactive"}
        )

    return user


def require_roles(*allowed_roles: DispatcherRole):
    """
    Dependency factory for role-based access control.

    Usage:
        @app.get("/admin")
        async def admin_page(user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))):
            ...
    """
    def dependency(request: Request, db: Session = Depends(get_db)) -> Dispatcher:
        user = require_auth(request, db)

        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to access this page"
            )

        return user

    return dependency


def is_admin(user: Optional[Dispatcher]) -> bool:
    """Check if user has admin privileges (Admin or Owner)."""
    if not user:
        return False
    return user.role in [DispatcherRole.ADMIN, DispatcherRole.OWNER]


def is_owner(user: Optional[Dispatcher]) -> bool:
    """Check if user is the Owner."""
    if not user:
        return False
    return user.role == DispatcherRole.OWNER


async def handle_google_callback(request: Request, db: Session) -> dict:
    """
    Process Google OAuth callback and return user info or error.

    Returns:
        dict with either:
        - {"success": True, "user": Dispatcher}
        - {"success": False, "error": str, "error_code": str}
    """
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to get access token: {str(e)}",
            "error_code": "token_error"
        }

    # Get user info from Google
    user_info = token.get("userinfo")
    if not user_info:
        return {
            "success": False,
            "error": "Could not get user info from Google",
            "error_code": "userinfo_error"
        }

    email = user_info.get("email", "").lower()
    google_id = user_info.get("sub")
    name = user_info.get("name", email.split("@")[0])

    # Check domain restriction
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        return {
            "success": False,
            "error": f"Only @{ALLOWED_DOMAIN} email addresses are allowed",
            "error_code": "domain_error"
        }

    # Look up user by email
    user = db.query(Dispatcher).filter(Dispatcher.email == email).first()

    if not user:
        return {
            "success": False,
            "error": "Your account hasn't been set up yet. Please contact an administrator.",
            "error_code": "no_account"
        }

    if not user.is_active:
        return {
            "success": False,
            "error": "Your account has been deactivated. Please contact an administrator.",
            "error_code": "inactive"
        }

    # Update user with Google info and last login
    user.google_id = google_id
    user.last_login = datetime.utcnow()
    if not user.name or user.name == email:
        user.name = name  # Update name from Google if not set

    db.commit()

    return {"success": True, "user": user}


def create_session(request: Request, user: Dispatcher):
    """Create a session for the authenticated user."""
    request.session["user_id"] = user.id
    request.session["user_email"] = user.email
    request.session["user_role"] = user.role.value


def clear_session(request: Request):
    """Clear the user session (logout)."""
    request.session.clear()
