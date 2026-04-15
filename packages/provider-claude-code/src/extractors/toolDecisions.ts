import type { HookEvent, SessionArtifact, ToolCallEvent, ToolDecisionArtifact, ToolResultEvent } from '@howicc/canonical'
import { pairToolCallsAndResults } from '../parse/pairToolCalls'

export const extractToolDecisionArtifacts = (input: {
  toolCalls: ToolCallEvent[]
  toolResults: ToolResultEvent[]
  hooks: HookEvent[]
}): SessionArtifact[] => {
  const paired = pairToolCallsAndResults(input.toolCalls, input.toolResults)

  const fromResults = paired.flatMap(pair => {
    if (!pair.result || pair.result.status === 'ok') return []

    const status = classifyDecisionStatus(pair.call.toolName, pair.result)

    const artifact: ToolDecisionArtifact = {
      id: `tool-decision:${pair.call.toolUseId}`,
      artifactType: 'tool_decision',
      provider: 'claude_code',
      source: {
        eventIds: [pair.call.id, pair.result.id],
        toolUseIds: [pair.call.toolUseId],
      },
      toolName: pair.call.toolName,
      status,
      feedbackText: pair.result.text,
      isErrorResult: pair.result.status === 'error',
      createdAt: pair.result.timestamp,
    }

    return [artifact]
  })

  const fromHooks = input.hooks.flatMap(hook => {
    if (!hook.preventedContinuation) return []

    const artifact: ToolDecisionArtifact = {
      id: `tool-decision:hook:${hook.id}`,
      artifactType: 'tool_decision',
      provider: 'claude_code',
      source: {
        eventIds: [hook.id],
        toolUseIds: hook.toolUseId ? [hook.toolUseId] : undefined,
      },
      toolName: hook.label ?? 'unknown',
      status: 'hook_blocked',
      feedbackText: hook.text,
      isErrorResult: true,
      createdAt: hook.timestamp,
    }

    return [artifact]
  })

  return [...fromResults, ...fromHooks]
}

const classifyDecisionStatus = (
  toolName: string,
  result: ToolResultEvent,
): ToolDecisionArtifact['status'] => {
  const text = result.text ?? ''

  if (toolName === 'AskUserQuestion') {
    if (text.includes('clarify these questions')) return 'redirected'
    if (text.includes('enough answers for the plan interview')) return 'aborted'
  }

  if (text.includes('InputValidationError') || text.includes('tool_use_error')) {
    return 'interrupted'
  }

  if (result.status === 'partial') {
    return 'interrupted'
  }

  return 'rejected'
}
