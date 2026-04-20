import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildChangesetMarkdown,
  deriveBumpAndSummaries,
  getAffectedReleasePackageNames,
} from './auto-changeset.mjs'

test('maps private CLI dependencies back to the published CLI surface', () => {
  const packageNames = getAffectedReleasePackageNames([
    'packages/provider-claude-code/src/parse/selectActiveThread.ts',
    'packages/provider-claude-code/src/test/selectActiveThread.test.ts',
  ])

  assert.deepEqual(packageNames, ['howicc'])
})

test('maps shared workspace changes to every published surface they impact', () => {
  const packageNames = getAffectedReleasePackageNames([
    'packages/api-client/src/index.ts',
  ])

  assert.deepEqual(packageNames, ['@howicc/web', 'howicc'])
})

test('builds release-surface frontmatter instead of private workspace packages', () => {
  const markdown = buildChangesetMarkdown({
    packageNames: ['howicc'],
    bump: 'patch',
    summaries: ['Keep active threads through attachment parents'],
  })

  assert.match(markdown, /'howicc': patch/)
  assert.doesNotMatch(markdown, /@howicc\/provider-claude-code/)
})

test('derives the highest bump across conventional commits and deduplicates summaries', () => {
  const result = deriveBumpAndSummaries([
    {
      hash: 'a',
      subject: 'fix(cli): streamline sync flow',
      body: '',
    },
    {
      hash: 'b',
      subject: 'feat(cli): add upload sanitization mode',
      body: '',
    },
    {
      hash: 'c',
      subject: 'feat(cli): add upload sanitization mode',
      body: '',
    },
  ])

  assert.equal(result.bump, 'minor')
  assert.deepEqual(result.summaries, [
    'streamline sync flow',
    'add upload sanitization mode',
  ])
})
