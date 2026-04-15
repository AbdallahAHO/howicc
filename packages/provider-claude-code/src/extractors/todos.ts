import type { SessionArtifact, TodoSnapshotArtifact, ToolCallEvent } from '@howicc/canonical'

export const extractTodoArtifacts = (input: {
  toolCalls: ToolCallEvent[]
}): SessionArtifact[] =>
  input.toolCalls.flatMap(call => {
    if (call.toolName !== 'TodoWrite') return []
    if (!call.input || typeof call.input !== 'object') return []

    const todos = Array.isArray((call.input as Record<string, unknown>).todos)
      ? ((call.input as Record<string, unknown>).todos as Array<Record<string, unknown>>)
          .map(todo => ({
            content: typeof todo.content === 'string' ? todo.content : 'Untitled todo',
            status: typeof todo.status === 'string' ? todo.status : 'pending',
            activeForm:
              typeof todo.activeForm === 'string' ? todo.activeForm : undefined,
            priority:
              typeof todo.priority === 'string' ? todo.priority : undefined,
          }))
      : []

    if (todos.length === 0) return []

    const artifact: TodoSnapshotArtifact = {
      id: `todo:${call.toolUseId}`,
      artifactType: 'todo_snapshot',
      provider: 'claude_code',
      source: {
        eventIds: [call.id],
        toolUseIds: [call.toolUseId],
      },
      todos,
      createdAt: call.timestamp,
    }

    return [artifact]
  })
