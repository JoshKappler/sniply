import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/server-auth";

const mockPoolQuery = vi.fn();
const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  rowToThread: (r: Record<string, unknown>) => ({
    id: r.thread_id, customerId: r.customer_id ?? undefined,
    customerName: r.customer_name ?? "", preview: r.preview ?? "",
    timestamp: r.ts ? new Date(r.ts as string).toISOString() : new Date().toISOString(),
    unread: Boolean(r.unread), messages: r.messages ?? [],
  }),
  rowToCustomerThread: (r: Record<string, unknown>) => ({
    proProfileId: r.pro_profile_id ?? "", proName: r.pro_name ?? "",
    threadId: r.thread_id, lastMessage: r.last_message ?? undefined,
    timestamp: r.ts ? new Date(r.ts as string).toISOString() : new Date().toISOString(),
    unread: Boolean(r.unread),
  }),
  pool: vi.fn(() => ({ query: mockPoolQuery, connect: vi.fn().mockResolvedValue(mockClient) })),
}));

import * as db from "@/lib/db";
import { GET as getProThreads, PUT as updateProThreads } from "@/app/api/threads/[proId]/route";
import { GET as getCustomerThreads, PUT as updateCustomerThreads } from "@/app/api/customer-threads/[customerId]/route";

const mockQuery = vi.mocked(db.query);
const mockQueryOne = vi.mocked(db.queryOne);

const THREAD_ROW = {
  pro_id: "pro-1", thread_id: "t1", customer_id: "u1", customer_name: "Alice",
  preview: "Hey", ts: "2026-02-01T12:00:00Z", unread: true, messages: [],
};

const THREAD: import("@/lib/types").MessageThread = {
  id: "t1", customerId: "u1", customerName: "Alice", preview: "Hey",
  timestamp: "2026-02-01T12:00:00.000Z", unread: true, messages: [],
};

function authedReq(url: string, method: string, userId: string, role: string, body?: unknown) {
  const token = signSession(userId, role);
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE}=${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [] });
  mockClient.query.mockResolvedValue({ rows: [] });
  mockClient.release.mockResolvedValue(undefined);
});

describe("GET /api/threads/[proId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/threads/pro-1");
    const res = await getProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "pro-2" });
    const req = authedReq("http://localhost/api/threads/pro-1", "GET", "pro-user", "pro");
    const res = await getProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns threads array for owning pro", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "pro-1" }); // ownership
    mockQuery.mockResolvedValueOnce([THREAD_ROW]);
    const req = authedReq("http://localhost/api/threads/pro-1", "GET", "pro-user", "pro");
    const res = await getProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("t1");
  });

  it("returns only own threads for customer", async () => {
    mockQuery.mockResolvedValueOnce([THREAD_ROW]);
    const req = authedReq("http://localhost/api/threads/pro-1", "GET", "u1", "customer");
    const res = await getProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/threads/[proId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/threads/pro-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([THREAD]),
    });
    const res = await updateProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when pro does not own the profile", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "pro-2" });
    const req = authedReq("http://localhost/api/threads/pro-1", "PUT", "pro-user", "pro", [THREAD]);
    const res = await updateProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(403);
  });

  it("allows pro to upsert their threads", async () => {
    mockQueryOne.mockResolvedValueOnce({ profile_id: "pro-1" }); // ownership
    mockQuery.mockResolvedValueOnce([THREAD_ROW]);               // return threads
    const req = authedReq("http://localhost/api/threads/pro-1", "PUT", "pro-user", "pro", [THREAD]);
    const res = await updateProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(200);
  });

  it("allows customer to upsert their own threads", async () => {
    mockQuery.mockResolvedValueOnce([]); // return threads
    const req = authedReq("http://localhost/api/threads/pro-1", "PUT", "u1", "customer", [THREAD]);
    const res = await updateProThreads(req, { params: Promise.resolve({ proId: "pro-1" }) });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/customer-threads/[customerId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/customer-threads/u1");
    const res = await getCustomerThreads(req, { params: Promise.resolve({ customerId: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/customer-threads/u1", "GET", "u-other", "customer");
    const res = await getCustomerThreads(req, { params: Promise.resolve({ customerId: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("returns customer thread refs", async () => {
    const ctRow = { customer_id: "u1", thread_id: "t1", pro_profile_id: "pro-1",
      pro_name: "Marcus", pro_avatar: null, last_message: "Hey", ts: "2026-01-01T00:00:00Z", unread: false };
    mockQuery.mockResolvedValueOnce([ctRow]);
    const req = authedReq("http://localhost/api/customer-threads/u1", "GET", "u1", "customer");
    const res = await getCustomerThreads(req, { params: Promise.resolve({ customerId: "u1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].threadId).toBe("t1");
  });
});

describe("PUT /api/customer-threads/[customerId]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/customer-threads/u1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    const res = await updateCustomerThreads(req, { params: Promise.resolve({ customerId: "u1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when session userId does not match", async () => {
    const req = authedReq("http://localhost/api/customer-threads/u1", "PUT", "u-other", "customer", []);
    const res = await updateCustomerThreads(req, { params: Promise.resolve({ customerId: "u1" }) });
    expect(res.status).toBe(403);
  });

  it("updates customer threads and returns 200", async () => {
    mockQuery.mockResolvedValueOnce([]); // final SELECT
    const req = authedReq("http://localhost/api/customer-threads/u1", "PUT", "u1", "customer", []);
    const res = await updateCustomerThreads(req, { params: Promise.resolve({ customerId: "u1" }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
