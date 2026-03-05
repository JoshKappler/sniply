/**
 * E2E tests: Customer — Account Settings
 * Tests updating name, changing password, notification prefs, and account deletion.
 * Account deletion test MUST run last (it destroys the account).
 */

import { test, expect } from "@playwright/test";
import { apiRegisterUser, apiDeleteUser, uniqueUsername } from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

let testUser: TestUser;
let testCookie: string;
const TEST_PASSWORD = "TestPass123!";

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_settings"),
    password: TEST_PASSWORD,
    name: "Settings Test Customer",
    role: "customer",
  });
  testUser = result.user;
  testCookie = result.cookie;
});

test.afterAll(async () => {
  // Clean up only if not deleted by the delete test
  await apiDeleteUser(testUser.id, testCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, testUser, testCookie);
  await page.goto("/settings");
  // Settings page has no polling — networkidle is fine here
  await page.waitForLoadState("networkidle");
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("settings page loads and shows Account Settings heading", async ({ page }) => {
  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });
  // Username is shown as read-only text
  await expect(page.getByText(`@${testUser.username}`)).toBeVisible({ timeout: 10_000 });
});

test("can update display name", async ({ page }) => {
  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });

  // The name input has label "Full Name" but no placeholder — select by being the only text input
  const nameInput = page.locator("input[type='text']").first();
  await expect(nameInput).toBeVisible({ timeout: 5_000 });

  await nameInput.clear();
  await nameInput.fill("Updated E2E Name");

  await page.getByRole("button", { name: "Save Name" }).click();
  await page.waitForTimeout(1500);

  // Success state: button text changes to "Name Updated ✓"
  await expect(page.getByRole("button").filter({ hasText: /Name Updated/ })).toBeVisible({ timeout: 8_000 });
});

test("wrong current password shows error", async ({ page }) => {
  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("Enter current password").fill("WrongPassword999!");
  await page.getByPlaceholder("Min. 6 characters").fill("NewPassword123!");
  await page.getByPlaceholder("Repeat new password").fill("NewPassword123!");

  await page.getByRole("button", { name: "Update Password" }).click();
  await page.waitForTimeout(2000);

  // Error appears under the current password field
  await expect(page.getByText(/incorrect|wrong|invalid/i).first()).toBeVisible({ timeout: 8_000 });
});

test("notification preferences have toggles visible", async ({ page }) => {
  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });

  // Notif prefs are custom toggle divs (not real checkboxes/switches — those are sr-only)
  // The section is "Notifications"
  await expect(page.getByText("Notifications")).toBeVisible({ timeout: 5_000 });

  // Click the label wrapping the first toggle — this toggles the sr-only checkbox
  const notifLabels = page.locator("label").filter({ has: page.locator("input[type='checkbox']") });
  const count = await notifLabels.count();
  expect(count).toBeGreaterThan(0);

  // Click the first toggle label
  await notifLabels.first().click();
  await page.waitForTimeout(300);

  // Save preferences
  await page.getByRole("button", { name: "Save Preferences" }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByRole("button").filter({ hasText: /Preferences Saved/ })).toBeVisible({ timeout: 8_000 });
});

// DELETE ACCOUNT — must run last
test("can delete account from settings", async ({ page }) => {
  await expect(page.getByText("Account Settings")).toBeVisible({ timeout: 15_000 });

  // Click "Delete My Account" to reveal the confirmation dialog
  await page.getByRole("button", { name: "Delete My Account" }).click();
  await page.waitForTimeout(300);

  // Confirmation dialog appears — must type USERNAME (not "DELETE")
  const confirmInput = page.getByPlaceholder(new RegExp(`Type "${testUser.username}" to confirm`));
  await expect(confirmInput).toBeVisible({ timeout: 5_000 });
  await confirmInput.fill(testUser.username);

  // The "Delete Account" button is now enabled
  const deleteBtn = page.getByRole("button", { name: "Delete Account" });
  await expect(deleteBtn).toBeEnabled({ timeout: 3_000 });
  await deleteBtn.click();

  // Should redirect to home after deletion
  await page.waitForURL(/\/(|login)$/, { timeout: 15_000 });

  // localStorage should be cleared
  const storedUser = await page.evaluate(() => localStorage.getItem("sniply_current_user"));
  expect(storedUser).toBeNull();
});
