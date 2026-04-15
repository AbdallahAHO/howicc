import type { Page, Locator } from '@playwright/test';

/**
 * Base Page Object
 * Common functionality shared across all pages
 */
export class BasePage {
  readonly page: Page;
  readonly header: Locator;
  readonly navigation: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.header = page.locator('header');
    this.navigation = page.locator('nav[aria-label="Primary"]');
    this.footer = page.locator('footer, [role="contentinfo"]');
  }

  /**
   * Navigate to a specific path
   */
  async goto(path: string = '/') {
    await this.page.goto(path);
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get current URL
   */
  getUrl(): string {
    return this.page.url();
  }

  /**
   * Wait for page to load
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigation methods
   */
  async clickFeatures() {
    await this.navigation.getByRole('link', { name: /features/i }).click();
  }

  async clickLeaderboard() {
    await this.navigation.getByRole('link', { name: /leaderboard/i }).click();
  }

  async clickMyConversations() {
    await this.navigation.getByRole('link', { name: /my conversations/i }).click();
  }

  async clickSettings() {
    await this.navigation.getByRole('link', { name: /settings/i }).click();
  }

  async clickSignIn() {
    await this.navigation.getByRole('link', { name: /sign in/i }).click();
  }

  async clickGetStarted() {
    await this.navigation.getByRole('link', { name: /get started/i }).click();
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    const userEmail = this.navigation.locator('text=/@/');
    return await userEmail.isVisible().catch(() => false);
  }

  /**
   * Get logged in user email
   */
  async getUserEmail(): Promise<string | null> {
    const emailElement = this.navigation.locator('text=/@/');
    if (await emailElement.isVisible().catch(() => false)) {
      return await emailElement.textContent();
    }
    return null;
  }

  /**
   * Logout
   */
  async logout() {
    const logoutButton = this.navigation.getByRole('button', { name: /sign out|logout/i });
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
}
