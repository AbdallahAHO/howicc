import { describe, expect, it } from 'vitest'
import { normalizeClaudeCommandText } from '../parse/commandText'

describe('normalizeClaudeCommandText', () => {
  it('normalizes local-command stdout and strips ANSI formatting', () => {
    expect(
      normalizeClaudeCommandText(
        '<local-command-stdout>Set model to \u001b[1mOpus 4.6 (1M context) (default)\u001b[22m</local-command-stdout>',
      ),
    ).toMatchObject({
      text: 'Set model to Opus 4.6 (1M context) (default)',
      isMachineGenerated: true,
      isLocalCommandCaveat: false,
    })
  })

  it('combines bash stdout and stderr into readable text', () => {
    expect(
      normalizeClaudeCommandText(
        '<bash-stdout>compiled successfully</bash-stdout><bash-stderr>warning: deprecated flag</bash-stderr>',
      ),
    ).toMatchObject({
      text: 'compiled successfully\nwarning: deprecated flag',
      isMachineGenerated: true,
      isLocalCommandCaveat: false,
    })
  })

  it('extracts task notification summaries', () => {
    expect(
      normalizeClaudeCommandText(
        '<task-notification>\n<task-id>task-1</task-id>\n<status>failed</status>\n<summary>Background command "Verify MCP GET still works" failed with exit code 18</summary>\n</task-notification>',
      ),
    ).toMatchObject({
      text: 'Background command "Verify MCP GET still works" failed with exit code 18',
      isMachineGenerated: true,
      isLocalCommandCaveat: false,
    })
  })

  it('emits a readable placeholder for empty local-command output', () => {
    expect(
      normalizeClaudeCommandText(
        '<local-command-stdout></local-command-stdout><local-command-stderr></local-command-stderr>',
      ),
    ).toMatchObject({
      text: '(Command completed with no output)',
      isMachineGenerated: true,
      isLocalCommandCaveat: false,
    })
  })
})
