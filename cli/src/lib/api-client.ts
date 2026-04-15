import { createHash } from 'node:crypto';
import type { SyncResult } from '../types/index.js';
import type { Conversation } from '@howicc/schemas';

export class HowIClaudeCodeClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Upload a conversation to How I Claude Code
   */
  async uploadConversation(
    conversation: Conversation,
    options: {
      description?: string;
      visibility?: 'private' | 'unlisted' | 'public';
      allowListing?: boolean;
    } = {}
  ): Promise<SyncResult> {
    try {
      // Calculate checksum from the timeline data
      const checksum = this.calculateChecksum(
        JSON.stringify(conversation.timeline)
      );

      // Prepare the payload with conversation data + options
      const payload = {
        ...conversation,
        checksum,
        source: 'claude' as const,
        visibility: options.visibility || 'private',
        allowListing: options.allowListing ?? false,
        ...(options.description && { description_user: options.description }),
      };

      // Upload to API as JSON
      const response = await fetch(`${this.apiUrl}/api/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Handle 409 Conflict as success (duplicate conversation already exists)
      if (response.status === 409) {
        const result = (await response.json()) as {
          id?: string;
          slug?: string;
          url?: string;
          duplicate?: boolean;
        };

        return {
          success: true,
          conversationId: result.id,
          slug: result.slug,
          url: result.url,
          duplicate: true,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Use default error message
        }

        return {
          success: false,
          error: errorMessage,
        };
      }

      const result = (await response.json()) as {
        id?: string;
        slug?: string;
        url?: string;
      };

      return {
        success: true,
        conversationId: result.id,
        slug: result.slug,
        url: result.url,
      };
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more helpful messages for common fetch errors
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          errorMessage = `Connection failed: Unable to reach ${this.apiUrl}. Is the server running?`;
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = `DNS lookup failed: Cannot resolve hostname for ${this.apiUrl}`;
        } else if (error.message.includes('ETIMEDOUT')) {
          errorMessage = `Connection timeout: Server at ${this.apiUrl} did not respond`;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Trigger processing for a conversation
   */
  async triggerProcessing(conversationId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/ingest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Calculate SHA-256 checksum
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
