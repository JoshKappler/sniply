/**
 * Browser auth helpers for E2E tests.
 * Handles the dual-layer auth: httpOnly cookie + localStorage.
 */

import type { Page } from "@playwright/test";
import type { TestUser } from "./api";

/**
 * Drive the actual login form UI.
 * Use this only in auth.spec.ts to test the login page itself.
 * For other tests, use injectAuthState() instead (much faster).
 */
export async function loginViaUI(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Customers go to /browse, pros go to /pro/dashboard
  await page.waitForURL(/\/(browse|pro\/dashboard)/);
}

/**
 * Inject auth state directly into the browser context without driving the login form.
 * Sets both the httpOnly cookie (via Playwright CDP) and localStorage keys.
 * ~200ms vs ~2s for UI login.
 *
 * IMPORTANT: This must be called before navigating to the target page,
 * because pages check localStorage in useEffect on mount.
 */
export async function injectAuthState(
  page: Page,
  user: TestUser,
  cookieToken: string
): Promise<void> {
  // Set the httpOnly cookie — Playwright can do this via CDP even though JS cannot
  await page.context().addCookies([
    {
      name: "sniply_session",
      value: cookieToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // Navigate to home so we have a page context to run evaluate in
  await page.goto("/");

  // Set all three localStorage keys the app reads
  await page.evaluate((u: TestUser) => {
    localStorage.setItem("sniply_current_user", JSON.stringify(u));
    localStorage.setItem("sniply_role", u.role);
    localStorage.setItem("sniply_onboarded", "true");
  }, user);
}

/**
 * Clear all auth state from the browser context.
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.removeItem("sniply_current_user");
    localStorage.removeItem("sniply_role");
    localStorage.removeItem("sniply_onboarded");
  });
}
