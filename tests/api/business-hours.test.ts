import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  rowToBusinessHours: (r: Record<string, unknown>) => ({
    openTime: r.open_time ?? "9:00 AM",
    closeTime: r.close_time ?? "5:00 PM",
  }),
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
import { GET as getBusinessHours, PUT as updateBusinessHours } from "@/app/api/business-hours/[profileId]/route";

const mockQueryOne = vi.mocked(db.queryOne);

const HOURS = { openTime: "9:00 AM", closeTime: "6:00 PM" };

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

describe("GET /api/business-hours/[profileId]", () => {
  it("returns hours when row exists", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b1", open_time: "9:00 AM", close_time: "6:00 PM" });
    const req = new NextRequest("http://localhost/api/business-hours/b1");
    const res = await getBusinessHours(req, { params: Promise.resolve({ profileId: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openTime).toBe("9:00 AM");
  });

  it("returns null when no row", async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/business-hours/b1");
    const res = await getBusinessHours(req, { params: Promise.resolve({ profileId: "b1" }) });
    expect(await res.json()).toBeNull();
  });
});

describe("PUT /api/business-hours/[profileId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/business-hours/b1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(HOURS),
    });
    const res = await updateBusinessHours(req, { params: Promise.resolve({ profileId: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not pro", async () => {
    const token = signSession("u1", "customer");
    const req = new NextRequest("http://localhost/api/business-hours/b1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
      body: JSON.stringify(HOURS),
    });
    const res = await updateBusinessHours(req, { params: Promise.resolve({ profileId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b2" });
    const req = proReq("http://localhost/api/business-hours/b1", "PUT", "pro-user", HOURS);
    const res = await updateBusinessHours(req, { params: Promise.resolve({ profileId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("updates hours when pro owns profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b1" });
    const req = proReq("http://localhost/api/business-hours/b1", "PUT", "pro-user", HOURS);
    const res = await updateBusinessHours(req, { params: Promise.resolve({ profileId: "b1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(HOURS);
  });
});
