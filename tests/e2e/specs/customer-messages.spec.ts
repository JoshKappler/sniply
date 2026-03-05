/**
 * E2E tests: Customer — Messaging
 * Seeds a message thread via API in beforeAll, then tests the /messages page
 * and sending a message from the barber profile page.
 */

import { test, expect } from "@playwright/test";
import { apiRegisterUser, apiDeleteUser, uniqueUsername, BASE } from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

const DEMO_BARBER_ID = "3"; // Use barber 3 to avoid conflicts

let testUser: TestUser;
let testCookie: string;
let seededThreadId: string;
let barberName: string;

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_msg"),
    password: "TestPass123!",
    name: "Message Test Customer",
    role: "customer",
  });
  testUser = result.user;
  testCookie = result.cookie;

  // Fetch the demo barber's name
  const barberRes = await fetch(`${BASE}/api/barbers/${DEMO_BARBER_ID}`, {
    headers: { Cookie: `sniply_session=${testCookie}` },
  });
  if (barberRes.ok) {
    const barber = await barberRes.json() as { name: string };
    barberName = barber.name;
  } else {
    barberName = "Demo Barber";
  }

  // Seed a message thread using the customer's session
  // (PUT /api/threads/[proId] allows customers to upsert their own threads)
  seededThreadId = `thread-e2e-msg-${Date.now()}`;
  const threadPayload = [
    {
      id: seededThreadId,
      customerId: testUser.id,
      customerName: testUser.name,
      preview: "Hello from E2E test",
      timestamp: new Date().toISOString(),
      unread: false,
      messages: [
        {
          from: "customer" as const,
          text: "Hello from E2E test",
          time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        },
      ],
    },
  ];

  const threadRes = await fetch(`${BASE}/api/threads/${DEMO_BARBER_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${testCookie}`,
    },
    body: JSON.stringify(threadPayload),
  });
  if (!threadRes.ok) {
    const body = await threadRes.text().catch(() => "(no body)");
    throw new Error(`Thread seed failed: HTTP ${threadRes.status} — ${body}`);
  }

  // Seed the customer thread ref so it appears on /messages
  const customerRefPayload = [
    {
      proProfileId: DEMO_BARBER_ID,
      proName: barberName,
      threadId: seededThreadId,
      lastMessage: "Hello from E2E test",
      timestamp: new Date().toISOString(),
      unread: false,
    },
  ];

  const refRes = await fetch(`${BASE}/api/customer-threads/${testUser.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${testCookie}`,
    },
    body: JSON.stringify(customerRefPayload),
  });
  if (!refRes.ok) {
    const body = await refRes.text().catch(() => "(no body)");
    throw new Error(`Customer thread ref seed failed: HTTP ${refRes.status} — ${body}`);
  }
});

test.afterAll(async () => {
  await apiDeleteUser(testUser.id, testCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, testUser, testCookie);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("barber profile page has a Message button", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  // The Message button is always present for logged-in customers
  const messageBtn = page.getByRole("button", { name: "Message" });
  await expect(messageBtn).toBeVisible({ timeout: 15_000 });
});

test("can send a message from the barber profile page", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  // Click the Message button to open the MessageModal
  await page.getByRole("button", { name: "Message" }).click();
  await page.waitForTimeout(500);

  // MessageModal textarea: placeholder is "Message ${firstName}…"
  const textarea = page.locator("textarea[placeholder^='Message']");
  await expect(textarea).toBeVisible({ timeout: 5_000 });

  const msgText = "Hey, just checking availability for next week!";
  await textarea.fill(msgText);

  // Click the send button (arrow icon button next to textarea)
  const sendBtn = page.locator("button[disabled]").or(page.locator("button")).filter({
    has: page.locator("svg"),
  }).last();
  // Use keyboard Enter instead — more reliable
  await textarea.press("Enter");
  await page.waitForTimeout(1000);

  // The sent message should appear in the conversation
  await expect(page.getByText(msgText)).toBeVisible({ timeout: 10_000 });
});

test("messages page shows seeded thread in list", async ({ page }) => {
  await page.goto("/messages");
  await page.waitForLoadState("networkidle");

  // The "Messages" h1 should always be present
  await expect(page.getByRole("heading", { name: "Messages", level: 1 })).toBeVisible({ timeout: 10_000 });

  // The seeded barber's thread should appear
  await expect(page.getByText(barberName)).toBeVisible({ timeout: 10_000 });
});

test("clicking thread shows the conversation", async ({ page }) => {
  await page.goto("/messages");
  await page.waitForLoadState("networkidle");

  // Wait for thread list to load
  await expect(page.getByText(barberName)).toBeVisible({ timeout: 10_000 });

  // Click the thread button
  const threadBtn = page.locator("button").filter({ hasText: barberName });
  await threadBtn.first().click();
  await page.waitForTimeout(500);

  // The seeded message text should appear in the conversation panel
  await expect(page.getByText("Hello from E2E test")).toBeVisible({ timeout: 10_000 });

  // Reply input should be visible
  const replyInput = page.locator("input[type='text'][placeholder^='Message']");
  await expect(replyInput).toBeVisible({ timeout: 5_000 });
});

test("can send a reply from the messages page", async ({ page }) => {
  await page.goto("/messages");
  await page.waitForLoadState("networkidle");

  // Wait for threads to load and click the seeded thread
  await expect(page.getByText(barberName)).toBeVisible({ timeout: 10_000 });
  await page.locator("button").filter({ hasText: barberName }).first().click();
  await page.waitForTimeout(500);

  // Type and send a reply
  const replyInput = page.locator("input[type='text'][placeholder^='Message']");
  await expect(replyInput).toBeVisible({ timeout: 5_000 });

  const replyText = "E2E reply message from /messages page";
  await replyInput.fill(replyText);
  await replyInput.press("Enter");
  await page.waitForTimeout(1000);

  // The reply appears in the conversation (first match = thread list preview is fine too)
  await expect(page.getByText(replyText).first()).toBeVisible({ timeout: 10_000 });
});
