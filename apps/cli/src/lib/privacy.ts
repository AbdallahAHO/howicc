import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { CanonicalSession, SessionArtifact } from '@howicc/canonical'
import {
  inspectSegments,
  redactText,
  type PrivacyFinding,
  type PrivacyInspection,
  type PrivacySegment,
  type PrivacySummary,
} from '@howicc/privacy'
import type { SourceBundle } from '@howicc/parser-core'
import { buildRenderDocument, type RenderBlock, type RenderDocument } from '@howicc/render'
import {
  buildSourceBundleArchive,
  buildSourceBundleArchiveFromEntries,
  createSourceBundleArchiveManifest,
} from './source-bundle-archive'

export type CliPrivacyPreflightStatus = 'clear' | 'warning' | 'review' | 'block'
export type CliSyncPrivacyMode = 'sanitize' | 'strict'
export type CliPreparedPrivacyAction = 'clear' | 'review' | 'sanitized' | 'block'

export type CliPrivacyPreflight = {
  status: CliPrivacyPreflightStatus
  inspection: PrivacyInspection
  sourceInspection: PrivacyInspection
  canonicalInspection: PrivacyInspection
  renderInspection: PrivacyInspection
}

export type CliPrivacySanitizationReport = {
  redactedTextValueCount: number
  removedTextValueCount: number
  redactedSourceFileCount: number
  removedSourceFileCount: number
}

export type CliPreparedSessionPrivacy = {
  action: CliPreparedPrivacyAction
  mode: CliSyncPrivacyMode
  preflight: CliPrivacyPreflight
  uploadInspection: CliPrivacyPreflight
  report: CliPrivacySanitizationReport
}

export type CliPrivacySafeUpload = {
  canonical: CanonicalSession
  render: RenderDocument
  sourceBundleArchive: Uint8Array
  privacy: CliPreparedSessionPrivacy
}

export type RedactedRenderPreview = {
  lines: string[]
  hiddenLineCount: number
}

type StringFieldContext = {
  path: Array<string | number>
  key: string | number
  parent: Record<string, unknown> | unknown[]
  value: string
}

type SanitizedSourceBundle = {
  archive: Uint8Array
  inspection: PrivacyInspection
  report: CliPrivacySanitizationReport
}

type CanonicalSanitizationResult = {
  value: CanonicalSession
  report: CliPrivacySanitizationReport
}

const emptySummary = (): PrivacySummary => ({
  warnings: 0,
  reviews: 0,
  blocks: 0,
})

const emptyInspection = (): PrivacyInspection => ({
  findings: [],
  summary: emptySummary(),
})

const emptySanitizationReport = (): CliPrivacySanitizationReport => ({
  redactedTextValueCount: 0,
  removedTextValueCount: 0,
  redactedSourceFileCount: 0,
  removedSourceFileCount: 0,
})

const canonicalIgnoredKeys = new Set([
  'id',
  'uuid',
  'parentUuid',
  'toolUseId',
  'sessionId',
  'sourceRevisionHash',
  'transcriptSha256',
  'projectKey',
  'createdAt',
  'updatedAt',
  'importedAt',
  'schemaVersion',
  'parserVersion',
  'provider',
  'kind',
  'artifactType',
  'hookEvent',
  'status',
  'eventId',
  'taskId',
  'agentId',
  'model',
  'mcpServerName',
  'type',
  'role',
  'slashName',
  'name',
  'matchedCatalogId',
  'matchedCanonicalSlug',
  'matchType',
  'reliability',
  'source',
])

