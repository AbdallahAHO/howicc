import { describe, expect, it } from 'vitest'
import type { ParsedRawEntry } from '../jsonl'
import { selectActiveThread } from '../parse/selectActiveThread'

const entry = (index: number, raw: Record<string, unknown>): ParsedRawEntry => ({
  index,
  raw,
})

describe('selectActiveThread', () => {
  it('walks through attachment parents to recover the active conversation branch', () => {
    const entries = [
      entry(0, {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-04-20T10:00:00.000Z',
        message: {
          role: 'user',
          content: 'can you check @data/khromata_judgments_117.json',
        },
      }),
      entry(1, {
        type: 'assistant',
        uuid: 'a1',
        parentUuid: 'u1',
        timestamp: '2026-04-20T10:00:01.000Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Inspecting the file now.' },
            {
              type: 'tool_use',
              id: 'tool_1',
              name: 'Bash',
              input: { command: 'jq length data/khromata_judgments_117.json' },
            },
          ],
        },
      }),
      entry(2, {
        type: 'user',
        uuid: 'u2',
        parentUuid: 'a1',
        timestamp: '2026-04-20T10:00:02.000Z',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool_1', content: '237' }],
        },
      }),
      entry(3, {
        type: 'attachment',
        uuid: 'att_async',
        parentUuid: 'u2',
        timestamp: '2026-04-20T10:00:03.000Z',
        attachment: { type: 'async_hook_response' },
      }),
      entry(4, {
        type: 'assistant',
        uuid: 'a2',
        parentUuid: 'att_async',
        timestamp: '2026-04-20T10:00:04.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Solid dataset. I can train a stronger ranking model from this.',
            },
          ],
        },
      }),
      entry(5, {
        type: 'attachment',
        uuid: 'att_hook',
        parentUuid: 'a2',
        timestamp: '2026-04-20T10:00:05.000Z',
        attachment: { type: 'hook_success' },
      }),
      entry(6, {
        type: 'system',
        uuid: 's1',
        parentUuid: 'att_hook',
        timestamp: '2026-04-20T10:00:06.000Z',
        subtype: 'stop_hook_summary',
        hookInfos: [{ command: 'cmux-notify.sh', durationMs: 44 }],
      }),
      entry(7, {
        type: 'system',
        uuid: 's2',
        parentUuid: 's1',
        timestamp: '2026-04-20T10:00:07.000Z',
        subtype: 'turn_duration',
        content: 'turn_duration',
      }),
      entry(8, {
        type: 'system',
        uuid: 's3',
        parentUuid: 's2',
        timestamp: '2026-04-20T10:00:08.000Z',
        subtype: 'away_summary',
        content: "You're improving Khromata's neural networks.",
      }),
      entry(9, {
        type: 'assistant',
        uuid: 'a_dead',
        parentUuid: 'u1',
        timestamp: '2026-04-20T10:00:01.500Z',
        isSidechain: true,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Dead branch.' }],
        },
      }),
    ]

    const selection = selectActiveThread(entries)

    expect(selection.selectedLeafUuid).toBe('s3')
    expect(selection.branchCount).toBeGreaterThan(0)
    expect(selection.selectedEntries.map(candidate => candidate.raw.uuid)).toEqual([
      'u1',
      'a1',
      'u2',
      'att_async',
      'a2',
      'att_hook',
      's1',
      's2',
      's3',
    ])
  })
})
