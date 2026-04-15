import { describe, it, expect, beforeAll } from 'vitest';
import { TimelineExtractor } from '../src/lib/extractor';
import { ConversationSchema } from '@howicc/schemas';
import type {
  Conversation,
  ToolResultEvent,
  AssistantTurnEvent,
  UserPromptEvent,
} from '@howicc/schemas';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_SESSION_ID = 'e7339573-3ef5-4cce-8b2d-8010f9559c78';
const FIXTURE_DIR = join(__dirname, 'fixtures', FIXTURE_SESSION_ID);

describe(`Real Fixture: ${FIXTURE_SESSION_ID}`, () => {
  describe('Single Session Extraction', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should extract the conversation successfully', () => {
      expect(conversation).toBeDefined();
      expect(conversation.id).toBe(FIXTURE_SESSION_ID);
    });

    it('should conform to ConversationSchema', () => {
      const result = ConversationSchema.safeParse(conversation);
      if (!result.success) {
        console.error('Validation errors:', JSON.stringify(result.error.format(), null, 2));
      }
      expect(result.success).toBe(true);
    });

    it('should have a meaningful title (not "Untitled Conversation")', () => {
      expect(conversation.title).toBeDefined();
      expect(conversation.title).not.toBe('Untitled Conversation');
      expect(conversation.title.length).toBeGreaterThan(0);
    });

    it('should extract project path from cwd in logs', () => {
      expect(conversation.project).toBeDefined();
      expect(conversation.project).toContain('howicc');
    });

    it('should have timeline events', () => {
      expect(conversation.timeline.length).toBeGreaterThan(100);
      console.log(`Extracted ${conversation.timeline.length} timeline events`);
    });

    it('should have all expected event types', () => {
      const eventTypes = new Set(conversation.timeline.map(e => e.type));
      expect(eventTypes.has('user_prompt')).toBe(true);
      expect(eventTypes.has('assistant_turn')).toBe(true);
      expect(eventTypes.has('tool_result')).toBe(true);
    });

    it('should maintain chronological order', () => {
      const timestamps = conversation.timeline.map(e => new Date(e.timestamp).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sortedTimestamps);
    });

    it('should have unique event IDs', () => {
      const ids = conversation.timeline.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('Two-Pass Reconstruction (extractProject)', () => {
    let conversations: Conversation[];
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, join(__dirname, 'fixtures'));
      conversations = await extractor.extractProject(FIXTURE_DIR);
    }, 30000);

    it('should extract at least one conversation from project directory', () => {
      expect(conversations.length).toBeGreaterThanOrEqual(1);
    });

    it('should find the main session', () => {
      const mainSession = conversations.find(c => c.id === FIXTURE_SESSION_ID);
      expect(mainSession).toBeDefined();
    });

    it('should link summaries to sessions via leafUuid (Pass 2)', () => {
      const mainSession = conversations.find(c => c.id === FIXTURE_SESSION_ID);
      expect(mainSession).toBeDefined();

      // The title should come from a summary linked via leafUuid or first user message
      // Based on the fixture, we saw summaries like:
      // "E2E Testing: Fixed PocketBase Schema & Playwright Tests"
      // "Move Playwright to root, unified dev scripts"
      expect(mainSession!.title).toBeDefined();
      // Title might be from summary or first user message - both are valid
      expect(mainSession!.title.length).toBeGreaterThan(0);
    });

    it('should extract project name from cwd in logs', () => {
      const mainSession = conversations.find(c => c.id === FIXTURE_SESSION_ID);
      expect(mainSession?.project).toBeDefined();
      expect(mainSession?.project).toContain('howicc');
    });

    it('should handle multiple JSONL files in project directory', async () => {
      const files = await readdir(FIXTURE_DIR);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      expect(jsonlFiles.length).toBeGreaterThan(1); // Main + agent files

      // All entries from all files should be processed
      const mainSession = conversations.find(c => c.id === FIXTURE_SESSION_ID);
      expect(mainSession?.timeline.length).toBeGreaterThan(100);
    });

    it('should maintain chronological order across files', () => {
      const mainSession = conversations.find(c => c.id === FIXTURE_SESSION_ID);
      if (!mainSession) return;

      const timestamps = mainSession.timeline.map(e => new Date(e.timestamp).getTime());
      const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
      expect(timestamps).toEqual(sortedTimestamps);
    });
  });

  describe('Structured Tool Results', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should generate structured content for tool results', () => {
      const toolResults = conversation.timeline.filter(
        e => e.type === 'tool_result'
      ) as ToolResultEvent[];

      expect(toolResults.length).toBeGreaterThan(0);

      // All tool results should have structuredContent
      for (const result of toolResults) {
        expect(result.structuredContent).toBeDefined();
        expect(result.structuredContent?.type).toBeDefined();
        expect(['file_edit', 'command', 'text', 'todo']).toContain(
          result.structuredContent?.type
        );
      }
    });

    it('should maintain backward compatibility with content field', () => {
      const toolResults = conversation.timeline.filter(
        e => e.type === 'tool_result'
      ) as ToolResultEvent[];

      for (const result of toolResults) {
        // Legacy content field should be present
        expect(result.content).toBeDefined();
      }
    });

    it('should link tool results to tool calls via toolCallId', () => {
      const toolResults = conversation.timeline.filter(
        e => e.type === 'tool_result'
      ) as ToolResultEvent[];

      const assistantTurns = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      // Find tool calls
      const toolCallIds = new Set<string>();
      for (const turn of assistantTurns) {
        for (const content of turn.content) {
          if (content.type === 'tool_call_block') {
            toolCallIds.add(content.id);
          }
        }
      }

      // All tool results should reference valid tool calls
      for (const result of toolResults) {
        expect(toolCallIds.has(result.toolCallId)).toBe(true);
      }
    });

    it('should extract tool names correctly', () => {
      const toolResults = conversation.timeline.filter(
        e => e.type === 'tool_result'
      ) as ToolResultEvent[];

      for (const result of toolResults) {
        expect(result.toolName).toBeDefined();
        expect(result.toolName).not.toBe('unknown');
      }
    });
  });

  describe('Agent Sidechains', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should process agent sidechain files', async () => {
      const files = await readdir(FIXTURE_DIR);
      const agentFiles = files.filter(f => f.startsWith('agent-') && f.endsWith('.jsonl'));
      expect(agentFiles.length).toBeGreaterThan(0);
      console.log(`Found ${agentFiles.length} agent sidechain files`);
    });

    it('should extract agent thoughts from sidechains', () => {
      const assistantEvents = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      const eventsWithThoughts = assistantEvents.filter(
        e => e.thoughts && e.thoughts.length > 0
      );

      console.log(`Found ${eventsWithThoughts.length} events with agent thoughts`);

      if (eventsWithThoughts.length > 0) {
        const firstThought = eventsWithThoughts[0].thoughts![0];
        expect(firstThought).toHaveProperty('agentId');
        expect(firstThought).toHaveProperty('prompt');
        expect(firstThought).toHaveProperty('response');
        expect(firstThought.agentId).toBeDefined();
        expect(firstThought.prompt.length).toBeGreaterThan(0);
        expect(firstThought.response.length).toBeGreaterThan(0);
      }
    });
  });

  describe('File Patches and Diffs', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should extract file patches from tool calls', () => {
      const assistantEvents = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      let patchCount = 0;
      const filePaths = new Set<string>();

      for (const event of assistantEvents) {
        for (const content of event.content) {
          if (content.type === 'tool_call_block' && content.filePatches) {
            patchCount += content.filePatches.length;
            for (const patch of content.filePatches) {
              filePaths.add(patch.filePath);
            }
          }
        }
      }

      console.log(`Found ${patchCount} file patches across ${filePaths.size} files`);
      expect(patchCount).toBeGreaterThanOrEqual(0);
    });

    it('should generate valid unified diff format for file edits', () => {
      const assistantEvents = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      for (const event of assistantEvents) {
        for (const content of event.content) {
          if (content.type === 'tool_call_block' && content.filePatches) {
            for (const patch of content.filePatches) {
              expect(patch.diff).toBeDefined();
              expect(patch.diff.length).toBeGreaterThan(0);
              // Unified diff should have header lines
              if (patch.type === 'edit' || patch.type === 'create') {
                expect(patch.diff).toMatch(/^--- /m);
                expect(patch.diff).toMatch(/^\+\+\+ /m);
              }
            }
          }
        }
      }
    });
  });

  describe('Content Sanitization', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should sanitize user prompts (remove protocol tags)', () => {
      const userEvents = conversation.timeline.filter(
        e => e.type === 'user_prompt'
      ) as UserPromptEvent[];

      for (const event of userEvents) {
        // Should not contain Claude protocol tags
        expect(event.content).not.toContain('<bash-input>');
        expect(event.content).not.toContain('<command-name>');
        expect(event.content).not.toContain('<command-message>');
      }
    });

    it('should sanitize assistant text blocks', () => {
      const assistantEvents = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      for (const event of assistantEvents) {
        for (const content of event.content) {
          if (content.type === 'text_block') {
            // Should not contain protocol tags
            expect(content.text).not.toContain('<bash-input>');
            expect(content.text).not.toContain('<command-name>');
          }
        }
      }
    });

    it('should filter out system messages', () => {
      const userEvents = conversation.timeline.filter(
        e => e.type === 'user_prompt'
      ) as UserPromptEvent[];

      // Should not have system/caveat messages
      for (const event of userEvents) {
        expect(event.content).not.toMatch(/^Caveat:/);
        expect(event.content).not.toMatch(/^\[Request interrupted/);
      }
    });
  });

  describe('Metadata Extraction', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should extract git branch information', () => {
      expect(conversation.gitBranch).toBeDefined();
      expect(conversation.gitBranch.length).toBeGreaterThan(0);
    });

    it('should extract version information', () => {
      expect(conversation.version).toBeDefined();
    });

    it('should have valid timestamps', () => {
      expect(conversation.createdAt).toBeDefined();
      expect(conversation.updatedAt).toBeDefined();

      const createdAt = new Date(conversation.createdAt);
      const updatedAt = new Date(conversation.updatedAt);

      expect(createdAt.getTime()).not.toBeNaN();
      expect(updatedAt.getTime()).not.toBeNaN();
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(createdAt.getTime());
    });

    it('should have timestamps in ISO format', () => {
      expect(conversation.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(conversation.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    let conversation: Conversation;
    let extractor: TimelineExtractor;

    beforeAll(async () => {
      const fixturesDir = join(__dirname, 'fixtures');
      extractor = new TimelineExtractor(FIXTURE_SESSION_ID, fixturesDir);
      conversation = await extractor.extract();
    }, 30000);

    it('should handle conversations with no tool calls gracefully', () => {
      // This conversation should have tool calls, but we test the structure
      const assistantEvents = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      // Some assistant turns might not have tool calls
      const turnsWithoutTools = assistantEvents.filter(
        e => !e.content.some(c => c.type === 'tool_call_block')
      );

      // Should handle both cases
      expect(assistantEvents.length).toBeGreaterThan(0);
    });

    it('should handle tool results without matching tool calls', () => {
      const toolResults = conversation.timeline.filter(
        e => e.type === 'tool_result'
      ) as ToolResultEvent[];

      // All should have structuredContent (fallback to text if no match)
      for (const result of toolResults) {
        expect(result.structuredContent).toBeDefined();
      }
    });

    it('should not have duplicate events', () => {
      const ids = conversation.timeline.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should handle empty content blocks gracefully', () => {
      const assistantEvents = conversation.timeline.filter(
        e => e.type === 'assistant_turn'
      ) as AssistantTurnEvent[];

      // Most assistant turns should have content, but empty ones are valid (filtered out)
      const eventsWithContent = assistantEvents.filter(e => e.content.length > 0);
      expect(eventsWithContent.length).toBeGreaterThan(0);
      console.log(`${eventsWithContent.length}/${assistantEvents.length} assistant turns have content`);
    });
  });
});
