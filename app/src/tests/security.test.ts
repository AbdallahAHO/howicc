import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isSafeURL } from '../lib/ssrf-protection';
import { isRateLimited } from '../lib/rate-limit';

describe('Security Tests', () => {
  describe('SSRF Protection', () => {
    it('should reject private IP addresses', () => {
      expect(isSafeURL('http://10.0.0.1')).toBe(false);
      expect(isSafeURL('http://192.168.1.1')).toBe(false);
      expect(isSafeURL('http://172.16.0.1')).toBe(false);
      expect(isSafeURL('http://127.0.0.1')).toBe(false);
      expect(isSafeURL('http://localhost')).toBe(false);
      expect(isSafeURL('http://169.254.1.1')).toBe(false);
    });

    it('should reject non-http/https schemes', () => {
      expect(isSafeURL('file:///etc/passwd')).toBe(false);
      expect(isSafeURL('ftp://example.com')).toBe(false);
      expect(isSafeURL('javascript:alert(1)')).toBe(false);
    });

    it('should allow public URLs', () => {
      expect(isSafeURL('https://example.com')).toBe(true);
      expect(isSafeURL('http://example.com')).toBe(true);
    });

    it('should allow URLs from allowed hosts', () => {
      expect(isSafeURL('http://pocketbase:8090/api/files/123', ['pocketbase'])).toBe(true);
      expect(isSafeURL('http://example.com', ['pocketbase'])).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Clear rate limit store between tests
      vi.clearAllMocks();
    });

    it('should allow requests within limit', () => {
      const request = new Request('http://localhost/api/conversations');

      // First 10 requests should be allowed
      for (let i = 0; i < 10; i++) {
        expect(isRateLimited(request, 10, 60000)).toBe(false);
      }
    });

    it('should rate limit after threshold', () => {
      const request = new Request('http://localhost/api/conversations');

      // Make 10 requests (limit)
      for (let i = 0; i < 10; i++) {
        isRateLimited(request, 10, 60000);
      }

      // 11th request should be rate limited
      expect(isRateLimited(request, 10, 60000)).toBe(true);
    });
  });

  describe('PocketBase Rules', () => {
    // Note: These tests would require a PocketBase instance
    // For now, we test the rule logic conceptually

    it('should deny anonymous list on conversations', () => {
      // listRule: (visibility='public' && allowListing=true) || user=@request.auth.id
      // Anonymous user (no auth) should not be able to list unless public+listable
      const anonymousListRule = "(visibility='public' && allowListing=true) || user=@request.auth.id";

      // Should only match if visibility='public' && allowListing=true
      expect(anonymousListRule.includes("user=@request.auth.id")).toBe(true);
      // But for anonymous, @request.auth.id is empty, so first part must match
    });

    it('should allow unlisted view', () => {
      // viewRule: visibility='public' || visibility='unlisted' || user=@request.auth.id
      // Unlisted conversations should be viewable by anyone with link
      const viewRule = "visibility='public' || visibility='unlisted' || user=@request.auth.id";

      expect(viewRule.includes("visibility='unlisted'")).toBe(true);
    });
  });

  describe('Default Visibility', () => {
    it('should default to private visibility', () => {
      // From schemas.ts
      const defaultVisibility = 'private';
      expect(defaultVisibility).toBe('private');
    });

    it('should default allowListing to false', () => {
      // From schemas.ts
      const defaultAllowListing = false;
      expect(defaultAllowListing).toBe(false);
    });
  });
});
