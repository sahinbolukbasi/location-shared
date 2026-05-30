import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.models import PaymentRecord, User
from app.schemas.subscription import CheckoutSessionRequest, CheckoutSessionResponse, SubscriptionStatusResponse
from app.services.subscription import get_location_limit

router = APIRouter(prefix="/subscription", tags=["subscription"])


@router.get("", response_model=SubscriptionStatusResponse)
def current_subscription(current_user: User = Depends(get_current_user)) -> SubscriptionStatusResponse:
    return SubscriptionStatusResponse(
        plan=current_user.plan,
        subscription_status=current_user.subscription_status,
        location_limit=get_location_limit(current_user),
    )


@router.post("/checkout-session", response_model=CheckoutSessionResponse)
def create_checkout_session(
    payload: CheckoutSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckoutSessionResponse:
    settings = get_settings()
    if not settings.stripe_secret_key or not settings.stripe_pro_price_id:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Stripe is not configured")

    stripe.api_key = settings.stripe_secret_key

    customer_id = current_user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(email=current_user.email, name=current_user.full_name)
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        db.commit()

    checkout = stripe.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
        success_url=payload.success_url,
        cancel_url=payload.cancel_url,
        metadata={"user_id": current_user.id},
    )

    return CheckoutSessionResponse(checkout_url=checkout.url)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    settings = get_settings()
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Stripe webhook is not configured")

    stripe.api_key = settings.stripe_secret_key
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, settings.stripe_webhook_secret)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook") from error

    if event["type"] == "checkout.session.completed":
        session_data = event["data"]["object"]
        user_id = session_data.get("metadata", {}).get("user_id")
        if user_id:
            user = db.scalar(select(User).where(User.id == user_id))
            if user:
                user.plan = "pro"
                user.subscription_status = "active"
                user.stripe_subscription_id = session_data.get("subscription")
                user.stripe_customer_id = session_data.get("customer") or user.stripe_customer_id
                db.commit()

    if event["type"] in {"invoice.paid", "invoice.payment_failed"}:
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        invoice_id = invoice.get("id")
        amount_cents = int(invoice.get("amount_paid") or invoice.get("amount_due") or 0)
        currency = (invoice.get("currency") or "usd").lower()
        status_value = "paid" if event["type"] == "invoice.paid" else "failed"
        paid_at_value = datetime.now(timezone.utc) if event["type"] == "invoice.paid" else None

        user = db.scalar(select(User).where(User.stripe_customer_id == customer_id))
        if user and invoice_id:
            payment = db.scalar(select(PaymentRecord).where(PaymentRecord.stripe_invoice_id == invoice_id))
            if payment:
                payment.amount_cents = amount_cents
                payment.currency = currency
                payment.status = status_value
                payment.paid_at = paid_at_value
            else:
                db.add(
                    PaymentRecord(
                        user_id=user.id,
                        stripe_invoice_id=invoice_id,
                        amount_cents=amount_cents,
                        currency=currency,
                        status=status_value,
                        paid_at=paid_at_value,
                    )
                )

            if event["type"] == "invoice.paid":
                user.plan = "pro"
                user.subscription_status = "active"
            else:
                user.subscription_status = "past_due"
            db.commit()

    if event["type"] == "customer.subscription.deleted":
        subscription_data = event["data"]["object"]
        customer_id = subscription_data.get("customer")
        user = db.scalar(select(User).where(User.stripe_customer_id == customer_id))
        if user:
            user.subscription_status = "canceled"
            user.plan = "free"
            user.stripe_subscription_id = None
            db.commit()

    return {"status": "ok"}
