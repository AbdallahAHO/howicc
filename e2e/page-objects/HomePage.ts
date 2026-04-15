import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Home Page Object
 */
export class HomePage extends BasePage {
  readonly heroHeading: Locator;
  readonly heroDescription: Locator;
  readonly getStartedButton: Locator;
  readonly howItWorksButton: Locator;
  readonly featuresSection: Locator;
  readonly stepsSection: Locator;

  constructor(page: Page) {
    super(page);
    this.heroHeading = page.locator('h1').first();
    this.heroDescription = page.locator('main p').first();
    this.getStartedButton = page.getByRole('link', { name: /get started/i }).first();
    this.howItWorksButton = page.getByRole('link', { name: /how it works/i });
    this.featuresSection = page.locator('section, [id*="feature"]');
    this.stepsSection = page.locator('section, [id*="step"]');
  }

  /**
   * Navigate to home page
   */
  async goto() {
    await super.goto('/');
    await this.waitForLoad();
  }

  /**
   * Click get started button
   */
  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  /**
   * Click how it works button
   */
  async clickHowItWorks() {
    await this.howItWorksButton.click();
  }

  /**
   * Verify page loaded correctly
   */
  async verifyPageLoaded() {
    await expect(this.heroHeading).toBeVisible();
    await expect(this.heroDescription).toBeVisible();
  }
}
