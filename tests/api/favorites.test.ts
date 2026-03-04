import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  pool: vi.fn(() => ({ query: mockPoolQuery })),
}));

import * as db from "@/lib/db";
import { GET as getFavorites, PUT as updateFavorites } from "@/app/api/favorites/[userId]/route";

const mockQuery = vi.mocked(db.query);

function authedReq(url: string, method: string, userId: string, body?: unknown) {
  const token = signSession(userId, "customer");
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [] });
});

describe("GET /api/favorites/[userId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/favorites/u1");
    const res = await getFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/favorites/u1", "GET", "u-other");
    const res = await getFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("returns array of barber IDs", async () => {
    mockQuery.mockResolvedValueOnce([{ barber_id: "b1" }, { barber_id: "b2" }]);
    const req = authedReq("http://localhost/api/favorites/u1", "GET", "u1");
    const res = await getFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(["b1", "b2"]);
  });

  it("returns empty array when no favorites", async () => {
    mockQuery.mockResolvedValueOnce([]);
    const req = authedReq("http://localhost/api/favorites/u1", "GET", "u1");
    const res = await getFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(await res.json()).toEqual([]);
  });
});

describe("PUT /api/favorites/[userId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/favorites/u1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(["b1"]),
    });
    const res = await updateFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/favorites/u1", "PUT", "u-other", ["b1"]);
    const res = await updateFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("replaces favorites and returns 200", async () => {
    const req = authedReq("http://localhost/api/favorites/u1", "PUT", "u1", ["b1", "b2"]);
    const res = await updateFavorites(req, { params: Promise.resolve({ userId: "u1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(["b1", "b2"]);
  });
});
