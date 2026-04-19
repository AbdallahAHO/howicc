/**
 * Heuristic phase classifier for render-document blocks.
 *
 * Groups a flat sequence of blocks into the narrative phases doc 20 calls
 * out — investigating, planning, building, validating, summary — so the
 * phase spine on /s/:slug can show a readable structure instead of a
 * chronological log. The heuristic is deliberately loose: it uses
 * positional signals (first plan marker, first and last write-tool run,
 * last assistant message) rather than content parsing, so it degrades
 * gracefully on short sessions and on sessions that skip a phase.
 *
 * Phases that don't occur in the transcript are simply absent from the
 * output; there is never more than one group per phase name.
 *
 * @example
 * const groups = classifyPhases(doc.blocks, Boolean(doc.context?.currentPlan))
 * // → [{ phase: 'investigating', blocks: [...] }, { phase: 'building', blocks: [...] }]
 */

export type PhaseKey =
  | 'investigating'
  | 'planning'
  | 'building'
  | 'validating'
  | 'summary'

export type PhaseGroup<Block> = {
  phase: PhaseKey
  label: string
  anchor: string
  blocks: Block[]
}

type MinimalBlock =
  | { type: 'message'; role: 'user' | 'assistant' }
  | { type: 'question' }
  | { type: 'todo_snapshot' }
  | {
      type: 'activity_group'
      items: Array<{ type: string; toolName?: string }>
    }
  | { type: string }

export const PHASE_LABELS: Record<PhaseKey, string> = {
  investigating: 'Investigating',
  planning: 'Planning',
  building: 'Building',
  validating: 'Validating',
  summary: 'Summary',
}

const WRITE_TOOL_PATTERN = /^(edit|write|multi_?edit|create|apply|patch|notebook_?edit)/i

const isPlanSignal = (block: MinimalBlock): boolean =>
  block.type === 'question' || block.type === 'todo_snapshot'

const hasWriteActivity = (block: MinimalBlock): boolean => {
  if (block.type !== 'activity_group') return false
  const group = block as Extract<MinimalBlock, { type: 'activity_group' }>
  return group.items.some(
    (item) => item.type === 'tool_run' && typeof item.toolName === 'string' && WRITE_TOOL_PATTERN.test(item.toolName),
  )
}

const isFinalAssistantMessage = (
  block: MinimalBlock,
  index: number,
  blocks: MinimalBlock[],
): boolean => {
  if (block.type !== 'message') return false
  if ((block as Extract<MinimalBlock, { type: 'message' }>).role !== 'assistant') return false
  return index === blocks.length - 1
}

export const classifyPhases = <Block extends MinimalBlock>(
  blocks: Block[],
  hasPlanContext: boolean,
): PhaseGroup<Block>[] => {
  if (blocks.length === 0) return []

  const planSignalIdx = blocks.findIndex(isPlanSignal)
  const firstPlanIdx = hasPlanContext ? 0 : planSignalIdx
  const firstWriteIdx = blocks.findIndex(hasWriteActivity)

  let lastWriteIdx = -1
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (hasWriteActivity(blocks[i]!)) {
      lastWriteIdx = i
      break
    }
  }

  const summaryIdx = isFinalAssistantMessage(
    blocks[blocks.length - 1]!,
    blocks.length - 1,
    blocks,
  )
    ? blocks.length - 1
    : -1

  const boundaries: Array<{ phase: PhaseKey; start: number }> = []
  const pushBoundary = (phase: PhaseKey, start: number) => {
    const last = boundaries[boundaries.length - 1]
    if (last && last.start === start) {
      last.phase = phase
      return
    }
    boundaries.push({ phase, start })
  }

  // Starting phase:
  //   - plan context in the render doc → planning
  //   - first block is already a plan signal (question / todo) → planning
  //   - first block already shows write activity → building
  //   - otherwise → investigating
  let startPhase: PhaseKey = 'investigating'
  if (hasPlanContext || planSignalIdx === 0) {
    startPhase = 'planning'
  } else if (firstWriteIdx === 0) {
    startPhase = 'building'
  }
  pushBoundary(startPhase, 0)

  if (startPhase !== 'planning' && firstPlanIdx > 0) {
    pushBoundary('planning', firstPlanIdx)
  }

  const currentStart = () => boundaries[boundaries.length - 1]?.start ?? 0
  if (startPhase !== 'building' && firstWriteIdx > currentStart()) {
    pushBoundary('building', firstWriteIdx)
  }

  if (lastWriteIdx >= 0 && lastWriteIdx + 1 < blocks.length) {
    pushBoundary('validating', lastWriteIdx + 1)
  }

  // Summary only fires when the session did meaningful work (building or
  // validating). Read-only / planning-only sessions keep their last assistant
  // message inside the prior phase.
  const hasBuildOrValidate = boundaries.some(
    (boundary) => boundary.phase === 'building' || boundary.phase === 'validating',
  )
  if (
    hasBuildOrValidate &&
    summaryIdx > 0 &&
    summaryIdx >= currentStart()
  ) {
    pushBoundary('summary', summaryIdx)
  }

  return boundaries.map((boundary, index) => {
    const start = boundary.start
    const end = index + 1 < boundaries.length ? boundaries[index + 1]!.start : blocks.length

    return {
      phase: boundary.phase,
      label: PHASE_LABELS[boundary.phase],
      anchor: `phase-${boundary.phase}`,
      blocks: blocks.slice(start, end),
    }
  })
}
