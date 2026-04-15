import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export type ClaudeToolCallFixture = {
  name: string
  input: Record<string, unknown>
}

export type ClaudeTurnFixture = {
  user: string
  assistant?: string
  toolCalls?: ClaudeToolCallFixture[]
  assistantModel?: string
  permissionMode?: 'acceptEdits' | 'bypassPermissions' | 'default'
}

export type ClaudeFixtureEnvironment = {
  rootDir: string
  claudeHomeDir: string
  projectDir: string
  projectKey: string
  cleanup: () => Promise<void>
}

export const createClaudeFixtureEnvironment = async (
  label = 'howicc-cli-claude-fixture',
): Promise<ClaudeFixtureEnvironment> => {
  const rootDir = await mkdtemp(path.join(tmpdir(), `${label}-`))
  const claudeHomeDir = path.join(rootDir, 'claude')
  const projectDir = path.join(rootDir, 'workspace', 'fixture-project')
  const projectKey = 'fixture-project'

  await Promise.all([
    mkdir(path.join(claudeHomeDir, 'projects', projectKey), { recursive: true }),
    mkdir(projectDir, { recursive: true }),
  ])

  return {
    rootDir,
    claudeHomeDir,
    projectDir,
    projectKey,
    cleanup: async () => {
      await rm(rootDir, { recursive: true, force: true })
    },
  }
}

export const writeClaudeSessionTranscript = async (
  env: ClaudeFixtureEnvironment,
  input: {
    sessionId: string
    fileTimestamp?: string
    gitBranch?: string
    slug?: string
    turns: ClaudeTurnFixture[]
  },
) => {
  const projectDirectory = path.join(env.claudeHomeDir, 'projects', env.projectKey)
  const transcriptPath = path.join(projectDirectory, `${input.sessionId}.jsonl`)
  const slug = input.slug ?? 'solid-fixture'
  const gitBranch = input.gitBranch ?? 'main'
  const baseTimestamp = Date.parse('2026-04-01T10:00:00.000Z')
  let parentUuid: string | null = null

  const lines = input.turns.flatMap((turn, index) => {
    const turnOffsetMs = index * 60_000
    const userUuid = `u${index + 1}`
    const assistantUuid = `a${index + 1}`

    const userEntry: Record<string, unknown> = {
      type: 'user',
      uuid: userUuid,
      parentUuid,
      promptId: `p${index + 1}`,
      timestamp: new Date(baseTimestamp + turnOffsetMs).toISOString(),
      permissionMode: turn.permissionMode ?? 'acceptEdits',
      cwd: env.projectDir,
      gitBranch,
      slug,
      message: {
        role: 'user',
        content: turn.user,
      },
    }

    const assistantContent: Array<Record<string, unknown>> = [
      ...(turn.toolCalls ?? []).map((toolCall, toolIndex) => ({
        type: 'tool_use',
        id: `toolu_${index + 1}_${toolIndex + 1}`,
        name: toolCall.name,
        input: toolCall.input,
      })),
      ...(turn.assistant
        ? [{
            type: 'text',
            text: turn.assistant,
          }]
        : []),
    ]

    const entries: Array<Record<string, unknown>> = [userEntry]

    if (assistantContent.length > 0) {
      entries.push({
        type: 'assistant',
        uuid: assistantUuid,
        parentUuid: userUuid,
        timestamp: new Date(baseTimestamp + turnOffsetMs + 5_000).toISOString(),
        cwd: env.projectDir,
        gitBranch,
        slug,
        message: {
          role: 'assistant',
          model: turn.assistantModel ?? 'claude-sonnet-4-6',
          usage: {
            input_tokens: 100 + index,
            output_tokens: 200 + index,
            cache_creation_input_tokens: index === 0 ? 10 : 0,
            cache_read_input_tokens: index === 0 ? 5 : 0,
          },
          content: assistantContent,
        },
      })

      parentUuid = assistantUuid
    } else {
      parentUuid = userUuid
    }

    return entries
  })

  await writeFile(
    transcriptPath,
    `${lines.map(line => JSON.stringify(line)).join('\n')}\n`,
  )

  if (input.fileTimestamp) {
    const timestamp = new Date(input.fileTimestamp)
    await utimes(transcriptPath, timestamp, timestamp)
  }

  return transcriptPath
}

export const writeBrokenClaudeSessionTranscript = async (
  env: ClaudeFixtureEnvironment,
  input: {
    sessionId: string
    fileTimestamp?: string
  },
) => {
  const projectDirectory = path.join(env.claudeHomeDir, 'projects', env.projectKey)
  const transcriptPath = path.join(projectDirectory, `${input.sessionId}.jsonl`)

  await writeFile(
    transcriptPath,
    '{"type":"user","uuid":"broken","parentUuid":null,"timestamp":"2026-04-01T10:00:00.000Z","cwd":"/tmp/bad","message":{"role":"user","content":"broken"}\n',
  )

  if (input.fileTimestamp) {
    const timestamp = new Date(input.fileTimestamp)
    await utimes(transcriptPath, timestamp, timestamp)
  }

  return transcriptPath
}
