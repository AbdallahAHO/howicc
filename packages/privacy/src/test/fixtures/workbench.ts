import { readFileSync } from 'node:fs'
import type { PrivacySegment } from '../../types'

type WorkbenchVersion = 'v3' | 'v6'

type WorkbenchEvent = {
  id: string
  type: string
  text?: string
  commentLabel?: string
  input?: Record<string, unknown>
}

type WorkbenchArtifact = {
  id: string
  artifactType: string
  content?: string
  previewText?: string
  feedbackText?: string
  filePath?: string
}

const fixtureCache = new Map<string, unknown>()

const readJsonFixture = <T>(relativePath: string): T => {
  if (!fixtureCache.has(relativePath)) {
    fixtureCache.set(
      relativePath,
      JSON.parse(
        readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
      ),
    )
  }

  return fixtureCache.get(relativePath) as T
}

const pushSegment = (
  segments: PrivacySegment[],
  segment: PrivacySegment | undefined,
) => {
  if (!segment || !segment.text.trim()) {
    return
  }

  segments.push(segment)
}

export const loadWorkbenchEvents = (version: WorkbenchVersion) =>
  readJsonFixture<WorkbenchEvent[]>(
    `../../../../provider-claude-code/src/test/fixtures/workbench/${version}/03-events.json`,
  )

export const loadWorkbenchArtifacts = (version: WorkbenchVersion) =>
  readJsonFixture<WorkbenchArtifact[]>(
    `../../../../provider-claude-code/src/test/fixtures/workbench/${version}/03-artifacts.json`,
  )

export const buildWorkbenchSegments = (
  version: WorkbenchVersion = 'v6',
): PrivacySegment[] => {
  const events = loadWorkbenchEvents(version)
  const artifacts = loadWorkbenchArtifacts(version)
  const segments: PrivacySegment[] = []

  for (const event of events) {
    pushSegment(segments, {
      id: `event:${event.id}:text`,
      kind: event.type,
      role: event.type.includes('assistant')
        ? 'assistant'
        : event.type.includes('user')
          ? 'user'
          : 'system',
      text: event.text ?? '',
    })

    if (event.input && Object.keys(event.input).length > 0) {
      pushSegment(segments, {
        id: `event:${event.id}:input`,
        kind: 'tool_input',
        role: 'assistant',
        text: JSON.stringify(event.input, null, 2),
      })
    }

    pushSegment(segments, {
      id: `event:${event.id}:label`,
      kind: 'tool_label',
      role: 'assistant',
      text: event.commentLabel ?? '',
    })
  }

  for (const artifact of artifacts) {
    pushSegment(segments, {
      id: `artifact:${artifact.id}:content`,
      kind: artifact.artifactType,
      text: artifact.content ?? '',
    })

    pushSegment(segments, {
      id: `artifact:${artifact.id}:preview`,
      kind: artifact.artifactType,
      text: artifact.previewText ?? '',
    })

    pushSegment(segments, {
      id: `artifact:${artifact.id}:feedback`,
      kind: artifact.artifactType,
      text: artifact.feedbackText ?? '',
    })

    pushSegment(segments, {
      id: `artifact:${artifact.id}:path`,
      kind: 'artifact_path',
      path: artifact.filePath,
      text: artifact.filePath ?? '',
    })
  }

  return segments
}

export const buildLargeWorkbenchSegments = (input?: {
  version?: WorkbenchVersion
  repeat?: number
  limit?: number
}) => {
  const version = input?.version ?? 'v6'
  const repeat = input?.repeat ?? 4
  const baseSegments = buildWorkbenchSegments(version).slice(
    0,
    input?.limit ?? Number.POSITIVE_INFINITY,
  )

  return Array.from({ length: repeat }, (_, iteration) =>
    baseSegments.map(segment => ({
      ...segment,
      id: `${segment.id}:repeat:${iteration + 1}`,
    })),
  ).flat()
}

export const joinSegmentTexts = (segments: readonly PrivacySegment[]) =>
  segments.map(segment => segment.text).join('\n')
