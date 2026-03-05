import type { Page } from "@playwright/test";

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  get usernameInput() {
    // Login page labels don't have htmlFor — use placeholder instead
    return this.page.getByPlaceholder("Your username");
  }

  get passwordInput() {
    return this.page.getByPlaceholder("Enter your password");
  }

  get submitButton() {
    return this.page.getByRole("button", { name: "Sign In" });
  }

  get errorMessage() {
    return this.page.locator(".bg-red-50");
  }

  get signUpLink() {
    return this.page.getByRole("link", { name: "Sign up free" });
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
