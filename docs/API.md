# API Reference

Complete REST API documentation for the Location Shared backend.

> **Interactive docs**: http://api.location-shared.4.231.68.185.sslip.io/docs (Swagger UI)  
> **Base URL (dev)**: `http://api.location-shared.4.231.68.185.sslip.io`  
> **API prefix**: `/api/v1`

---

## Authentication

All protected endpoints require a JWT bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via the `/api/v1/auth/login`, `/api/v1/auth/register`, or `/api/v1/auth/google` endpoints.

| Token type | Lifetime | Purpose |
|---|---|---|
| Access token | 30 minutes | Authenticate API requests |
| Refresh token | 7 days | Obtain a new access token (not yet wired to an endpoint) |

---

## Health

### `GET /health`

Liveness probe — no authentication required.

**Response `200 OK`**
```json
{ "status": "ok" }
```

---

## Auth — `/api/v1/auth`

### `POST /api/v1/auth/register`

Create a new account with email and password.

**Request body**
```json
{
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "password": "s3cur3P@ssw0rd"
}
```

**Response `201 Created`**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer"
}
```

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `409 Conflict` | Email already registered | Duplicate email |

---

### `POST /api/v1/auth/login`

Authenticate with email and password.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "s3cur3P@ssw0rd"
}
```

**Response `200 OK`** — same `TokenResponse` as register.

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `401 Unauthorized` | Invalid credentials | Wrong email or password |

---

### `POST /api/v1/auth/google`

Authenticate or register via Google OAuth.

The frontend obtains a Google ID token from the Google Sign-In SDK and forwards it here. A new account is created automatically on first login.

**Request body**
```json
{
  "id_token": "<google-id-token>"
}
```

**Response `200 OK`** — same `TokenResponse` as register.

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `401 Unauthorized` | Invalid Google token | Token verification failed |

---

### `GET /api/v1/auth/me`

Return the authenticated user's profile.

**Auth**: Required

**Response `200 OK`**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "Jane Doe",
  "plan": "free",
  "subscription_status": "inactive",
  "location_limit": 5
}
```

> `location_limit` is `5` for `free` plan, `null` (unlimited) for `pro` plan.

---

## Locations — `/api/v1/locations`

**Auth**: Required on all endpoints.

### `GET /api/v1/locations`

List all saved locations for the authenticated user, newest first.

**Response `200 OK`**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Home",
    "note": "Front door code: 1234",
    "latitude": 52.3676,
    "longitude": 4.9041,
    "created_at": "2026-05-01T10:00:00Z",
    "updated_at": "2026-05-01T10:00:00Z"
  }
]
```

---

### `POST /api/v1/locations`

Save a new location.

> Free plan users are limited to **5 locations**. Upgrade to Pro to save unlimited locations.

**Request body**
```json
{
  "name": "Office",
  "note": "Second floor, desk 22",
  "latitude": 52.3676,
  "longitude": 4.9041
}
```

**Response `201 Created`** — full `LocationResponse` object.

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `402 Payment Required` | Free plan limit reached | 5 locations already saved; upgrade required |

---

### `PUT /api/v1/locations/{location_id}`  
### `PATCH /api/v1/locations/{location_id}`

Update an existing location. Both `PUT` and `PATCH` replace all editable fields.

**Path param**: `location_id` — UUID of the location.

**Request body**: Same as `POST /locations`.

**Response `200 OK`** — updated `LocationResponse`.

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `404 Not Found` | Location not found | ID does not exist or belongs to another user |

---

### `DELETE /api/v1/locations/{location_id}`

Delete a saved location.

**Response `204 No Content`**

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `404 Not Found` | Location not found | ID does not exist or belongs to another user |

---

## Share Codes — `/api/v1/share-codes`

Share codes let authenticated users share a location snapshot with anyone — no account required on the recipient side.

### `POST /api/v1/share-codes`

Create a new share code for a coordinate pair.

