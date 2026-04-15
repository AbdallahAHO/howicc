import { readFile } from 'node:fs/promises'
import {
  inspectSegments,
  redactText,
  type PrivacyFinding,
  type PrivacyInspection,
  type PrivacySegment,
  type PrivacySummary,
} from '@howicc/privacy'
import type { SourceBundle } from '@howicc/parser-core'
import type { RenderBlock, RenderDocument } from '@howicc/render'
import { createSourceBundleArchiveManifest } from './source-bundle-archive'

export type CliPrivacyPreflightStatus = 'clear' | 'warning' | 'review' | 'block'

export type CliPrivacyPreflight = {
  status: CliPrivacyPreflightStatus
  inspection: PrivacyInspection
  sourceInspection: PrivacyInspection
  renderInspection: PrivacyInspection
}

export type RedactedRenderPreview = {
  lines: string[]
  hiddenLineCount: number
}

/**
 * Inspect the raw source bundle inputs plus the public-facing render output
 * before a sync run uploads anything.
 */
export const inspectSessionPrivacy = async (input: {
  bundle: SourceBundle
  render: RenderDocument
}): Promise<CliPrivacyPreflight> => {
  const [sourceInspection, renderInspection] = await Promise.all([
    inspectSourceBundlePrivacy(input.bundle),
    Promise.resolve(inspectSegments(buildRenderPrivacySegments(input.render))),
  ])

  const inspection = mergeInspections(sourceInspection, renderInspection)

  return {
    status: derivePrivacyStatus(inspection.summary),
    inspection,
    sourceInspection,
    renderInspection,
  }
}

export const formatPrivacySummary = (summary: PrivacySummary): string => {
  if (summary.blocks === 0 && summary.reviews === 0 && summary.warnings === 0) {
    return 'clear'
  }

  return [
    `${summary.blocks} ${pluralize(summary.blocks, 'block')}`,
    `${summary.reviews} ${pluralize(summary.reviews, 'review')}`,
    `${summary.warnings} ${pluralize(summary.warnings, 'warning')}`,
  ].join(', ')
}

