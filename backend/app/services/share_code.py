import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import ShareCode


def create_unique_code(db: Session, tries: int = 20) -> str:
    for _ in range(tries):
        candidate = f"{random.randint(0, 999999):06d}"
        exists = db.scalar(select(ShareCode.id).where(ShareCode.code == candidate))
        if not exists:
            return candidate
    raise ValueError("Could not create unique code")


def default_expiration(days: int = 7) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)
