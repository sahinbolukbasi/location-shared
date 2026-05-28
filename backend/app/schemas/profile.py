from datetime import datetime

from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    username: str | None
    profile_image_data: str | None
    plan: str
    subscription_status: str
    location_limit: int


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    username: str | None = Field(default=None, min_length=3, max_length=60)
    profile_image_data: str | None = Field(default=None, max_length=2000000)


class PasswordChangeRequest(BaseModel):
    current_password: str | None = Field(default=None)
    new_password: str = Field(min_length=8, max_length=128)


class PasswordChangeResponse(BaseModel):
    message: str


class PaymentHistoryItem(BaseModel):
    id: str
    amount_cents: int
    currency: str
    status: str
    paid_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True
