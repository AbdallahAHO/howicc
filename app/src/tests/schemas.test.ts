import { describe, it, expect } from 'vitest';
import {
  ConversationUploadSchema,
  AIAnalysisSchema,
  MessageSchema,
  IngestRequestSchema,
} from '@howicc/schemas';

describe('Schema Validation', () => {
  describe('ConversationUploadSchema', () => {
    it('should validate a complete upload', () => {
      const data = {
        title: 'Test Conversation',
        slug: 'test-conversation',
        description_user: 'A test conversation',
        isPublic: true,
        tags: ['test', 'conversation'],
        checksum: 'a'.repeat(64),
        source: 'claude' as const,
      };

      const result = ConversationUploadSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid slug format', () => {
      const data = {
        slug: 'Invalid Slug!',
      };

      const result = ConversationUploadSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid checksum', () => {
      const data = {
        checksum: 'invalid',
      };

      const result = ConversationUploadSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should use default values', () => {
      const data = {};
      const result = ConversationUploadSchema.safeParse(data);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isPublic).toBe(false);
        expect(result.data.source).toBe('claude');
      }
    });
  });

  describe('AIAnalysisSchema', () => {
    it('should validate complete analysis', () => {
      const data = {
        title: 'Test Analysis',
        summary: 'A test summary of the conversation',
        takeaways: ['Point 1', 'Point 2'],
        generated_tags: ['tag1', 'tag2'],
        safety_flags: {
          pii: false,
          secrets: false,
        },
      };

      const result = AIAnalysisSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const data = {
        title: 'Test',
      };

      const result = AIAnalysisSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should enforce array limits', () => {
      const data = {
        title: 'Test',
        summary: 'Test',
        takeaways: Array(20).fill('point'),
        generated_tags: ['tag'],
        safety_flags: { pii: false, secrets: false },
      };

      const result = AIAnalysisSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('MessageSchema', () => {
    it('should validate user message', () => {
      const data = {
        role: 'user' as const,
        content: 'Hello',
      };

      const result = MessageSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should validate assistant message with timestamp', () => {
      const data = {
        role: 'assistant' as const,
        content: 'Hi there!',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const result = MessageSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid role', () => {
      const data = {
        role: 'invalid',
        content: 'Test',
      };

      const result = MessageSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('IngestRequestSchema', () => {
    it('should validate ingest request', () => {
      const data = {
        conversationId: 'conv123',
      };

      const result = IngestRequestSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty conversationId', () => {
      const data = {
        conversationId: '',
      };

      const result = IngestRequestSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
