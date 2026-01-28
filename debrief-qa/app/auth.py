"""
Google OAuth authentication module with Portal SSO Integration.

Handles:
- Google OAuth flow (login, callback)
- Session management via signed cookies
- User authentication dependencies
- Role-based access control
- Portal SSO validation (validates users against portal_users table)
"""

import os
from datetime import datetime
from typing import Optional
from functools import wraps

import httpx
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

# Portal SSO Configuration
PORTAL_URL = os.getenv("PORTAL_URL", "https://portal.christmasair.com")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET")

# NextAuth cookie names (must match portal's auth.ts config)
# In production: __Secure-next-auth.session-token
# In development: next-auth.session-token
NEXTAUTH_COOKIE_NAME = "__Secure-next-auth.session-token"
NEXTAUTH_COOKIE_NAME_DEV = "next-auth.session-token"

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


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> Dispatcher:
    """
    Get the current user from session with SSO support.
    Raises 401 if not logged in. Use this as a dependency for protected API routes.
    """
    user = get_current_user_optional(request, db)
    if user:
        return user

    # Try SSO auto-login for API requests too
    sso_user = await auto_login_from_portal(request, db)
    if sso_user:
        return sso_user

    raise HTTPException(status_code=401, detail="Not authenticated")


async def require_auth(request: Request, db: Session = Depends(get_db)) -> Dispatcher:
    """
    Async dependency that handles authentication with SSO support.
    Use for HTML page routes.

    SSO Flow:
    1. Check for existing local session
    2. If not found, try SSO auto-login from portal session cookie
    3. If SSO succeeds, user is logged in automatically
    4. If all fails, redirect to login page
    """
    user_id = request.session.get("user_id")

    if user_id:
        # Have local session, validate it
        user = db.query(Dispatcher).filter(
            Dispatcher.id == user_id,
            Dispatcher.is_active == True
        ).first()

        if user:
            return user

        # Invalid session, clear it
        request.session.clear()

    # No valid local session - try SSO auto-login
    sso_user = await auto_login_from_portal(request, db)
    if sso_user:
        return sso_user

    # SSO failed or no portal session - redirect to login
    request.session["next"] = str(request.url)
    raise HTTPException(
        status_code=302,
        headers={"Location": "/login"}
    )


def require_roles(*allowed_roles: DispatcherRole):
    """
    Dependency factory for role-based access control.

    Usage:
        @app.get("/admin")
        async def admin_page(user: Dispatcher = Depends(require_roles(DispatcherRole.ADMIN, DispatcherRole.OWNER))):
            ...
    """
    async def dependency(request: Request, db: Session = Depends(get_db)) -> Dispatcher:
        user = await require_auth(request, db)

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


async def validate_user_with_portal(email: str) -> dict:
    """
    Validate user against the portal_users table via Internal Portal API.

    NOTE: Portal validation is currently OPTIONAL to prevent lockouts.
    If validation fails for any reason, users can still log in with Google OAuth.
    This allows gradual migration to centralized user management.

    Returns:
        dict with:
        - {"valid": True, "user": {...}} if user exists and is active
        - {"valid": True, "user": None, "skipped": True} if validation skipped/failed
    """
    if not INTERNAL_API_SECRET:
        print("WARNING: INTERNAL_API_SECRET not configured - skipping portal validation")
        return {"valid": True, "user": None, "skipped": True}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PORTAL_URL}/api/users/validate",
                json={"email": email},
                headers={"Authorization": f"Bearer {INTERNAL_API_SECRET}"},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                return data
            else:
                # Portal validation failed - allow login anyway (graceful degradation)
                print(f"Portal validation returned {response.status_code} - allowing login anyway")
                return {"valid": True, "user": None, "skipped": True}
    except httpx.TimeoutException:
        print("Portal validation timed out - allowing login as fallback")
        return {"valid": True, "user": None, "timeout": True}
    except Exception as e:
        print(f"Portal validation error: {e} - allowing login anyway")
        # Allow login on portal errors to prevent lockout
        return {"valid": True, "user": None, "error_fallback": True}


async def validate_sso_token(session_token: str) -> dict:
    """
    Validate a NextAuth session token via Portal SSO API.

    This decodes the JWT on the portal side and returns user info.
    Used for true SSO - auto-login when user has portal session.

    Returns:
        dict with:
        - {"valid": True, "user": {...}} if token is valid
        - {"valid": False, "error": str} if validation fails
    """
    if not INTERNAL_API_SECRET:
        return {"valid": False, "error": "SSO not configured"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PORTAL_URL}/api/sso/validate",
                json={"sessionToken": session_token},
                headers={"Authorization": f"Bearer {INTERNAL_API_SECRET}"},
                timeout=10.0
            )

            if response.status_code == 200:
                return response.json()
            else:
                return {"valid": False, "error": f"Token validation failed ({response.status_code})"}
    except httpx.TimeoutException:
        return {"valid": False, "error": "SSO validation timed out"}
    except Exception as e:
        print(f"SSO token validation error: {e}")
        return {"valid": False, "error": str(e)}


