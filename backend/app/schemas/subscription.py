from pydantic import BaseModel


class SubscriptionStatusResponse(BaseModel):
    plan: str
    subscription_status: str
    location_limit: int


class CheckoutSessionRequest(BaseModel):
    success_url: str
    cancel_url: str


class CheckoutSessionResponse(BaseModel):
    checkout_url: str
