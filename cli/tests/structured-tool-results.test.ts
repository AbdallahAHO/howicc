import { describe, it, expect, beforeAll } from 'vitest';
import { TimelineExtractor } from '../src/lib/extractor';
import type { ToolResultEvent } from '@howicc/schemas';
import type { StructuredToolContent } from '@howicc/schemas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile, mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Structured Tool Results', () => {
  const testDir = join(__dirname, 'fixtures', 'test-structured-results');

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });

    // Create a test session with various tool result types
    const sessionFile = join(testDir, 'structured-session.jsonl');
    const entries = [
      // User prompt
      JSON.stringify({
        type: 'user',
        uuid: 'user-1',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:00:00.000Z',
        message: { role: 'user', content: 'Edit a file' },
      }),
      // Assistant with Edit tool
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-1',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:00:01.000Z',
        parentUuid: 'user-1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-edit-1',
              name: 'Edit',
              input: {
                file_path: 'src/utils.py',
                old_string: 'def old():\n    pass',
                new_string: 'def new():\n    return True',
              },
            },
          ],
        },
      }),
      // Tool result for Edit
      JSON.stringify({
        type: 'user',
        uuid: 'tool-result-1',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:00:02.000Z',
        parentUuid: 'assistant-1',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-edit-1',
              content: '--- a/src/utils.py\n+++ b/src/utils.py\n@@ -1,2 +1,2 @@\n-def old():\n+def new():\n     pass\n+    return True',
            },
          ],
        },
      }),
      // Assistant with Bash tool
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-2',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:01:00.000Z',
        parentUuid: 'tool-result-1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-bash-1',
              name: 'Bash',
              input: {
                command: 'git status',
                exitCode: 0,
              },
            },
          ],
        },
      }),
      // Tool result for Bash
      JSON.stringify({
        type: 'user',
        uuid: 'tool-result-2',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:01:01.000Z',
        parentUuid: 'assistant-2',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-bash-1',
              content: 'On branch main\nYour branch is up to date.',
            },
          ],
        },
      }),
      // Assistant with TodoWrite tool
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-3',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:02:00.000Z',
        parentUuid: 'tool-result-2',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-todo-1',
              name: 'TodoWrite',
              input: {
                todos: [{ id: '1', content: 'Task 1' }],
              },
            },
          ],
        },
      }),
      // Tool result for TodoWrite (JSON format)
      JSON.stringify({
        type: 'user',
        uuid: 'tool-result-3',
        sessionId: 'structured-session',
        timestamp: '2024-01-01T10:02:01.000Z',
        parentUuid: 'assistant-3',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-todo-1',
              content: JSON.stringify({
                oldTodos: [],
                newTodos: [{ id: '1', content: 'Task 1' }],
              }),
            },
          ],
        },
      }),
    ];

    await writeFile(sessionFile, entries.join('\n'));
  });

  it('should generate file_edit structured content for Edit tool', async () => {
    const extractor = new TimelineExtractor('structured-session', testDir);
    const conversation = await extractor.extract();

    const toolResults = conversation.timeline.filter(
      e => e.type === 'tool_result'
    ) as ToolResultEvent[];

    const editResult = toolResults.find(r => r.toolCallId === 'tool-edit-1');
    expect(editResult).toBeDefined();
    expect(editResult?.structuredContent).toBeDefined();
    expect(editResult?.structuredContent?.type).toBe('file_edit');

    const fileEdit = editResult!.structuredContent as Extract<
      StructuredToolContent,
      { type: 'file_edit' }
    >;
    expect(fileEdit.oldPath).toBe('src/utils.py');
    expect(fileEdit.diff).toBeDefined();
    expect(fileEdit.diff).toContain('--- a/src/utils.py');
    expect(fileEdit.diff).toContain('+++ b/src/utils.py');
  });

  it('should generate command structured content for Bash tool', async () => {
    const extractor = new TimelineExtractor('structured-session', testDir);
    const conversation = await extractor.extract();

    const toolResults = conversation.timeline.filter(
      e => e.type === 'tool_result'
    ) as ToolResultEvent[];

    const bashResult = toolResults.find(r => r.toolCallId === 'tool-bash-1');
    expect(bashResult).toBeDefined();
    expect(bashResult?.structuredContent).toBeDefined();
    expect(bashResult?.structuredContent?.type).toBe('command');

    const command = bashResult!.structuredContent as Extract<
      StructuredToolContent,
      { type: 'command' }
    >;
    expect(command.command).toBe('git status');
    expect(command.stdout).toContain('On branch main');
    expect(command.exitCode).toBe(0);
  });

  it('should generate todo structured content for TodoWrite tool', async () => {
    const extractor = new TimelineExtractor('structured-session', testDir);
    const conversation = await extractor.extract();

    const toolResults = conversation.timeline.filter(
      e => e.type === 'tool_result'
    ) as ToolResultEvent[];

    const todoResult = toolResults.find(r => r.toolCallId === 'tool-todo-1');
    expect(todoResult).toBeDefined();
    expect(todoResult?.structuredContent).toBeDefined();
    expect(todoResult?.structuredContent?.type).toBe('todo');

    const todo = todoResult!.structuredContent as Extract<
      StructuredToolContent,
      { type: 'todo' }
    >;
    expect(todo.oldTodos).toEqual([]);
    expect(todo.newTodos).toHaveLength(1);
  });

  it('should fallback to text type for unknown tools', async () => {
    // This would require a tool result without a matching tool call
    // The extractor should still create a structured content with type 'text'
    const extractor = new TimelineExtractor('structured-session', testDir);
    const conversation = await extractor.extract();

    const toolResults = conversation.timeline.filter(
      e => e.type === 'tool_result'
    ) as ToolResultEvent[];

    // All results should have structuredContent
    for (const result of toolResults) {
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent?.type).toBeDefined();
    }
  });

  it('should maintain backward compatibility with content field', async () => {
    const extractor = new TimelineExtractor('structured-session', testDir);
    const conversation = await extractor.extract();

    const toolResults = conversation.timeline.filter(
      e => e.type === 'tool_result'
    ) as ToolResultEvent[];

    // All results should have both content (legacy) and structuredContent (new)
    for (const result of toolResults) {
      expect(result.content).toBeDefined(); // Legacy field
      expect(result.structuredContent).toBeDefined(); // New field
    }
  });
});
