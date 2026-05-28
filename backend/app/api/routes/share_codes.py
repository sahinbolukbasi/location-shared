from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import ShareCode, User
from app.schemas.share_code import ShareCodeCreateRequest, ShareCodeResponse
from app.services.share_code import create_unique_code, default_expiration

router = APIRouter(prefix="/share-codes", tags=["share-codes"])


@router.post("", response_model=ShareCodeResponse, status_code=status.HTTP_201_CREATED)
def create_code(
    payload: ShareCodeCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareCode:
    code = create_unique_code(db)
    entity = ShareCode(
        code=code,
        user_id=current_user.id,
        location_name=payload.location_name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        expires_at=default_expiration(),
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
    return entity


@router.get("/{code}", response_model=ShareCodeResponse)
def resolve_code(code: str, db: Session = Depends(get_db)) -> ShareCode:
    entity = db.scalar(select(ShareCode).where(ShareCode.code == code))
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code not found")

    if entity.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Code expired")

    entity.uses += 1
    db.commit()
    db.refresh(entity)
    return entity


@router.delete("/{code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    entity = db.scalar(select(ShareCode).where(ShareCode.code == code, ShareCode.user_id == current_user.id))
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Code not found")
    db.delete(entity)
    db.commit()
