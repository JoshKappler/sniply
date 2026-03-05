/**
 * E2E tests: Pro — Messages tab
 * Tests viewing and replying to customer messages via the pro dashboard.
 */

import { test, expect } from "@playwright/test";
import {
  apiRegisterUser,
  apiDeleteUser,
  apiCreateBarberProfile,
  uniqueUsername,
  BASE,
} from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

let proUser: TestUser;
let proCookie: string;
let barberId: string;

test.beforeAll(async () => {
  const proResult = await apiRegisterUser({
    username: uniqueUsername("e2e_pro_msg"),
    password: "TestPass123!",
    name: "Messages Test Barber",
    role: "pro",
  });
  proUser = proResult.user;
  proCookie = proResult.cookie;

  const barber = await apiCreateBarberProfile(proCookie, {
    name: "Messages Test Barber",
    bio: "E2E test barber for message tests",
  });
  barberId = barber.id;
  proUser = { ...proUser, profileId: barberId };

  // Seed a message thread by posting directly to the threads API
  const threadData = [
    {
      id: `thread-e2e-${Date.now()}`,
      customerId: "test-customer-id",
      customerName: "E2E Test Customer",
      preview: "Hello, I'd like to book",
      timestamp: new Date().toISOString(),
      unread: true,
      messages: [
        {
          from: "customer" as const,
          text: "Hello, I'd like to book an appointment!",
          time: new Date().toLocaleTimeString(),
        },
      ],
    },
  ];

  const seedRes = await fetch(`${BASE}/api/threads/${barberId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${proCookie}`,
    },
    body: JSON.stringify(threadData),
  });

  if (!seedRes.ok) {
    const body = await seedRes.text().catch(() => "(no body)");
    throw new Error(`Thread seeding failed: HTTP ${seedRes.status} — ${body}`);
  }
});

test.afterAll(async () => {
  await apiDeleteUser(proUser.id, proCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, proUser, proCookie);
  await page.goto("/pro/dashboard");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => !document.body?.textContent?.includes("Loading dashboard..."),
    { timeout: 20_000 }
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("messages tab renders on dashboard", async ({ page }) => {
  await page.locator("aside").getByRole("button", { name: "Messages" }).click();
  await page.waitForTimeout(500);

  await expect(page.locator("body")).not.toContainText("Something went wrong");
  await expect(page.locator("body")).toBeVisible();
});

test("seeded message thread appears in messages tab", async ({ page }) => {
  await page.locator("aside").getByRole("button", { name: "Messages" }).click();

  // Confirm the Messages tab is active (heading appears)
  await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible({ timeout: 10_000 });

  // Wait for skeleton loaders to clear (threadsLoaded = true)
  await page.waitForFunction(
    () => document.querySelectorAll(".animate-pulse").length === 0,
    { timeout: 15_000 }
  ).catch(() => {});
  await page.waitForTimeout(1000);

  // Should show the thread with the customer name
  const thread = page.getByText("E2E Test Customer");
  await expect(thread).toBeVisible({ timeout: 15_000 });
});

test("can click on thread to see messages", async ({ page }) => {
  await page.locator("aside").getByRole("button", { name: "Messages" }).click();
  await page.waitForTimeout(1000);

  // Thread was seeded in beforeAll — must be visible
  const threadBtn = page.getByText("E2E Test Customer");
  await expect(threadBtn).toBeVisible({ timeout: 15_000 });
  await threadBtn.click();
  await page.waitForTimeout(500);

  // Should see the message text
  await expect(page.getByText("Hello, I'd like to book an appointment!")).toBeVisible({ timeout: 10_000 });
});

test("can reply to a message thread", async ({ page }) => {
  await page.locator("aside").getByRole("button", { name: "Messages" }).click();
  await page.waitForTimeout(1000);

  // Thread was seeded in beforeAll — must be visible
  const threadBtn = page.getByText("E2E Test Customer");
  await expect(threadBtn).toBeVisible({ timeout: 15_000 });
  await threadBtn.click();
  await page.waitForTimeout(500);

  // Find reply input — the pro dashboard message reply textarea/input
  const replyInput = page.getByPlaceholder(/message/i).or(page.getByRole("textbox")).last();
  await expect(replyInput).toBeVisible({ timeout: 5_000 });

  await replyInput.fill("Thanks for reaching out! Let me check my availability.");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);

  await expect(page.getByText("Thanks for reaching out!").first()).toBeVisible({ timeout: 10_000 });
});
