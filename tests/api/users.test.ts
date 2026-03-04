import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  rowToUser: (r: Record<string, unknown>) => ({
    id: r.id, username: r.username, password: r.password, name: r.name, role: r.role,
    profileId: r.profile_id ?? undefined, avatar: r.avatar ?? undefined,
    hairType: r.hair_type ?? undefined, stylePrefs: r.style_prefs ?? undefined,
    concerns: r.concerns ?? undefined, location: r.location ?? undefined,
  }),
  pool: vi.fn(() => ({ query: mockPoolQuery })),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(), hash: vi.fn().mockResolvedValue("$hashed") },
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue("$hashed"),
}));

import * as db from "@/lib/db";
import * as bcrypt from "bcryptjs";
import { POST as createUser } from "@/app/api/users/route";
import { GET as getUser, PUT as updateUser } from "@/app/api/users/[id]/route";

const mockQueryOne = vi.mocked(db.queryOne);
const mockBcryptCompare = vi.mocked(bcrypt.default.compare);
const mockBcryptHash = vi.mocked(bcrypt.default.hash);

const BASE_ROW = {
  id: "u1", username: "alice", password: "$hashed", name: "Alice", role: "customer",
  profile_id: null, avatar: null, hair_type: "curly", hair_subtype: null,
  hair_texture: null, hair_color: null, style_prefs: ["Fades"], concerns: null,
  notes: null, gender: null, location: "Atlanta, GA",
};

function authedReq(url: string, method: string, userId: string, role: string, body?: object) {
  const token = signSession(userId, role);
  return new NextRequest(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: `${SESSION_COOKIE}=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [BASE_ROW] });
  mockBcryptHash.mockResolvedValue("$hashed" as never);
});

describe("POST /api/users", () => {
  it("creates a user and returns 201 with session cookie", async () => {
    mockQueryOne
      .mockResolvedValueOnce(null)     // no duplicate username
      .mockResolvedValueOnce(BASE_ROW); // fetch created user

    const req = new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "secret", name: "Alice", role: "customer" }),
    });
    const res = await createUser(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.username).toBe("alice");
    expect(body.password).toBeUndefined(); // never returned
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain(SESSION_COOKIE);
  });

  it("returns 409 when username is already taken", async () => {
    mockQueryOne.mockResolvedValueOnce({ id: "existing" });

    const req = new NextRequest("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "pw", name: "Bob", role: "customer" }),
    });
    const res = await createUser(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already taken/i);
  });
});

describe("GET /api/users/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/users/u1");
    const res = await getUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/users/u1", "GET", "u-other", "customer");
    const res = await getUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("returns user when found", async () => {
    mockQueryOne.mockResolvedValueOnce(BASE_ROW);
    const req = authedReq("http://localhost/api/users/u1", "GET", "u1", "customer");
    const res = await getUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("u1");
    expect(body.password).toBeUndefined(); // never returned
  });

  it("returns 404 when user not found", async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req = authedReq("http://localhost/api/users/unknown", "GET", "unknown", "customer");
    const res = await getUser(req, { params: Promise.resolve({ id: "unknown" }) });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/users/[id]", () => {
  it("returns 401 when no session", async () => {
    const req = new NextRequest("http://localhost/api/users/u1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice Updated" }),
    });
    const res = await updateUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/users/u1", "PUT", "u-other", "customer", { name: "Hacker" });
    const res = await updateUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("updates user and returns 200 with matching session", async () => {
    mockQueryOne.mockResolvedValueOnce(BASE_ROW); // existing
    const req = authedReq("http://localhost/api/users/u1", "PUT", "u1", "customer", { name: "Alice Updated" });
    const res = await updateUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Alice Updated");
    expect(body.password).toBeUndefined(); // never returned
  });

  it("returns 400 when changing password without providing currentPassword", async () => {
    mockQueryOne.mockResolvedValueOnce(BASE_ROW);
    const req = authedReq("http://localhost/api/users/u1", "PUT", "u1", "customer", {
      password: "newpassword",
      // no currentPassword
    });
    const res = await updateUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when currentPassword is wrong", async () => {
    mockQueryOne.mockResolvedValueOnce(BASE_ROW);
    mockBcryptCompare.mockResolvedValueOnce(false as never);
    const req = authedReq("http://localhost/api/users/u1", "PUT", "u1", "customer", {
      password: "newpassword",
      currentPassword: "wrongold",
    });
    const res = await updateUser(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(400);
  });
});
