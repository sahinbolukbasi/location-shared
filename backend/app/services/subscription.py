from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.models import Location, User

FREE_LOCATION_LIMIT = 5


def get_location_limit(user: User) -> int:
    if user.plan == "pro" and user.subscription_status == "active":
        return 1000000
    return FREE_LOCATION_LIMIT


def user_location_count(db: Session, user_id: str) -> int:
    return db.scalar(select(func.count(Location.id)).where(Location.user_id == user_id)) or 0


def can_create_location(db: Session, user: User) -> bool:
    return user_location_count(db, user.id) < get_location_limit(user)
