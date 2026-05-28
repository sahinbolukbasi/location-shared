from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import Location, User
from app.schemas.location import LocationCreateRequest, LocationResponse
from app.services.subscription import can_create_location

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationResponse])
def list_locations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Location]:
    statement = select(Location).where(Location.user_id == current_user.id).order_by(Location.created_at.desc())
    return list(db.scalars(statement))


@router.post("", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: LocationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Location:
    if not can_create_location(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Free plan allows up to 5 saved locations. Upgrade to continue.",
        )

    location = Location(
        user_id=current_user.id,
        name=payload.name,
        note=payload.note,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    location = db.scalar(
        select(Location).where(Location.id == location_id, Location.user_id == current_user.id)
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    db.delete(location)
    db.commit()


@router.put("/{location_id}", response_model=LocationResponse)
@router.patch("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: str,
    payload: LocationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Location:
    location = db.scalar(
        select(Location).where(Location.id == location_id, Location.user_id == current_user.id)
    )
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    location.name = payload.name
    location.note = payload.note
    location.latitude = payload.latitude
    location.longitude = payload.longitude

    db.commit()
    db.refresh(location)
    return location
