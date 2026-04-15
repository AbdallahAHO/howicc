import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Settings Page Object
 */
export class SettingsPage extends BasePage {
  readonly heading: Locator;
  readonly apiKeysSection: Locator;
  readonly generateKeyButton: Locator;
  readonly apiKeysList: Locator;
  readonly noKeysMessage: Locator;
  readonly newKeyModal: Locator;
  readonly newKeyValue: Locator;
  readonly copyNewKeyButton: Locator;
  readonly apiUrlInput: Locator;
  readonly copyApiUrlButton: Locator;
  readonly statsCards: Locator;
  readonly cliConfigSection: Locator;

  constructor(page: Page) {
    super(page);
    // Scope to main content to avoid dev toolbar conflicts
    this.heading = page.locator('main h1').first();
    this.apiKeysSection = page.locator('main #api-keys-section');
    this.generateKeyButton = page.locator('main').getByRole('button', { name: /generate new key|generate key/i });
    this.apiKeysList = page.locator('main #api-keys-list');
    this.noKeysMessage = page.locator('main').getByText(/no api keys yet/i);
    this.newKeyModal = page.locator('main #new-key-modal');
    this.newKeyValue = page.locator('main #new-key-value');
    this.copyNewKeyButton = page.locator('main').getByRole('button', { name: /copy/i }).first();
    this.apiUrlInput = page.locator('input#api-url');
    this.copyApiUrlButton = page.locator('main').getByRole('button', { name: /copy/i }).first();
    this.statsCards = page.locator('main .grid').first();
    this.cliConfigSection = page.locator('main').getByText(/CLI Configuration/i);
  }

  /**
   * Navigate to settings page
   */
  async goto() {
    await super.goto('/settings');
    await this.waitForLoad();
  }

  /**
   * Verify page loaded correctly
   */
  async verifyPageLoaded() {
    await expect(this.heading).toContainText(/settings/i);
  }

  /**
   * Check if API keys section is visible
   */
  async isApiKeysSectionVisible(): Promise<boolean> {
    return await this.apiKeysSection.isVisible().catch(() => false);
  }

  /**
   * Generate new API key
   */
  async generateNewKey() {
    await this.generateKeyButton.click();
    await this.page.waitForTimeout(2000); // Wait for API response
  }

  /**
   * Verify new key modal is shown
   */
  async verifyNewKeyModal() {
    await expect(this.newKeyModal).toBeVisible({ timeout: 5000 });
    await expect(this.newKeyValue).toBeVisible();
  }

  /**
   * Get new API key value
   */
  async getNewApiKey(): Promise<string | null> {
    if (await this.newKeyValue.isVisible().catch(() => false)) {
      return await this.newKeyValue.inputValue();
    }
    return null;
  }

  /**
   * Copy new API key
   */
  async copyNewApiKey() {
    await this.copyNewKeyButton.click();
  }

  /**
   * Close new key modal
   */
  async closeNewKeyModal() {
    const closeButton = this.page.locator('button, a').filter({ hasText: /close|i've copied/i });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
  }

  /**
   * Get API keys count
   */
  async getApiKeysCount(): Promise<number> {
    const keys = this.apiKeysList.locator('> *');
    return await keys.count();
  }

  /**
   * Delete API key by index
   */
  async deleteApiKey(index: number) {
    const keys = this.apiKeysList.locator('> *');
    const keyCard = keys.nth(index);
    const deleteButton = keyCard.getByRole('button', { name: /delete/i });
    await deleteButton.click();

    // Handle confirmation dialog if present
    this.page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await this.page.waitForTimeout(1000);
  }

  /**
   * Get API URL
   */
  async getApiUrl(): Promise<string | null> {
    try {
      const urlInput = this.apiUrlInput;
      await urlInput.waitFor({ state: 'attached', timeout: 2000 }).catch(() => console.log('API URL input not attached'));
      if (await urlInput.isVisible().catch(() => false)) {
        return await urlInput.inputValue();
      } else {
        console.log('API URL input not visible');
      }
      // Fallback: look for any readonly input
      const anyReadonly = this.page.locator('main input[readonly]').first();
      if (await anyReadonly.isVisible().catch(() => false)) {
        const value = await anyReadonly.inputValue();
        if (value.includes('http')) {
          return value;
        }
      }
    } catch (e) {
      console.error('Failed to get API URL:', e);
    }
    return null;
  }

  /**
   * Copy API URL
   */
  async copyApiUrl() {
    await this.copyApiUrlButton.click();
  }

  /**
   * Verify empty state
   */
  async verifyNoKeysMessage() {
    await expect(this.noKeysMessage).toBeVisible();
  }
}
