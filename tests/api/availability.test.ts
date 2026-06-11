import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  pool: vi.fn(() => ({
    query: mockPoolQuery,
    // Transaction client: BEGIN/COMMIT/ROLLBACK are no-ops so they don't
    // consume mockResolvedValueOnce queues scripted by individual tests.
    connect: vi.fn().mockResolvedValue({
      query: vi.fn((sql: string, ...rest: unknown[]) =>
        /^(BEGIN|COMMIT|ROLLBACK)/i.test(String(sql)) ? Promise.resolve({ rows: [] }) : mockPoolQuery(sql, ...rest),
      ),
      release: vi.fn(),
    }),
  })),
}));

import * as db from "@/lib/db";
import { GET as getAvailability, PUT as updateAvailability } from "@/app/api/availability/[barberId]/route";

const mockQueryOne = vi.mocked(db.queryOne);

const SLOTS = { "2026-03-10": [{ id: "s1", start: "9:00 AM", end: "9:30 AM" }] };

function proReq(url: string, method: string, userId: string, body?: object) {
  const token = signSession(userId, "pro");
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

describe("GET /api/availability/[barberId]", () => {
  it("returns slots when availability row exists", async () => {
    mockQueryOne.mockResolvedValueOnce({ slots: SLOTS });
    const req = new NextRequest("http://localhost/api/availability/b1");
    const res = await getAvailability(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body["2026-03-10"]).toHaveLength(1);
  });

  it("returns empty object when no availability row", async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/availability/b1");
    const res = await getAvailability(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(await res.json()).toEqual({});
  });
});

describe("PUT /api/availability/[barberId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/availability/b1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(SLOTS),
    });
    const res = await updateAvailability(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not pro", async () => {
    const token = signSession("u1", "customer");
    const req = new NextRequest("http://localhost/api/availability/b1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
      body: JSON.stringify(SLOTS),
    });
    const res = await updateAvailability(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b2" });
    const req = proReq("http://localhost/api/availability/b1", "PUT", "pro-user", SLOTS);
    const res = await updateAvailability(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("updates availability when pro owns profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b1" });
    const req = proReq("http://localhost/api/availability/b1", "PUT", "pro-user", SLOTS);
    const res = await updateAvailability(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body["2026-03-10"]).toHaveLength(1);
  });
});
