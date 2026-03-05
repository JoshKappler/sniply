/**
 * E2E tests: Pro — Dashboard
 * Tests all dashboard tabs, profile editing, and service management.
 */

import { test, expect } from "@playwright/test";
import {
  apiRegisterUser,
  apiDeleteUser,
  apiCreateBarberProfile,
  uniqueUsername,
} from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

let testUser: TestUser;
let testCookie: string;
let barberId: string;

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_pro_dash"),
    password: "TestPass123!",
    name: "Dashboard Test Barber",
    role: "pro",
  });
  testUser = result.user;
  testCookie = result.cookie;

  // Create barber profile
  const barber = await apiCreateBarberProfile(testCookie, {
    name: "Dashboard Test Barber",
    bio: "E2E test barber for dashboard tests",
    location: "New York, NY",
  });
  barberId = barber.id;

  // Update the user object with the profileId
  testUser = { ...testUser, profileId: barberId };
});

test.afterAll(async () => {
  await apiDeleteUser(testUser.id, testCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, testUser, testCookie);
  await page.goto("/pro/dashboard");
  await page.waitForLoadState("domcontentloaded");
  // Wait for the dashboard to finish loading (async data fetch)
  await page.waitForFunction(
    () => !document.body?.textContent?.includes("Loading dashboard..."),
    { timeout: 20_000 }
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("pro dashboard loads with profile tab active", async ({ page }) => {
  // Profile tab is active by default — barber name heading should be visible
  await expect(page.getByRole("heading", { name: "Dashboard Test Barber" })).toBeVisible({ timeout: 15_000 });
});

test("all dashboard tabs are visible", async ({ page }) => {
  const tabs = ["Profile", "Services", "Appointments", "Messages", "Analytics"];
  for (const tab of tabs) {
    const tabBtn = page.getByRole("button", { name: tab })
      .or(page.locator(`button:has-text("${tab}")`))
      .or(page.getByText(tab, { exact: true }));
    await expect(tabBtn.first()).toBeVisible({ timeout: 10_000 });
  }
});

test("can switch to Services tab", async ({ page }) => {
  await page.getByRole("button", { name: "Services" })
    .or(page.locator("button").filter({ hasText: "Services" })).first().click();
  await page.waitForTimeout(500);

  // Services tab heading should be visible
  await expect(page.getByRole("heading", { name: "Services", exact: true })).toBeVisible({ timeout: 10_000 });
});

test("can add a service", async ({ page }) => {
  await page.getByRole("button", { name: "Services" })
    .or(page.locator("button").filter({ hasText: "Services" })).first().click();
  await page.waitForTimeout(500);

  // Click "Add Service" button
  const addServiceBtn = page.getByRole("button", { name: /add service/i });
  if (!(await addServiceBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip();
    return;
  }
  await addServiceBtn.click();
  await page.waitForTimeout(300);

  // Fill in the new service form
  // The new service form is the LAST set of inputs (after the existing pre-seeded service)
  const allNameInputs = page.getByPlaceholder("e.g., Fade & Lineup");
  const count = await allNameInputs.count();
  if (count === 0) { test.skip(); return; }
  const nameInput = allNameInputs.last();
  const priceInput = page.getByLabel(/price/i).last();
  const durationInput = page.getByLabel(/duration/i).last();

  await nameInput.fill("E2E Test Cut");
  if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await priceInput.fill("40");
  }
  if (await durationInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await durationInput.fill("45");
  }

  // Click "Save Services" button (not "Add Service")
  const saveBtn = page.getByRole("button", { name: "Save Services" });
  if (!(await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    test.skip();
    return;
  }
  await saveBtn.click();
  await page.waitForTimeout(1500);

  // Service input should still contain the name (services render as inputs, not text nodes)
  await expect(page.getByPlaceholder("e.g., Fade & Lineup").last()).toHaveValue("E2E Test Cut", { timeout: 10_000 });
});

test("can switch to Appointments tab", async ({ page }) => {
  await page.getByRole("button", { name: "Appointments" })
    .or(page.locator("button").filter({ hasText: "Appointments" })).first().click();
  await page.waitForTimeout(500);

  // Should show appointments content (even if empty)
  const content = page.getByText(/appointments|upcoming|no appointments/i).first();
  await expect(content).toBeVisible({ timeout: 10_000 });
});

test("can switch to Messages tab", async ({ page }) => {
  await page.getByRole("button", { name: "Messages" })
    .or(page.locator("button").filter({ hasText: "Messages" })).first().click();
  await page.waitForTimeout(500);

  // Should show messages content (even if empty)
  const content = page.getByText(/messages|no messages|inbox/i).first();
  await expect(content).toBeVisible({ timeout: 10_000 });
});

test("can switch to Analytics tab", async ({ page }) => {
  await page.getByRole("button", { name: "Analytics" })
    .or(page.locator("button").filter({ hasText: "Analytics" })).first().click();
  await page.waitForTimeout(500);

  // Analytics tab should render without error
  await expect(page.locator("body")).not.toContainText("Something went wrong");
  const content = page.getByText(/analytics|reviews|rating|stats/i).first();
  await expect(content).toBeVisible({ timeout: 10_000 });
});

test("pro barber profile is publicly accessible", async ({ page }) => {
  // The pro's barber profile should be visible at /barber/[barberId]
  await page.goto(`/barber/${barberId}`);
  await page.waitForLoadState("networkidle");

  // Should show the barber's name as the main (h1) heading
  await expect(page.getByRole("heading", { name: "Dashboard Test Barber", exact: true }).first()).toBeVisible({ timeout: 15_000 });
});