const nonCollapsibleCanonicalKeys = new Set([
  'projectPath',
  'cwd',
  'filePath',
  'path',
  'relPath',
  'absolutePath',
  'gitBranch',
  'slug',
  'fullName',
  'repo',
  'repository',
  'server',
  'assetId',
  'fileUuid',
  'canonicalSlug',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Inspect the raw source bundle inputs, canonical payload, and public-facing render
 * output before a sync run uploads anything.
 */
export const inspectSessionPrivacy = async (input: {
  bundle: SourceBundle
  canonical: CanonicalSession
  render: RenderDocument
}): Promise<CliPrivacyPreflight> => {
  const [sourceInspection, canonicalInspection, renderInspection] = await Promise.all([
    inspectSourceBundlePrivacy(input.bundle),
    Promise.resolve(inspectCanonicalPrivacy(input.canonical)),
    Promise.resolve(inspectSegments(buildRenderPrivacySegments(input.render))),
  ])

  return buildCliPrivacyPreflight({
    sourceInspection,
    canonicalInspection,
    renderInspection,
  })
}

/**
 * Build the exact assets a sync run would upload under the requested privacy policy.
 *
 * `sanitize` keeps conversation structure but replaces sensitive text or source files
 * with deterministic placeholders before upload. `strict` preserves the current
 * fail-or-review behavior.
 */
export const buildPrivacySafeUpload = async (input: {
  bundle: SourceBundle
  canonical: CanonicalSession
  render: RenderDocument
  mode: CliSyncPrivacyMode
}): Promise<CliPrivacySafeUpload> => {
  const preflight = await inspectSessionPrivacy(input)

  if (input.mode === 'strict') {
    const rawArchive = await buildSourceBundleArchive(input.bundle)
    const action =
      preflight.status === 'block'
        ? 'block'
        : preflight.status === 'review'
          ? 'review'
          : 'clear'

    return {
      canonical: input.canonical,
      render: input.render,
      sourceBundleArchive: rawArchive,
      privacy: {
        action,
        mode: input.mode,
        preflight,
        uploadInspection: preflight,
        report: emptySanitizationReport(),
      },
    }
  }

  if (preflight.status === 'clear') {
    const rawArchive = await buildSourceBundleArchive(input.bundle)

    return {
      canonical: input.canonical,
      render: input.render,
      sourceBundleArchive: rawArchive,
      privacy: {
        action: 'clear',
        mode: input.mode,
        preflight,
        uploadInspection: preflight,
        report: emptySanitizationReport(),
      },
    }
  }

  const sanitizedCanonical = sanitizeCanonicalForUpload(input.canonical)
  const sanitizedSourceBundle = await sanitizeSourceBundleForUpload(input.bundle)
  const report = mergeSanitizationReports(
    sanitizedCanonical.report,
    sanitizedSourceBundle.report,
  )
  const sanitizedRender = buildSanitizedRenderDocument(
    sanitizedCanonical.value,
    report,
  )
  const uploadInspection = buildCliPrivacyPreflight({
    sourceInspection: sanitizedSourceBundle.inspection,
    canonicalInspection: inspectCanonicalPrivacy(sanitizedCanonical.value),
    renderInspection: inspectSegments(buildRenderPrivacySegments(sanitizedRender)),
  })

  return {
    canonical: sanitizedCanonical.value,
    render: sanitizedRender,
    sourceBundleArchive: sanitizedSourceBundle.archive,
    privacy: {
      action: uploadInspection.status === 'block' ? 'block' : 'sanitized',
      mode: input.mode,
      preflight,
      uploadInspection,
      report,
    },
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

export const formatPrivacySanitizationReport = (
  report: CliPrivacySanitizationReport,
): string => {
  const parts = [
    report.removedTextValueCount > 0
      ? `${report.removedTextValueCount} removed text ${pluralize(report.removedTextValueCount, 'field')}`
      : undefined,
    report.redactedTextValueCount > 0
      ? `${report.redactedTextValueCount} redacted text ${pluralize(report.redactedTextValueCount, 'field')}`
      : undefined,
    report.removedSourceFileCount > 0
      ? `${report.removedSourceFileCount} replaced source ${pluralize(report.removedSourceFileCount, 'file')}`
      : undefined,
    report.redactedSourceFileCount > 0
      ? `${report.redactedSourceFileCount} redacted source ${pluralize(report.redactedSourceFileCount, 'file')}`
      : undefined,
  ].filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(', ') : 'no upload-time sanitization'
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

const buildCliPrivacyPreflight = (input: {
  sourceInspection: PrivacyInspection
  canonicalInspection: PrivacyInspection
  renderInspection: PrivacyInspection
}): CliPrivacyPreflight => {
  const inspection = mergeInspections(
    input.sourceInspection,
    input.canonicalInspection,
    input.renderInspection,
  )

  return {
    status: derivePrivacyStatus(inspection.summary),
    inspection,
    sourceInspection: input.sourceInspection,
    canonicalInspection: input.canonicalInspection,
    renderInspection: input.renderInspection,
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

const inspectCanonicalPrivacy = (
  canonical: CanonicalSession,
): PrivacyInspection =>
  inspectSegments(buildCanonicalPrivacySegments(canonical))

const buildCanonicalPrivacySegments = (
  canonical: CanonicalSession,
): PrivacySegment[] => {
  const segments: PrivacySegment[] = []

  walkStringFields(canonical, field => {
    if (!shouldInspectCanonicalField(field)) {
      return
    }

    pushSegment(segments, {
      id: `canonical:${field.path.join('.')}`,
      kind: `canonical_${String(field.path[0] ?? 'field')}`,
      path: isPathLikeCanonicalKey(field.key) ? field.value : undefined,
      role: resolveCanonicalFieldRole(field.path, field.parent),
      text: field.value,
    })
  })

  return segments
}

const sanitizeCanonicalForUpload = (
  canonical: CanonicalSession,
): CanonicalSanitizationResult => {
  const sanitized = structuredClone(canonical)
  const report = emptySanitizationReport()

  walkStringFields(sanitized, field => {
    if (!shouldInspectCanonicalField(field)) {
      return
    }

    const redaction = redactText(field.value)
    if (!redaction.changed) {
      return
    }

    const collapseOnBlock =
      redaction.summary.blocks > 0 && shouldCollapseCanonicalFieldOnBlock(field)
    const nextValue = collapseOnBlock
      ? buildCanonicalPrivacyPlaceholder(field)
      : redaction.value

    setFieldValue(field.parent, field.key, nextValue)

    if (collapseOnBlock) {
      report.removedTextValueCount += 1
      return
    }

    report.redactedTextValueCount += 1
  })

  sanitized.searchText = buildSanitizedSearchText(sanitized)

  return {
    value: sanitized,
    report,
  }
}

const buildSanitizedSearchText = (canonical: CanonicalSession) => {
  const parts: string[] = []
  const seen = new Set<string>()
  const push = (value: string | undefined) => {
    const normalized = value?.trim()
    if (!normalized || seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    parts.push(normalized)
  }

  push(canonical.metadata.title)
  push(canonical.metadata.customTitle)
  push(canonical.metadata.summary)
  push(canonical.metadata.tag)

  for (const event of canonical.events) {
    switch (event.type) {
      case 'user_message':
      case 'assistant_message':
      case 'system_notice':
      case 'compact_boundary':
        push(event.text)
        break
      case 'hook':
        push(event.label)
        push(event.text)
        break
      case 'tool_call':
        push(event.toolName)
        push(event.commentLabel)
        break
      case 'tool_result':
        push(event.text)
        break
      case 'subagent_ref':
        push(event.label)
        break
    }
  }

  for (const artifact of canonical.artifacts) {
    collectArtifactSearchText(parts, seen, artifact)
  }

  for (const agent of canonical.agents) {
    push(agent.title)
    push(asOptionalString(agent.metadata?.description))

    for (const event of agent.events) {
      if ('text' in event) {
        push(typeof event.text === 'string' ? event.text : undefined)
      }
    }
  }

  return parts.join('\n\n')
}

const collectArtifactSearchText = (
  parts: string[],
  seen: Set<string>,
  artifact: SessionArtifact,
) => {
  const push = (value: string | undefined) => {
    const normalized = value?.trim()
    if (!normalized || seen.has(normalized)) {
      return
    }

    seen.add(normalized)
    parts.push(normalized)
  }

  switch (artifact.artifactType) {
    case 'plan':
      push(artifact.content)
      push(artifact.slug)
      break
    case 'question_interaction':
      for (const question of artifact.questions) {
        push(question.header)
        push(question.question)
        for (const option of question.options) {
          push(option.label)
          push(option.description)
          push(option.preview)
        }
      }
      for (const answer of Object.values(artifact.answers ?? {})) {
        push(answer)
      }
      push(artifact.feedbackText)
      break
    case 'tool_decision':
      push(artifact.feedbackText)
      push(artifact.toolName)
      break
    case 'tool_output':
      push(artifact.toolName)
      push(artifact.previewText)
      break
    case 'todo_snapshot':
      for (const todo of artifact.todos) {
        push(todo.content)
      }
      break
    case 'task_status_timeline':
      for (const entry of artifact.entries) {
        push(entry.description)
        push(entry.deltaSummary ?? undefined)
      }
      break
    case 'mcp_resource':
      push(artifact.name)
      push(artifact.description)
      push(artifact.uri)
      break
    case 'structured_output':
      push(JSON.stringify(artifact.data, null, 2))
      break
    case 'invoked_skill_set':
      for (const skill of artifact.skills) {
        push(skill.name)
        push(skill.path)
        push(skill.inlineContent)
      }
      break
    case 'brief_delivery':
      push(artifact.message)
      for (const attachment of artifact.attachments) {
        push(attachment.path)
      }
      break
  }
}

const sanitizeSourceBundleForUpload = async (
  bundle: SourceBundle,
): Promise<SanitizedSourceBundle> => {
  const report = emptySanitizationReport()
  const encoder = new TextEncoder()
  const sanitizedFiles = await Promise.all(
    bundle.files.map(async (file, index) => {
      const rawText = new TextDecoder().decode(await readFile(file.absolutePath))
      const redaction = redactText(rawText)
      const removed = redaction.summary.blocks > 0
      const sanitizedText = removed
        ? buildSourceFilePrivacyPlaceholder(file.relPath, file.kind)
        : redaction.value

      if (removed) {
        report.removedSourceFileCount += 1
      } else if (redaction.changed) {
        report.redactedSourceFileCount += 1
      }

      const body = encoder.encode(sanitizedText)
      const archivePath = `source/${String(index + 1).padStart(4, '0')}-${file.kind}.txt`
      const redactedRelPath = redactText(file.relPath).value

      return {
        archivePath,
        relPath: redactedRelPath,
        kind: file.kind,
        body,
        sha256: sha256Hex(body),
        privacyAction: removed
          ? 'removed'
          : redaction.changed
            ? 'redacted'
            : 'unchanged',
      }
    }),
  )

  const manifestBody = encoder.encode(
    JSON.stringify(
      {
        kind: 'sanitized_agent_source_bundle_archive',
        version: 1,
        provider: bundle.provider,
        sessionId: bundle.sessionId,
        projectKey: bundle.projectKey,
        capturedAt: bundle.capturedAt,
        privacy: {
          report,
        },
        files: sanitizedFiles.map(file => ({
          archivePath: file.archivePath,
          relPath: file.relPath,
          kind: file.kind,
          bytes: file.body.byteLength,
          sha256: file.sha256,
          privacyAction: file.privacyAction,
        })),
        manifest: sanitizeSourceBundleManifest(bundle),
      },
      null,
      2,
    ),
  )

  const archive = buildSourceBundleArchiveFromEntries([
    {
      path: 'manifest.json',
      body: manifestBody,
      mtime: new Date(bundle.capturedAt),
    },
    ...sanitizedFiles.map(file => ({
      path: file.archivePath,
      body: file.body,
      mtime: new Date(bundle.capturedAt),
    })),
  ])

  const inspection = inspectSegments([
    {
      id: 'sanitized-source:manifest',
      kind: 'sanitized_source_manifest',
      path: 'manifest.json',
      text: new TextDecoder().decode(manifestBody),
    },
    ...sanitizedFiles.map(file => ({
      id: `sanitized-source:file:${file.archivePath}`,
      kind: `sanitized_source_${file.kind}`,
      path: file.relPath,
      text: new TextDecoder().decode(file.body),
    })),
  ])

  return {
    archive,
    inspection,
    report,
  }
}

const sanitizeSourceBundleManifest = (bundle: SourceBundle) => {
  const sanitize = (value: string | undefined) =>
    value ? redactText(value).value : value

  return {
    transcript: {
      relPath: sanitize(bundle.manifest.transcript.relPath),
    },
    slug: sanitize(bundle.manifest.slug),
    cwd: sanitize(bundle.manifest.cwd),
    gitBranch: bundle.manifest.gitBranch,
    planFiles: bundle.manifest.planFiles.map(file => ({
      relPath: sanitize(file.relPath),
      agentId: file.agentId,
    })),
    toolResults: bundle.manifest.toolResults.map(file => ({
      relPath: sanitize(file.relPath),
    })),
    subagents: bundle.manifest.subagents.map(subagent => ({
      agentId: subagent.agentId,
      transcriptRelPath: sanitize(subagent.transcriptRelPath),
      metaRelPath: sanitize(subagent.metaRelPath),
      agentType: subagent.agentType,
      description: sanitize(subagent.description),
    })),
    remoteAgents: bundle.manifest.remoteAgents.map(file => ({
      relPath: sanitize(file.relPath),
    })),
    warnings: bundle.manifest.warnings.map(warning => sanitize(warning) ?? warning),
  }
}

const buildSanitizedRenderDocument = (
  canonical: CanonicalSession,
  report: CliPrivacySanitizationReport,
) => {
  const render = buildRenderDocument(canonical)

  if (!hasSanitizationChanges(report)) {
    return render
  }

  const blocks: RenderBlock[] = [
    {
      type: 'callout',
      id: 'privacy-sanitization',
      tone: 'warning',
      title: 'Privacy sanitized before sync',
      body: formatPrivacySanitizationReport(report),
    },
    ...render.blocks,
  ]

  return {
    ...render,
    blocks,
  }
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
    emptyInspection(),
  )

const mergeSummaries = (left: PrivacySummary, right: PrivacySummary): PrivacySummary => ({
  warnings: left.warnings + right.warnings,
  reviews: left.reviews + right.reviews,
  blocks: left.blocks + right.blocks,
})

const mergeSanitizationReports = (
  left: CliPrivacySanitizationReport,
  right: CliPrivacySanitizationReport,
): CliPrivacySanitizationReport => ({
  redactedTextValueCount:
    left.redactedTextValueCount + right.redactedTextValueCount,
  removedTextValueCount:
    left.removedTextValueCount + right.removedTextValueCount,
  redactedSourceFileCount:
    left.redactedSourceFileCount + right.redactedSourceFileCount,
  removedSourceFileCount:
    left.removedSourceFileCount + right.removedSourceFileCount,
})

const hasSanitizationChanges = (report: CliPrivacySanitizationReport) =>
  report.redactedTextValueCount > 0 ||
  report.removedTextValueCount > 0 ||
  report.redactedSourceFileCount > 0 ||
  report.removedSourceFileCount > 0

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

const walkStringFields = (
  value: unknown,
  visit: (field: StringFieldContext) => void,
  path: Array<string | number> = [],
) => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (typeof entry === 'string') {
        visit({
          path: [...path, index],
          key: index,
          parent: value,
          value: entry,
        })
        return
      }

      walkStringFields(entry, visit, [...path, index])
    })
    return
  }

  if (!isRecord(value)) {
    return
  }

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      visit({
        path: [...path, key],
        key,
        parent: value,
        value: entry,
      })
      continue
    }

    walkStringFields(entry, visit, [...path, key])
  }
}

const shouldInspectCanonicalField = (field: StringFieldContext) => {
  const key = String(field.key)
  const root = String(field.path[0] ?? '')

  if (root === 'searchText') {
    return false
  }

  if (
    root === 'source' &&
    ['sessionId', 'projectKey', 'sourceRevisionHash', 'transcriptSha256'].includes(key)
  ) {
    return false
  }

  return !canonicalIgnoredKeys.has(key)
}

const shouldCollapseCanonicalFieldOnBlock = (field: StringFieldContext) => {
  const key = String(field.key)
  return !nonCollapsibleCanonicalKeys.has(key)
}

const isPathLikeCanonicalKey = (key: string | number) => {
  const normalized = String(key)
  return (
    normalized === 'path' ||
    normalized === 'filePath' ||
    normalized === 'cwd' ||
    normalized === 'projectPath' ||
    normalized === 'absolutePath' ||
    normalized === 'relPath'
  )
}

const resolveCanonicalFieldRole = (
  path: Array<string | number>,
  parent: Record<string, unknown> | unknown[],
) => {
  if (path[0] !== 'events' && path[0] !== 'agents') {
    return undefined
  }

  if (isRecord(parent) && typeof parent.role === 'string') {
    return parent.role
  }

  return undefined
}

const buildCanonicalPrivacyPlaceholder = (field: StringFieldContext) => {
  const key = String(field.key)

  if (field.path[0] === 'metadata' && key === 'title') {
    return 'Private session'
  }

  if (field.path[0] === 'metadata') {
    return 'Content removed for privacy during sync.'
  }

  if (field.path[0] === 'events' && isRecord(field.parent)) {
    const eventType = typeof field.parent.type === 'string' ? field.parent.type : undefined

    if (eventType === 'user_message') {
      return 'This user message was removed for privacy during sync.'
    }

    if (eventType === 'assistant_message') {
      return 'This assistant message was removed for privacy during sync.'
    }

    if (eventType === 'system_notice') {
      return 'This system notice was removed for privacy during sync.'
    }

    if (eventType === 'hook') {
      return 'This hook detail was removed for privacy during sync.'
    }
  }

  if (field.path[0] === 'artifacts' && isRecord(field.parent)) {
    const artifactType =
      typeof field.parent.artifactType === 'string'
        ? field.parent.artifactType
        : undefined

    switch (artifactType) {
      case 'plan':
        return 'This plan was removed for privacy during sync.'
      case 'question_interaction':
        return 'This question content was removed for privacy during sync.'
      case 'tool_output':
        return 'This tool output was removed for privacy during sync.'
      case 'brief_delivery':
        return 'This delivery note was removed for privacy during sync.'
      default:
        return 'This artifact content was removed for privacy during sync.'
    }
  }

  if (field.path[0] === 'agents') {
    return 'This subagent content was removed for privacy during sync.'
  }

  if (key === 'command') {
    return 'Command removed for privacy during sync.'
  }

  if (key === 'uri') {
    return 'Resource URI removed for privacy during sync.'
  }

  return 'Content removed for privacy during sync.'
}

const setFieldValue = (
  parent: Record<string, unknown> | unknown[],
  key: string | number,
  value: string,
) => {
  if (Array.isArray(parent) && typeof key === 'number') {
    parent[key] = value
    return
  }

  ;(parent as Record<string, unknown>)[String(key)] = value
}

const buildSourceFilePrivacyPlaceholder = (
  relPath: string,
  kind: SourceBundle['files'][number]['kind'],
) => [
  'This source file was removed for privacy during sync.',
  `Kind: ${kind}`,
  `Original path: ${redactText(relPath).value}`,
].join('\n')

const sha256Hex = (body: Uint8Array) =>
  createHash('sha256').update(body).digest('hex')

const toJsonText = (value: unknown) => JSON.stringify(value, null, 2)

const describePrivacyScope = (finding: PrivacyFinding) => {
  if (finding.segmentKind?.startsWith('source_') || finding.segmentKind?.startsWith('sanitized_source_')) {
    return 'source bundle'
  }

  if (finding.segmentKind?.startsWith('canonical_')) {
    return 'canonical upload'
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

const asOptionalString = (value: unknown) =>
  typeof value === 'string' ? value : undefined
