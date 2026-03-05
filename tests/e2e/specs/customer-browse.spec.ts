/**
 * E2E tests: Customer — Browse page
 * Tests browsing barbers, filtering, switching to map view, and navigating to a profile.
 */

import { test, expect } from "@playwright/test";
import { apiRegisterUser, apiDeleteUser, uniqueUsername } from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

let testUser: TestUser;
let testCookie: string;

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_browse"),
    password: "TestPass123!",
    name: "Browse Test Customer",
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
  await page.goto("/browse");
  // Wait for barber cards to load
  await page.waitForLoadState("networkidle");
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("browse page loads and shows barber cards", async ({ page }) => {
  // At least one barber card should be visible
  const cards = page.locator("article, [data-testid='barber-card']")
    .or(page.locator(".barber-card"))
    .or(page.locator("a[href^='/barber/']").locator(".."));

  // More broadly: look for links to barber profiles
  const barberLinks = page.locator("a[href^='/barber/']");
  await expect(barberLinks.first()).toBeVisible({ timeout: 15_000 });

  const count = await barberLinks.count();
  expect(count).toBeGreaterThan(0);
});

test("browse page has a search/filter area", async ({ page }) => {
  // Should have some kind of filter or search UI
  const filterEl = page.getByRole("button", { name: /filter/i })
    .or(page.getByPlaceholder(/search|location/i).first());
  await expect(filterEl.first()).toBeVisible({ timeout: 10_000 });
});

test("clicking a barber card navigates to barber profile", async ({ page }) => {
  const barberLinks = page.locator("a[href^='/barber/']");
  await expect(barberLinks.first()).toBeVisible({ timeout: 15_000 });

  // Click the first barber card/link
  await barberLinks.first().click();

  // URL should change to /barber/[id]
  await page.waitForURL(/\/barber\/\w+/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/barber\//);
});

test("map view toggle shows map container", async ({ page }) => {
  // The Map toggle button is always present in the browse toolbar
  const mapBtn = page.getByRole("button", { name: "Map" }).first();
  await expect(mapBtn).toBeVisible({ timeout: 10_000 });
  await mapBtn.click();
  await page.waitForTimeout(500);
  // Leaflet map renders inside a div with class "leaflet-container"
  const mapContainer = page.locator(".leaflet-container");
  await expect(mapContainer).toBeVisible({ timeout: 15_000 });
});

test("filter modal opens when filter button is clicked", async ({ page }) => {
  // The Filters button is always present in the browse toolbar
  const filterBtn = page.getByRole("button", { name: /filter/i });
  await expect(filterBtn).toBeVisible({ timeout: 10_000 });
  await filterBtn.click();
  await page.waitForTimeout(300);
  // FilterModal renders an h2 "Filters"
  await expect(page.getByRole("heading", { name: "Filters", exact: true })).toBeVisible({ timeout: 5_000 });
});
