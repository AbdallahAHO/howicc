import { describe, it, expect } from 'vitest';
import { performSafetyCheck, collectRedactionStats, parseMarkdownToMessages } from '@/lib/ai-analysis';

describe('AI Analysis', () => {
  describe('performSafetyCheck - PII', () => {
    it('should detect email addresses', () => {
      const content = 'Contact me at test@example.com';
      const result = performSafetyCheck(content);
      expect(result.pii).toBe(true);
    });

    it('should detect phone numbers in various formats', () => {
      const formats = [
        'Call me at 555-123-4567',
        'Phone: (555) 123-4567',
        '555.123.4567',
        '+1 555-123-4567',
        '15551234567',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.pii).toBe(true);
      }
    });

    it('should detect SSN', () => {
      const content = 'SSN: 123-45-6789';
      const result = performSafetyCheck(content);
      expect(result.pii).toBe(true);
    });

    it('should detect UUIDs', () => {
      const formats = [
        '550e8400-e29b-41d4-a716-446655440000',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        'UUID: 123e4567-e89b-12d3-a456-426614174000',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.pii).toBe(true);
      }
    });
  });

  describe('performSafetyCheck - Secrets', () => {
    it('should detect .env-style key-value pairs', () => {
      const formats = [
        'OPENROUTER_API_KEY=sk-1234567890abcdef',
        'export SERVER_SECRET=mysecret123',
        'DATABASE_PASSWORD:super_secret_pass',
        'PRIVATE_KEY=-----BEGIN PRIVATE KEY-----',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect password key-value pairs', () => {
      const formats = [
        'password: mySecretPass123!',
        'pwd=super_secret',
        'passwd: another_password_here',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect SSH private keys', () => {
      const content = '-----BEGIN OPENSSH PRIVATE KEY-----\nMIIEowIBAAKCAQEA...';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect RSA private keys', () => {
      const formats = [
        '-----BEGIN RSA PRIVATE KEY-----',
        '-----BEGIN PRIVATE KEY-----',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect EC private keys', () => {
      const content = '-----BEGIN EC PRIVATE KEY-----';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect PGP private keys', () => {
      const content = '-----BEGIN PGP PRIVATE KEY BLOCK-----';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect OpenAI/Anthropic keys', () => {
      const content = 'sk-abcdefghijklmnopqrstuvwxyz123456';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect Stripe keys', () => {
      const formats = [
        'sk_live_abcdefghijklmnopqrstuvwxyz123456',
        'sk_test_abcdefghijklmnopqrstuvwxyz123456',
        'pk_live_abcdefghijklmnopqrstuvwxyz123456',
        'pk_test_abcdefghijklmnopqrstuvwxyz123456',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect GitHub tokens', () => {
      const formats = [
        'ghp_abcdefghijklmnopqrstuvwxyz123456',
        'gho_abcdefghijklmnopqrstuvwxyz123456',
        'ghu_abcdefghijklmnopqrstuvwxyz123456',
        'ghs_abcdefghijklmnopqrstuvwxyz123456',
        'ghr_abcdefghijklmnopqrstuvwxyz123456',
        'github_pat_11ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect Slack tokens', () => {
      const formats = [
        'xoxb-1234567890-abcdefghijklmnopqrstuvwxyz',
        'xoxa-1234567890-abcdefghijklmnopqrstuvwxyz',
        'xoxp-1234567890-abcdefghijklmnopqrstuvwxyz',
        'xoxr-1234567890-abcdefghijklmnopqrstuvwxyz',
        'xoxs-1234567890-abcdefghijklmnopqrstuvwxyz',
        'xoxoa-1234567890-abcdefghijklmnopqrstuvwxyz',
        'xoxos-1234567890-abcdefghijklmnopqrstuvwxyz',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect Google API keys', () => {
      const content = 'AIzaSyDaGmWKa4JsXZ-HlGw2IS2gJ93f2wXqF0k';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect AWS access key IDs', () => {
      const formats = [
        'AKIAIOSFODNN7EXAMPLE',
        'ASIAIOSFODNN7EXAMPLE',
        'AGPAIOSFODNN7EXAMPLE',
        'AIDAIOSFODNN7EXAMPLE',
        'AROAIOSFODNN7EXAMPLE',
        'ANPAIOSFODNN7EXAMPLE',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect AWS secret access keys', () => {
      const formats = [
        'aws_secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect JWTs', () => {
      const content = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect bearer tokens', () => {
      const formats = [
        'Authorization: bearer abcdefghijklmnopqrstuvwxyz123456',
        'Bearer abcdefghijklmnopqrstuvwxyz123456',
        'bearer abcdefghijklmnopqrstuvwxyz123456',
      ];
      for (const content of formats) {
        const result = performSafetyCheck(content);
        expect(result.secrets).toBe(true);
      }
    });

    it('should detect SendGrid keys', () => {
      const content = 'SG.abcdefghijklmnopqrstuvwxyz123456.abcdefghijklmnopqrstuvwxyz123456';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect Twilio SIDs', () => {
      const content = 'AC1234567890abcdef1234567890abcdef';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect Twilio auth tokens', () => {
      const content = '1234567890abcdef1234567890abcdef';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });

    it('should detect GCP service account keys', () => {
      const content = '"private_key": "-----BEGIN PRIVATE KEY-----';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(true);
    });
  });

  describe('collectRedactionStats', () => {
    it('should collect stats for multiple PII types', () => {
      const content = 'Email: test@example.com, Phone: 555-123-4567, SSN: 123-45-6789, UUID: 550e8400-e29b-41d4-a716-446655440000';
      const result = collectRedactionStats(content);
      expect(result.pii).toBe(true);
      expect(result.secrets).toBe(false);
      expect(result.redactions.length).toBeGreaterThan(0);
      const emailCount = result.redactions.find(r => r.type === 'email')?.count || 0;
      const phoneCount = result.redactions.find(r => r.type === 'phone')?.count || 0;
      const ssnCount = result.redactions.find(r => r.type === 'ssn')?.count || 0;
      const uuidCount = result.redactions.find(r => r.type === 'uuid')?.count || 0;
      expect(emailCount).toBeGreaterThan(0);
      expect(phoneCount).toBeGreaterThan(0);
      expect(ssnCount).toBeGreaterThan(0);
      expect(uuidCount).toBeGreaterThan(0);
    });

    it('should collect stats for multiple secret types', () => {
      const content = 'API_KEY=sk-1234567890abcdef\nGITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz123456';
      const result = collectRedactionStats(content);
      expect(result.pii).toBe(false);
      expect(result.secrets).toBe(true);
      expect(result.redactions.length).toBeGreaterThan(0);
    });

    it('should count multiple occurrences', () => {
      const content = 'test@example.com and another@test.com';
      const result = collectRedactionStats(content);
      const emailRedaction = result.redactions.find(r => r.type === 'email');
      expect(emailRedaction?.count).toBe(2);
    });

    it('should return empty redactions for safe content', () => {
      const content = 'This is a normal conversation without sensitive data.';
      const result = collectRedactionStats(content);
      expect(result.pii).toBe(false);
      expect(result.secrets).toBe(false);
      expect(result.redactions).toHaveLength(0);
    });
  });

  describe('performSafetyCheck - Edge Cases', () => {
    it('should not flag safe content', () => {
      const content = 'This is a normal conversation without sensitive data.';
      const result = performSafetyCheck(content);
      expect(result.pii).toBe(false);
      expect(result.secrets).toBe(false);
    });

    it('should handle empty content', () => {
      const result = performSafetyCheck('');
      expect(result.pii).toBe(false);
      expect(result.secrets).toBe(false);
    });

    it('should handle content with partial matches that should not trigger', () => {
      const content = 'The word "password" appears but no actual password value';
      const result = performSafetyCheck(content);
      expect(result.secrets).toBe(false);
    });
  });

  describe('parseMarkdownToMessages', () => {
    it('should parse user messages', () => {
      const markdown = `## 👤 User

Hello, how are you?`;

      const messages = parseMarkdownToMessages(markdown);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toContain('Hello');
    });

    it('should parse assistant messages', () => {
      const markdown = `## 🤖 Claude

I am doing well, thank you!`;

      const messages = parseMarkdownToMessages(markdown);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toContain('doing well');
    });

    it('should parse system messages', () => {
      const markdown = `## ℹ️ System

Connection established`;

      const messages = parseMarkdownToMessages(markdown);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('Connection');
    });

    it('should parse multiple messages', () => {
      const markdown = `## 👤 User

Hello

---

## 🤖 Assistant

Hi there!

---

## 👤 User

How are you?`;

      const messages = parseMarkdownToMessages(markdown);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should handle empty markdown', () => {
      const markdown = '';
      const messages = parseMarkdownToMessages(markdown);
      expect(messages).toHaveLength(0);
    });

    it('should fallback to single message for unstructured content', () => {
      const markdown = 'Just some random text without structure';
      const messages = parseMarkdownToMessages(markdown);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe(markdown.trim());
    });

    it('should handle variations in header formatting', () => {
      const variations = [
        `## 👤 User\nMessage`,
        `## 👤 Human\nMessage`,
        `# 👤 USER\nMessage`,
        `## 🤖 Claude\nMessage`,
        `## 🤖 Assistant\nMessage`,
      ];

      for (const markdown of variations) {
        const messages = parseMarkdownToMessages(markdown);
        expect(messages.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
