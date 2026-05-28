from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.models import PaymentRecord, User, UserAccountProfile
from app.schemas.profile import (
    PasswordChangeRequest,
    PasswordChangeResponse,
    PaymentHistoryItem,
    ProfileResponse,
    ProfileUpdateRequest,
)
from app.services.subscription import get_location_limit

router = APIRouter(prefix="/profile", tags=["profile"])


def get_or_create_profile(db: Session, user: User) -> UserAccountProfile:
    profile = db.scalar(select(UserAccountProfile).where(UserAccountProfile.user_id == user.id))
    if profile:
        return profile

    profile = UserAccountProfile(user_id=user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ProfileResponse:
    profile = get_or_create_profile(db, current_user)
    return ProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        username=profile.username,
        profile_image_data=profile.profile_image_data,
        plan=current_user.plan,
        subscription_status=current_user.subscription_status,
        location_limit=get_location_limit(current_user),
    )


@router.put("", response_model=ProfileResponse)
@router.patch("", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    profile = get_or_create_profile(db, current_user)

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()

    if payload.username is not None:
        normalized_username = payload.username.strip().lower() or None
        if normalized_username:
            conflict = db.scalar(
                select(UserAccountProfile).where(
                    UserAccountProfile.username == normalized_username,
                    UserAccountProfile.user_id != current_user.id,
                )
            )
            if conflict:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken")
        profile.username = normalized_username

    if payload.profile_image_data is not None:
        profile.profile_image_data = payload.profile_image_data or None

    db.commit()
    db.refresh(current_user)
    db.refresh(profile)

    return ProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        username=profile.username,
        profile_image_data=profile.profile_image_data,
        plan=current_user.plan,
        subscription_status=current_user.subscription_status,
        location_limit=get_location_limit(current_user),
    )


@router.post("/change-password", response_model=PasswordChangeResponse)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PasswordChangeResponse:
    if current_user.password_hash:
        if not payload.current_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required")
        if not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    elif payload.current_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is not set for this account")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return PasswordChangeResponse(message="Password updated successfully")


@router.get("/payments", response_model=list[PaymentHistoryItem])
def list_payments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[PaymentRecord]:
    statement = (
        select(PaymentRecord)
        .where(PaymentRecord.user_id == current_user.id)
        .order_by(PaymentRecord.created_at.desc())
    )
    return list(db.scalars(statement))
