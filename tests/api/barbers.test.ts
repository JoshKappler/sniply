import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();

vi.mock("@/lib/db", () => ({
  queryOne: vi.fn(),
  query: vi.fn(),
  rowToBarber: (r: Record<string, unknown>) => ({
    id: r.id, name: r.name, username: r.username ?? "", rating: Number(r.rating ?? 0),
    reviewCount: Number(r.review_count ?? 0), location: r.location ?? "",
    fullAddress: r.full_address ?? "", lat: r.lat != null ? Number(r.lat) : undefined,
    lng: r.lng != null ? Number(r.lng) : undefined, type: r.type ?? "independent",
    shopId: r.shop_id ?? undefined, startingPrice: Number(r.starting_price ?? 0),
    specialties: r.specialties ?? [], hairTypes: r.hair_types ?? [],
    bio: r.bio ?? "", experience: r.experience ?? "", languages: r.languages ?? [],
    heroImage: r.hero_image ?? "", profileImage: r.profile_image ?? "",
    portfolioImages: r.portfolio_images ?? [], services: r.services ?? [],
    reviews: [], credentials: r.credentials ?? [],
  }),
  rowToShop: (r: Record<string, unknown>) => ({
    id: r.id, name: r.name, address: r.address ?? "", city: r.city ?? "", image: r.image ?? "",
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
import { GET as listBarbers, POST as createBarber } from "@/app/api/barbers/route";
import { GET as getBarber, PUT as updateBarber, DELETE as deleteBarber } from "@/app/api/barbers/[id]/route";

const mockQuery = vi.mocked(db.query);
const mockQueryOne = vi.mocked(db.queryOne);

const BARBER_ROW = {
  id: "b1", name: "Marcus", username: "marcus", rating: "4.8", review_count: "5",
  location: "Atlanta, GA", full_address: "123 Peach St", lat: "33.7", lng: "-84.4",
  type: "independent", shop_id: null, starting_price: "40",
  specialties: ["Fades"], hair_types: ["Curly"], bio: "Expert", experience: "5 years",
  languages: ["English"], hero_image: "hero.jpg", profile_image: "profile.jpg",
  portfolio_images: [], services: [], credentials: [],
};

function proReq(url: string, method: string, userId: string, body?: object) {
  const token = signSession(userId, "pro");
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  // resetAllMocks clears once-queues, preventing mock pollution between tests
  vi.resetAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [BARBER_ROW] });
});

describe("GET /api/barbers", () => {
  it("returns all barbers and shops", async () => {
    mockQuery
      .mockResolvedValueOnce([BARBER_ROW]) // barbers
      .mockResolvedValueOnce([]);          // shops
    const res = await listBarbers();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.barbers).toHaveLength(1);
    expect(body.barbers[0].id).toBe("b1");
    expect(body.shops).toEqual([]);
  });
});

describe("POST /api/barbers", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/barbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Marcus", username: "marcus", type: "independent" }),
    });
    const res = await createBarber(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not pro", async () => {
    const token = signSession("u1", "customer");
    const req = new NextRequest("http://localhost/api/barbers", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
      body: JSON.stringify({ name: "Marcus" }),
    });
    const res = await createBarber(req);
    expect(res.status).toBe(403);
  });

  it("returns 409 when pro already has a barber profile", async () => {
    // The duplicate check now runs inside the transaction on the pool client:
    // SELECT profile_id ... FOR UPDATE, then SELECT id FROM barbers.
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ profile_id: "b-existing" }] }) // user row locked — has profile
      .mockResolvedValueOnce({ rows: [{ id: "b-existing" }] });        // that barber still exists
    const req = proReq("http://localhost/api/barbers", "POST", "pro-user", {
      name: "Marcus", username: "marcus", type: "independent",
      specialties: [], hairTypes: [], languages: [], services: [], reviews: [], portfolioImages: [],
    });
    const res = await createBarber(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already exists/i);
  });

  it("creates a barber and returns 201", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [{ profile_id: null }] }) // user row locked — no existing profile
      .mockResolvedValueOnce({ rows: [] })                      // INSERT barber
      .mockResolvedValueOnce({ rows: [] });                     // UPDATE users.profile_id
    mockQueryOne.mockResolvedValueOnce(BARBER_ROW);             // fetch created barber after COMMIT
    const req = proReq("http://localhost/api/barbers", "POST", "pro-user", {
      name: "Marcus", username: "marcus", type: "independent",
      specialties: [], hairTypes: [], languages: [], services: [], reviews: [], portfolioImages: [],
    });
    const res = await createBarber(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Marcus");
  });
});

describe("GET /api/barbers/[id]", () => {
  it("returns the barber when found", async () => {
    mockQueryOne.mockResolvedValueOnce(BARBER_ROW);
    const req = new NextRequest("http://localhost/api/barbers/b1");
    const res = await getBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Marcus");
  });

  it("returns 404 when not found", async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/barbers/nope");
    const res = await getBarber(req, { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/barbers/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/barbers/b1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await updateBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not pro", async () => {
    const token = signSession("u1", "customer");
    const req = new NextRequest("http://localhost/api/barbers/b1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
      body: JSON.stringify({ name: "Hack" }),
    });
    const res = await updateBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b2" });
    const req = proReq("http://localhost/api/barbers/b1", "PUT", "pro-user", { name: "Hack" });
    const res = await updateBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("updates barber when pro owns the profile", async () => {
    mockQueryOne
      .mockResolvedValueOnce({ profile_id: "b1" }) // ownership check
      .mockResolvedValueOnce(BARBER_ROW)             // existing barber
      .mockResolvedValueOnce({ ...BARBER_ROW, name: "Marcus Updated" }); // after update
    const req = proReq("http://localhost/api/barbers/b1", "PUT", "pro-user", { name: "Marcus Updated" });
    const res = await updateBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/barbers/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/barbers/b1", { method: "DELETE" });
    const res = await deleteBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not pro", async () => {
    const token = signSession("u1", "customer");
    const req = new NextRequest("http://localhost/api/barbers/b1", {
      method: "DELETE",
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
    const res = await deleteBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b2" });
    const req = proReq("http://localhost/api/barbers/b1", "DELETE", "pro-user");
    const res = await deleteBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("succeeds and clears profile_id even when the barber row is already gone", async () => {
    // The route no longer 404s on a missing barber row: a matching profile_id
    // with no barber is treated as orphaned state and cleaned up anyway.
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b1" }); // ownership ok
    mockPoolQuery.mockResolvedValue({ rows: [] });            // every cascade delete affects 0 rows
    const req = proReq("http://localhost/api/barbers/b1", "DELETE", "pro-user");
    const res = await deleteBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // profile_id is cleared regardless of whether the barber row existed
    const sqls = mockPoolQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /UPDATE users SET profile_id = NULL/i.test(s))).toBe(true);
  });

  it("deletes barber when pro owns the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b1" }); // ownership ok
    const req = proReq("http://localhost/api/barbers/b1", "DELETE", "pro-user");
    const res = await deleteBarber(req, { params: Promise.resolve({ id: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Cascade delete runs in a transaction and removes the barber row itself
    const sqls = mockPoolQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /DELETE FROM barbers\s+WHERE id\s+= \$1/i.test(s))).toBe(true);
  });
});
