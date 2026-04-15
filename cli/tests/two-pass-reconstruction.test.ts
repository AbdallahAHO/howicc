import { describe, it, expect, beforeAll } from 'vitest';
import { TimelineExtractor } from '../src/lib/extractor';
import { ConversationSchema } from '@howicc/schemas';
import type { Conversation, ToolResultEvent } from '@howicc/schemas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFile, mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Two-Pass Reconstruction (extractProject)', () => {
  const testProjectDir = join(__dirname, 'fixtures', 'test-project-reconstruction');

  beforeAll(async () => {
    // Create test project directory with multiple sessions
    await mkdir(testProjectDir, { recursive: true });

    // Session 1: Has summary that appears AFTER the conversation
    const session1File = join(testProjectDir, 'session-1.jsonl');
    const session1Entries = [
      // User message
      JSON.stringify({
        type: 'user',
        uuid: 'user-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T10:00:00.000Z',
        message: { role: 'user', content: 'Fix the bug in utils.py' },
        cwd: '/Users/test/project',
        gitBranch: 'main',
      }),
      // Assistant response
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-1',
        sessionId: 'session-1',
        timestamp: '2024-01-01T10:00:01.000Z',
        parentUuid: 'user-1',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'I will fix the bug.' }],
        },
      }),
      // Summary appears LATER (this is the key test - summary comes after)
      JSON.stringify({
        type: 'summary',
        uuid: 'summary-1',
        leafUuid: 'assistant-1', // Links to assistant-1
        summary: 'Fixed bug in utils.py',
        timestamp: '2024-01-01T10:05:00.000Z', // Later timestamp
      }),
    ];
    await writeFile(session1File, session1Entries.join('\n'));

    // Session 2: Multiple files, summary in different file
    const session2File1 = join(testProjectDir, 'session-2.jsonl');
    const session2File2 = join(testProjectDir, 'session-2-agent.jsonl');

    const session2Entries1 = [
      JSON.stringify({
        type: 'user',
        uuid: 'user-2',
        sessionId: 'session-2',
        timestamp: '2024-01-01T11:00:00.000Z',
        message: { role: 'user', content: 'Refactor the API' },
        cwd: '/Users/test/project',
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-2',
        sessionId: 'session-2',
        timestamp: '2024-01-01T11:00:01.000Z',
        parentUuid: 'user-2',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will refactor.' },
            {
              type: 'tool_use',
              id: 'tool-edit-1',
              name: 'Edit',
              input: { file_path: 'api.py', old_string: 'old', new_string: 'new' },
            },
          ],
        },
      }),
    ];

    const session2Entries2 = [
      // Tool result in separate "agent" file
      JSON.stringify({
        type: 'user',
        uuid: 'tool-result-1',
        sessionId: 'session-2',
        timestamp: '2024-01-01T11:00:02.000Z',
        parentUuid: 'assistant-2',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool-edit-1',
              content: 'Edit completed successfully',
            },
          ],
        },
      }),
      // Summary in this file, links to assistant-2
      JSON.stringify({
        type: 'summary',
        uuid: 'summary-2',
        leafUuid: 'assistant-2',
        summary: 'Refactored API endpoints',
        timestamp: '2024-01-01T11:05:00.000Z',
      }),
    ];

    await writeFile(session2File1, session2Entries1.join('\n'));
    await writeFile(session2File2, session2Entries2.join('\n'));

    // Session 3: No summary, should use first user message
    const session3File = join(testProjectDir, 'session-3.jsonl');
    const session3Entries = [
      JSON.stringify({
        type: 'user',
        uuid: 'user-3',
        sessionId: 'session-3',
        timestamp: '2024-01-01T12:00:00.000Z',
        message: { role: 'user', content: 'Add new feature' },
        cwd: '/Users/test/project',
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'assistant-3',
        sessionId: 'session-3',
        timestamp: '2024-01-01T12:00:01.000Z',
        parentUuid: 'user-3',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Feature added.' }],
        },
      }),
    ];
    await writeFile(session3File, session3Entries.join('\n'));
  });

  it('should extract all sessions from project directory', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    expect(conversations.length).toBe(3);
    expect(conversations.map(c => c.id).sort()).toEqual(['session-1', 'session-2', 'session-3']);
  });

  it('should link summaries to sessions using leafUuid (Pass 2)', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    const session1 = conversations.find(c => c.id === 'session-1');
    expect(session1).toBeDefined();
    expect(session1?.title).toBe('Fixed bug in utils.py'); // From summary linked via leafUuid

    const session2 = conversations.find(c => c.id === 'session-2');
    expect(session2).toBeDefined();
    expect(session2?.title).toBe('Refactored API endpoints'); // From summary in different file
  });

  it('should use first user message as title when no summary exists', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    const session3 = conversations.find(c => c.id === 'session-3');
    expect(session3).toBeDefined();
    expect(session3?.title).toContain('Add new feature');
  });

  it('should extract project name from cwd in logs', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    const session1 = conversations.find(c => c.id === 'session-1');
    expect(session1?.project).toBeDefined();
    expect(session1?.project).toContain('project');
  });

  it('should handle sessions with entries in multiple files', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    const session2 = conversations.find(c => c.id === 'session-2');
    expect(session2).toBeDefined();
    // Should have both user message and tool result
    const userEvents = session2?.timeline.filter(e => e.type === 'user_prompt');
    const toolResults = session2?.timeline.filter(e => e.type === 'tool_result');
    expect(userEvents?.length).toBeGreaterThan(0);
    expect(toolResults?.length).toBeGreaterThan(0);
  });

  it('should maintain chronological order across files', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    const session2 = conversations.find(c => c.id === 'session-2');
    expect(session2).toBeDefined();

    const timestamps = session2!.timeline.map(e => new Date(e.timestamp).getTime());
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sortedTimestamps);
  });

  it('should generate structured tool results', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    const session2 = conversations.find(c => c.id === 'session-2');
    const toolResults = (session2?.timeline.filter(
      e => e.type === 'tool_result'
    ) || []) as ToolResultEvent[];

    expect(toolResults.length).toBeGreaterThan(0);
    const firstResult = toolResults[0];
    // structuredContent is optional, but should be present for tool results
    if (firstResult.structuredContent) {
      expect(firstResult.structuredContent.type).toBeDefined();
    }
    // Legacy content should always be present
    expect(firstResult.content).toBeDefined();
  });

  it('should validate all conversations against schema', async () => {
    const extractor = new TimelineExtractor('dummy', testProjectDir);
    const conversations = await extractor.extractProject(testProjectDir);

    for (const conversation of conversations) {
      const result = ConversationSchema.safeParse(conversation);
      if (!result.success) {
        console.error('Validation errors:', JSON.stringify(result.error.format(), null, 2));
      }
      expect(result.success).toBe(true);
    }
  });

  it('should handle empty project directory', async () => {
    const emptyDir = join(__dirname, 'fixtures', 'empty-project');
    await mkdir(emptyDir, { recursive: true });

    const extractor = new TimelineExtractor('dummy', emptyDir);
    const conversations = await extractor.extractProject(emptyDir);

    expect(conversations).toEqual([]);
  });
});
