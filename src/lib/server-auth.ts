// Server-only module: session signing + verification using HMAC-SHA256.
// No external dependencies — uses Node's built-in crypto module.
// Import only in API routes (server-side), never in client components.

import crypto from "crypto";
import type { NextRequest } from "next/server";

const SECRET = (() => {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable must be set in production.");
    }
    return "dev-secret-change-in-production";
  }
  return s;
})();

export const SESSION_COOKIE = "sniply_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  role: "customer" | "pro";
}

/** Produce a signed session token: base64url(payload).base64url(hmac) */
export function signSession(userId: string, role: string): string {
  const encoded = Buffer.from(JSON.stringify({ userId, role })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/** Verify a session token. Returns the payload or null if invalid/tampered. */
export function verifySession(token: string): SessionPayload | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const encoded = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");

  // Timing-safe comparison to prevent side-channel attacks
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString()
    ) as SessionPayload;
    if (!payload.userId || !["customer", "pro"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the session from a Next.js API request.
 * Checks the httpOnly cookie first, then falls back to the Authorization header.
 */
export function getSession(req: NextRequest): SessionPayload | null {
  const token =
    req.cookies.get(SESSION_COOKIE)?.value ??
    req.headers.get("Authorization")?.replace(/^Bearer\s+/, "");
  if (!token) return null;
  return verifySession(token);
}

/** Convenience: return 401 JSON response (import from here so routes stay DRY). */
export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

/** Convenience: return 403 JSON response. */
export function forbidden() {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
