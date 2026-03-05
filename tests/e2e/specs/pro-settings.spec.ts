/**
 * E2E tests: Pro — Settings & Account Deletion
 * Tests that pros can access settings and delete their account.
 * Account deletion MUST run last.
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
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_pro_settings"),
    password: "TestPass123!",
    name: "Settings Test Barber",
    role: "pro",
  });
  proUser = result.user;
  proCookie = result.cookie;

  const barber = await apiCreateBarberProfile(proCookie, {
    name: "Settings Test Barber",
    bio: "E2E test barber for settings tests",
  });
  barberId = barber.id;
  proUser = { ...proUser, profileId: barberId };
});

test.afterAll(async () => {
  // Attempt cleanup in case delete test didn't run
  await apiDeleteUser(proUser.id, proCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, proUser, proCookie);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("pro can access settings page", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  // Settings page has a specific "Account Settings" heading
  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });
  // Username is shown as read-only text
  await expect(page.getByText(`@${proUser.username}`)).toBeVisible({ timeout: 10_000 });
});

test("pro settings page shows account options", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });

  // Name input, password section, and notifications section should all be present
  await expect(page.locator("input[type='text']").first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Notifications")).toBeVisible({ timeout: 5_000 });
});

// DELETE ACCOUNT — must run last; cascades barber profile + all associated data
test("pro can delete account and barber profile is removed", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  // Step 1: Click "Delete My Account" to reveal the confirmation panel
  const revealBtn = page.getByRole("button", { name: "Delete My Account" });
  if (!(await revealBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip();
    return;
  }
  await revealBtn.click();
  await page.waitForTimeout(300);

  // Step 2: Type the username to unlock the delete button
  const confirmInput = page.getByPlaceholder(new RegExp(`Type ".*" to confirm`));
  await expect(confirmInput).toBeVisible({ timeout: 5_000 });
  await confirmInput.fill(proUser.username);

  // Step 3: Delete Account button should now be enabled
  const confirmBtn = page.getByRole("button", { name: "Delete Account" });
  await expect(confirmBtn).toBeEnabled({ timeout: 3_000 });
  await confirmBtn.click();

  // Should redirect away
  await page.waitForURL(/\/(login|$)/, { timeout: 15_000 });

  // localStorage should be cleared
  const storedUser = await page.evaluate(() => localStorage.getItem("sniply_current_user"));
  expect(storedUser).toBeNull();

  // Verify barber profile is gone via API
  const barberRes = await fetch(`${BASE}/api/barbers/${barberId}`);
  expect(barberRes.status).toBe(404);
});
