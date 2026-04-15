import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  ClaudeConversation,
  ClaudeMessage,
  JSONLEntry,
  ContentBlock,
  TokenUsage,
} from '../types/index.js';
import type {
  Conversation,
  TimelineEvent,
  UserPromptEvent,
  AssistantTurnEvent,
  ToolResultEvent,
  ParsingErrorEvent,
  FilePatch,
  ToolCallBlock,
  Thought,
  AssistantContent,
} from '@howicc/schemas';
import {
  decodeProjectFolderName,
  normalizeProjectPath,
} from './path-utils.js';
import { SessionCacheManager } from './cache.js';
import { cleanContent, isSystemMessage, cleanToolOutput } from './sanitizer.js';

export class ClaudeExtractor {
  private claudeDir: string;
  private cacheManager: SessionCacheManager;

  constructor() {
    this.claudeDir = join(homedir(), '.claude', 'projects');
    this.cacheManager = new SessionCacheManager();
  }

  /**
   * Find all JSONL session files
   */
  async findSessions(): Promise<string[]> {
    const sessions: string[] = [];

    try {
      const scan = async (dir: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
            sessions.push(fullPath);
          }
        }
      };

      await scan(this.claudeDir);

      // Sort by modification time (most recent first)
      const withStats = await Promise.all(
        sessions.map(async (path) => ({
          path,
          mtime: (await stat(path)).mtime,
        }))
      );

