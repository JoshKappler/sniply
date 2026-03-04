import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Must mock before importing routes
vi.mock("@/lib/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  rowToUser: (r: Record<string, unknown>) => ({
    id: r.id, username: r.username, password: r.password, name: r.name, role: r.role,
    profileId: r.profile_id ?? undefined, avatar: undefined,
  }),
  pool: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import * as db from "@/lib/db";
import * as bcrypt from "bcryptjs";
import { SESSION_COOKIE } from "@/lib/server-auth";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";

const mockQueryOne = vi.mocked(db.queryOne);
const mockBcryptCompare = vi.mocked(bcrypt.default.compare);

const USER_ROW = {
  id: "u1", username: "alice", password: "$hashed", name: "Alice",
  role: "customer", profile_id: null, avatar: null,
  hair_type: null, hair_subtype: null, hair_texture: null, hair_color: null,
  style_prefs: null, concerns: null, notes: null, gender: null, location: null,
};

function makeLoginReq(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/login", () => {
  it("returns 200 and sets session cookie on valid credentials", async () => {
    mockQueryOne.mockResolvedValueOnce(USER_ROW);
    mockBcryptCompare.mockResolvedValueOnce(true as never);

    const res = await loginHandler(makeLoginReq({ username: "alice", password: "secret" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.username).toBe("alice");

    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain(SESSION_COOKIE);
  });

  it("returns 401 when user is not found", async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const res = await loginHandler(makeLoginReq({ username: "nobody", password: "pw" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 401 when password is wrong", async () => {
    mockQueryOne.mockResolvedValueOnce(USER_ROW);
    mockBcryptCompare.mockResolvedValueOnce(false as never);

    const res = await loginHandler(makeLoginReq({ username: "alice", password: "wrong" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 and clears the session cookie", async () => {
    const req = new NextRequest("http://localhost/api/auth/logout", { method: "POST" });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie");
    // Cookie should be expired (maxAge=0 or past expires)
    expect(cookie).toContain(SESSION_COOKIE);
    expect(cookie).toMatch(/max-age=0|expires=.*1970/i);
  });
});
