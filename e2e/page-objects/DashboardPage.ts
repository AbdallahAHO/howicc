import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Dashboard Page Object
 * Shows user's conversations
 */
export class DashboardPage extends BasePage {
  readonly heading: Locator;
  readonly conversationCount: Locator;
  readonly filterAll: Locator;
  readonly filterPrivate: Locator;
  readonly filterUnlisted: Locator;
  readonly filterPublic: Locator;
  readonly conversationsList: Locator;
  readonly conversationCards: Locator;
  readonly emptyState: Locator;
  readonly apiKeysButton: Locator;
  readonly uploadNewButton: Locator;
  readonly setupCliButton: Locator;

  constructor(page: Page) {
    super(page);
    // Scope to main content to avoid dev toolbar conflicts
    this.heading = page.locator('main h1').first();
    this.conversationCount = page.locator('main').getByText(/conversation/i).first();
    this.filterAll = page.locator('main #filter-all');
    this.filterPrivate = page.locator('main #filter-private');
    this.filterUnlisted = page.locator('main #filter-unlisted');
    this.filterPublic = page.locator('main #filter-public');
    this.conversationsList = page.locator('main #conversations-list');
    this.conversationCards = page.locator('main .conversation-card');
    this.emptyState = page.locator('main').getByText(/no conversations yet/i).first();
    this.apiKeysButton = page.locator('main').getByRole('link', { name: /api keys/i }).first();
    this.uploadNewButton = page.locator('main').getByRole('link', { name: /upload new/i }).first();
    this.setupCliButton = page.locator('main').getByRole('link', { name: /set up cli/i }).first();
  }

  /**
   * Navigate to dashboard
   */
  async goto() {
    await super.goto('/dashboard');
    await this.waitForLoad();
  }

  /**
   * Verify page loaded correctly
   */
  async verifyPageLoaded() {
    await expect(this.heading).toContainText(/my conversations/i);
  }

  /**
   * Check if empty state is shown
   */
  async isEmpty(): Promise<boolean> {
    return await this.emptyState.isVisible().catch(() => false);
  }

  /**
   * Get conversation count
   */
  async getConversationCount(): Promise<number> {
    const count = await this.conversationCards.count();
    return count;
  }

  /**
   * Filter conversations by visibility
   */
  async filterByVisibility(visibility: 'all' | 'private' | 'unlisted' | 'public') {
    switch (visibility) {
      case 'all':
        await this.filterAll.click();
        break;
      case 'private':
        await this.filterPrivate.click();
        break;
      case 'unlisted':
        await this.filterUnlisted.click();
        break;
      case 'public':
        await this.filterPublic.click();
        break;
    }
    await this.page.waitForTimeout(2000); // Wait for filter to apply (increased for stability)
  }

  /**
   * Get conversation card by index
   */
  getConversationCard(index: number): Locator {
    return this.conversationCards.nth(index);
  }

  /**
   * Get conversation title by index
   */
  async getConversationTitle(index: number): Promise<string | null> {
    const card = this.getConversationCard(index);
    const title = card.locator('h3, a[href*="/p/"]');
    return await title.textContent();
  }

  /**
   * Get conversation visibility badge by index
   */
  async getConversationVisibility(index: number): Promise<string | null> {
    const card = this.getConversationCard(index);
    const badge = card.locator('text=/private|unlisted|public/i');
    if (await badge.isVisible().catch(() => false)) {
      return await badge.textContent();
    }
    return null;
  }

  /**
   * Click on conversation by index
   */
  async clickConversation(index: number) {
    const card = this.getConversationCard(index);
    const link = card.locator('a[href*="/p/"]').first();
    await link.click();
  }

  /**
   * Navigate to API keys
   */
  async goToApiKeys() {
    await this.apiKeysButton.click();
  }

  /**
   * Navigate to upload new
   */
  async goToUploadNew() {
    await this.uploadNewButton.click();
  }

  /**
   * Verify empty state
   */
  async verifyEmptyState() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.setupCliButton).toBeVisible();
  }

  /**
   * Get all conversations with their details
   */
  async getConversations(): Promise<Array<{
    title: string;
    slug: string;
    visibility: 'private' | 'unlisted' | 'public';
  }>> {
    const conversations: Array<{
      title: string;
      slug: string;
      visibility: 'private' | 'unlisted' | 'public';
    }> = [];

    const count = await this.conversationCards.count();

    for (let i = 0; i < count; i++) {
      const card = this.getConversationCard(i);
      if (!(await card.isVisible())) continue;

      const titleLink = card.locator('h3 a, a[href*="/p/"]').first();
      const href = await titleLink.getAttribute('href');
      const slug = href ? href.replace('/p/', '') : '';
      const title = (await titleLink.textContent() || '').trim();

      // Get visibility badge
      const badge = card.locator('span').filter({ hasText: /private|unlisted|public/i });
      let visibility: 'private' | 'unlisted' | 'public' = 'private';
      if (await badge.isVisible().catch(() => false)) {
        const badgeText = (await badge.textContent() || '').toLowerCase();
        if (badgeText.includes('public')) {
          visibility = 'public';
        } else if (badgeText.includes('unlisted')) {
          visibility = 'unlisted';
        } else {
          visibility = 'private';
        }
      }

      conversations.push({ title, slug, visibility });
    }

    return conversations;
  }
}
