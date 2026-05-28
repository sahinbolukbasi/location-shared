import {
  AuthTokens,
  CheckoutSessionResponse,
  LocationItem,
  PaymentHistoryItem,
  Profile,
  ShareCode,
  SubscriptionStatus,
  UserProfile
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "DELETE" | "PUT";

function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem("access_token");
}

function setTokens(tokens: AuthTokens): void {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
}

function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function request<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  saveTokens: setTokens,
  clearTokens,
  register: (payload: { email: string; password: string; full_name: string }) =>
    request<AuthTokens>("/api/v1/auth/register", "POST", payload),
  login: (payload: { email: string; password: string }) =>
    request<AuthTokens>("/api/v1/auth/login", "POST", payload),
  me: () => request<UserProfile>("/api/v1/auth/me", "GET"),
  listLocations: () => request<LocationItem[]>("/api/v1/locations", "GET"),
  createLocation: (payload: { name: string; note?: string; latitude: number; longitude: number }) =>
    request<LocationItem>("/api/v1/locations", "POST", payload),
  deleteLocation: (id: string) => request<void>(`/api/v1/locations/${id}`, "DELETE"),
  updateLocation: (id: string, payload: { name: string; note?: string; latitude: number; longitude: number }) =>
    request<LocationItem>(`/api/v1/locations/${id}`, "PUT", payload),
  createShareCode: (payload: { latitude: number; longitude: number; location_name: string }) =>
    request<ShareCode>("/api/v1/share-codes", "POST", payload),
  resolveShareCode: (code: string) => request<ShareCode>(`/api/v1/share-codes/${code}`, "GET"),
  getProfile: () => request<Profile>("/api/v1/profile", "GET"),
  updateProfile: (payload: { full_name: string; username?: string | null; profile_image_data?: string | null }) =>
    request<Profile>("/api/v1/profile", "PUT", payload),
  changePassword: (payload: { current_password?: string | null; new_password: string }) =>
    request<{ message: string }>("/api/v1/profile/change-password", "POST", payload),
  listPayments: () => request<PaymentHistoryItem[]>("/api/v1/profile/payments", "GET"),
  getSubscription: () => request<SubscriptionStatus>("/api/v1/subscription", "GET"),
  createCheckoutSession: (payload: { success_url: string; cancel_url: string }) =>
    request<CheckoutSessionResponse>("/api/v1/subscription/checkout-session", "POST", payload)
};
