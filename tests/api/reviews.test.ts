import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();
const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  rowToReview: (r: Record<string, unknown>) => ({
    id: r.id !== undefined ? Number(r.id) : undefined,
    userId: r.user_id, userName: r.user_name ?? "",
    rating: Number(r.rating), text: r.text ?? "",
    date: r.date ?? "", reply: r.reply ?? undefined, photos: r.photos ?? [],
  }),
  pool: vi.fn(() => ({ query: mockPoolQuery, connect: vi.fn().mockResolvedValue(mockClient) })),
}));

import * as db from "@/lib/db";
import { GET as getReviews, POST as postReview } from "@/app/api/reviews/[barberId]/route";
import { POST as postReply } from "@/app/api/reviews/[barberId]/reply/route";

const mockQuery = vi.mocked(db.query);
const mockQueryOne = vi.mocked(db.queryOne);

const REVIEW_ROW = {
  id: 1, barber_id: "b1", user_id: "u1", user_name: "Alice",
  rating: 5, text: "Great cut!", date: "2026-01-01", reply: null, photos: [],
};

function authedReq(url: string, method: string, userId: string, role: string, body?: object) {
  const token = signSession(userId, role);
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [] });
  mockClient.query.mockResolvedValue({ rows: [] });
  mockClient.release.mockResolvedValue(undefined);
});

describe("GET /api/reviews/[barberId]", () => {
  it("returns reviews array", async () => {
    mockQuery.mockResolvedValueOnce([REVIEW_ROW]);
    const req = new NextRequest("http://localhost/api/reviews/b1");
    const res = await getReviews(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].rating).toBe(5);
  });

  it("returns empty array when no reviews", async () => {
    mockQuery.mockResolvedValueOnce([]);
    const req = new NextRequest("http://localhost/api/reviews/b1");
    const res = await getReviews(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(await res.json()).toEqual([]);
  });
});

describe("POST /api/reviews/[barberId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/reviews/b1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", rating: 5, text: "Good" }),
    });
    const res = await postReview(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when userId in body does not match session", async () => {
    const req = authedReq("http://localhost/api/reviews/b1", "POST", "u1", "customer", {
      userId: "u-other", rating: 5, text: "Fake",
    });
    const res = await postReview(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 409 when user already reviewed this barber", async () => {
    mockQuery.mockResolvedValueOnce([REVIEW_ROW]); // duplicate check finds existing review
    const reviewBody = { userId: "u1", userName: "Alice", rating: 5, text: "Great!", date: "2026-01-01", photos: [] };
    const req = authedReq("http://localhost/api/reviews/b1", "POST", "u1", "customer", reviewBody);
    const res = await postReview(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(409);
  });

  it("creates review and returns 201", async () => {
    mockQuery.mockResolvedValueOnce([]); // no duplicate
    // pool().connect() provides client for transaction
    const reviewBody = { userId: "u1", userName: "Alice", rating: 5, text: "Great!", date: "2026-01-01", photos: [] };
    const req = authedReq("http://localhost/api/reviews/b1", "POST", "u1", "customer", reviewBody);
    const res = await postReview(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.userId).toBe("u1");
  });
});

describe("POST /api/reviews/[barberId]/reply", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/reviews/b1/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId: 1, text: "Thanks!" }),
    });
    const res = await postReply(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when role is not pro", async () => {
    const req = authedReq("http://localhost/api/reviews/b1/reply", "POST", "u1", "customer", {
      reviewId: 1, text: "Thanks!",
    });
    const res = await postReply(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "b2" }); // owns b2, not b1
    const req = authedReq("http://localhost/api/reviews/b1/reply", "POST", "pro-user", "pro", {
      reviewId: 1, text: "Thanks!",
    });
    const res = await postReply(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(403);
  });

  it("replies to review when pro owns the profile", async () => {
    mockQueryOne
      .mockResolvedValueOnce({ profile_id: "b1" })              // ownership check
      .mockResolvedValueOnce({ id: 1, barber_id: "b1" })        // existing review check
      .mockResolvedValueOnce({ ...REVIEW_ROW, reply: "Thanks!" }); // after update

    const req = authedReq("http://localhost/api/reviews/b1/reply", "POST", "pro-user", "pro", {
      reviewId: 1, text: "Thanks!",
    });
    const res = await postReply(req, { params: Promise.resolve({ barberId: "b1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe("Thanks!");
  });
});
