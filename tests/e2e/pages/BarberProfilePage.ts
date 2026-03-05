import type { Page } from "@playwright/test";

export class BarberProfilePage {
  constructor(private page: Page) {}

  async goto(barberId: string) {
    await this.page.goto(`/barber/${barberId}`);
    // Wait for barber data to load
    await this.page.waitForSelector("h1", { timeout: 15_000 });
  }

  async switchToTab(tab: "Portfolio" | "Booking" | "Reviews") {
    await this.page.getByRole("button", { name: tab }).click();
    await this.page.waitForTimeout(300);
  }

  // ── Booking tab ───────────────────────────────────────────────────────────────

  /** Click a calendar date cell by its day number (1-31) */
  async clickCalendarDay(dayNumber: number) {
    // Calendar days are buttons with aria-label containing the date or just the number text
    const dayButtons = this.page.locator("button").filter({ hasText: String(dayNumber) });
    // Find first enabled one that's not a nav button
    await dayButtons.first().click();
  }

  /** Select a time slot button by its visible text (e.g. "9:00 AM") */
  async selectTimeSlot(time: string) {
    await this.page.getByRole("button", { name: time }).click();
  }

  /** Select a service in the booking modal dropdown */
  async selectService(serviceName: string) {
    const select = this.page.locator("select").first();
    await select.selectOption({ label: serviceName });
  }

  /** Click the first available time slot in the booking tab */
  async selectFirstAvailableSlot() {
    // Time slots are grouped under Morning/Afternoon/Evening
    // They are buttons with time text like "9:00 AM"
    const slotButton = this.page.locator("button").filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first();
    await slotButton.click();
  }

  /** Click the Confirm Booking button in the modal */
  async confirmBooking() {
    await this.page.getByRole("button", { name: /confirm booking|confirm/i }).last().click();
  }

  /** Wait for booking success screen */
  async waitForBookingSuccess() {
    await this.page.waitForSelector("text=Booking Confirmed!", { timeout: 10_000 });
  }

  /** Close the booking modal after success */
  async closeBookingModal() {
    await this.page.getByRole("button", { name: /close|done/i }).click();
  }

  // ── Reviews tab ──────────────────────────────────────────────────────────────

  /** Click star N in the review form (1-5) */
  async clickStar(starNumber: number) {
    const stars = this.page.locator("[data-star]");
    await stars.nth(starNumber - 1).click();
  }

  async fillReviewText(text: string) {
    await this.page.locator("textarea").fill(text);
  }

  async submitReview() {
    await this.page.getByRole("button", { name: /submit review|submit/i }).click();
  }

  // ── Messaging ────────────────────────────────────────────────────────────────

  async clickMessageButton() {
    await this.page.getByRole("button", { name: /message/i }).click();
  }

  // ── Favorites ────────────────────────────────────────────────────────────────

  get saveButton() {
    return this.page.getByRole("button", { name: /save|saved|favorite/i });
  }
}
