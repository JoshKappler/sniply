import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  rowToNotifPrefs: (r: Record<string, unknown>) => ({
    bookingConfirmations: Boolean(r.booking_confirmations),
    bookingReminders: Boolean(r.booking_reminders),
    messages: Boolean(r.messages),
    promotions: Boolean(r.promotions),
  }),
  pool: vi.fn(() => ({ query: mockPoolQuery })),
}));

import * as db from "@/lib/db";
import { GET as getNotifPrefs, PUT as updateNotifPrefs } from "@/app/api/notif-prefs/[userId]/route";

const mockQueryOne = vi.mocked(db.queryOne);

const PREFS_ROW = {
  user_id: "u1", booking_confirmations: true, booking_reminders: true,
  messages: true, promotions: false,
};
const PREFS = { bookingConfirmations: true, bookingReminders: true, messages: true, promotions: false };

function authedReq(url: string, method: string, userId: string, body?: object) {
  const token = signSession(userId, "customer");
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [] });
});

describe("GET /api/notif-prefs/[userId]", () => {
  it("returns prefs when row exists", async () => {
    mockQueryOne.mockResolvedValueOnce(PREFS_ROW);
    const req = new NextRequest("http://localhost/api/notif-prefs/u1");
    const res = await getNotifPrefs(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookingConfirmations).toBe(true);
    expect(body.promotions).toBe(false);
  });

  it("returns null when no prefs row", async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/notif-prefs/u1");
    const res = await getNotifPrefs(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(await res.json()).toBeNull();
  });
});

describe("PUT /api/notif-prefs/[userId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/notif-prefs/u1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PREFS),
    });
    const res = await updateNotifPrefs(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/notif-prefs/u1", "PUT", "u-other", PREFS);
    const res = await updateNotifPrefs(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("saves prefs and returns 200", async () => {
    const req = authedReq("http://localhost/api/notif-prefs/u1", "PUT", "u1", PREFS);
    const res = await updateNotifPrefs(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(PREFS);
  });
});
