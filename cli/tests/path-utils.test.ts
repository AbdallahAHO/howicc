import { describe, it, expect } from 'vitest';
import { decodeProjectFolderName, normalizeProjectPath } from '../src/lib/path-utils';

describe('path-utils', () => {
  describe('decodeProjectFolderName', () => {
    it('should decode folder names with double dashes to paths', () => {
      expect(decodeProjectFolderName('-Users--john--projects--myapp')).toBe(
        '/Users/john/projects/myapp'
      );
    });

    it('should convert single dashes to slashes', () => {
      expect(decodeProjectFolderName('-home-user-code')).toBe('/home/user/code');
    });

    it('should remove leading dash', () => {
      expect(decodeProjectFolderName('-project-name')).toBe('/project/name');
    });

    it('should handle folder names without leading dash', () => {
      expect(decodeProjectFolderName('Users--john--projects')).toBe(
        '/Users/john/projects'
      );
    });

    it('should preserve tilde paths', () => {
      expect(decodeProjectFolderName('~-projects-myapp')).toBe('~/projects/myapp');
    });

    it('should return "Unknown Project" for empty string', () => {
      expect(decodeProjectFolderName('')).toBe('Unknown Project');
    });

    it('should return "Unknown Project" for whitespace-only string', () => {
      expect(decodeProjectFolderName('   ')).toBe('Unknown Project');
    });

    it('should trim whitespace', () => {
      expect(decodeProjectFolderName('  -Users--john  ')).toBe('/Users/john');
    });

    it('should handle paths starting with slash', () => {
      expect(decodeProjectFolderName('/already/absolute')).toBe('/already/absolute');
    });
  });

  describe('normalizeProjectPath', () => {
    it('should extract and decode encoded project path from .claude/projects/', () => {
      const path = '/home/user/.claude/projects/-Users--john--projects--myapp';
      expect(normalizeProjectPath(path)).toBe('/Users/john/projects/myapp');
    });

    it('should handle paths with .claude/projects/ prefix', () => {
      const path = '~/.claude/projects/-home-user-code';
      expect(normalizeProjectPath(path)).toBe('/home/user/code');
    });

    it('should normalize regular paths', () => {
      const path = '/Users/john/../john/projects/./myapp';
      expect(normalizeProjectPath(path)).toBe('/Users/john/projects/myapp');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeProjectPath('')).toBe('');
    });

    it('should trim whitespace from input', () => {
      const path = '  /Users/john/projects  ';
      expect(normalizeProjectPath(path)).toBe('/Users/john/projects');
    });

    it('should handle paths without .claude/projects/', () => {
      const path = '/Users/john/my-project';
      expect(normalizeProjectPath(path)).toBe('/Users/john/my-project');
    });

    it('should handle complex encoded paths', () => {
      const path = '.claude/projects/-Users--john--My Documents--project-name';
      expect(normalizeProjectPath(path)).toBe('/Users/john/My Documents/project/name');
    });
  });
});