**Auth**: Required

**Request body**
```json
{
  "location_name": "My Office",
  "latitude": 52.3676,
  "longitude": 4.9041
}
```

**Response `201 Created`**
```json
{
  "id": "uuid",
  "code": "A1B2C3",
  "user_id": "uuid",
  "location_name": "My Office",
  "latitude": 52.3676,
  "longitude": 4.9041,
  "uses": 0,
  "expires_at": "2026-05-30T10:00:00Z",
  "created_at": "2026-05-29T10:00:00Z"
}
```

> Codes expire **24 hours** after creation (configurable via `default_expiration` in `services/share_code.py`).

---

### `GET /api/v1/share-codes/{code}`

Resolve a share code and return the associated coordinates.

**Auth**: Not required — anyone with the code can access this endpoint.

**Path param**: `code` — the 6-character share code.

**Response `200 OK`** — `ShareCodeResponse` (same schema as above; `uses` counter is incremented).

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `404 Not Found` | Code not found | Invalid code |
| `410 Gone` | Code expired | Code existed but has passed its `expires_at` |

---

### `DELETE /api/v1/share-codes/{code}`

Revoke a share code.

**Auth**: Required (only the code owner can delete).

**Response `204 No Content`**

**Errors**
| Status | Detail | Cause |
|---|---|---|
| `404 Not Found` | Code not found | Code does not exist or belongs to another user |

---

## Profile — `/api/v1/profile`

### `GET /api/v1/profile`

Return the authenticated user's public profile.

**Auth**: Required

**Response `200 OK`**
```json
{
  "user_id": "uuid",
  "username": "janedoe",
  "profile_image_data": null
}
```

---

### `PUT /api/v1/profile`

Update username or profile image.

**Auth**: Required

**Request body**
```json
{
  "username": "janedoe",
  "profile_image_data": "<base64-encoded-image>"
}
```

**Response `200 OK`** — updated `ProfileResponse`.

---

## Subscriptions — `/api/v1/subscriptions`

Stripe-backed subscription management.

### `POST /api/v1/subscriptions/checkout`

Create a Stripe Checkout session for the Pro plan upgrade.

**Auth**: Required

**Response `200 OK`**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/..."
}
```

---

### `POST /api/v1/subscriptions/portal`

Create a Stripe Customer Portal session (manage/cancel subscription).

**Auth**: Required

**Response `200 OK`**
```json
{
  "portal_url": "https://billing.stripe.com/p/session/..."
}
```

---

### `POST /api/v1/subscriptions/webhook`

Stripe webhook endpoint. Handles `checkout.session.completed` and `customer.subscription.deleted` events to sync subscription state to the database.

**Auth**: Stripe signature verification (`Stripe-Signature` header + `STRIPE_WEBHOOK_SECRET`).

> This endpoint is called by Stripe, not by the application frontend. Configure it in **Stripe Dashboard → Webhooks**.

---

## Common Error Responses

| Status | Meaning |
|---|---|
| `400 Bad Request` | Request body validation failed (Pydantic) |
| `401 Unauthorized` | Missing, invalid, or expired JWT |
| `402 Payment Required` | Plan limit reached |
| `403 Forbidden` | Action not allowed for this user |
| `404 Not Found` | Resource does not exist (or belongs to another user) |
| `409 Conflict` | Unique constraint violation (e.g., duplicate email) |
| `410 Gone` | Resource existed but has expired |
| `422 Unprocessable Entity` | FastAPI request body schema error |
| `500 Internal Server Error` | Unexpected server-side error |

---

## Subscription Plans

| Feature | Free | Pro |
|---|---|---|
| Saved locations | 5 | Unlimited |
| Share codes | Unlimited | Unlimited |
| Price | $0 | Stripe-configured |

`plan` field in the user object is `"free"` or `"pro"`. `subscription_status` mirrors the Stripe subscription state (`"active"`, `"inactive"`, `"canceled"`, etc.).
