import httpx
from fastapi import HTTPException

from app.core.config import get_settings


async def verify_google_id_token(id_token: str) -> dict:
    settings = get_settings()
    token_info_url = "https://oauth2.googleapis.com/tokeninfo"

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(token_info_url, params={"id_token": id_token})

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    payload = response.json()
    audience = payload.get("aud")
    if settings.google_client_id and audience != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Google audience mismatch")

    email = payload.get("email")
    sub = payload.get("sub")
    name = payload.get("name") or "Google User"
    if not email or not sub:
        raise HTTPException(status_code=401, detail="Google token payload missing required claims")
    if payload.get("email_verified") not in ("true", True):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    return {"email": email, "sub": sub, "name": name}
