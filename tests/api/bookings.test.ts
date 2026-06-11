import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();
const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  rowToBooking: (r: Record<string, unknown>) => ({
    id: r.id, barberId: r.barber_id, barberName: r.barber_name ?? "",
    barberImage: r.barber_image ?? "", userId: r.user_id,
    userName: r.user_name ?? undefined, service: r.service ?? "",
    date: r.date ?? "", time: r.time ?? "", endTime: r.end_time ?? undefined,
    price: Number(r.price ?? 0), duration: Number(r.duration ?? 0),
    status: r.status ?? "upcoming", cancelled: Boolean(r.cancelled),
    notes: r.notes ?? undefined,
  }),
  pool: vi.fn(() => ({ query: mockPoolQuery, connect: vi.fn().mockResolvedValue(mockClient) })),
}));

import * as db from "@/lib/db";
import { GET as listBookings, POST as createBooking } from "@/app/api/bookings/route";
import { PUT as updateBooking, DELETE as deleteBooking } from "@/app/api/bookings/[id]/route";

const mockQuery = vi.mocked(db.query);
const mockQueryOne = vi.mocked(db.queryOne);

const BOOKING_ROW = {
  id: "bk1", barber_id: "b1", barber_name: "Marcus", barber_image: "img",
  user_id: "u1", user_name: "Alice", service: "Fade", date: "2026-03-10",
  time: "10:00 AM", end_time: "10:30 AM", price: 40, duration: 30,
  status: "upcoming", cancelled: false, created_at: null, notes: null,
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
  mockPoolQuery.mockResolvedValue({ rows: [BOOKING_ROW] });
  mockClient.query.mockResolvedValue({ rows: [] });
  mockClient.release.mockResolvedValue(undefined);
});

describe("GET /api/bookings", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/bookings");
    const res = await listBookings(req);
    expect(res.status).toBe(401);
  });

  it("returns all bookings with no filters", async () => {
    mockQuery.mockResolvedValueOnce([BOOKING_ROW]);
    const req = authedReq("http://localhost/api/bookings", "GET", "u1", "customer");
    const res = await listBookings(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("bk1");
  });

  it("filters by userId", async () => {
    mockQuery.mockResolvedValueOnce([BOOKING_ROW]);
    const req = authedReq("http://localhost/api/bookings?userId=u1", "GET", "u1", "customer");
    const res = await listBookings(req);
    expect(res.status).toBe(200);
  });

  it("returns 403 when customer requests another user's bookings", async () => {
    const req = authedReq("http://localhost/api/bookings?userId=u-other", "GET", "u1", "customer");
    const res = await listBookings(req);
    expect(res.status).toBe(403);
  });

  it("filters by barberId — returns PII-stripped data for non-owners", async () => {
    mockQuery.mockResolvedValueOnce([BOOKING_ROW]);
    mockQueryOne.mockResolvedValueOnce({ profile_id: "other-barber" }); // not the owning pro
    const req = authedReq("http://localhost/api/bookings?barberId=b1", "GET", "u1", "customer");
    const res = await listBookings(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // PII stripped — should not include userName or notes
    expect(body[0].userId).toBeUndefined();
    expect(body[0].barberId).toBe("b1");
  });
});

