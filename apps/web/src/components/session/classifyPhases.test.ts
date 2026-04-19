import { describe, expect, it } from 'vitest'
import { classifyPhases } from './classifyPhases'

const userMessage = (id: string) =>
  ({ type: 'message' as const, role: 'user' as const, id, text: 'hi' })

const assistantMessage = (id: string) =>
  ({ type: 'message' as const, role: 'assistant' as const, id, text: 'ok' })

const readActivity = (id: string) =>
  ({
    type: 'activity_group' as const,
    id,
    label: 'Reading',
    defaultCollapsed: true,
    items: [{ type: 'tool_run' as const, id: `${id}-1`, toolName: 'Read' }],
  })

const writeActivity = (id: string) =>
  ({
    type: 'activity_group' as const,
    id,
    label: 'Editing',
    defaultCollapsed: true,
    items: [{ type: 'tool_run' as const, id: `${id}-1`, toolName: 'Edit' }],
  })

const bashActivity = (id: string) =>
  ({
    type: 'activity_group' as const,
    id,
    label: 'Running',
    defaultCollapsed: true,
    items: [{ type: 'tool_run' as const, id: `${id}-1`, toolName: 'Bash' }],
  })

const planQuestion = (id: string) =>
  ({ type: 'question' as const, id, title: 'Plan' })

describe('classifyPhases', () => {
  it('returns an empty array for an empty document', () => {
    expect(classifyPhases([], false)).toEqual([])
  })

  it('labels a read-only session as a single investigating phase', () => {
    const groups = classifyPhases(
      [userMessage('u1'), readActivity('r1'), assistantMessage('a1')],
      false,
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]!.phase).toBe('investigating')
    expect(groups[0]!.blocks).toHaveLength(3)
  })

  it('splits into investigating then planning at the first question block', () => {
    const groups = classifyPhases(
      [
        userMessage('u1'),
        readActivity('r1'),
        planQuestion('q1'),
        assistantMessage('a1'),
      ],
      false,
    )

    expect(groups.map((g) => g.phase)).toEqual(['investigating', 'planning'])
    expect(groups[0]!.blocks).toHaveLength(2)
    expect(groups[1]!.blocks).toHaveLength(2)
  })

  it('starts in planning when the render document carries plan context', () => {
    const groups = classifyPhases(
      [userMessage('u1'), writeActivity('w1'), assistantMessage('a1')],
      true,
    )

    expect(groups[0]!.phase).toBe('planning')
    // write activity promotes into building, final assistant becomes summary
    expect(groups.map((g) => g.phase)).toEqual(['planning', 'building', 'summary'])
  })

  it('detects a validating phase between the last write and the summary', () => {
    const u = userMessage('u1')
    const q = planQuestion('q1')
    const w = writeActivity('w1')
    const b = bashActivity('b1')
    const a = assistantMessage('a1')

    const groups = classifyPhases([u, q, w, b, a], false)

    expect(groups.map((g) => g.phase)).toEqual([
      'investigating',
      'planning',
      'building',
      'validating',
      'summary',
    ])

    const building = groups.find((g) => g.phase === 'building')!
    expect(building.blocks).toEqual([w])
    const validating = groups.find((g) => g.phase === 'validating')!
    expect(validating.blocks).toEqual([b])
    const summary = groups.find((g) => g.phase === 'summary')!
    expect(summary.blocks).toEqual([a])
  })

  it('assigns stable anchors that match the phase key', () => {
    const groups = classifyPhases(
      [planQuestion('q1'), writeActivity('w1')],
      false,
    )

    expect(groups.length).toBeGreaterThan(0)
    expect(groups.map((g) => g.anchor)).toEqual(groups.map((g) => `phase-${g.phase}`))
  })

  it('does not emit a summary phase when the final block is not an assistant message', () => {
    const groups = classifyPhases(
      [writeActivity('w1'), readActivity('r1')],
      false,
    )

    expect(groups.some((g) => g.phase === 'summary')).toBe(false)
  })
})
