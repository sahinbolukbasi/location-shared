from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    note: str | None = Field(default=None, max_length=1000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LocationResponse(BaseModel):
    id: str
    name: str
    note: str | None
    latitude: float
    longitude: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
