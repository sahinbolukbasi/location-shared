from datetime import datetime

from pydantic import BaseModel, Field


class ShareCodeCreateRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_name: str = Field(min_length=1, max_length=150)


class ShareCodeResponse(BaseModel):
    code: str
    latitude: float
    longitude: float
    location_name: str
    expires_at: datetime
