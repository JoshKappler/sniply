// Typed async fetch wrappers for all API routes.
// Centralizes error handling and replaces all localStorage data calls.

import type {
  Barber,
  Shop,
  User,
  Booking,
  MessageThread,
  CustomerThreadRef,
  StoredReview,
  TimeBlock,
  BusinessHours,
  NotifPrefs,
} from "@/lib/types";

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Barbers ──────────────────────────────────────────────────────────────────

export async function apiGetBarbers(): Promise<{ barbers: Barber[]; shops: Shop[] }> {
  return apiFetch("/api/barbers");
}

export async function apiGetBarber(id: string): Promise<Barber> {
  return apiFetch(`/api/barbers/${id}`);
}

export async function apiCreateBarber(barber: Barber): Promise<Barber> {
  return apiFetch("/api/barbers", { method: "POST", body: JSON.stringify(barber) });
}

export async function apiUpdateBarber(id: string, patch: Partial<Barber>): Promise<Barber> {
  return apiFetch(`/api/barbers/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function apiRegisterUser(user: User): Promise<User> {
  return apiFetch("/api/users", { method: "POST", body: JSON.stringify(user) });
}

export async function apiGetUser(id: string): Promise<User> {
  return apiFetch(`/api/users/${id}`);
}

export async function apiUpdateUser(id: string, patch: Partial<User> & { currentPassword?: string }): Promise<User> {
  return apiFetch(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(username: string, password: string): Promise<User> {
  return apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export async function apiGetBookings(filter?: { userId?: string; barberId?: string }): Promise<Booking[]> {
  const params = new URLSearchParams();
  if (filter?.userId) params.set("userId", filter.userId);
  if (filter?.barberId) params.set("barberId", filter.barberId);
  return apiFetch(`/api/bookings?${params.toString()}`);
}

export async function apiCreateBooking(booking: Booking): Promise<Booking> {
  return apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(booking) });
}

export async function apiUpdateBooking(id: string, patch: Partial<Booking>): Promise<Booking> {
  return apiFetch(`/api/bookings/${id}`, { method: "PUT", body: JSON.stringify(patch) });
}

export async function apiDeleteBooking(id: string): Promise<Booking> {
  return apiFetch(`/api/bookings/${id}`, { method: "DELETE" });
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export async function apiGetReviews(barberId: string): Promise<StoredReview[]> {
  return apiFetch(`/api/reviews/${barberId}`);
}

export async function apiPostReview(barberId: string, review: StoredReview): Promise<StoredReview> {
  return apiFetch(`/api/reviews/${barberId}`, { method: "POST", body: JSON.stringify(review) });
}

export async function apiReplyToReview(barberId: string, reviewIdx: number, text: string): Promise<StoredReview> {
  return apiFetch(`/api/reviews/${barberId}/reply`, {
    method: "POST",
    body: JSON.stringify({ reviewIdx, text }),
  });
}

// ── Threads (pro-side) ────────────────────────────────────────────────────────

export async function apiGetThreads(proId: string): Promise<MessageThread[]> {
  return apiFetch(`/api/threads/${proId}`);
}

export async function apiUpdateThreads(proId: string, threads: MessageThread[]): Promise<MessageThread[]> {
  return apiFetch(`/api/threads/${proId}`, { method: "PUT", body: JSON.stringify(threads) });
}

// ── Customer threads ──────────────────────────────────────────────────────────

export async function apiGetCustomerThreads(customerId: string): Promise<CustomerThreadRef[]> {
  return apiFetch(`/api/customer-threads/${customerId}`);
}

export async function apiUpdateCustomerThreads(customerId: string, threads: CustomerThreadRef[]): Promise<CustomerThreadRef[]> {
  return apiFetch(`/api/customer-threads/${customerId}`, { method: "PUT", body: JSON.stringify(threads) });
}

// ── Availability ──────────────────────────────────────────────────────────────

export async function apiGetAvailability(barberId: string): Promise<Record<string, TimeBlock[]>> {
  return apiFetch(`/api/availability/${barberId}`);
}

export async function apiUpdateAvailability(barberId: string, slots: Record<string, TimeBlock[]>): Promise<Record<string, TimeBlock[]>> {
  return apiFetch(`/api/availability/${barberId}`, { method: "PUT", body: JSON.stringify(slots) });
}

// ── Business hours ────────────────────────────────────────────────────────────

export async function apiGetBusinessHours(profileId: string): Promise<BusinessHours | null> {
  return apiFetch(`/api/business-hours/${profileId}`);
}

export async function apiUpdateBusinessHours(profileId: string, hours: BusinessHours): Promise<BusinessHours> {
  return apiFetch(`/api/business-hours/${profileId}`, { method: "PUT", body: JSON.stringify(hours) });
}

// ── Favorites ─────────────────────────────────────────────────────────────────

export async function apiGetFavorites(userId: string): Promise<string[]> {
  return apiFetch(`/api/favorites/${userId}`);
}

export async function apiUpdateFavorites(userId: string, ids: string[]): Promise<string[]> {
  return apiFetch(`/api/favorites/${userId}`, { method: "PUT", body: JSON.stringify(ids) });
}

// ── Notification prefs ────────────────────────────────────────────────────────

export async function apiGetNotifPrefs(userId: string): Promise<NotifPrefs | null> {
  return apiFetch(`/api/notif-prefs/${userId}`);
}

export async function apiUpdateNotifPrefs(userId: string, prefs: NotifPrefs): Promise<NotifPrefs> {
  return apiFetch(`/api/notif-prefs/${userId}`, { method: "PUT", body: JSON.stringify(prefs) });
}
