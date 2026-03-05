/**
 * E2E tests: Customer — Reviews
 * Tests writing a review on a barber profile.
 *
 * IMPORTANT: The UI has a booking gate — "Book first to leave a review"
 * is shown unless the user has a booking for the barber (hasBooked = true).
 * We seed a booking via API in beforeAll to unlock the review form.
 */

import { test, expect } from "@playwright/test";
import {
  apiRegisterUser,
  apiDeleteUser,
  apiCreateBooking,
  uniqueUsername,
  futureDate,
} from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

const DEMO_BARBER_ID = "2"; // Use barber 2; separate from booking tests on barber 1

let testUser: TestUser;
let testCookie: string;

test.beforeAll(async () => {
  const result = await apiRegisterUser({
    username: uniqueUsername("e2e_review"),
    password: "TestPass123!",
    name: "Review Test Customer",
    role: "customer",
  });
  testUser = result.user;
  testCookie = result.cookie;

  // Seed a booking against barber 2 so the UI review gate opens (hasBooked = true)
  await apiCreateBooking(testCookie, {
    id: `e2e-review-booking-${Date.now()}`,
    barberId: DEMO_BARBER_ID,
    barberName: "Demo Barber 2",
    service: "Fade",
    duration: 30,
    date: futureDate(14),
    time: "11:00 AM",
    endTime: "11:30 AM",
    userId: testUser.id,
    userName: testUser.name,
    status: "upcoming",
    price: 35,
    createdAt: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  await apiDeleteUser(testUser.id, testCookie).catch(() => {});
});

test.beforeEach(async ({ page }) => {
  await injectAuthState(page, testUser, testCookie);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("reviews tab shows review form when customer has a booking", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Reviews" }).click();
  await page.waitForTimeout(500);

  // After seeding a booking, the review form should appear (not "Book first" message)
  const reviewFormOrBtn = page.getByRole("button", { name: /write a review|submit/i })
    .or(page.locator("textarea"))
    .or(page.locator("text=Write a Review"));

  await expect(reviewFormOrBtn.first()).toBeVisible({ timeout: 15_000 });
});

test("can submit a review via star rating and text", async ({ page }) => {
  await page.goto(`/barber/${DEMO_BARBER_ID}`);
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Reviews" }).click();
  await page.waitForTimeout(500);

  // Stars render as <button> elements with exactly "★" as text content
  const stars = page.locator("button").filter({ hasText: /^★$/ });
  await expect(stars.nth(3)).toBeVisible({ timeout: 10_000 });
  await stars.nth(3).click(); // click 4th star (0-indexed) for rating 4

  // Fill the review textarea
  const textarea = page.locator("textarea");
  await expect(textarea).toBeVisible({ timeout: 5_000 });
  await textarea.fill("Great barber! Very skilled and professional. E2E test review.");

  // Submit
  const submitBtn = page.getByRole("button", { name: "Submit Review" });
  await expect(submitBtn).toBeVisible({ timeout: 3_000 });
  await submitBtn.click();
  await page.waitForTimeout(1500);

  // Exact success text shown in the green confirmation div
  await expect(page.getByText("Review submitted — thank you!")).toBeVisible({ timeout: 10_000 });
});

test("without a booking the reviews tab shows booking-required message", async ({ page }) => {
  // Test against a different barber (barber 3) where this user has no booking
  await page.goto("/barber/3");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: "Reviews" }).click();
  await page.waitForTimeout(500);

  // Should show the "Book first to leave a review" gate
  const gate = page.getByText(/book first|only clients who have booked/i);
  await expect(gate.first()).toBeVisible({ timeout: 10_000 });
});
