/**
 * Programmatic API helpers for E2E test setup and teardown.
 * These call the live running server's API routes directly (no browser).
 */

export const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export interface TestUser {
  id: string;
  username: string;
  name: string;
  role: "customer" | "pro";
  profileId?: string | null;
}

export interface TestBarber {
  id: string;
  name: string;
}

/** Generate a unique username to avoid conflicts between test runs */
export function uniqueUsername(base: string): string {
  return `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
}

/** Extract the cookie value from a Set-Cookie header string */
export function extractCookieValue(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0].split("=").slice(1).join("=");
}

/** Extract the cookie name=value pair from a Set-Cookie header */
export function extractCookiePair(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0];
}

/**
 * Register a new user via POST /api/users.
 * Returns the user object and the raw Set-Cookie header value for use in subsequent requests.
 */
export async function apiRegisterUser(payload: {
  username: string;
  password: string;
  name: string;
  role: "customer" | "pro";
}): Promise<{ user: TestUser; cookie: string }> {
  const res = await fetch(`${BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`apiRegisterUser failed ${res.status}: ${body}`);
  }

  const user = await res.json() as TestUser;
  const setCookie = res.headers.get("set-cookie") ?? "";
  // Extract just the token value from "sniply_session=TOKEN; Path=/; ..."
  const cookie = extractCookieValue(setCookie);

  return { user, cookie };
}

/**
 * Login via POST /api/auth/login.
 * Returns the user object and the raw session token value.
 */
export async function apiLoginUser(
  username: string,
  password: string
): Promise<{ user: TestUser; cookie: string }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`apiLoginUser failed ${res.status}: ${body}`);
  }

  const user = await res.json() as TestUser;
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = extractCookieValue(setCookie);

  return { user, cookie };
}

/**
 * Delete a user account via DELETE /api/users/[id].
 * This cascades: bookings, reviews, favorites, threads, and (if pro) the barber profile.
 */
export async function apiDeleteUser(userId: string, cookie: string): Promise<void> {
  const res = await fetch(`${BASE}/api/users/${userId}`, {
    method: "DELETE",
    headers: { Cookie: `sniply_session=${cookie}` },
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`apiDeleteUser failed ${res.status}: ${body}`);
  }
}

/**
 * Create a barber profile for the authenticated pro user via POST /api/barbers.
 * Also links the profile_id on the users row.
 */
export async function apiCreateBarberProfile(
  cookie: string,
  partial: Partial<TestBarber & { bio?: string; location?: string; services?: unknown[] }> = {}
): Promise<TestBarber> {
  const body = {
    name: partial.name ?? "Test Barber",
    bio: partial.bio ?? "E2E test barber",
    location: partial.location ?? "New York, NY",
    type: "independent",
    specialties: ["Fades"],
    hairTypes: ["Type 3"],
    languages: ["English"],
    services: partial.services ?? [
      { name: "Fade", description: "Clean fade", price: 35, duration: 30, images: [] },
    ],
    portfolioImages: [],
    credentials: [],
  };

  const res = await fetch(`${BASE}/api/barbers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${cookie}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`apiCreateBarberProfile failed ${res.status}: ${text}`);
  }

  return res.json() as Promise<TestBarber>;
}

/**
 * Create a booking via POST /api/bookings.
 */
export async function apiCreateBooking(
  cookie: string,
  booking: {
    id: string;
    barberId: string;
    barberName: string;
    service: string;
    duration: number;
    date: string;
    time: string;
    endTime: string;
    userId: string;
    userName: string;
    status: "upcoming";
    price: number;
    createdAt: string;
  }
): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${cookie}`,
    },
    body: JSON.stringify(booking),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`apiCreateBooking failed ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ id: string }>;
}

/**
 * Post a review via POST /api/reviews/[barberId].
 * Note: no booking gate in the API — only requires valid session + not already reviewed.
 */
export async function apiPostReview(
  cookie: string,
  barberId: string,
  review: {
    userId: string;
    userName: string;
    rating: number;
    text: string;
    date: string;
  }
): Promise<void> {
  const res = await fetch(`${BASE}/api/reviews/${barberId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${cookie}`,
    },
    body: JSON.stringify(review),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`apiPostReview failed ${res.status}: ${text}`);
  }
}

/** Get a future date in YYYY-MM-DD format, `daysFromNow` days ahead (default 7) */
export function futureDate(daysFromNow = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  // Skip to weekday (demo barbers are closed Sunday; avoid any potential day-off)
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}
