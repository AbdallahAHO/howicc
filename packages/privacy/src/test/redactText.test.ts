import { describe, expect, it } from 'vitest'
import { inspectText, redactText } from '../redactText'

describe('redactText', () => {
  it('redacts realistic local paths and localhost URLs from transcript snippets', () => {
    const input = [
      "curl 'http://localhost:9002/allie/chat'",
      'Read /Users/abdallah/Developer/personal/howicc/packages/canonical/src/session.ts',
    ].join('\n')

    const result = redactText(input)

    expect(result.value).toContain("http://<local-host>:9002/allie/chat")
    expect(result.value).toContain(
      '/Users/<redacted>/Developer/personal/howicc/packages/canonical/src/session.ts',
    )
    expect(result.summary.reviews).toBe(2)
  })

  it('preserves provider prefixes when redacting API tokens', () => {
    const githubToken = `ghp_${'a'.repeat(36)}`
    const openAiToken = `sk-proj-${'A'.repeat(74)}T3BlbkFJ${'B'.repeat(74)}`
    const anthropicToken = `sk-ant-api03-${'A'.repeat(93)}AA`
    const input = [githubToken, openAiToken, anthropicToken].join('\n')

    const result = redactText(input)

    expect(result.value).toContain('ghp_<redacted>')
    expect(result.value).toContain('sk-proj-<redacted>')
    expect(result.value).toContain('sk-ant-api03-<redacted>')
    expect(result.summary.blocks).toBe(3)
    expect(JSON.stringify(result.findings)).not.toContain(githubToken)
    expect(JSON.stringify(result.findings)).not.toContain(openAiToken)
    expect(JSON.stringify(result.findings)).not.toContain(anthropicToken)
  })

  it('redacts bearer tokens and secret assignments while skipping placeholders', () => {
    const input = [
      'OPENAI_API_KEY="your-api-key-here"',
      'OPENAI_API_KEY="super-secret-value-123456"',
      'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
      'SERVICE_TOKEN=plain-text-secret-value',
    ].join('\n')

    const result = redactText(input)

    expect(result.value).toContain('OPENAI_API_KEY="your-api-key-here"')
    expect(result.value).toContain('OPENAI_API_KEY="<redacted-secret>"')
    expect(result.value).toContain('Authorization: Bearer <redacted>')
    expect(result.value).toContain('SERVICE_TOKEN=<redacted-secret>')
    expect(result.summary.blocks).toBe(3)
  })

  it('redacts private keys, basic auth URLs, emails, and phone numbers', () => {
    const privateKey = [
      '-----BEGIN PRIVATE KEY-----',
      'VGhpcy1pcy1ub3QtYS1yZWFsLWtleS1idXQtaXQtbG9va3MtbGlrZS1vbmU=',
      '-----END PRIVATE KEY-----',
    ].join('\n')
    const input = [
      'https://abdallah:really-secret@example.com',
      'Contact abdallah@company.com or +1 (415) 555-0132',
      privateKey,
    ].join('\n\n')

    const result = redactText(input)

    expect(result.value).toContain('https://<redacted-user>:<redacted-pass>@example.com')
    expect(result.value).toContain('<redacted-email>')
    expect(result.value).toContain('<redacted-phone>')
    expect(result.value).toContain('<redacted-private-key>')
    expect(result.summary.blocks).toBe(2)
    expect(result.summary.reviews).toBe(2)
  })

  it('is idempotent on already redacted content', () => {
    const once = redactText(
      'Run it from /Users/abdallah/project with ghp_abcdefghijklmnopqrstuvwxyz123456',
    )
    const twice = redactText(once.value)

    expect(twice.value).toBe(once.value)
    expect(twice.changed).toBe(false)
  })

  it('supports inspection without mutating the source text', () => {
    const input = 'Email me at abdallah@company.com'

    const inspection = inspectText(input)
    const redaction = redactText(input)

    expect(inspection.findings).toHaveLength(1)
    expect(redaction.value).toBe('Email me at <redacted-email>')
    expect(input).toBe('Email me at abdallah@company.com')
  })
})
