import { describe, it, expect, beforeAll } from 'vitest';
import { TimelineExtractor, ClaudeExtractor } from '../src/lib/extractor';
import type { ToolCallBlock, FilePatch } from '@howicc/schemas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('TimelineExtractor Utilities', () => {
  describe('File diff generation', () => {
    let extractor: TimelineExtractor;

    beforeAll(() => {
      extractor = new TimelineExtractor('test-utilities', join(__dirname, 'fixtures'));
    });

    it('should generate diff for Write tool calls', () => {
      const toolBlock: ToolCallBlock = {
        id: 'write-1',
        type: 'tool_call_block',
        toolName: 'Write',
        input: {
          file_path: 'test.ts',
          content: 'console.log("hello");\nconsole.log("world");',
        },
      };

      // Access private method via any cast for testing
      const patches = (extractor as any).generateFileDiffs(toolBlock);

      expect(patches).toHaveLength(1);
      expect(patches[0]).toMatchObject({
        filePath: 'test.ts',
        type: 'create',
      });
      expect(patches[0].diff).toContain('+console.log("hello");');
      expect(patches[0].diff).toContain('+console.log("world");');
      expect(patches[0].diff).toContain('--- /dev/null');
      expect(patches[0].diff).toContain('+++ b/test.ts');
    });

    it('should generate diffs for MultiEdit tool calls', () => {
      const toolBlock: ToolCallBlock = {
        id: 'multiedit-1',
        type: 'tool_call_block',
        toolName: 'MultiEdit',
        input: {
          edits: [
            { file_path: 'file1.ts', new_string: 'const x = 1;' },
            { file_path: 'file2.ts', new_string: 'const y = 2;' },
          ],
        },
      };

      const patches = (extractor as any).generateFileDiffs(toolBlock);

      expect(patches).toHaveLength(2);
      expect(patches[0].filePath).toBe('file1.ts');
      expect(patches[1].filePath).toBe('file2.ts');
      expect(patches[0].diff).toContain('+const x = 1;');
      expect(patches[1].diff).toContain('+const y = 2;');
    });

    it('should return empty array for non-file tools', () => {
      const toolBlock: ToolCallBlock = {
        id: 'read-1',
        type: 'tool_call_block',
        toolName: 'Read',
        input: { file_path: 'test.ts' },
      };

      const patches = (extractor as any).generateFileDiffs(toolBlock);
      expect(patches).toEqual([]);
    });

    it('should handle Write without file_path', () => {
      const toolBlock: ToolCallBlock = {
        id: 'write-2',
        type: 'tool_call_block',
        toolName: 'Write',
        input: { content: 'test' },
      };

      const patches = (extractor as any).generateFileDiffs(toolBlock);
      expect(patches).toEqual([]);
    });

    it('should handle Write without content', () => {
      const toolBlock: ToolCallBlock = {
        id: 'write-3',
        type: 'tool_call_block',
        toolName: 'Write',
        input: { file_path: 'test.ts' },
      };

      const patches = (extractor as any).generateFileDiffs(toolBlock);
      expect(patches).toEqual([]);
    });
  });

  describe('createUnifiedDiff', () => {
    let extractor: TimelineExtractor;

    beforeAll(() => {
      extractor = new TimelineExtractor('test-utilities', __dirname + '/fixtures');
    });

    it('should create valid unified diff format', () => {
      const diff = (extractor as any).createUnifiedDiff(
        'src/test.ts',
        'line1\nline2\nline3'
      );

      expect(diff).toContain('--- /dev/null');
      expect(diff).toContain('+++ b/src/test.ts');
      expect(diff).toContain('@@ -0,0 +1,3 @@');
      expect(diff).toContain('+line1');
      expect(diff).toContain('+line2');
      expect(diff).toContain('+line3');
    });

    it('should handle single line content', () => {
      const diff = (extractor as any).createUnifiedDiff('file.ts', 'single line');

      expect(diff).toContain('@@ -0,0 +1,1 @@');
      expect(diff).toContain('+single line');
    });

    it('should handle empty content', () => {
      const diff = (extractor as any).createUnifiedDiff('empty.ts', '');

      expect(diff).toContain('@@ -0,0 +1,1 @@');
      expect(diff).toContain('+');
    });

    it('should handle multiline with empty lines', () => {
      const diff = (extractor as any).createUnifiedDiff('file.ts', 'line1\n\nline3');

      expect(diff).toContain('@@ -0,0 +1,3 @@');
      expect(diff).toContain('+line1');
      expect(diff).toContain('+');
      expect(diff).toContain('+line3');
    });
  });

  describe('cleanPreview', () => {
    let extractor: ClaudeExtractor;

    beforeAll(() => {
      extractor = new ClaudeExtractor();
    });

    it('should remove XML-like tags', () => {
      // cleanPreview now uses cleanContent which only removes specific Claude protocol tags
      // Generic XML tags like <thinking> are not removed by sanitizer
      const result = (extractor as any).cleanPreview(
        'Hello <bash-input>git status</bash-input> world'
      );
      expect(result).toBe('Hello git status world');
    });

    it('should remove interruption messages', () => {
      const result = (extractor as any).cleanPreview(
        'Processing [Request interrupted by user] done'
      );
      expect(result).toBe('Processing done');
    });

    it('should normalize whitespace', () => {
      const result = (extractor as any).cleanPreview(
        'Hello    world\n\n  with   spaces'
      );
      expect(result).toBe('Hello world with spaces');
    });

    it('should handle combined cleaning', () => {
      // cleanPreview uses cleanContent which removes specific protocol tags
      const result = (extractor as any).cleanPreview(
        '<command-name>test</command-name>   [Request interrupted]   world  '
      );
      expect(result).toBe('world');
    });

    it('should handle empty string', () => {
      const result = (extractor as any).cleanPreview('');
      expect(result).toBe('');
    });

    it('should handle only tags', () => {
      // cleanPreview uses cleanContent which only removes specific protocol tags
      const result = (extractor as any).cleanPreview('<command-name>test</command-name>');
      expect(result).toBe('');
    });
  });

  describe('extractTextFromContent', () => {
    let extractor: TimelineExtractor;

    beforeAll(() => {
      extractor = new TimelineExtractor('test-utilities', __dirname + '/fixtures');
    });

    it('should extract text from string content', () => {
      const result = (extractor as any).extractTextFromContent('plain text');
      expect(result).toBe('plain text');
    });

    it('should extract text from content blocks array', () => {
      const content = [
        { type: 'text', text: 'First' },
        { type: 'text', text: 'Second' },
      ];
      const result = (extractor as any).extractTextFromContent(content);
      expect(result).toBe('First\nSecond');
    });

    it('should skip non-text blocks', () => {
      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'tool_use', id: 'tool-1', name: 'Read' },
        { type: 'text', text: 'World' },
      ];
      const result = (extractor as any).extractTextFromContent(content);
      expect(result).toBe('Hello\nWorld');
    });

    it('should handle undefined content', () => {
      const result = (extractor as any).extractTextFromContent(undefined);
      expect(result).toBe('');
    });

    it('should handle empty array', () => {
      const result = (extractor as any).extractTextFromContent([]);
      expect(result).toBe('');
    });

    it('should handle blocks without text property', () => {
      const content = [{ type: 'text' }, { type: 'text', text: 'Valid' }];
      const result = (extractor as any).extractTextFromContent(content);
      expect(result).toBe('Valid');
    });
  });

  describe('extractToolNameFromResult', () => {
    let extractor: TimelineExtractor;

    beforeAll(() => {
      extractor = new TimelineExtractor('test-utilities', __dirname + '/fixtures');
    });

    it('should extract "Task" for agent tool results', () => {
      const entry = {
        type: 'user',
        toolUseResult: { agentId: 'agent-123' },
      } as any;

      const result = (extractor as any).extractToolNameFromResult(entry);
      expect(result).toBe('Task');
    });

    it('should return "unknown" for non-agent results', () => {
      const entry = {
        type: 'user',
        toolUseResult: {},
      } as any;

      const result = (extractor as any).extractToolNameFromResult(entry);
      expect(result).toBe('unknown');
    });

    it('should return "unknown" for missing toolUseResult', () => {
      const entry = {
        type: 'user',
      } as any;

      const result = (extractor as any).extractToolNameFromResult(entry);
      expect(result).toBe('unknown');
    });
  });
});
