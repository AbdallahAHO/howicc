import type { SessionArtifact, ToolCallEvent, ToolOutputArtifact, ToolResultEvent } from '@howicc/canonical'
import { pairToolCallsAndResults } from '../parse/pairToolCalls'

const semanticToolNames = new Set(['AskUserQuestion', 'TodoWrite', 'EnterPlanMode', 'ExitPlanMode'])

export const extractToolOutputArtifacts = (input: {
  toolCalls: ToolCallEvent[]
  toolResults: ToolResultEvent[]
}): SessionArtifact[] => {
  const paired = pairToolCallsAndResults(input.toolCalls, input.toolResults)

  return paired.flatMap(pair => {
    if (!pair.result) return []
    if (semanticToolNames.has(pair.call.toolName)) return []

    const artifact: ToolOutputArtifact = {
      id: `tool-output:${pair.call.toolUseId}`,
      artifactType: 'tool_output',
      provider: 'claude_code',
      source: {
        eventIds: [pair.call.id, pair.result.id],
        toolUseIds: [pair.call.toolUseId],
      },
      toolName: pair.call.toolName,
      status: pair.result.status,
      previewText: pair.result.text?.slice(0, 1200),
      fullOutputAssetId: pair.result.artifactId,
      createdAt: pair.result.timestamp,
    }

    return [artifact]
  })
}
