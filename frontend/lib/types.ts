export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  plan: "free" | "pro";
  subscription_status: "inactive" | "active" | "past_due" | "canceled";
  location_limit: number;
};

export type LocationItem = {
  id: string;
  name: string;
  note: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
};

export type ShareCode = {
  code: string;
  latitude: number;
  longitude: number;
  location_name: string;
  expires_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  profile_image_data: string | null;
  plan: "free" | "pro";
  subscription_status: "inactive" | "active" | "past_due" | "canceled";
  location_limit: number;
};

export type PaymentHistoryItem = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type SubscriptionStatus = {
  plan: "free" | "pro";
  subscription_status: "inactive" | "active" | "past_due" | "canceled";
  location_limit: number;
};

export type CheckoutSessionResponse = {
  checkout_url: string;
};
