export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface ClaudeConversation {
  sessionId: string;
  projectName: string;
  filePath: string;
  messages: ClaudeMessage[];
  title: string;
  gitBranch: string;
  messageCount: number;
  modifiedAt: Date;
  checksum?: string;
  // Enhanced metadata
  summary?: string;
  firstUserMessage?: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface JSONLEntry {
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'system' | 'summary';
  message?: {
    role?: string;
    content?: string | ContentBlock[];
    usage?: TokenUsage;
  };
  content?: string | ContentBlock[];
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  gitBranch?: string;
  summary?: string;
  uuid?: string;
  leafUuid?: string;
  requestId?: string; // Used to deduplicate token counts
  isMeta?: boolean; // System/metadata messages that shouldn't be used for titles
  isSidechain?: boolean; // Agent sidechain messages
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: string;
}

export interface SyncOptions {
  apiUrl: string;
  apiKey: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface SyncResult {
  success: boolean;
  conversationId?: string;
  slug?: string;
  url?: string;
  error?: string;
  duplicate?: boolean;
}

export interface Config {
  apiUrl: string;
  apiKey: string;
  lastSync?: string;
  syncedSessions?: string[];
}

export interface UploadPayload {
  title: string;
  slug?: string;
  description_user?: string;
  isPublic: boolean;
  tags: string[];
  checksum: string;
  source: 'claude';
}

// ============================================================================
// Timeline-Based Conversation Types
// ============================================================================

/**
 * Represents a file modification with unified diff format
 */
export interface FilePatch {
  filePath: string;
  type: 'create' | 'edit' | 'delete';
  diff: string; // Unified diff format
}

/**
 * A tool call made by the assistant
 */
export interface ToolCallBlock {
  id: string;
  type: 'tool_call_block';
  toolName: string;
  input: Record<string, unknown>;
  argsSummary?: string; // Human readable summary of arguments
  filePatches?: FilePatch[];
}

/**
 * A simple text block from the assistant
 */
export interface TextBlock {
  type: 'text_block';
  text: string;
}

/**
 * Assistant content can be text or tool calls
 */
export type AssistantContent = TextBlock | ToolCallBlock;

/**
 * Internal thoughts from a specialized agent
 */
export interface Thought {
  agentId: string;
  prompt: string;
  response: string;
}

/**
 * User prompt event in the timeline
 */
export interface UserPromptEvent {
  id: string;
  type: 'user_prompt';
  timestamp: string;
  content: string;
}

/**
 * Assistant turn event with possible tool calls and thoughts
 */
export interface AssistantTurnEvent {
  id: string;
  type: 'assistant_turn';
  timestamp: string;
  model: string;
  stopReason: string;
  content: AssistantContent[];
  thoughts?: Thought[];
}

/**
 * Tool execution result event
 */
export interface ToolResultEvent {
  id: string;
  type: 'tool_result';
  timestamp: string;
  toolCallId: string;
  toolName: string;
  status: 'success' | 'error';
  content?: string; // Legacy: plain text content
  structuredContent?: {
    type: 'file_edit' | 'command' | 'text' | 'todo';
    [key: string]: any;
  }; // New: structured content
  summary?: string; // Human readable summary of result
  isError: boolean;
}

/**
 * Parsing error event for corrupted log entries
 */
export interface ParsingErrorEvent {
  id: string;
  type: 'parsing_error';
  timestamp: string;
  error: string;
  originalLine: string;
  sourceFile: string;
  lineNumber: number;
}

/**
 * All possible timeline events
 */
export type TimelineEvent =
  | UserPromptEvent
  | AssistantTurnEvent
  | ToolResultEvent
  | ParsingErrorEvent;

/**
 * Complete conversation with timeline structure
 */
export interface Conversation {
  id: string;
  title: string;
  project: string;
  gitBranch: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  tags?: string[];
  timeline: TimelineEvent[];
}

/**
 * Type guard for tool call blocks
 */
export function isToolCallBlock(content: AssistantContent): content is ToolCallBlock {
  return content.type === 'tool_call_block';
}

/**
 * Type guard for text blocks
 */
export function isTextBlock(content: AssistantContent): content is TextBlock {
  return content.type === 'text_block';
}
