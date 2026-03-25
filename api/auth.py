"""
poker-app/backend/api/auth.py

JWT verification against Supabase-issued tokens.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config import get_settings

bearer = HTTPBearer(auto_error=False)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id  = payload.get("sub")
        username = (payload.get("user_metadata") or {}).get("username", "Player")
        email    = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {"user_id": user_id, "username": username, "email": email}
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}")


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="No credentials")
    return verify_token(creds.credentials)


def extract_token_from_query(token: str) -> dict:
    """Used for WebSocket auth where headers aren't available."""
    return verify_token(token)
