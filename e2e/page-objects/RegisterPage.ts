import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Register Page Object
 */
export class RegisterPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly createAccountButton: Locator;
  readonly signInLink: Locator;
  readonly termsLink: Locator;
  readonly privacyLink: Locator;
  readonly successMessage: Locator;
  readonly apiKeyDisplay: Locator;
  readonly copyApiKeyButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByRole('textbox', { name: /email/i });
    this.passwordInput = page.getByRole('textbox', { name: /^password$/i }).first();
    this.confirmPasswordInput = page.getByRole('textbox', { name: /confirm password|password confirm/i });
    this.createAccountButton = page.getByRole('button', { name: /create account|register|sign up/i });
    this.signInLink = page.getByRole('link', { name: /sign in/i });
    this.termsLink = page.getByRole('link', { name: /terms of service/i });
    this.privacyLink = page.getByRole('link', { name: /privacy policy/i });
    // Scope to main content to avoid dev toolbar conflicts
    this.successMessage = page.locator('main').getByText(/account created|successfully created/i).first();
    this.apiKeyDisplay = page.locator('main textbox[readonly], main input[readonly]').first();
    this.copyApiKeyButton = page.locator('main').getByRole('button', { name: /copy/i }).first();
  }

  /**
   * Navigate to register page
   */
  async goto() {
    await super.goto('/register');
    await this.waitForLoad();
  }

  /**
   * Fill registration form
   */
  async fillForm(email: string, password: string, confirmPassword?: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword || password);
  }

  /**
   * Submit registration form
   */
  async submit() {
    await this.createAccountButton.click();
    await this.page.waitForTimeout(2000); // Wait for API response
  }

  /**
   * Register a new user
   */
  async register(email: string, password: string) {
    await this.fillForm(email, password);
    await this.submit();
  }

  /**
   * Verify registration success
   */
  async verifyRegistrationSuccess() {
    await expect(this.successMessage).toBeVisible({ timeout: 5000 });
    await expect(this.apiKeyDisplay).toBeVisible();
  }

  /**
   * Get API key from success page
   */
  async getApiKey(): Promise<string | null> {
    if (await this.apiKeyDisplay.isVisible().catch(() => false)) {
      return await this.apiKeyDisplay.inputValue();
    }
    return null;
  }

  /**
   * Copy API key
   */
  async copyApiKey() {
    if (await this.copyApiKeyButton.isVisible().catch(() => false)) {
      await this.copyApiKeyButton.click();
    }
  }

  /**
   * Navigate to settings from success page
   */
  async goToSettings() {
    const settingsLink = this.page.getByRole('link', { name: /go to settings|settings/i });
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click();
    }
  }

  /**
   * Verify page loaded correctly
   */
  async verifyPageLoaded() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.createAccountButton).toBeVisible();
  }
}
