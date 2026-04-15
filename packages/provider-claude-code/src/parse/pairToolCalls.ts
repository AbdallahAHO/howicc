import type { ToolCallEvent, ToolResultEvent } from '@howicc/canonical'

export type PairedToolCall = {
  call: ToolCallEvent
  result?: ToolResultEvent
}

export const pairToolCallsAndResults = (
  toolCalls: ToolCallEvent[],
  toolResults: ToolResultEvent[],
): PairedToolCall[] => {
  const resultsByToolUseId = new Map(
    toolResults.map(result => [result.toolUseId, result]),
  )

  return toolCalls.map(call => ({
    call,
    result: resultsByToolUseId.get(call.toolUseId),
  }))
}