export const getTopPrivacyFindings = (
  inspection: PrivacyInspection,
  maxFindings = 5,
): PrivacyFinding[] => {
  const seen = new Set<string>()

  return [...inspection.findings]
    .sort((left, right) => {
      const severityRank =
        privacySeverityRank(left.severity) - privacySeverityRank(right.severity)

      if (severityRank !== 0) {
        return severityRank
      }

      return left.ruleId.localeCompare(right.ruleId)
    })
    .filter(finding => {
      const key = [
        finding.severity,
        finding.ruleId,
        finding.segmentKind,
        finding.maskedPreview,
      ].join(':')

      if (seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .slice(0, maxFindings)
}

export const formatPrivacyFinding = (finding: PrivacyFinding): string =>
  `${finding.severity.toUpperCase()} ${finding.category} in ${describePrivacyScope(finding)}: ${truncatePreview(finding.maskedPreview)}`

/**
 * Build a terminal-friendly render preview with deterministic redaction applied
 * line by line.
 */
export const buildRedactedRenderPreview = (
  render: RenderDocument,
  input?: { maxLines?: number },
): RedactedRenderPreview => {
  const allLines = buildRenderPreviewLines(render)
  const maxLines = input?.maxLines ?? 18
  const visibleLines = allLines
    .slice(0, maxLines)
    .map(line => redactText(line).value)

  return {
    lines: visibleLines,
    hiddenLineCount: Math.max(0, allLines.length - visibleLines.length),
  }
}

const inspectSourceBundlePrivacy = async (
  bundle: SourceBundle,
): Promise<PrivacyInspection> => {
  const segments: PrivacySegment[] = [
    {
      id: 'source:manifest',
      kind: 'source_manifest',
      path: 'manifest.json',
      text: JSON.stringify(createSourceBundleArchiveManifest(bundle), null, 2),
    },
  ]

  for (const file of bundle.files) {
    const fileBody = await readFile(file.absolutePath)

    pushSegment(segments, {
      id: `source:file:${file.id}`,
      kind: `source_${file.kind}`,
      path: file.absolutePath,
      text: new TextDecoder().decode(fileBody),
    })
  }

  return inspectSegments(segments)
}

const buildRenderPrivacySegments = (render: RenderDocument): PrivacySegment[] => {
  const segments: PrivacySegment[] = []

  pushSegment(segments, {
    id: 'render:session:title',
    kind: 'render_session_title',
    text: render.session.title,
  })

  if (render.context?.currentPlan) {
    pushSegment(segments, {
      id: 'render:context:plan:title',
      kind: 'render_plan_title',
      text: render.context.currentPlan.title,
    })
    pushSegment(segments, {
      id: 'render:context:plan:body',
      kind: 'render_plan_body',
      path: render.context.currentPlan.filePath,
      text: render.context.currentPlan.body,
    })
  }

  for (const block of render.blocks) {
    collectRenderBlockSegments(segments, block)
  }

  return segments
}

const collectRenderBlockSegments = (
  segments: PrivacySegment[],
  block: RenderBlock,
) => {
  switch (block.type) {
    case 'message':
      pushSegment(segments, {
        id: `render:block:${block.id}:message`,
        kind: 'render_message',
        role: block.role,
        text: block.text,
      })
      return
    case 'question':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:question`,
        kind: 'render_question',
        value: {
          title: block.title,
          questions: block.questions,
          feedbackText: block.feedbackText,
        },
      })
      return
    case 'activity_group':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:activity`,
        kind: 'render_activity_group',
        value: {
          label: block.label,
          summary: block.summary,
          items: block.items.map(item =>
            item.type === 'tool_run'
              ? {
                  type: item.type,
                  title: item.title,
                  toolName: item.toolName,
                  inputPreview: item.inputPreview,
                  outputPreview: item.outputPreview,
                  status: item.status,
                }
              : {
                  type: item.type,
                  title: item.title,
                  body: item.body,
                  tone: item.tone,
                }),
        },
      })
      return
    case 'callout':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:callout`,
        kind: 'render_callout',
        value: {
          tone: block.tone,
          title: block.title,
          body: block.body,
        },
      })
      return
    case 'todo_snapshot':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:todo`,
        kind: 'render_todo_snapshot',
        value: {
          title: block.title,
          items: block.items,
        },
      })
      return
    case 'task_timeline':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:task-timeline`,
        kind: 'render_task_timeline',
        value: {
          title: block.title,
          entries: block.entries,
        },
      })
      return
    case 'resource':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:resource`,
        kind: 'render_resource',
        value: {
          title: block.title,
          server: block.server,
          uri: block.uri,
          previewText: block.previewText,
        },
      })
      return
    case 'structured_data':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:structured-data`,
        kind: 'render_structured_data',
        value: {
          title: block.title,
          data: block.data,
        },
      })
      return
    case 'brief_delivery':
      pushJsonSegment(segments, {
        id: `render:block:${block.id}:brief-delivery`,
        kind: 'render_brief_delivery',
        value: {
          title: block.title,
          message: block.message,
          attachments: block.attachments,
        },
      })
      return
    case 'subagent_thread':
      pushSegment(segments, {
        id: `render:block:${block.id}:subagent:title`,
        kind: 'render_subagent_thread',
        text: block.title,
      })
      for (const child of block.blocks) {
        collectRenderBlockSegments(segments, child)
      }
      return
    case 'compact_boundary':
      pushSegment(segments, {
        id: `render:block:${block.id}:compact-boundary`,
        kind: 'render_compact_boundary',
        text: block.text,
      })
      return
  }
}

const buildRenderPreviewLines = (render: RenderDocument): string[] => {
  const lines: string[] = []

  if (render.context?.currentPlan) {
    lines.push(`PLAN: ${render.context.currentPlan.title}`)
    lines.push(render.context.currentPlan.body)
  }

  for (const block of render.blocks) {
    collectRenderPreviewLines(lines, block, 0)
  }

  return lines
}

const collectRenderPreviewLines = (
  lines: string[],
  block: RenderBlock,
  depth: number,
) => {
  const prefix = '  '.repeat(depth)

  switch (block.type) {
    case 'message':
      lines.push(`${prefix}${block.role.toUpperCase()}: ${block.text}`)
      return
    case 'question':
      lines.push(`${prefix}QUESTIONS: ${block.title}`)
      for (const question of block.questions.slice(0, 3)) {
        lines.push(`${prefix}- ${question.header}: ${question.question}`)
      }
      if (block.feedbackText) {
        lines.push(`${prefix}FEEDBACK: ${block.feedbackText}`)
      }
      return
    case 'activity_group':
      lines.push(`${prefix}ACTIVITY: ${block.label}`)
      if (block.summary) {
        lines.push(`${prefix}${block.summary}`)
      }
      for (const item of block.items.slice(0, 3)) {
        if (item.type === 'tool_run') {
          lines.push(`${prefix}- ${item.title}`)
          if (item.outputPreview) {
            lines.push(`${prefix}  ${truncatePreview(item.outputPreview, 140)}`)
          } else if (item.inputPreview) {
            lines.push(`${prefix}  ${truncatePreview(item.inputPreview, 140)}`)
          }
        } else {
          lines.push(`${prefix}- ${item.title}`)
          if (item.body) {
            lines.push(`${prefix}  ${truncatePreview(item.body, 140)}`)
          }
        }
      }
      return
    case 'callout':
      lines.push(
        `${prefix}CALLOUT (${block.tone}): ${block.title}${block.body ? ` — ${block.body}` : ''}`,
      )
      return
    case 'todo_snapshot':
      lines.push(`${prefix}TODO: ${block.title}`)
      for (const item of block.items.slice(0, 3)) {
        lines.push(`${prefix}- [${item.status}] ${item.content}`)
      }
      return
    case 'task_timeline':
      lines.push(`${prefix}TASKS: ${block.title}`)
      for (const entry of block.entries.slice(0, 3)) {
        lines.push(`${prefix}- ${entry.status}: ${entry.description}`)
      }
      return
    case 'resource':
      lines.push(
        `${prefix}RESOURCE: ${block.title}${block.previewText ? ` — ${block.previewText}` : ''}`,
      )
      return
    case 'structured_data':
      lines.push(
        `${prefix}DATA: ${block.title} — ${truncatePreview(toJsonText(block.data), 140)}`,
      )
      return
    case 'brief_delivery':
      lines.push(`${prefix}DELIVERY: ${block.message}`)
      for (const attachment of block.attachments.slice(0, 3)) {
        lines.push(`${prefix}- attachment: ${attachment.label}`)
      }
      return
    case 'subagent_thread':
      lines.push(`${prefix}SUBAGENT: ${block.title}`)
      for (const child of block.blocks) {
        collectRenderPreviewLines(lines, child, depth + 1)
      }
      return
    case 'compact_boundary':
      lines.push(`${prefix}COMPACT: ${block.text}`)
      return
  }
}

const mergeInspections = (...inspections: PrivacyInspection[]): PrivacyInspection =>
  inspections.reduce<PrivacyInspection>(
    (merged, inspection) => ({
      findings: [...merged.findings, ...inspection.findings],
      summary: mergeSummaries(merged.summary, inspection.summary),
    }),
    {
      findings: [],
      summary: { warnings: 0, reviews: 0, blocks: 0 },
    },
  )

const mergeSummaries = (left: PrivacySummary, right: PrivacySummary): PrivacySummary => ({
  warnings: left.warnings + right.warnings,
  reviews: left.reviews + right.reviews,
  blocks: left.blocks + right.blocks,
})

const derivePrivacyStatus = (
  summary: PrivacySummary,
): CliPrivacyPreflightStatus => {
  if (summary.blocks > 0) return 'block'
  if (summary.reviews > 0) return 'review'
  if (summary.warnings > 0) return 'warning'
  return 'clear'
}

const pushSegment = (
  segments: PrivacySegment[],
  segment: PrivacySegment | undefined,
) => {
  if (!segment?.text.trim()) {
    return
  }

  segments.push(segment)
}

const pushJsonSegment = (
  segments: PrivacySegment[],
  input: {
    id: string
    kind: string
    path?: string
    value: unknown
  },
) => {
  const text = toJsonText(input.value)

  if (text === '{}' || text === '[]') {
    return
  }

  pushSegment(segments, {
    id: input.id,
    kind: input.kind,
    path: input.path,
    text,
  })
}

const toJsonText = (value: unknown) => JSON.stringify(value, null, 2)

const describePrivacyScope = (finding: PrivacyFinding) => {
  if (finding.segmentKind?.startsWith('source_')) {
    return 'source bundle'
  }

  if (finding.segmentKind?.startsWith('render_')) {
    return 'render preview'
  }

  return 'session'
}

const privacySeverityRank = (severity: PrivacyFinding['severity']): number => {
  switch (severity) {
    case 'block':
      return 0
    case 'review':
      return 1
    case 'warning':
      return 2
  }
}

const truncatePreview = (value: string, maxLength = 96) => {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`
}

const pluralize = (count: number, singular: string) =>
  count === 1 ? singular : `${singular}s`
