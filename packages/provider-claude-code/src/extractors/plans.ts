import { readUtf8File } from '../fs'
import type { SessionArtifact, AssetRef, ToolCallEvent, ToolResultEvent } from '@howicc/canonical'
import type { SourceBundle } from '@howicc/parser-core'
import { pairToolCallsAndResults } from '../parse/pairToolCalls'

export const extractPlanArtifacts = async (input: {
  bundle: SourceBundle
  assets: AssetRef[]
  toolCalls: ToolCallEvent[]
  toolResults: ToolResultEvent[]
}): Promise<SessionArtifact[]> => {
  const planFileArtifacts = await Promise.all(
    input.bundle.manifest.planFiles.map(async planFile => {
      const asset = input.assets.find(item => item.relPath === planFile.relPath)
      const content = await readUtf8File(planFile.absolutePath)

      return {
        id: `plan:${asset?.id ?? planFile.relPath}`,
        artifactType: 'plan' as const,
        provider: 'claude_code' as const,
        source: {
          assetIds: asset ? [asset.id] : undefined,
          agentId: planFile.agentId,
        },
        role: planFile.agentId ? ('subagent' as const) : ('main' as const),
        resolutionSource: 'file' as const,
        slug: input.bundle.manifest.slug,
        filePath: planFile.absolutePath,
        content,
      }
    }),
  )

  const hasMainPlan = planFileArtifacts.some(artifact => artifact.role === 'main')

  if (hasMainPlan) {
    return planFileArtifacts
  }

  const paired = pairToolCallsAndResults(input.toolCalls, input.toolResults)
  const exitPlanPair = [...paired].reverse().find(pair => pair.call.toolName === 'ExitPlanMode')
  const toolUsePlan = exitPlanPair ? extractPlanFromToolCall(exitPlanPair.call) : undefined

  if (toolUsePlan) {
    return [
      ...planFileArtifacts,
      {
        id: `plan:tool:${exitPlanPair?.call.toolUseId}`,
        artifactType: 'plan',
        provider: 'claude_code',
        source: {
          eventIds: [exitPlanPair!.call.id],
          toolUseIds: [exitPlanPair!.call.toolUseId],
        },
        role: 'main',
        resolutionSource: 'tool_use',
        slug: input.bundle.manifest.slug,
        content: toolUsePlan,
      },
    ]
  }

  const resultPlan = [...input.toolResults]
    .reverse()
    .map(result => extractPlanFromToolResult(result))
    .find(Boolean)

  if (resultPlan) {
    return [
      ...planFileArtifacts,
      {
        id: `plan:tool-result`,
        artifactType: 'plan',
        provider: 'claude_code',
        source: {
          eventIds: [resultPlan.eventId],
        },
        role: 'main',
        resolutionSource: 'tool_result',
        slug: input.bundle.manifest.slug,
        content: resultPlan.content,
      },
    ]
  }

  return planFileArtifacts
}

const extractPlanFromToolCall = (toolCall: ToolCallEvent): string | undefined => {
  const input = toolCall.input
  if (!input || typeof input !== 'object') return undefined

  const inputRecord = input as Record<string, unknown>

  const plan = typeof inputRecord.plan === 'string'
    ? inputRecord.plan
    : undefined
  const planContent = typeof inputRecord.planContent === 'string'
    ? inputRecord.planContent
    : undefined

  return plan ?? planContent
}

const extractPlanFromToolResult = (
  result: ToolResultEvent,
): { eventId: string; content: string } | undefined => {
  if (!result.text) return undefined

  const match = result.text.match(
    /## Approved Plan(?: \(edited by user\))?:\n([\s\S]+)/,
  )

  if (!match?.[1]) return undefined

  return {
    eventId: result.id,
    content: match[1].trim(),
  }
}