describe("POST /api/bookings", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1" }),
    });
    const res = await createBooking(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when userId does not match session", async () => {
    const bookingData = { id: "bk1", barberId: "b1", userId: "u-other", service: "Fade" };
    const req = authedReq("http://localhost/api/bookings", "POST", "u1", "customer", bookingData);
    const res = await createBooking(req);
    expect(res.status).toBe(403);
  });

  it("returns 409 when time slot is already booked", async () => {
    // BEGIN → advisory lock on (barber, date) → conflict check finds a row → ROLLBACK
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })                         // BEGIN
      .mockResolvedValueOnce({ rows: [] })                         // pg_advisory_xact_lock
      .mockResolvedValueOnce({ rows: [{ id: "bk-existing" }] })   // conflict found
      .mockResolvedValueOnce({ rows: [] });                        // ROLLBACK
    const bookingData = { id: "bk2", barberId: "b1", userId: "u1", service: "Fade",
      date: "2026-03-10", time: "10:00 AM", endTime: "10:30 AM" };
    const req = authedReq("http://localhost/api/bookings", "POST", "u1", "customer", bookingData);
    const res = await createBooking(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/no longer available/i);
  });

  it("creates a booking and returns 201", async () => {
    // BEGIN, advisory lock, no conflict, INSERT, COMMIT
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockResolvedValueOnce({ rows: [] })  // pg_advisory_xact_lock
      .mockResolvedValueOnce({ rows: [] })  // no conflict
      .mockResolvedValueOnce({ rows: [] })  // INSERT
      .mockResolvedValueOnce({ rows: [] }); // COMMIT
    mockQueryOne.mockResolvedValueOnce(BOOKING_ROW); // SELECT after insert
    const bookingData = { id: "bk1", barberId: "b1", barberName: "Marcus",
      barberImage: "img", userId: "u1", service: "Fade", date: "2026-03-10",
      time: "10:00 AM", endTime: "10:30 AM", price: 40, duration: 30, status: "upcoming" };
    const req = authedReq("http://localhost/api/bookings", "POST", "u1", "customer", bookingData);
    const res = await createBooking(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("bk1");
  });
});

describe("PUT /api/bookings/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/bookings/bk1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const res = await updateBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking not found", async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const req = authedReq("http://localhost/api/bookings/nope", "PUT", "u1", "customer", { status: "cancelled" });
    const res = await updateBooking(req, { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user does not own the booking", async () => {
    mockQueryOne.mockResolvedValueOnce({ ...BOOKING_ROW, user_id: "u-other" });
    const req = authedReq("http://localhost/api/bookings/bk1", "PUT", "u1", "customer", { status: "cancelled" });
    const res = await updateBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(403);
  });

  it("allows booking owner to update status", async () => {
    mockQueryOne
      .mockResolvedValueOnce(BOOKING_ROW)               // existing
      .mockResolvedValueOnce({ ...BOOKING_ROW, status: "cancelled" }); // after update
    const req = authedReq("http://localhost/api/bookings/bk1", "PUT", "u1", "customer", { status: "cancelled" });
    const res = await updateBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("cancelled");
  });

  it("allows pro who owns the barber to update booking", async () => {
    mockQueryOne
      .mockResolvedValueOnce(BOOKING_ROW)              // existing booking (barberId: "b1")
      .mockResolvedValueOnce({ profile_id: "b1" })     // pro owns barber b1
      .mockResolvedValueOnce({ ...BOOKING_ROW, status: "cancelled" }); // after update
    const req = authedReq("http://localhost/api/bookings/bk1", "PUT", "pro-user", "pro", { status: "cancelled" });
    const res = await updateBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/bookings/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/bookings/bk1", { method: "DELETE" });
    const res = await deleteBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user does not own the booking", async () => {
    mockQueryOne.mockResolvedValueOnce({ ...BOOKING_ROW, user_id: "u-other" });
    const req = authedReq("http://localhost/api/bookings/bk1", "DELETE", "u1", "customer");
    const res = await deleteBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(403);
  });

  it("deletes booking when user owns it", async () => {
    mockQueryOne.mockResolvedValueOnce(BOOKING_ROW); // existing
    const req = authedReq("http://localhost/api/bookings/bk1", "DELETE", "u1", "customer");
    const res = await deleteBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(200);
  });

  it("allows pro who owns the barber to delete booking", async () => {
    mockQueryOne
      .mockResolvedValueOnce(BOOKING_ROW)          // existing booking (barberId: "b1")
      .mockResolvedValueOnce({ profile_id: "b1" }); // pro owns barber b1
    const req = authedReq("http://localhost/api/bookings/bk1", "DELETE", "pro-user", "pro");
    const res = await deleteBooking(req, { params: Promise.resolve({ id: "bk1" }) });
    expect(res.status).toBe(200);
  });
});
