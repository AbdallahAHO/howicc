import { describe, expect, it } from 'vitest'
import { buildSearchText } from '../canonical/buildSearchText'

describe('buildSearchText', () => {
  it('strips raw Claude wrapper tags from tool results while keeping inner text searchable', () => {
    const searchText = buildSearchText({
      metadata: {},
      events: [
        {
          type: 'tool_result',
          id: 'tool-result-1',
          toolUseId: 'toolu_1',
          timestamp: '2026-04-01T10:00:00.000Z',
          status: 'ok',
          text: [
            '<task-notification>',
            '<status>failed</status>',
            '<summary>Background command "Verify MCP GET still works" failed with exit code 18</summary>',
            '</task-notification>',
          ].join('\n'),
        },
      ],
      artifacts: [],
    })

    expect(searchText).toContain('Background command "Verify MCP GET still works" failed with exit code 18')
    expect(searchText).toContain('failed')
    expect(searchText).not.toContain('<task-notification>')
    expect(searchText).not.toContain('<summary>')
    expect(searchText).not.toContain('<status>')
  })
})
