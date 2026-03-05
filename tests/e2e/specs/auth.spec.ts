/**
 * E2E tests: Authentication flows
 * Tests signup (customer + pro), login, logout, and auth guards.
 * Creates its own accounts — no shared fixture — and cleans up in afterAll.
 */

import { test, expect } from "@playwright/test";
import { apiRegisterUser, apiDeleteUser, apiLoginUser, uniqueUsername } from "../helpers/api";
import { LoginPage } from "../pages/LoginPage";

// Accounts created during tests — cleaned up in afterAll
const cleanup: { id: string; cookie: string }[] = [];

test.afterAll(async () => {
  for (const { id, cookie } of cleanup) {
    await apiDeleteUser(id, cookie).catch(() => {});
  }
});

// ── Customer signup ───────────────────────────────────────────────────────────

test("customer signup flow creates account and redirects to browse", async ({ page }) => {
  const username = uniqueUsername("e2e_csup");
  const password = "TestPass123!";

  await page.goto("/signup/role-selection");

  // Click the customer card CTA
  await page.getByRole("link", { name: "Join as Customer" }).click();
  await page.waitForURL("**/customer/profile-setup");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(300);

  // Step 1: Create Account
  // Username placeholder: "e.g., alex_hair"  password: "At least 6 characters"  confirm: "Repeat your password"
  await page.getByPlaceholder("e.g., alex_hair").fill(username);
  await page.getByPlaceholder("At least 6 characters").fill(password);
  await page.getByPlaceholder("Repeat your password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);

  // Step 2: Personal Info — first name required, last name + gender optional
  await page.getByPlaceholder("Enter your first name").fill("E2E");
  await page.getByPlaceholder("Enter your last name").fill("Customer");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);

  // Step 3: Hair type + texture (both required)
  // CustomSelect: click trigger button, then click the option text
  await page.getByRole("button", { name: /Select your hair type/i }).click();
  await page.waitForTimeout(200);
  await page.getByText("Straight (Type 1)").click();
  await page.waitForTimeout(200);

  await page.getByRole("button", { name: /Select your hair texture/i }).click();
  await page.waitForTimeout(200);
  await page.getByText("Fine").first().click();
  await page.waitForTimeout(200);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(500);

  // Steps 4–5 are optional — continue through them
  for (let i = 0; i < 3; i++) {
    const createBtn = page.getByRole("button", { name: "Create Account" });
    if (await createBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await createBtn.click();
      break;
    }
    const continueBtn = page.getByRole("button", { name: "Continue" });
    if (await continueBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // Should redirect to /browse after successful registration
  await page.waitForURL(/\/browse/, { timeout: 20_000 });

  // Capture user id + cookie for cleanup
  const userId = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("sniply_current_user") ?? "null")?.id ?? null;
    } catch { return null; }
  });

  if (userId) {
    const { cookie } = await apiLoginUser(username, password).catch(() => ({ user: null as never, cookie: "" }));
    if (cookie) cleanup.push({ id: userId, cookie });
  }
});

// ── Login with valid credentials ─────────────────────────────────────────────

test("login with valid credentials redirects customer to /browse", async ({ page }) => {
  const username = uniqueUsername("e2e_login");
  const { user, cookie } = await apiRegisterUser({
    username,
    password: "TestPass123!",
    name: "Login Test User",
    role: "customer",
  });
  cleanup.push({ id: user.id, cookie });

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, "TestPass123!");

  await page.waitForURL("**/browse", { timeout: 15_000 });
  await expect(page).toHaveURL(/browse/);

  // localStorage should contain the user
  const storedRole = await page.evaluate(() => localStorage.getItem("sniply_role"));
  expect(storedRole).toBe("customer");
});

test("login with valid credentials redirects pro to /pro/dashboard", async ({ page }) => {
  const username = uniqueUsername("e2e_pro_login");
  const { user, cookie } = await apiRegisterUser({
    username,
    password: "TestPass123!",
    name: "Pro Login User",
    role: "pro",
  });
  cleanup.push({ id: user.id, cookie });

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, "TestPass123!");

  await page.waitForURL("**/pro/dashboard", { timeout: 15_000 });
  await expect(page).toHaveURL(/pro\/dashboard/);
});

// ── Login with invalid credentials ───────────────────────────────────────────

test("login with wrong password shows error message", async ({ page }) => {
  const username = uniqueUsername("e2e_wrongpw");
  const { user, cookie } = await apiRegisterUser({
    username,
    password: "CorrectPass123!",
    name: "Wrong PW User",
    role: "customer",
  });
  cleanup.push({ id: user.id, cookie });

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, "WrongPassword999!");

  await expect(loginPage.errorMessage).toBeVisible({ timeout: 10_000 });
  await expect(loginPage.errorMessage).toContainText(/incorrect/i);
});

test("login with unknown username shows error message", async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login("definitely_no_such_user_xyz_999", "AnyPassword1!");

  await expect(loginPage.errorMessage).toBeVisible({ timeout: 10_000 });
  await expect(loginPage.errorMessage).toContainText(/incorrect/i);
});

// ── Logout ────────────────────────────────────────────────────────────────────

test("logout clears session and redirects to home or login", async ({ page }) => {
  const username = uniqueUsername("e2e_logout");
  const { user, cookie } = await apiRegisterUser({
    username,
    password: "TestPass123!",
    name: "Logout Test User",
    role: "customer",
  });
  cleanup.push({ id: user.id, cookie });

  // Log in via UI
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(username, "TestPass123!");
  await page.waitForURL("**/browse");

  // Open user dropdown in navbar and click Sign Out
  // The navbar shows user avatar/name with a dropdown
  const userMenuTrigger = page.locator("nav").getByRole("button").filter({ hasText: /logout user|sign out/i })
    .or(page.locator("nav button[aria-label*='menu']"))
    .or(page.locator("nav button").last());

  // Try clicking the user avatar/name button in navbar
  const navbarButtons = page.locator("nav").getByRole("button");
  const count = await navbarButtons.count();

  // Click the last button in nav (usually user menu)
  if (count > 0) {
    await navbarButtons.last().click();
  }

  // Look for Sign Out link/button
  const signOutBtn = page.getByRole("button", { name: /sign out|log out/i })
    .or(page.getByRole("menuitem", { name: /sign out|log out/i }))
    .or(page.getByText(/sign out|log out/i).first());

  await signOutBtn.waitFor({ timeout: 5_000 });
  await signOutBtn.click();

  // Should redirect away from authenticated pages
  await page.waitForURL(/\/(login|$)/, { timeout: 10_000 });

  // localStorage should be cleared
  const storedUser = await page.evaluate(() => localStorage.getItem("sniply_current_user"));
  expect(storedUser).toBeNull();
});

// ── Auth guards ───────────────────────────────────────────────────────────────

test("unauthenticated user visiting /bookings is redirected to login", async ({ page }) => {
  // Don't inject any auth state — visit protected page cold
  await page.goto("/bookings");
  // The page should redirect to /login
  await page.waitForURL(/login/, { timeout: 10_000 });
  await expect(page).toHaveURL(/login/);
});

test("unauthenticated user visiting /saved is redirected to login", async ({ page }) => {
  await page.goto("/saved");
  await page.waitForURL(/login/, { timeout: 10_000 });
  await expect(page).toHaveURL(/login/);
});
