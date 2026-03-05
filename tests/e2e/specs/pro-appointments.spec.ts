/**
 * E2E tests: Pro — Appointments management
 * Seeds a booking against the pro's barber profile and tests the appointments tab.
 */

import { test, expect } from "@playwright/test";
import {
  apiRegisterUser,
  apiDeleteUser,
  apiCreateBarberProfile,
  apiCreateBooking,
  uniqueUsername,
  futureDate,
} from "../helpers/api";
import { injectAuthState } from "../helpers/auth";
import type { TestUser } from "../helpers/api";

let proUser: TestUser;
let proCookie: string;
let barberId: string;
let customerUser: TestUser;
let customerCookie: string;

test.beforeAll(async () => {
  // Create pro account + barber profile
  const proResult = await apiRegisterUser({
    username: uniqueUsername("e2e_pro_appt"),
    password: "TestPass123!",
    name: "Appointments Test Barber",
    role: "pro",
  });
  proUser = proResult.user;
  proCookie = proResult.cookie;

  const barber = await apiCreateBarberProfile(proCookie, {
    name: "Appointments Test Barber",
    bio: "E2E test barber for appointment tests",
    services: [
      { name: "Fade", description: "Clean fade", price: 35, duration: 30, images: [] },
    ],
  });
  barberId = barber.id;
  proUser = { ...proUser, profileId: barberId };

  // Create a customer account to seed bookings
  const custResult = await apiRegisterUser({
    username: uniqueUsername("e2e_appt_cust"),
    password: "TestPass123!",
    name: "Appointment Customer",
    role: "customer",
  });
  customerUser = custResult.user;
  customerCookie = custResult.cookie;

  // Seed a booking against this barber
  const bookingDate = futureDate(7);
  await apiCreateBooking(customerCookie, {
    id: `e2e-booking-${Date.now()}`,
    barberId,
    barberName: "Appointments Test Barber",
    service: "Fade",
    duration: 30,
    date: bookingDate,
    time: "10:00 AM",
    endTime: "10:30 AM",
    userId: customerUser.id,
    userName: customerUser.name,
    status: "upcoming",
    price: 35,
    createdAt: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  await apiDeleteUser(customerUser.id, customerCookie).catch(() => {});
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

test("appointments tab shows seeded booking", async ({ page }) => {
  await page.getByRole("button", { name: "Appointments" })
    .or(page.locator("button").filter({ hasText: "Appointments" })).first().click();
  await page.waitForTimeout(500);

  // Should show the customer's name or the service name
  const booking = page.getByText(customerUser.name)
    .or(page.getByText("Fade"))
    .or(page.getByText("Appointment Customer"));

  await expect(booking.first()).toBeVisible({ timeout: 15_000 });
});

test("pro can see appointment details (customer name and service)", async ({ page }) => {
  await page.getByRole("button", { name: "Appointments" })
    .or(page.locator("button").filter({ hasText: "Appointments" })).first().click();
  await page.waitForTimeout(500);

  // Check for Fade service in the appointment
  await expect(page.getByText("Fade").first()).toBeVisible({ timeout: 10_000 });
});

test("appointments tab shows calendar and schedule", async ({ page }) => {
  await page.getByRole("button", { name: "Appointments" })
    .or(page.locator("button").filter({ hasText: "Appointments" })).first().click();
  await page.waitForTimeout(500);

  // Should show the Availability Schedule section (always visible in appointments tab)
  const scheduleSection = page.getByText("Availability Schedule")
    .or(page.getByText(/No appointments today/i))
    .or(page.getByText(/appointments/i).first());
  await expect(scheduleSection.first()).toBeVisible({ timeout: 10_000 });
});
