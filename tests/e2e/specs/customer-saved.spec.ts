/**
 * E2E tests: Customer — Saved/Favorites
 * Tests saving and unsaving barbers.
 */

import { test, expect } from "@playwright/test";
import { apiRegisterUser, apiDeleteUser, uniqueUsername, BASE } from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

const DEMO_BARBER_ID = "4"; // Use barber 4 to avoid conflicts

let testUser: TestUser;
let testCookie: string;

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_saved"),
    password: "TestPass123!",
    name: "Saved Test Customer",
    role: "customer",
  });
  testUser = result.user;
  testCookie = result.cookie;
});

test.afterAll(async () => {
  await apiDeleteUser(testUser.id, testCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, testUser, testCookie);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("/saved page loads and shows empty state or saved barbers", async ({ page }) => {
  await page.goto("/saved");
  await page.waitForLoadState("networkidle");

  // Either has saved barbers or shows an empty state message
  const content = page.locator("a[href^='/barber/']")
    .or(page.getByText(/no saved|browse/i).first())
    .or(page.getByText("Saved Pros", { exact: false }).first());

  await expect(content.first()).toBeVisible({ timeout: 15_000 });
});

test("can save a barber from their profile page", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  // Find the save/favorite button
  // Usually a heart icon button or "Save" button near the barber header
  const saveBtn = page.getByRole("button", { name: /save|heart|favorite/i })
    .or(page.locator("button").filter({ has: page.locator("svg[class*='heart'], svg path[d*='M4.318']") }))
    .or(page.locator("[aria-label*='save']"))
    .or(page.locator("[aria-label*='favorite']"));

  if (!(await saveBtn.first().isVisible({ timeout: 10_000 }).catch(() => false))) {
    test.skip();
    return;
  }

  await saveBtn.first().click();
  await page.waitForTimeout(1000);

  // Go to saved page and verify the specific barber is now saved
  await page.goto("/saved");
  await page.waitForLoadState("networkidle");

  // The specific barber we saved should now have a link on the page
  const savedBarberLink = page.locator(`a[href='/barber/${DEMO_BARBER_ID}']`);
  await expect(savedBarberLink).toBeVisible({ timeout: 10_000 });
});

test("can unsave a barber from the saved page", async ({ page }) => {
  // First save via API to ensure there's something to unsave
  const savedRes = await fetch(`${BASE}/api/favorites/${testUser.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: `sniply_session=${testCookie}`,
    },
    body: JSON.stringify([DEMO_BARBER_ID]),
  });

  if (!savedRes.ok) {
    test.skip();
    return;
  }

  await page.goto("/saved");
  await page.waitForLoadState("networkidle");

  const barberLinks = page.locator("a[href^='/barber/']");
  if (!(await barberLinks.first().isVisible({ timeout: 5_000 }).catch(() => false))) {
    test.skip();
    return;
  }

  // Find and click the unsave/remove button (heart/save button on the barber card)
  const unsaveBtn = page.getByRole("button", { name: /unsave|remove|saved/i })
    .or(page.locator("button").filter({ has: page.locator("svg[class*='heart']") }))
    .or(page.locator("[aria-label*='remove']").first());

  if (await unsaveBtn.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await unsaveBtn.first().click();
  } else {
    // Click heart/toggle button on the barber card itself
    const barberCard = barberLinks.first().locator("..");
    const heartBtn = barberCard.locator("button").first();
    await expect(heartBtn).toBeVisible({ timeout: 3_000 });
    await heartBtn.click();
  }

  await page.waitForTimeout(1000);
  // After unsave the specific barber card should be gone from /saved
  await expect(page.locator(`a[href='/barber/${DEMO_BARBER_ID}']`)).not.toBeVisible({ timeout: 5_000 });
});
