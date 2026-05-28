# API Overview

Base path: `/api/v1`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `GET /auth/me`

## Locations

- `GET /locations`
- `POST /locations`
- `DELETE /locations/{location_id}`

`POST /locations` enforces subscription limits (5 free).

## Share Codes

- `POST /share-codes` (auth required)
- `GET /share-codes/{code}` (public)
- `DELETE /share-codes/{code}` (owner only)

## Subscription

- `GET /subscription`
- `POST /subscription/checkout-session`
- `POST /subscription/webhook`

Stripe webhook updates plan and subscription status.
