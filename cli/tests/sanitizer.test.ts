import { describe, it, expect } from 'vitest';
import { isSystemMessage, cleanContent, cleanToolOutput } from '../src/lib/sanitizer';

describe('Sanitizer', () => {
  describe('isSystemMessage', () => {
    it('should detect caveat messages', () => {
      expect(isSystemMessage('Caveat: The messages below were generated')).toBe(true);
      expect(isSystemMessage('caveat: something')).toBe(false); // case sensitive
    });

    it('should detect request interrupted messages', () => {
      expect(isSystemMessage('[Request interrupted by user for tool use]')).toBe(true);
    });

    it('should detect local command stdout', () => {
      expect(isSystemMessage('<local-command-stdout>')).toBe(true);
    });

    it('should return false for normal messages', () => {
      expect(isSystemMessage('Hello, how can I help you?')).toBe(false);
      expect(isSystemMessage('Can you read this file?')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(isSystemMessage('')).toBe(false);
    });
  });

  describe('cleanContent', () => {
    it('should unwrap bash-input tags', () => {
      const input = '<bash-input>git status</bash-input>';
      expect(cleanContent(input)).toBe('git status');
    });

    it('should remove command-name tags', () => {
      const input = 'Before <command-name>test</command-name> after';
      expect(cleanContent(input)).toBe('Before  after');
    });

    it('should remove command-message tags', () => {
      const input = 'Text <command-message>some message</command-message> more text';
      expect(cleanContent(input)).toBe('Text  more text');
    });

    it('should remove command-contents tags', () => {
      const input = 'Start <command-contents>contents</command-contents> end';
      expect(cleanContent(input)).toBe('Start  end');
    });

    it('should remove bash-stdout tags', () => {
      const input = 'Output: <bash-stdout>result</bash-stdout> done';
      expect(cleanContent(input)).toBe('Output: result done');
    });

    it('should remove bash-stderr tags', () => {
      const input = 'Error: <bash-stderr>error message</bash-stderr>';
      expect(cleanContent(input)).toBe('Error: error message');
    });

    it('should prettify init command', () => {
      const input = 'Some text <command-name>init</command-name> more';
      expect(cleanContent(input)).toBe('Claude Initializes Codebase Documentation Guide (/init command)');
    });

    it('should handle multiple tags', () => {
      const input = '<bash-input>git status</bash-input> <command-name>test</command-name> result';
      expect(cleanContent(input)).toBe('git status  result');
    });

    it('should trim whitespace', () => {
      const input = '  <bash-input>cmd</bash-input>  ';
      expect(cleanContent(input)).toBe('cmd');
    });

    it('should handle empty strings', () => {
      expect(cleanContent('')).toBe('');
    });

    it('should handle text without tags', () => {
      const input = 'Plain text without any tags';
      expect(cleanContent(input)).toBe('Plain text without any tags');
    });
  });

  describe('cleanToolOutput', () => {
    it('should remove local-command-stdout prefix', () => {
      const input = '<local-command-stdout>Command output here';
      expect(cleanToolOutput(input)).toBe('Command output here');
    });

    it('should handle with whitespace', () => {
      const input = '<local-command-stdout>   Output with spaces';
      expect(cleanToolOutput(input)).toBe('Output with spaces');
    });

    it('should not modify text without prefix', () => {
      const input = 'Normal tool output';
      expect(cleanToolOutput(input)).toBe('Normal tool output');
    });

    it('should handle empty strings', () => {
      expect(cleanToolOutput('')).toBe('');
    });
  });
});
