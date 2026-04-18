import { describe, expect, it } from 'vitest'
import { renderBlockSchema, type RenderBlock } from '@howicc/contracts'

/**
 * The dispatcher (`BlockRenderer.astro`) carries an exhaustive switch that
 * must cover every variant of `RenderBlock`. This test is the belt on top
 * of the compiler's braces: it asserts the list of block types we've
 * handled in `BlockRenderer.astro` matches exactly the set of `type`
 * literals in the contract's discriminated union.
 *
 * If this test fails, either:
 *   - add a case (and component) to BlockRenderer.astro, or
 *   - update the list below to match the new union.
 */

const EXPECTED_BLOCK_TYPES = [
  'message',
  'question',
  'activity_group',
  'callout',
  'todo_snapshot',
  'task_timeline',
  'resource',
  'structured_data',
  'brief_delivery',
  'subagent_thread',
  'compact_boundary',
] as const

describe('BlockRenderer exhaustiveness', () => {
  it('handles every type in the render-block discriminated union', () => {
    const options = (
      renderBlockSchema as unknown as {
        options: Array<{ shape: { type: { value: string } } }>
      }
    ).options
    const unionTypes = options.map((schema) => schema.shape.type.value).sort()
    const handled = [...EXPECTED_BLOCK_TYPES].sort()

    expect(unionTypes).toEqual(handled)
  })

  it('accepts every expected discriminator as a valid RenderBlock type', () => {
    const sample: Record<string, RenderBlock['type']> = {}
    for (const type of EXPECTED_BLOCK_TYPES) {
      sample[type] = type
    }
    expect(Object.keys(sample)).toHaveLength(EXPECTED_BLOCK_TYPES.length)
  })
})
