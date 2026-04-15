import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Login Page Object
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.signInButton = page.locator('button[type="submit"]');
    this.registerLink = page.locator('a[href="/register"]');
    this.errorMessage = page.locator('#error');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await super.goto('/login');
    await this.waitForLoad();
  }

  /**
   * Fill login form
   */
  async fillForm(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * Submit login form
   */
  async submit() {
    await this.signInButton.click();
    await this.page.waitForTimeout(2000); // Wait for API response
  }

  /**
   * Login with credentials
   */
  async login(email: string, password: string) {
    await this.fillForm(email, password);
    await this.submit();
  }

  /**
   * Verify login success (redirected away from login page)
   */
  async verifyLoginSuccess() {
    // Should be redirected away from login page
    await expect(this.page).not.toHaveURL(/\/login/);
  }

  /**
   * Verify error message displayed
   */
  async verifyErrorMessage() {
    await expect(this.errorMessage.first()).toBeVisible({ timeout: 3000 });
  }

  /**
   * Navigate to register page
   */
  async goToRegister() {
    await this.registerLink.click();
  }

  /**
   * Verify page loaded correctly
   */
  async verifyPageLoaded() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }
}
