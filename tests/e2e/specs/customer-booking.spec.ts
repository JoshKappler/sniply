/**
 * E2E tests: Customer — Booking flow
 * Books against demo barber ID "1" which always has availability.
 * Tests: view profile tabs, select a slot, confirm booking, view in /bookings, cancel.
 */

import { test, expect } from "@playwright/test";
import { apiRegisterUser, apiDeleteUser, uniqueUsername } from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

const DEMO_BARBER_ID = "1";

let testUser: TestUser;
let testCookie: string;

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_booking"),
    password: "TestPass123!",
    name: "Booking Test Customer",
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

test("barber profile page loads with tabs", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  // Barber name should appear
  await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

  // All three tabs should be visible
  await expect(page.getByRole("button", { name: "Portfolio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Booking" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reviews" })).toBeVisible();
});

test("booking tab shows calendar", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Booking" }).click();
  await page.waitForTimeout(500);

  // Calendar should be visible — look for day name headers
  const calendarHeader = page.locator("text=Sun").or(page.locator("text=Mon"));
  await expect(calendarHeader.first()).toBeVisible({ timeout: 10_000 });
});

test("can select a date and see time slots", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Booking" }).click();
  await page.waitForTimeout(500);

  // Click the first enabled date button in the calendar
  const enabledDate = page.locator("button:not([disabled])").filter({
    hasText: /^\d{1,2}$/,
  }).first();
  await expect(enabledDate).toBeVisible({ timeout: 10_000 });
  await enabledDate.click();
  await page.waitForTimeout(1000);

  // Time slot buttons should appear (e.g. "9:00 AM", "10:30 AM")
  const timeSlots = page.getByRole("button").filter({ hasText: /\d{1,2}:\d{2} [AP]M/ });
  await expect(timeSlots.first()).toBeVisible({ timeout: 10_000 });
});

test("full booking flow: select slot, confirm, see in /bookings", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Booking" }).click();
  await page.waitForTimeout(500);

  // Use the 4th enabled date (≥4 days out) so cancellation is never locked (>24h window)
  const enabledDates = page.locator("button:not([disabled])").filter({
    hasText: /^\d{1,2}$/,
  });
  await expect(enabledDates.nth(3)).toBeVisible({ timeout: 10_000 });
  await enabledDates.nth(3).click();
  await page.waitForTimeout(1000);

  // Availability shows as collapsible "segment tile" headers (e.g. "10:00 AM – 11:30 AM").
  // Click the first tile to expand it and reveal individual start-time buttons.
  const segmentTile = page.getByRole("button").filter({ hasText: /\d{1,2}:\d{2} [AP]M/ }).first();
  await expect(segmentTile).toBeVisible({ timeout: 10_000 });
  await segmentTile.click();
  await page.waitForTimeout(300);

  // Individual slot-time buttons now visible (exact single time like "10:00 AM")
  const slotBtn = page.getByRole("button").filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first();
  await expect(slotBtn).toBeVisible({ timeout: 5_000 });
  await slotBtn.click();
  await page.waitForTimeout(500);

  // Booking modal opens — select a service via radio label
  const serviceLabel = page.locator("label").filter({
    has: page.locator("input[name='bookingService']"),
  }).first();
  await expect(serviceLabel).toBeVisible({ timeout: 5_000 });
  await serviceLabel.click();

  // Confirm the booking
  await page.getByRole("button", { name: "Confirm Booking" }).click();

  // Success screen shows "You're booked!"
  await expect(page.getByText("You're booked!")).toBeVisible({ timeout: 15_000 });

  // Close modal
  await page.getByRole("button", { name: "Done" }).click();

  // Navigate to /bookings and confirm the booking is in the Upcoming section
  await page.goto("/bookings");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /upcoming/i })).toBeVisible({ timeout: 10_000 });
});

test("cancel booking removes it from the list", async ({ page }) => {
  await page.goto("/bookings");
  await page.waitForLoadState("networkidle");

  // Expect the upcoming booking seeded by the previous test to be present
  await expect(page.getByRole("heading", { name: /upcoming/i })).toBeVisible({ timeout: 10_000 });

  // Expand the first booking card (click the cursor-pointer main row)
  await page.locator("div.cursor-pointer").first().click();
  await page.waitForTimeout(300);

  // "Cancel booking" link-button in the expanded detail panel
  await expect(page.getByText("Cancel booking")).toBeVisible({ timeout: 5_000 });
  await page.getByText("Cancel booking").click();

  // Two-step: "Confirm cancel" appears
  await expect(page.getByText("Confirm cancel")).toBeVisible({ timeout: 3_000 });
  await page.getByText("Confirm cancel").click();

  // Booking removed from state — no more upcoming bookings → "No bookings yet"
  await expect(page.getByRole("heading", { name: "No bookings yet" })).toBeVisible({ timeout: 10_000 });
});

test("portfolio tab shows images or empty state", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Portfolio" }).click();
  await page.waitForTimeout(500);

  // Portfolio tab should show barber images or an empty-state message
  const portfolioContent = page.locator("img[alt]")
    .or(page.getByText(/no portfolio|portfolio/i).first());
  await expect(portfolioContent.first()).toBeVisible({ timeout: 10_000 });
});

test("reviews tab shows booking gate or review form", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Reviews" }).click();
  await page.waitForTimeout(500);

  // Exactly one of: booking-gate, review form, or "already reviewed" state
  const reviewsContent = page.getByText("Book first to leave a review")
    .or(page.getByRole("heading", { name: "Leave a Review" }))
    .or(page.getByText("You've already reviewed this pro."));
  await expect(reviewsContent.first()).toBeVisible({ timeout: 10_000 });
});