def get_nextauth_session_token(request: Request) -> Optional[str]:
    """
    Extract NextAuth session token from cookies.

    Checks both production (__Secure-next-auth.session-token) and
    development (next-auth.session-token) cookie names.
    """
    # Try production cookie first
    token = request.cookies.get(NEXTAUTH_COOKIE_NAME)
    if token:
        return token

    # Fall back to development cookie
    token = request.cookies.get(NEXTAUTH_COOKIE_NAME_DEV)
    return token


async def auto_login_from_portal(request: Request, db: Session) -> Optional[Dispatcher]:
    """
    Attempt automatic login using Portal SSO session.

    If user has a valid NextAuth session from portal, automatically
    create/update local session without requiring Google OAuth flow.

    Returns:
        Dispatcher if SSO login successful, None otherwise
    """
    session_token = get_nextauth_session_token(request)
    if not session_token:
        return None

    # Validate token with portal
    result = await validate_sso_token(session_token)
    if not result.get("valid"):
        return None

    portal_user = result.get("user")
    if not portal_user:
        return None

    email = portal_user.get("email", "").lower()
    name = portal_user.get("name") or email.split("@")[0]

    # Look up or create local user
    user = db.query(Dispatcher).filter(Dispatcher.email == email).first()

    if not user:
        # Auto-create from portal
        role = map_portal_role_to_dispatcher_role(
            portal_user.get("role", "employee"),
            portal_user.get("permissions")
        )

        user = Dispatcher(
            name=name,
            email=email,
            role=role,
            is_active=True,
            last_login=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"SSO: Auto-created local user from portal: {email}")
    else:
        if not user.is_active:
            return None

        # Sync role from portal
        new_role = map_portal_role_to_dispatcher_role(
            portal_user.get("role", "employee"),
            portal_user.get("permissions")
        )
        if user.role != new_role:
            user.role = new_role

        user.last_login = datetime.utcnow()
        if not user.name or user.name == email:
            user.name = name

        db.commit()

    # Create local session
    create_session(request, user)
    print(f"SSO: Auto-logged in {email} from portal session")

    return user


def map_portal_role_to_dispatcher_role(portal_role: str, portal_permissions: dict) -> DispatcherRole:
    """
    Map portal role and permissions to debrief-qa DispatcherRole.

    Portal roles: owner, manager, employee
    Debrief roles: owner, admin, manager, dispatcher

    Also checks debrief_qa specific permissions.
    """
    if portal_role == "owner":
        return DispatcherRole.OWNER

    # Check for admin-level debrief permissions
    debrief_perms = portal_permissions.get("debrief_qa", {}) if portal_permissions else {}
    if debrief_perms.get("can_manage_users"):
        return DispatcherRole.ADMIN

    if portal_role == "manager":
        return DispatcherRole.MANAGER

    return DispatcherRole.DISPATCHER


async def handle_google_callback(request: Request, db: Session) -> dict:
    """
    Process Google OAuth callback and return user info or error.

    This function now integrates with Portal SSO:
    1. Validates Google OAuth token
    2. Validates user exists in portal_users (SSO check)
    3. Creates/updates local Dispatcher record synced with portal
    4. Returns user for session creation

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

    # ===== Portal SSO Validation =====
    # Validate user exists and is active in the central portal_users table
    portal_result = await validate_user_with_portal(email)

    if not portal_result.get("valid"):
        return {
            "success": False,
            "error": portal_result.get("error", "Portal validation failed"),
            "error_code": "portal_validation_failed"
        }

    portal_user = portal_result.get("user")

    # ===== Local User Management =====
    # Look up or create local Dispatcher record
    user = db.query(Dispatcher).filter(Dispatcher.email == email).first()

    if not user:
        # User exists in portal but not locally - auto-create
        # This allows portal admins to provision users without touching debrief-qa
        role = DispatcherRole.DISPATCHER
        if portal_user:
            role = map_portal_role_to_dispatcher_role(
                portal_user.get("role", "employee"),
                portal_user.get("permissions")
            )

        user = Dispatcher(
            name=name,
            email=email,
            google_id=google_id,
            role=role,
            is_active=True,
            last_login=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Auto-created local user from portal: {email} with role {role.value}")
    else:
        if not user.is_active:
            return {
                "success": False,
                "error": "Your account has been deactivated. Please contact an administrator.",
                "error_code": "inactive"
            }

        # Sync role from portal if available
        if portal_user:
            new_role = map_portal_role_to_dispatcher_role(
                portal_user.get("role", "employee"),
                portal_user.get("permissions")
            )
            if user.role != new_role:
                print(f"Syncing role for {email}: {user.role.value} -> {new_role.value}")
                user.role = new_role

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
