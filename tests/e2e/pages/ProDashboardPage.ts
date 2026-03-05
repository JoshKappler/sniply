import type { Page } from "@playwright/test";

export class ProDashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/pro/dashboard");
    // Use domcontentloaded — networkidle times out because the dashboard polls continuously
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(800);
  }

  async switchToTab(tab: "Profile" | "Services" | "Appointments" | "Messages" | "Analytics") {
    await this.page.getByRole("button", { name: tab }).click();
    await this.page.waitForTimeout(400);
  }

  // ── Profile tab ──────────────────────────────────────────────────────────────

  async clickEditProfile() {
    await this.page.getByRole("button", { name: /edit profile|edit/i }).first().click();
  }

  async fillBio(bio: string) {
    const bioField = this.page.getByPlaceholder(/bio|about/i);
    await bioField.clear();
    await bioField.fill(bio);
  }

  async saveProfile() {
    await this.page.getByRole("button", { name: /save/i }).click();
  }

  // ── Services tab ─────────────────────────────────────────────────────────────

  async clickAddService() {
    await this.page.getByRole("button", { name: /add service/i }).click();
  }

  async fillServiceForm(name: string, price: string, duration: string) {
    await this.page.getByPlaceholder(/service name/i).fill(name);
    await this.page.getByPlaceholder(/price/i).fill(price);
    await this.page.getByPlaceholder(/duration/i).fill(duration);
  }

  async saveService() {
    await this.page.getByRole("button", { name: /save|add/i }).last().click();
  }

  async deleteFirstService() {
    await this.page.getByRole("button", { name: /delete|remove/i }).first().click();
    // Confirm if there's a confirmation dialog
    const confirmBtn = this.page.getByRole("button", { name: /confirm|yes/i });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
  }

  // ── Appointments tab ─────────────────────────────────────────────────────────

  async confirmFirstAppointment() {
    await this.page.getByRole("button", { name: /confirm/i }).first().click();
  }

  async completeFirstAppointment() {
    await this.page.getByRole("button", { name: /complete|done/i }).first().click();
  }

  // ── Messages tab ─────────────────────────────────────────────────────────────

  async selectThread(customerName: string) {
    await this.page.getByText(customerName).first().click();
  }

  async replyToThread(message: string) {
    const input = this.page.getByRole("textbox").last();
    await input.fill(message);
    await this.page.keyboard.press("Enter");
  }
}