      return withStats
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        .map((s) => s.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          `Claude directory not found at ${this.claudeDir}. Have you used Claude Code?`
        );
      }
      throw error;
    }
  }

  /**
   * Check if conversation should be included (not filtered out)
   * Excludes: single-message conversations and conversations with no user messages
   */
  shouldIncludeConversation(conv: ClaudeConversation): boolean {
    // Filter out single-message conversations
    if (conv.messageCount <= 1) return false;

    // Filter out conversations with no user messages (title falls back to 'Untitled Conversation')
    if (conv.title === 'Untitled Conversation') return false;

    return true;
  }

  /**
   * Find sessions with filtering applied
   * Returns only conversations with >1 message and a title
   */
  async findFilteredSessions(): Promise<{ sessions: string[]; totalFound: number; filtered: number }> {
    await this.cacheManager.init();
    const allSessions = await this.findSessions();
    const filtered: string[] = [];

    for (const path of allSessions) {
      try {
        // Use metadata extraction which leverages cache
        const conv = await this.extractMetadata(path);
        if (this.shouldIncludeConversation(conv)) {
          filtered.push(path);
        }
      } catch {
        // Skip errored sessions
      }
    }

    return {
      sessions: filtered,
      totalFound: allSessions.length,
      filtered: allSessions.length - filtered.length,
    };
  }

  /**
   * Extract conversation metadata (using cache if available)
   * This is faster for listing as it avoids full parsing if cached
   */
  async extractMetadata(filePath: string): Promise<ClaudeConversation> {
    const cached = await this.cacheManager.getCachedSession(filePath);
    if (cached) {
      return {
        sessionId: cached.sessionId,
        projectName: cached.projectPath,
        filePath: cached.fullPath,
        messages: [], // Metadata doesn't include messages
        title: cached.title,
        gitBranch: cached.gitBranch || '',
        messageCount: cached.messageCount,
        modifiedAt: new Date(cached.mtime),
        summary: cached.summary,
        firstUserMessage: cached.firstUserMessage,
        firstTimestamp: cached.firstTimestamp,
        lastTimestamp: cached.lastTimestamp,
        tokenUsage: cached.tokenUsage,
      };
    }

    // If not cached, perform full extraction and cache it
    const conv = await this.extractConversation(filePath);

    // Update cache with enhanced metadata
    await this.cacheManager.updateSession({
      sessionId: conv.sessionId,
      projectPath: conv.projectName,
      fullPath: conv.filePath,
      mtime: conv.modifiedAt.getTime(),
      title: conv.title,
      messageCount: conv.messageCount,
      gitBranch: conv.gitBranch,
      createdAt: conv.firstTimestamp || conv.modifiedAt.toISOString(),
      updatedAt: conv.lastTimestamp || conv.modifiedAt.toISOString(),
      summary: conv.summary,
      firstUserMessage: conv.firstUserMessage,
      firstTimestamp: conv.firstTimestamp,
      lastTimestamp: conv.lastTimestamp,
      tokenUsage: conv.tokenUsage,
    });
    await this.cacheManager.saveCache();

    return conv;
  }

  /**
   * Extract a single conversation from a JSONL file
   */
  async extractConversation(filePath: string): Promise<ClaudeConversation> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error('Conversation file is empty');
    }

    let gitBranch = '';
    let projectPath = '';
    let lastMessageUuid: string | undefined;
    let latestSummary: string | undefined;
    const summariesByLeaf = new Map<string, string>();
    const messages: ClaudeMessage[] = [];

    // Enhanced metadata tracking
    let firstTimestamp: string | undefined;
    let lastTimestamp: string | undefined;
    const tokenUsage: TokenUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };
    const seenRequestIds = new Set<string>();
    let firstUserMessage: string | undefined;

    for (const line of lines) {
      try {
        const entry: JSONLEntry = JSON.parse(line);

        // Track timestamps
        if (entry.timestamp) {
          if (!firstTimestamp || entry.timestamp < firstTimestamp) {
            firstTimestamp = entry.timestamp;
          }
          if (!lastTimestamp || entry.timestamp > lastTimestamp) {
            lastTimestamp = entry.timestamp;
          }
        }

        if (entry.type === 'summary' && typeof entry.summary === 'string') {
          const normalized = this.cleanPreview(entry.summary);
          if (entry.leafUuid) {
            summariesByLeaf.set(entry.leafUuid, normalized);
          }
          if (normalized && !this.isWarmupMessage(normalized) && !this.isSystemMessage(normalized)) {
            latestSummary = normalized;
          }
          continue;
        }

        if (typeof entry.gitBranch === 'string' && entry.gitBranch.trim()) {
          gitBranch = entry.gitBranch.trim();
        }

        if (typeof entry.cwd === 'string' && entry.cwd.trim()) {
          projectPath = normalizeProjectPath(entry.cwd);
        }

        // Extract user messages (skip meta/system messages)
        if (entry.type === 'user' && entry.message && !entry.isMeta) {
          const content = this.extractTextContent(
            entry.message.content || entry.content
          );
          // Skip system/caveat messages
          if (content && !this.isSystemMessage(content)) {
            // Track first meaningful user message
            if (!firstUserMessage && !this.isWarmupMessage(content)) {
              firstUserMessage = this.cleanPreview(content.slice(0, 1000));
            }

            messages.push({
              role: 'user',
              content,
              timestamp: entry.timestamp,
            });
            if (entry.uuid) {
              lastMessageUuid = entry.uuid;
            }
          }
        }

        // Extract assistant messages with token usage
        if (entry.type === 'assistant' && entry.message) {
          const content = this.extractTextContent(
            entry.message.content || entry.content
          );
          if (content) {
            messages.push({
              role: 'assistant',
              content,
              timestamp: entry.timestamp,
            });
            if (entry.uuid) {
              lastMessageUuid = entry.uuid;
            }
          }

          // Extract token usage (deduplicate by requestId)
          if (entry.message.usage && entry.requestId && !seenRequestIds.has(entry.requestId)) {
            seenRequestIds.add(entry.requestId);
            const usage = entry.message.usage;
            tokenUsage.input_tokens = (tokenUsage.input_tokens || 0) + (usage.input_tokens || 0);
            tokenUsage.output_tokens = (tokenUsage.output_tokens || 0) + (usage.output_tokens || 0);
            tokenUsage.cache_creation_input_tokens = (tokenUsage.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
            tokenUsage.cache_read_input_tokens = (tokenUsage.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
          }
        }
      } catch (error) {
        // Skip invalid JSON lines
        continue;
      }
    }

    // Extract project name from path
    const pathParts = filePath.split('/');
    const projectsIndex = pathParts.indexOf('projects');
    if (!projectPath) {
      const folderName =
        projectsIndex !== -1 && pathParts[projectsIndex + 1]
          ? pathParts[projectsIndex + 1]
          : '';
      projectPath = decodeProjectFolderName(folderName);
    }

    // Get file stats
    const stats = await stat(filePath);

    let summaryFromLeaf = lastMessageUuid
      ? summariesByLeaf.get(lastMessageUuid)
      : undefined;

    // Use the tracked firstUserMessage or find from messages
    let preview = firstUserMessage
      ? this.cleanPreview(firstUserMessage.slice(0, 150))
      : '';

    // Fallback: find first user message from parsed messages if not already tracked
    if (!preview) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      if (firstUserMsg) {
        preview = this.cleanPreview(firstUserMsg.content.slice(0, 150));
      }
    }

    // Filter out warmup and system messages
    if (preview && (this.isWarmupMessage(preview) || this.isSystemMessage(preview))) {
      preview = '';
      // Try to find next meaningful user message
      for (const msg of messages) {
        if (msg.role === 'user') {
          const text = this.cleanPreview(msg.content.slice(0, 150));
          if (text && !this.isWarmupMessage(text) && !this.isSystemMessage(text)) {
            preview = text;
            break;
          }
        }
      }
    }

    // Filter warmup and system messages from summaries
    if (summaryFromLeaf && (this.isWarmupMessage(summaryFromLeaf) || this.isSystemMessage(summaryFromLeaf))) {
      summaryFromLeaf = undefined;
    }
    if (latestSummary && (this.isWarmupMessage(latestSummary) || this.isSystemMessage(latestSummary))) {
      latestSummary = undefined;
    }

    // Prioritize first user message content over summary field
    // This matches ccresume's behavior and avoids misleading titles like "Warmup"
    const title =
      preview || summaryFromLeaf || latestSummary || 'Untitled Conversation';

    // Use summary from leaf UUID if available, otherwise use latest summary
    const finalSummary = summaryFromLeaf || latestSummary;

    return {
      sessionId: filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown',
      projectName: projectPath,
      filePath,
      messages,
      title,
      gitBranch,
      messageCount: messages.length,
      modifiedAt: stats.mtime,
      summary: finalSummary,
      firstUserMessage: firstUserMessage || preview,
      firstTimestamp,
      lastTimestamp,
      tokenUsage: (tokenUsage.input_tokens || tokenUsage.output_tokens) ? tokenUsage : undefined,
    };
  }

  /**
   * Extract text content from various JSONL content formats
   */
  private extractTextContent(
    content: string | ContentBlock[] | undefined
  ): string {
    if (!content) return '';

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textParts: string[] = [];

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text);
        }
      }

      return textParts.join('\n');
    }

    return '';
  }

  /**
   * Check if text is a warmup message (should be ignored for titles)
   */
  private isWarmupMessage(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return (
      normalized === 'warmup' ||
      normalized.startsWith('warmup') ||
      normalized === 'agent warmup' ||
      normalized.includes('agent warmup')
    );
  }

  /**
   * Check if text is a system/caveat message (should be ignored for titles)
   */
  private isSystemMessage(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return (
      normalized.startsWith('caveat:') ||
      normalized.startsWith('the user opened') ||
      normalized.startsWith('the user opened the file') ||
      normalized.includes('do not respond to these messages') ||
      normalized.includes('generated by the user while running local commands') ||
      normalized.includes('request interrupted') ||
      normalized.includes('<local-command-stdout>')
    );
  }

  /**
   * Clean preview text by removing special formatting
   * Uses sanitizer for consistency
   */
  private cleanPreview(text: string): string {
    return cleanContent(text)
      .replace(/\[Request interrupted.*?\]/g, '') // Remove interruption messages
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Convert conversation to markdown format
   */
  conversationToMarkdown(conversation: ClaudeConversation): string {
    const lines: string[] = [];

    lines.push('# Claude Conversation Log\n');
    lines.push(`Session ID: ${conversation.sessionId}`);
    lines.push(`Project: ${conversation.projectName}`);
    lines.push(
      `Date: ${conversation.modifiedAt.toISOString().split('T')[0]}\n`
    );
    lines.push('---\n');

    for (const message of conversation.messages) {
      const roleLabel = message.role === 'user' ? '👤 Human' : '🤖 Claude';
      lines.push(`## ${roleLabel}\n`);
      lines.push(`${message.content}\n`);
      lines.push('---\n');
    }

    return lines.join('\n');
  }

  /**
   * Check if Claude directory exists
   */
  async checkClaudeDirectory(): Promise<boolean> {
    try {
      await stat(this.claudeDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Aggregate project-level statistics from all sessions in a project directory
   * Similar to Python's process_projects_hierarchy and _collect_project_sessions
   */
  async aggregateProjectStats(projectDir: string): Promise<{
    projectName: string;
    jsonlCount: number;
    totalMessages: number;
    totalTokens: TokenUsage;
    earliestTimestamp?: string;
    latestTimestamp?: string;
    sessions: Array<{
      sessionId: string;
      title: string;
      summary?: string;
      firstTimestamp?: string;
      lastTimestamp?: string;
      messageCount: number;
      firstUserMessage?: string;
      tokenUsage?: TokenUsage;
    }>;
  }> {
    const projectPath = join(this.claudeDir, projectDir);
    const jsonlFiles = (await readdir(projectPath)).filter(f => f.endsWith('.jsonl'));

    const sessions = [];
    const totalTokens: TokenUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };
    let totalMessages = 0;
    let earliestTimestamp: string | undefined;
    let latestTimestamp: string | undefined;

    for (const jsonlFile of jsonlFiles) {
      const filePath = join(projectPath, jsonlFile);
      try {
        const conv = await this.extractMetadata(filePath);

        sessions.push({
          sessionId: conv.sessionId,
          title: conv.title,
          summary: conv.summary,
          firstTimestamp: conv.firstTimestamp,
          lastTimestamp: conv.lastTimestamp,
          messageCount: conv.messageCount,
          firstUserMessage: conv.firstUserMessage,
          tokenUsage: conv.tokenUsage,
        });

        totalMessages += conv.messageCount;

        // Aggregate timestamps
        if (conv.firstTimestamp) {
          if (!earliestTimestamp || conv.firstTimestamp < earliestTimestamp) {
            earliestTimestamp = conv.firstTimestamp;
          }
        }
        if (conv.lastTimestamp) {
          if (!latestTimestamp || conv.lastTimestamp > latestTimestamp) {
            latestTimestamp = conv.lastTimestamp;
          }
        }

        // Aggregate token usage
        if (conv.tokenUsage) {
          totalTokens.input_tokens = (totalTokens.input_tokens || 0) + (conv.tokenUsage.input_tokens || 0);
          totalTokens.output_tokens = (totalTokens.output_tokens || 0) + (conv.tokenUsage.output_tokens || 0);
          totalTokens.cache_creation_input_tokens = (totalTokens.cache_creation_input_tokens || 0) + (conv.tokenUsage.cache_creation_input_tokens || 0);
          totalTokens.cache_read_input_tokens = (totalTokens.cache_read_input_tokens || 0) + (conv.tokenUsage.cache_read_input_tokens || 0);
        }
      } catch (error) {
        // Skip errored sessions
        continue;
      }
    }

    // Sort sessions by first timestamp (oldest first, like Python script)
    sessions.sort((a, b) => {
      const aTime = a.firstTimestamp || '';
      const bTime = b.firstTimestamp || '';
      return aTime.localeCompare(bTime);
    });

    return {
      projectName: decodeProjectFolderName(projectDir),
      jsonlCount: jsonlFiles.length,
      totalMessages,
      totalTokens,
      earliestTimestamp,
      latestTimestamp,
      sessions,
    };
  }

}

// ============================================================================
// Timeline-Based Extractor
// ============================================================================

/**
 * Extended JSONL entry with additional fields for timeline extraction
 */
interface ExtendedJSONLEntry extends JSONLEntry {
  parentUuid?: string;
  isSidechain?: boolean;
  agentId?: string;
  uuid?: string;
  toolUseResult?: {
    agentId?: string;
    prompt?: string;
    content?: ContentBlock[];
  };
  version?: string;
  tool_use_id?: string; // For tool results
}

/**
 * Raw entry from JSONL files before processing
 */
interface RawEntry {
  uuid?: string;
  sessionId?: string;
  timestamp?: string;
  type: string;
  leafUuid?: string; // For summaries
  summary?: string;
  content?: any;
  message?: any;
  cwd?: string;
  gitBranch?: string;
  isMeta?: boolean;
  parentUuid?: string;
  isSidechain?: boolean;
  agentId?: string;
  tool_use_id?: string;
  version?: string;
  [key: string]: any; // Allow other fields
}

/**
 * Internal parsed entry with metadata
 */
interface ParsedEntry {
  entry: ExtendedJSONLEntry;
  sourceFile: string;
  lineNumber: number;
}

/**
 * Extracts conversations in timeline format with full tool usage, agent thoughts, and file diffs
 */
export class TimelineExtractor {
  private sessionId: string;
  private logsDir: string;
  private errors: ParsingErrorEvent[] = [];

  constructor(sessionId: string, logsDir?: string) {
    this.sessionId = sessionId;
    this.logsDir = logsDir || join(homedir(), '.claude', 'projects');
  }

  /**
   * Main extraction method
   */
  async extract(): Promise<Conversation> {
    // Find all session files (main + agent sidechains)
    const files = await this.findSessionFiles();

    // Parse and link all messages
    const messageGraph = await this.parseAndLink(files);

    // Build timeline from message graph
    const timeline = this.buildTimeline(messageGraph);

    // Extract metadata
    const metadata = this.extractMetadata(messageGraph);

    return {
      id: this.sessionId,
      title: metadata.title,
      project: metadata.project,
      gitBranch: metadata.gitBranch,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      version: metadata.version,
      tags: metadata.tags,
      timeline,
    };
  }

  /**
   * Find main session file and agent sidechain files
   */
  private async findSessionFiles(): Promise<{ main: string; agents: string[] }> {
    // Find the directory containing the session file
    const scan = async (dir: string): Promise<string | null> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const result = await scan(join(dir, entry.name));
            if (result) return result;
          } else if (entry.isFile() && entry.name === `${this.sessionId}.jsonl`) {
            return dir;
          }
        }
      } catch {
        // Directory might not be readable, skip it
      }

      return null;
    };

    const sessionDir = await scan(this.logsDir);

    if (!sessionDir) {
      throw new Error(
        `Session ${this.sessionId} not found in ${this.logsDir}`
      );
    }

    // Find main file and agent files
    const mainFile = join(sessionDir, `${this.sessionId}.jsonl`);
    const agentFiles: string[] = [];

    const entries = await readdir(sessionDir);
    for (const entry of entries) {
      if (entry.startsWith('agent-') && entry.endsWith('.jsonl')) {
        agentFiles.push(join(sessionDir, entry));
      }
    }

    return { main: mainFile, agents: agentFiles };
  }

  /**
   * Parse all JSONL files and build message graph
   */
  private async parseAndLink(
    files: { main: string; agents: string[] }
  ): Promise<Map<string, ParsedEntry>> {
    const messageGraph = new Map<string, ParsedEntry>();
    const allFiles = [files.main, ...files.agents];

    for (const filePath of allFiles) {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (let i = 0; i < lines.length; i++) {
        try {
          const entry: ExtendedJSONLEntry = JSON.parse(lines[i]);

          // Store in graph with uuid as key
          if (entry.uuid) {
            messageGraph.set(entry.uuid, {
              entry,
              sourceFile: filePath,
              lineNumber: i + 1,
            });
          }
        } catch (error) {
          // Collect parsing error
          this.errors.push({
            id: `parse-error-${Date.now()}-${i}`,
            type: 'parsing_error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            originalLine: lines[i],
            sourceFile: filePath,
            lineNumber: i + 1,
          });
        }
      }
    }

    return messageGraph;
  }

  /**
   * Build chronological timeline from message graph
   */
  private buildTimeline(
    messageGraph: Map<string, ParsedEntry>,
    toolCallMap?: Map<string, { toolName: string; input: any }>
  ): TimelineEvent[] {
    const timeline: TimelineEvent[] = [];

    // Find root message (no parent or parent not in graph)
    let currentUuid: string | undefined;
    for (const [uuid, parsed] of messageGraph) {
      if (
        !parsed.entry.isSidechain &&
        (!parsed.entry.parentUuid || !messageGraph.has(parsed.entry.parentUuid))
      ) {
        currentUuid = uuid;
        break;
      }
    }

      // Use provided tool call map or build one from message graph
    const effectiveToolCallMap = toolCallMap || new Map<string, { toolName: string; input: any }>();
    if (!toolCallMap) {
      for (const [, parsed] of messageGraph) {
        const entry = parsed.entry;
        if (entry.type === 'assistant' && entry.message?.content) {
          const content = entry.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'tool_use' && (block as any).id && block.name) {
                effectiveToolCallMap.set((block as any).id, {
                  toolName: block.name,
                  input: block.input || {},
                });
              }
            }
          }
        }
      }
    }

    // Walk the main conversation chain
    while (currentUuid) {
      const parsed = messageGraph.get(currentUuid);
      if (!parsed || parsed.entry.isSidechain) break;

      const entry = parsed.entry;

      // Handle different entry types
      if (entry.type === 'summary') {
        // Summary entries don't go in timeline, they're metadata
      } else if (entry.type === 'user' && !entry.isMeta) {
        // Skip meta/system messages
        const event = this.createUserOrToolResultEvent(entry, effectiveToolCallMap);
        if (event) timeline.push(event);
      } else if (entry.type === 'assistant') {
        const event = this.createAssistantEvent(entry, messageGraph);
        if (event) timeline.push(event);
      }

      // Find next message in chain
      currentUuid = this.findNextInChain(currentUuid, messageGraph);
    }

    // Add parsing errors at the end
    timeline.push(...this.errors);

    return timeline;
  }

  /**
   * Check if content block is a tool result
   */
  private isToolResult(content: string | ContentBlock[] | undefined): boolean {
    if (!Array.isArray(content) || content.length === 0) return false;
    const firstBlock = content[0];
    return (
      firstBlock.type === 'tool_result' &&
      'tool_use_id' in firstBlock &&
      typeof firstBlock.tool_use_id === 'string'
    );
  }

  /**
   * Create user prompt or tool result event
   */
  private createUserOrToolResultEvent(
    entry: ExtendedJSONLEntry,
    toolCallMap?: Map<string, { toolName: string; input: any }>
  ): UserPromptEvent | ToolResultEvent | null {
    if (!entry.message || !entry.uuid || !entry.timestamp || entry.isMeta) return null;

    const content = entry.message.content;

    // Skip system/caveat messages using sanitizer
    if (typeof content === 'string') {
      if (isSystemMessage(content)) return null;
    } else if (Array.isArray(content)) {
      const textContent = this.extractTextFromContent(content);
      if (isSystemMessage(textContent)) return null;
    }

    // Check if this is a tool result
    if (Array.isArray(content) && content.length > 0) {
      const firstBlock = content[0];
      if (
        firstBlock.type === 'tool_result' &&
        'tool_use_id' in firstBlock &&
        typeof firstBlock.tool_use_id === 'string'
      ) {
        // This is a tool result
        // Extract content from tool_result block - it can be a string or in content property
        let contentText = '';
        if (typeof firstBlock.content === 'string') {
          contentText = firstBlock.content;
        } else if (Array.isArray(firstBlock.content)) {
          contentText = this.extractTextFromContent(firstBlock.content);
        } else {
          // Fallback: try to extract from the content array
          contentText = this.extractTextFromContent(content);
        }
        contentText = cleanToolOutput(contentText);
        let summary: string | undefined;
        let structuredContent: any = undefined;

        const toolCallId = firstBlock.tool_use_id;
        const toolCall = toolCallMap?.get(toolCallId);

        // Try to parse JSON content if it looks like a structured tool output
        if (contentText.trim().startsWith('{') || contentText.trim().startsWith('[')) {
          try {
            const json = JSON.parse(contentText);

            // Handle Todo Results
            if (json.oldTodos && json.newTodos) {
              summary = 'Updated TODO list';
              structuredContent = {
                type: 'todo',
                oldTodos: json.oldTodos,
                newTodos: json.newTodos,
              };
            }
            // Handle File Listing Results
            else if (Array.isArray(json) && json.every((x: any) => typeof x === 'string')) {
              summary = `${json.length} files found`;
              contentText = json.slice(0, 10).join('\n') + (json.length > 10 ? `\n...and ${json.length - 10} more` : '');
            }
          } catch (e) {
            // not json, ignore
          }
        }

        // Handle file edit results - check if the tool was an Edit/Write/MultiEdit
        if (!structuredContent && toolCall) {
          const toolName = toolCall.toolName;
          const toolInput = toolCall.input;
          if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
            // Generate diff from tool input if available
            if (toolInput && (toolInput.file_path || (Array.isArray(toolInput.edits) && toolInput.edits[0]?.file_path))) {
              const filePath = toolInput.file_path || toolInput.edits[0]?.file_path;
              structuredContent = {
                type: 'file_edit',
                oldPath: String(filePath),
                diff: contentText, // The tool result content is often the diff
              };
            }
          } else if (toolName === 'Bash' || toolName === 'Command') {
            // Command results
            structuredContent = {
              type: 'command',
              command: (toolInput?.command || toolInput?.cmd || '') as string,
              stdout: contentText,
              exitCode: toolInput?.exitCode as number | undefined,
            };
          }
        }

        // Fallback to text if no structured content
        if (!structuredContent) {
          structuredContent = {
            type: 'text',
            content: contentText,
          };
        }

        return {
          id: entry.uuid,
          type: 'tool_result' as const,
          timestamp: entry.timestamp,
          toolCallId,
          toolName: toolCall?.toolName || this.extractToolNameFromResult(entry),
          status: 'success' as const,
          content: contentText, // Keep legacy content for backward compatibility
          structuredContent,
          summary,
          isError: false,
        } as ToolResultEvent;
      }
    }

    // Regular user prompt - clean content
    const textContent =
      typeof content === 'string' ? content : this.extractTextFromContent(content);
    const cleanedContent = cleanContent(textContent);

    return {
      id: entry.uuid,
      type: 'user_prompt',
      timestamp: entry.timestamp,
      content: cleanedContent,
    };
  }

  /**
   * Formats tool arguments into a human-readable string based on tool type
   */
  private formatToolArgs(name: string, input: any): string | undefined {
    if (!input) return undefined;

    switch (name) {
      case 'Bash':
        return input.command || input.cmd;
      case 'Grep':
        return `pattern: "${input.pattern}" in ${input.glob || input.path || '.'}`;
      case 'Glob':
        return `pattern: "${input.pattern}"`;
      case 'Read':
        return `${input.file_path || input.filePath}${input.offset ? ` (lines ${input.offset}-${input.offset + 50})` : ''}`;
      case 'Edit':
        return `Modify ${input.file_path || input.filePath}`;
      case 'Write':
        return `Create ${input.file_path || input.filePath}`;
      case 'TodoWrite':
        return input.todos ? `${input.todos.length} TODOs` : undefined;
      case 'MultiEdit':
        return Array.isArray(input.edits) ? `${input.edits.length} edits` : undefined;
      default:
        return undefined;
    }
  }

  /**
   * Create assistant turn event with tool calls and thoughts
   */
  private createAssistantEvent(
    entry: ExtendedJSONLEntry,
    messageGraph: Map<string, ParsedEntry>
  ): AssistantTurnEvent | null {
    if (!entry.message || !entry.uuid || !entry.timestamp) return null;

    const content = entry.message.content;
    if (!Array.isArray(content)) return null;

    // Parse content blocks
    const assistantContent: AssistantContent[] = [];

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        // Clean text content
        const cleanedText = cleanContent(block.text);
        assistantContent.push({
          type: 'text_block',
          text: cleanedText,
        });
      } else if (block.type === 'tool_use' && block.name) {
        const toolBlock = {
          id: (block as any).id || `tool-${Date.now()}`,
          type: 'tool_call_block' as const,
          toolName: block.name,
          input: block.input || {},
          argsSummary: this.formatToolArgs(block.name, block.input),
        } as ToolCallBlock;

        // Generate file diffs for file-modifying tools
        const patches = this.generateFileDiffs(toolBlock);
        if (patches.length > 0) {
          toolBlock.filePatches = patches;
        }

        assistantContent.push(toolBlock);
      }
    }

    // Extract thoughts from agent sidechains
    const thoughts = this.extractThoughts(entry.uuid, messageGraph);

    return {
      id: entry.uuid,
      type: 'assistant_turn',
      timestamp: entry.timestamp,
      model: 'claude-sonnet-4-5-20250929', // Default model, could extract from logs
      stopReason: assistantContent.some((c) => c.type === 'tool_call_block')
        ? 'tool_use'
        : 'end_turn',
      content: assistantContent,
      thoughts: thoughts.length > 0 ? thoughts : undefined,
    };
  }

  /**
   * Extract thoughts from agent sidechains linked to this message
   */
  private extractThoughts(
    assistantUuid: string,
    messageGraph: Map<string, ParsedEntry>
  ): Thought[] {
    const thoughts: Thought[] = [];

    // Find the next message after this assistant turn (should be tool result)
    let currentUuid: string | undefined = assistantUuid;

    // Look through the next few messages to find tool results
    for (let i = 0; i < 10; i++) {
      currentUuid = this.findNextInChain(currentUuid!, messageGraph);
      if (!currentUuid) break;

      const parsed = messageGraph.get(currentUuid);
      if (!parsed) break;

      const entry = parsed.entry;

      // Check if this is a tool result with an agentId
      if (entry.toolUseResult?.agentId) {
        const agentId = entry.toolUseResult.agentId;
        const prompt = entry.toolUseResult.prompt || 'Agent task';

        // Find the agent's response from the sidechain
        const agentResponse = this.findAgentResponse(agentId, messageGraph);

        if (agentResponse) {
          thoughts.push({
            agentId,
            prompt,
            response: agentResponse,
          });
        }
      }

      // If we hit an assistant message, stop looking
      if (entry.type === 'assistant') break;
    }

    return thoughts;
  }

  /**
   * Find agent response from agent sidechain by agentId
   */
  private findAgentResponse(
    agentId: string,
    messageGraph: Map<string, ParsedEntry>
  ): string | null {
    // Find all messages from this agent
    const agentMessages: ExtendedJSONLEntry[] = [];

    for (const [, parsed] of messageGraph) {
      if (parsed.entry.agentId === agentId && parsed.entry.isSidechain) {
        agentMessages.push(parsed.entry);
      }
    }

    // Sort by timestamp to find the sequence
    agentMessages.sort((a, b) => {
      const aTime = a.timestamp || '';
      const bTime = b.timestamp || '';
      return aTime.localeCompare(bTime);
    });

    // Find assistant responses (skip the Warmup)
    for (const msg of agentMessages) {
      if (msg.type === 'assistant' && msg.message) {
        const response = this.extractTextFromContent(msg.message.content);
        if (response && !response.includes('Warmup')) {
          return response;
        }
      }
    }

    return null;
  }

  /**
   * Generate file diffs for file-modifying tools
   */
  private generateFileDiffs(toolBlock: ToolCallBlock): FilePatch[] {
    const patches: FilePatch[] = [];
    const input = toolBlock.input as any;

    // Handle 'Write' (Full file overwrite/creation)
    if (toolBlock.toolName === 'Write' && input.file_path && input.content) {
      const filePath = String(input.file_path);
      patches.push({
        filePath,
        type: 'create', // Represents full content write
        diff: this.createUnifiedDiff(filePath, String(input.content)),
      });
    }
    // Handle 'Edit' (Search and Replace)
    else if (toolBlock.toolName === 'Edit' && input.file_path && input.old_string && input.new_string) {
      const filePath = String(input.file_path);
      const oldString = String(input.old_string);
      const newString = String(input.new_string);

      // Create a pseudo-diff showing just the chunk being swapped
      const oldLines = oldString.split('\n');
      const newLines = newString.split('\n');

      // Build diff with old lines (marked with -) followed by new lines (marked with +)
      const diffLines: string[] = [];
      diffLines.push(`--- a/${filePath}`);
      diffLines.push(`+++ b/${filePath}`);
      diffLines.push(`@@ -SEARCH +REPLACE @@`);

      // Add old lines
      for (const line of oldLines) {
        diffLines.push(`-${line}`);
      }

      // Add new lines
      for (const line of newLines) {
        diffLines.push(`+${line}`);
      }

      patches.push({
        filePath,
        type: 'edit',
        diff: diffLines.join('\n'),
      });
    }
    // Handle 'MultiEdit' (Multiple edits in one operation)
    else if (toolBlock.toolName === 'MultiEdit' && Array.isArray(input.edits)) {
      for (const edit of input.edits as any[]) {
        if (edit.file_path) {
          const filePath = String(edit.file_path);

          // MultiEdit can contain both old_string/new_string (edit) or just new_string (create)
          if (edit.old_string && edit.new_string) {
            const oldLines = String(edit.old_string).split('\n');
            const newLines = String(edit.new_string).split('\n');

            const diffLines: string[] = [];
            diffLines.push(`--- a/${filePath}`);
            diffLines.push(`+++ b/${filePath}`);
            diffLines.push(`@@ -SEARCH +REPLACE @@`);

            for (const line of oldLines) {
              diffLines.push(`-${line}`);
            }

            for (const line of newLines) {
              diffLines.push(`+${line}`);
            }

            patches.push({
              filePath,
              type: 'edit',
              diff: diffLines.join('\n'),
            });
          } else if (edit.new_string) {
            patches.push({
              filePath,
              type: 'create',
              diff: this.createUnifiedDiff(filePath, String(edit.new_string)),
            });
          }
        }
      }
    }

    return patches;
  }

  /**
   * Create unified diff format
   */
  private createUnifiedDiff(filePath: string, content: string): string {
    const lines = content.split('\n');
    const lineCount = lines.length;

    const diffLines: string[] = [];
    diffLines.push(`--- /dev/null`);
    diffLines.push(`+++ b/${filePath}`);
    diffLines.push(`@@ -0,0 +1,${lineCount} @@`);

    for (const line of lines) {
      diffLines.push(`+${line}`);
    }

    return diffLines.join('\n');
  }

  /**
   * Extract text from content blocks
   */
  private extractTextFromContent(content: string | ContentBlock[] | undefined): string {
    if (!content) return '';

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const textParts: string[] = [];

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          textParts.push(block.text);
        }
      }

      return textParts.join('\n');
    }

    return '';
  }

  /**
   * Extract tool name from tool result entry
   */
  private extractToolNameFromResult(entry: ExtendedJSONLEntry): string {
    if (entry.toolUseResult?.agentId) {
      return 'Task'; // Agent execution
    }
    return 'unknown';
  }

  /**
   * Find next message in chain
   */
  private findNextInChain(
    currentUuid: string,
    messageGraph: Map<string, ParsedEntry>
  ): string | undefined {
    for (const [uuid, parsed] of messageGraph) {
      if (parsed.entry.parentUuid === currentUuid && !parsed.entry.isSidechain) {
        return uuid;
      }
    }
    return undefined;
  }

  /**
   * Check if text is a warmup message (should be ignored for titles)
   */
  private isWarmupMessage(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return (
      normalized === 'warmup' ||
      normalized.startsWith('warmup') ||
      normalized === 'agent warmup' ||
      normalized.includes('agent warmup')
    );
  }

  /**
   * Check if text is a system/caveat message (should be ignored for titles)
   */
  private isSystemMessage(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return (
      normalized.startsWith('caveat:') ||
      normalized.startsWith('the user opened') ||
      normalized.startsWith('the user opened the file') ||
      normalized.includes('do not respond to these messages') ||
      normalized.includes('generated by the user while running local commands') ||
      normalized.includes('request interrupted') ||
      normalized.includes('<local-command-stdout>')
    );
  }

  /**
   * Generate fallback title from first user message
   */
  private generateFallbackTitle(messages: ExtendedJSONLEntry[]): string {
    // Find first user message that isn't a tool result, isn't from sidechain, isn't meta, and isn't warmup/system
    const userMsg = messages.find(
      (m) =>
        !m.isSidechain &&
        !m.isMeta &&
        m.type === 'user' &&
        m.message?.content &&
        !this.isToolResult(m.message.content)
    );

    if (!userMsg || !userMsg.message) return 'New Conversation';

    const text = this.extractTextFromContent(userMsg.message.content);

    // Skip warmup and system messages
    if (this.isWarmupMessage(text) || this.isSystemMessage(text)) {
      // Try to find the next meaningful user message
      const startIndex = messages.indexOf(userMsg);
      for (let i = startIndex + 1; i < messages.length; i++) {
        const msg = messages[i];
        if (
          !msg.isSidechain &&
          !msg.isMeta &&
          msg.type === 'user' &&
          msg.message?.content &&
          !this.isToolResult(msg.message.content)
        ) {
          const nextText = this.extractTextFromContent(msg.message.content);
          if (!this.isWarmupMessage(nextText) && !this.isSystemMessage(nextText)) {
            const cleaned = nextText
              .replace(/[\r\n]+/g, ' ')
              .replace(/\s+/g, ' ')
              .substring(0, 80)
              .trim();
            return cleaned || 'New Conversation';
          }
        }
      }
      return 'New Conversation';
    }

    // Clean up: remove newlines, extra spaces, truncated
    return (
      text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 80)
        .trim() || 'New Conversation'
    );
  }

  /**
   * Extract metadata from message graph
   */
  private extractMetadata(messageGraph: Map<string, ParsedEntry>): {
    title: string;
    project: string;
    gitBranch: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    tags?: string[];
  } {
    let title = 'Untitled Conversation';
    let project = '';
    let gitBranch = '';
    let version = '';
    let earliestTimestamp: string | undefined;
    let latestTimestamp: string | undefined;

    for (const [, parsed] of messageGraph) {
      const entry = parsed.entry;

      // Extract title from summary (skip warmup and system summaries)
      if (
        entry.type === 'summary' &&
        entry.summary &&
        !this.isWarmupMessage(entry.summary) &&
        !this.isSystemMessage(entry.summary)
      ) {
        title = entry.summary;
      }

      // Extract project from cwd
      if (entry.cwd) {
        project = normalizeProjectPath(entry.cwd);
      }

      // Extract git branch
      if (entry.gitBranch) {
        gitBranch = entry.gitBranch;
      }

      // Extract version
      if (entry.version) {
        version = entry.version;
      }

      // Track timestamps
      if (entry.timestamp) {
        if (!earliestTimestamp || entry.timestamp < earliestTimestamp) {
          earliestTimestamp = entry.timestamp;
        }
        if (!latestTimestamp || entry.timestamp > latestTimestamp) {
          latestTimestamp = entry.timestamp;
        }
      }
    }

    // Generate fallback title if still untitled or if title is warmup
    if (title === 'Untitled Conversation' || this.isWarmupMessage(title)) {
      title = this.generateFallbackTitle(
        Array.from(messageGraph.values())
          .map((p) => p.entry)
          .filter((e) => !e.isSidechain) // Only look at main conversation chain
      );
    }

    return {
      title,
      project,
      gitBranch,
      createdAt: earliestTimestamp || new Date().toISOString(),
      updatedAt: latestTimestamp || new Date().toISOString(),
      version,
    };
  }

  /**
   * Extract all conversations from a project directory using two-pass reconstruction
   * This treats logs as a fragmented database that needs reconstruction
   *
   * Phase 1: Ingestion - Load all entries from all files
   * Phase 2: Pass 1 - Build uuid_to_session map and group by session
   * Phase 3: Pass 2 - Resolve summaries using the map (the "stitching")
   * Phase 4: Construction - Build clean conversation objects
   */
  async extractProject(projectDir: string): Promise<Conversation[]> {
    // PHASE 1: INGESTION - Load ALL lines from ALL files into memory
    const allEntries: RawEntry[] = [];
    const files = await readdir(projectDir);

    for (const file of files.filter(f => f.endsWith('.jsonl'))) {
      const filePath = join(projectDir, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        content.split('\n').forEach((line, lineNum) => {
          if (!line.trim()) return;
          try {
            const json = JSON.parse(line);
            allEntries.push({
              ...json,
              _sourceFile: filePath,
              _lineNumber: lineNum + 1,
            });
          } catch (e) {
            // Collect parsing error
            this.errors.push({
              id: `parse-error-${Date.now()}-${lineNum}`,
              type: 'parsing_error',
              timestamp: new Date().toISOString(),
              error: e instanceof Error ? e.message : String(e),
              originalLine: line,
              sourceFile: filePath,
              lineNumber: lineNum + 1,
            });
          }
        });
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    // Sort by timestamp for chronological processing
    allEntries.sort((a, b) => {
      const tA = a.timestamp || '';
      const tB = b.timestamp || '';
      return tA.localeCompare(tB);
    });

    // PASS 1: BUILD THE INDEX - Map UUIDs to Sessions and group entries
    const uuidToSession = new Map<string, string>();
    const sessions = new Map<string, RawEntry[]>();
    const toolCallMap = new Map<string, { toolName: string; input: any }>();
    let projectCwd = '';

    for (const entry of allEntries) {
      // Track project CWD from first entry that has it (for project discovery)
      if (entry.cwd && !projectCwd) {
        projectCwd = entry.cwd;
      }

      // Map UUIDs to Sessions (critical for summary linking)
      if (entry.uuid && entry.sessionId) {
        uuidToSession.set(entry.uuid, entry.sessionId);

        // Group entries by SessionID
        if (!sessions.has(entry.sessionId)) {
          sessions.set(entry.sessionId, []);
        }
        sessions.get(entry.sessionId)!.push(entry);
      }

      // Map tool calls for structured content generation
      if (entry.type === 'assistant' && entry.message?.content) {
        const content = entry.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && (block as any).id && block.name) {
              toolCallMap.set((block as any).id, {
                toolName: block.name,
                input: block.input || {},
              });
            }
          }
        }
      }
    }

    // PASS 2: RESOLVE METADATA - Link summaries to sessions using the map
    const sessionSummaries = new Map<string, string>();

    for (const entry of allEntries) {
      // Handle Summaries (The "Stitching" Logic)
      if (entry.type === 'summary' && entry.leafUuid && entry.summary) {
        const cleanedSummary = cleanContent(entry.summary);
        if (cleanedSummary && !this.isWarmupMessage(cleanedSummary) && !isSystemMessage(cleanedSummary)) {
          // Look up the session ID using the leafUuid
          const targetSessionId = uuidToSession.get(entry.leafUuid);
          if (targetSessionId) {
            sessionSummaries.set(targetSessionId, cleanedSummary);
          }
        }
      }
    }

    // PHASE 4: CONSTRUCTION - Build clean conversation objects
    const results: Conversation[] = [];

    for (const [sessionId, entries] of sessions) {
      // Skip sessions that are just noise/warmup
      if (entries.length < 2) continue;

      // Get the title from our relational map (Pass 2 result), fallback to first user message
      let title = sessionSummaries.get(sessionId);
      if (!title) {
        const firstUserMsg = entries.find(e => e.type === 'user' && !e.isMeta);
        if (firstUserMsg) {
          const rawText = this.extractTextFromContent(firstUserMsg.message?.content || firstUserMsg.content);
          if (rawText && !isSystemMessage(rawText) && !this.isWarmupMessage(rawText)) {
            title = cleanContent(rawText).slice(0, 150);
          }
        }
      }
      if (!title) title = 'Untitled Session';

      // Transform entries into timeline format
      const timeline: TimelineEvent[] = [];
      const messageGraph = new Map<string, ParsedEntry>();

      // Build message graph from entries
      for (const entry of entries) {
        if (entry.uuid) {
          messageGraph.set(entry.uuid, {
            entry: entry as ExtendedJSONLEntry,
            sourceFile: entry._sourceFile || '',
            lineNumber: entry._lineNumber || 0,
          });
        }
      }

      // Build timeline using existing logic with sanitization and tool call map
      const builtTimeline = this.buildTimeline(messageGraph, toolCallMap);
      timeline.push(...builtTimeline);

      // Extract metadata
      const metadata = this.extractMetadata(messageGraph);

      // Use project CWD from logs if available (project discovery), otherwise use folder name
      const projectName = projectCwd
        ? normalizeProjectPath(projectCwd)
        : decodeProjectFolderName(projectDir.split('/').pop() || '');

      results.push({
        id: sessionId,
        title: title || metadata.title,
        project: projectName || metadata.project,
        gitBranch: metadata.gitBranch,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        version: metadata.version,
        tags: metadata.tags,
        timeline,
      });
    }

    return results;
  }
}
