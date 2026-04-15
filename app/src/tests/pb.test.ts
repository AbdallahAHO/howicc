import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/pb';

describe('PocketBase Helpers', () => {
  describe('slugify', () => {
    it('should convert text to lowercase slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
      expect(slugify('Test@#$%Title')).toBe('testtitle');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(slugify('Multiple   Spaces')).toBe('multiple-spaces');
    });

    it('should replace multiple hyphens with single hyphen', () => {
      expect(slugify('Too---Many---Hyphens')).toBe('too-many-hyphens');
    });

    it('should trim hyphens from start and end', () => {
      expect(slugify('-trimmed-')).toBe('trimmed');
      expect(slugify('--start')).toBe('start');
      expect(slugify('end--')).toBe('end');
    });

    it('should limit length to 100 characters', () => {
      const longText = 'a'.repeat(150);
      const result = slugify(longText);
      expect(result.length).toBe(100);
    });

    it('should handle empty string', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      expect(slugify('!@#$%^&*()')).toBe('');
    });

    it('should preserve numbers and hyphens', () => {
      expect(slugify('test-123-abc')).toBe('test-123-abc');
    });
  });
});
