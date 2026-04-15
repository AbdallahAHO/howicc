import { describe, expect, it } from 'vitest'
import { redactText } from '../redactText'
import { publicShareRules } from '../rules/publicShare'

const goldenCases = [
  {
    name: 'github token',
    ruleIds: ['github-token'],
    input: `ghp_${'a'.repeat(36)}`,
    output: 'ghp_<redacted>',
  },
  {
    name: 'openai token',
    ruleIds: ['openai-api-token'],
    input: `sk-proj-${'A'.repeat(74)}T3BlbkFJ${'B'.repeat(74)}`,
    output: 'sk-proj-<redacted>',
  },
  {
    name: 'anthropic token',
    ruleIds: ['anthropic-api-key'],
    input: `sk-ant-api03-${'A'.repeat(93)}AA`,
    output: 'sk-ant-api03-<redacted>',
  },
  {
    name: 'bearer token',
    ruleIds: ['bearer-token'],
    input: 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    output: 'Authorization: Bearer <redacted>',
  },
  {
    name: 'private key block',
    ruleIds: ['private-key-block'],
    input: [
      '-----BEGIN PRIVATE KEY-----',
      'VGhpcy1pcy1ub3QtYS1yZWFsLWtleS1idXQtaXQtbG9va3MtbGlrZS1vbmU=',
      '-----END PRIVATE KEY-----',
    ].join('\n'),
    output: '<redacted-private-key>',
  },
  {
    name: 'basic auth url',
    ruleIds: ['basic-auth-url'],
    input: 'https://abdallah:really-secret@example.com/path',
    output: 'https://<redacted-user>:<redacted-pass>@example.com/path',
  },
  {
    name: 'quoted secret assignment',
    ruleIds: ['quoted-secret-assignment'],
    input: 'OPENAI_API_KEY="super-secret-token-value-abcdef"',
    output: 'OPENAI_API_KEY="<redacted-secret>"',
  },
  {
    name: 'env secret assignment',
    ruleIds: ['env-secret-assignment'],
    input: 'SERVICE_TOKEN=super-secret-token-value-abcdef',
    output: 'SERVICE_TOKEN=<redacted-secret>',
  },
  {
    name: 'home directory path',
    ruleIds: ['home-directory-path'],
    input: '/Users/abdallah/Developer/personal/howicc',
    output: '/Users/<redacted>/Developer/personal/howicc',
  },
  {
    name: 'private url',
    ruleIds: ['private-url'],
    input: 'http://localhost:3000/dashboard',
    output: 'http://<local-host>:3000/dashboard',
  },
  {
    name: 'email address',
    ruleIds: ['email-address'],
    input: 'Reach me at abdallah@company.com',
    output: 'Reach me at <redacted-email>',
  },
  {
    name: 'phone number',
    ruleIds: ['phone-number'],
    input: 'Call me at +49 151 2345 6789',
    output: 'Call me at <redacted-phone>',
  },
] as const

describe('public-share rule goldens', () => {
  it('covers every public-share rule with a golden case', () => {
    const uncoveredRuleIds = publicShareRules
      .map(rule => rule.id)
      .filter(
        ruleId =>
          !goldenCases.some(testCase =>
            (testCase.ruleIds as readonly string[]).includes(ruleId),
          ),
      )

    expect(uncoveredRuleIds).toEqual([])
  })

  it.each(goldenCases)('redacts $name', testCase => {
    const result = redactText(testCase.input)

    expect(result.value).toBe(testCase.output)
    expect(result.findings.map(finding => finding.ruleId)).toEqual(testCase.ruleIds)
  })
})
