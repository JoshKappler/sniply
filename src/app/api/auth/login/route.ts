import { NextRequest, NextResponse } from "next/server";
import { queryOne, rowToUser } from "@/lib/db";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/server-auth";
import bcrypt from "bcryptjs";

// Simple in-memory rate limiter: 5 failed attempts per IP per 15 minutes.
// For multi-instance deployments, replace with a Redis-backed solution.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_ATTEMPTS) return true;
  entry.count++;
  return false;
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait 15 minutes and try again." },
      { status: 429 }
    );
  }

  const { username, password } = await req.json() as { username: string; password: string };

  const row = await queryOne(
    `SELECT * FROM users WHERE lower(username) = lower($1)`,
    [username]
  );
  if (!row || !(await bcrypt.compare(password, row.password as string))) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  clearAttempts(ip);

  const { password: _pw, ...safeUser } = rowToUser(row);
  const token = signSession(safeUser.id, safeUser.role);
  const res = NextResponse.json(safeUser);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
