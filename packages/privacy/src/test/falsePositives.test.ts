import { describe, expect, it } from 'vitest'
import { redactText } from '../redactText'

const falsePositiveCases = [
  {
    name: 'placeholder quoted api key',
    input: 'OPENAI_API_KEY="your-api-key-here"',
  },
  {
    name: 'process env secret reference',
    input: 'SERVICE_TOKEN=process.env.SERVICE_TOKEN',
  },
  {
    name: 'example email address',
    input: 'Contact support@example.com for help',
  },
  {
    name: 'placeholder home directory user',
    input: 'cd /Users/example/project',
  },
  {
    name: 'short fake github token in docs',
    input: 'Use ghp_example_token as the placeholder in the tutorial.',
  },
  {
    name: 'already redacted token markers',
    input: 'Masked values: ghp_<redacted> and sk-proj-<redacted>',
  },
  {
    name: 'markdown table with placeholders',
    input: [
      '| Key | Value |',
      '| --- | --- |',
      '| OPENAI_API_KEY | your-api-key-here |',
    ].join('\n'),
  },
] as const

describe('false positive regressions', () => {
  it.each(falsePositiveCases)('skips $name', testCase => {
    const result = redactText(testCase.input)

    expect(result.changed).toBe(false)
    expect(result.value).toBe(testCase.input)
    expect(result.findings).toEqual([])
    expect(result.summary).toEqual({
      warnings: 0,
      reviews: 0,
      blocks: 0,
    })
  })
})
