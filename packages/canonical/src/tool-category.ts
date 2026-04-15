export type ToolCategory =
  | 'read'
  | 'write'
  | 'search'
  | 'command'
  | 'agent'
  | 'mcp'
  | 'plan'
  | 'question'
  | 'task'
  | 'web'
  | 'other'

const nativeToolCategories: Record<string, ToolCategory> = {
  // Read — file/resource inspection
  Read: 'read',
  NotebookRead: 'read',
  LS: 'read',
  LSP: 'read',
  ReadMcpResourceTool: 'read',
  ListMcpResourcesTool: 'read',
  // Codex equivalents
  file_read: 'read',
  directory_read: 'read',

  // Write — file creation/modification
  Edit: 'write',
  Write: 'write',
  MultiEdit: 'write',
  NotebookEdit: 'write',
  // Codex
  file_write: 'write',
  file_edit: 'write',

  // Search — finding files/content
  Grep: 'search',
  Glob: 'search',

  // Command — shell execution
  Bash: 'command',
  PowerShell: 'command',
  Computer: 'command',
  REPL: 'command',
  // Codex
  shell: 'command',

  // Agent — delegation and coordination
  Agent: 'agent',
  SendMessage: 'agent',
  EnterWorktree: 'agent',
  ExitWorktree: 'agent',
  TeamCreate: 'agent',
  TeamDelete: 'agent',
  Brief: 'agent',

  // Plan — planning and progress tracking
  EnterPlanMode: 'plan',
  ExitPlanMode: 'plan',
  TodoWrite: 'plan',
  TodoRead: 'plan',

  // Question — user interaction
  AskUserQuestion: 'question',

  // Task — task management
  TaskCreate: 'task',
  TaskUpdate: 'task',
  TaskGet: 'task',
  TaskList: 'task',
  TaskStop: 'task',
  TaskOutput: 'task',
  CronCreate: 'task',
  CronDelete: 'task',
  CronList: 'task',

  // Web — external fetching
  WebSearch: 'web',
  WebFetch: 'web',
  WebBrowser: 'web',

  // Other — meta tools, internal
  Skill: 'other',
  ToolSearch: 'other',
  Config: 'other',
  Sleep: 'other',
}

/**
 * Categorize a tool name into a canonical category.
 * Works across providers — CC's `Read` and Codex's `file_read` both map to `read`.
 */
export const categorizeToolName = (
  toolName: string,
  source: 'native' | 'mcp' | 'repl_virtual' = 'native',
): ToolCategory => {
  if (source === 'mcp') return 'mcp'
  return nativeToolCategories[toolName] ?? 'other'
}

/**
 * Normalize MCP server names so configured names match tool-call-derived names.
 * CC normalizes server names in tool names: dots → underscores, spaces → underscores.
 * Attachment entries keep the original display name (e.g., "claude.ai DocFork").
 * Tool calls use the normalized form (e.g., "claude_ai_DocFork").
 */
export const normalizeMcpServerName = (name: string): string =>
  name.replace(/[.\s]+/g, '_')

export const emptyToolCategories = (): Record<ToolCategory, number> => ({
  read: 0,
  write: 0,
  search: 0,
  command: 0,
  agent: 0,
  mcp: 0,
  plan: 0,
  question: 0,
  task: 0,
  web: 0,
  other: 0,
})
