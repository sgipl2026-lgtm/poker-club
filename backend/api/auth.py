from __future__ import annotations

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from config import get_settings

bearer = HTTPBearer(auto_error=False)


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        # Detect which algorithm Supabase is using for this project
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            # Older Supabase projects — verify with JWT secret
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            # Newer Supabase projects use RS256
            # Decode without signature verification but still check expiry
            payload = jwt.decode(
                token,
                key="",
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                    "verify_exp": True,
                },
                algorithms=["RS256"],
            )

        user_id   = payload.get("sub")
        user_meta = payload.get("user_metadata") or {}
        app_meta  = payload.get("app_metadata")  or {}

        # Try several places Supabase may store the username
        username = (
            user_meta.get("username")
            or user_meta.get("name")
            or app_meta.get("username")
            or payload.get("email", "Player").split("@")[0]
        )
        email = payload.get("email", "")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user id")

        return {"user_id": user_id, "username": username, "email": email}

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token invalid: {e}")


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="No credentials provided")
    return verify_token(creds.credentials)


def extract_token_from_query(token: str) -> dict:
    """Used for WebSocket auth where headers are not available (WebSocket)."""
    return verify_token(token)
