import chalk from 'chalk'
import ora from 'ora'
import type { CanonicalSession, ToolCallEvent, ToolResultEvent } from '@howicc/canonical'
import { extractSessionDigest } from '@howicc/profile'
import { inspectClaudeSession, getPricingCatalog } from '../lib/claude'
import { formatRelativeTime } from '../lib/output'

export const inspectCommand = async (sessionId: string) => {
  const spinner = ora('Parsing session...').start()
  const pricingCatalog = await getPricingCatalog()
  const result = await inspectClaudeSession(sessionId, { pricingCatalog })

  if (!result) {
    spinner.fail(`Session ${sessionId} was not found in your local Claude storage.`)
    return
  }

  spinner.stop()

  const { canonical } = result
  const digest = extractSessionDigest(canonical)
  const dim = chalk.dim
  const bold = chalk.bold
  const cyan = chalk.cyan
  const green = chalk.green
  const red = chalk.red
  const yellow = chalk.yellow
  const white = chalk.white
  const magenta = chalk.magenta

  const title = digest.title ?? sessionId
  const repo = digest.repository?.fullName
  const branch = digest.gitBranch
  const durationMin = digest.durationMs ? `${Math.round(digest.durationMs / 60_000)}m` : 'unknown'
  const model = digest.models.map(m => m.model).join(', ') || 'unknown'
  const cacheRate = (digest.providerDigest as { cacheHitRate?: number } | undefined)?.cacheHitRate

  // ── Hero ──────────────────────────────────────────────────────────
  console.log()
  console.log(`  ${cyan('◆')} ${bold(title)}`)
  const metaParts = [
    branch ? white(branch) : null,
    repo ? dim(repo) : dim(digest.projectPath ?? digest.projectKey),
  ].filter(Boolean)
  console.log(`  ${metaParts.join(dim(' · '))}`)

  const created = new Date(digest.createdAt)
  const updated = new Date(digest.updatedAt)
  const dateStr = created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeRange = `${created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} → ${updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  console.log(`  ${dim(dateStr + ', ' + timeRange + ' · ' + durationMin)}`)
  const costStr = digest.estimatedCostUsd != null && digest.estimatedCostUsd > 0
    ? ` · ${green(`$${digest.estimatedCostUsd.toFixed(2)}`)}`
    : ''
  console.log(`  ${dim(model)}${cacheRate != null ? dim(` · ${(cacheRate * 100).toFixed(0)}% cache hit`) : ''}${costStr}`)
  console.log()

  // ── Plan ──────────────────────────────────────────────────────────
  const planArtifact = canonical.artifacts.find(a => a.artifactType === 'plan' && a.role === 'main')
  if (planArtifact && planArtifact.artifactType === 'plan') {
    console.log(`  ${dim('PLAN')}`)
    const lines = planArtifact.content.split('\n').filter(l => l.trim())
    for (const line of lines.slice(0, 8)) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) {
        console.log(`  ${bold(trimmed)}`)
      } else {
        console.log(`  ${dim(trimmed)}`)
      }
    }
    if (lines.length > 8) console.log(`  ${dim(`... ${lines.length - 8} more lines`)}`)
    console.log()
  }

  // ── Timeline ──────────────────────────────────────────────────────
  console.log(`  ${dim('TIMELINE')} ${dim(`(${digest.turnCount} turns)`)}`)
  console.log()

  const turns = groupEventsIntoTurns(canonical)

  for (const turn of turns.slice(0, 12)) {
    const ts = turn.timestamp
      ? new Date(turn.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '     '

    if (turn.userText) {
      const preview = turn.userText.slice(0, 100) + (turn.userText.length > 100 ? '…' : '')
      console.log(`  ${dim(ts)}  ${cyan('▸')} ${preview}`)
    }

    if (turn.toolGroups.length > 0) {
      const summary = turn.toolGroups
        .map(([name, count]) => count > 1 ? `${name}×${count}` : name)
        .join(dim(', '))
      const errors = turn.errorCount > 0 ? red(` (${turn.errorCount} errors)`) : ''
      console.log(`  ${' '.repeat(ts.length)}  ${dim('⚙')} ${dim(summary)}${errors}`)
    }

    if (turn.assistantPreview) {
      const preview = turn.assistantPreview.slice(0, 90) + (turn.assistantPreview.length > 90 ? '…' : '')
      console.log(`  ${' '.repeat(ts.length)}  ${dim(preview)}`)
    }
  }

  if (turns.length > 12) {
    console.log(`  ${dim(`    ... ${turns.length - 12} more turns`)}`)
  }
  console.log()

  // ── Files Changed ─────────────────────────────────────────────────
  if (digest.filesChanged.length > 0) {
    console.log(`  ${dim('FILES CHANGED')} ${dim(`(${digest.filesChanged.length})`)}`)
    console.log()

    const cwd = digest.projectPath ?? ''
    for (const file of digest.filesChanged.slice(0, 10)) {
      const short = cwd && file.startsWith(cwd) ? file.slice(cwd.length + 1) : file
      console.log(`  ${green('✏')}  ${white(short)}`)
    }
    if (digest.filesChanged.length > 10) {
      console.log(`  ${dim(`   + ${digest.filesChanged.length - 10} more files`)}`)
    }
    console.log()
  }

  // ── Git Activity ──────────────────────────────────────────────────
  if (digest.gitCommits > 0 || digest.prLinks.length > 0) {
    console.log(`  ${dim('GIT')}`)
    console.log()
    if (digest.gitCommits > 0) {
      console.log(`  ${dim(`${digest.gitCommits} commits · ${digest.gitPushes} pushes`)}`)
    }
    for (const pr of digest.prLinks) {
      console.log(`  ${green('▸')} PR #${pr.number} ${dim(pr.repository)} ${dim(pr.url)}`)
    }
    console.log()
  }

  // ── Stats Row ─────────────────────────────────────────────────────
  console.log(`  ${dim('TOOLS')} ${dim(`(${digest.toolRunCount} runs)`)}${' '.repeat(20)}${dim('ARTIFACTS')}`)
  console.log()

  const cats = Object.entries(digest.toolCategories)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
  const maxCat = cats[0]?.[1] ?? 1

  const artifactTypes = canonical.artifacts.reduce<Record<string, number>>((acc, a) => {
    acc[a.artifactType] = (acc[a.artifactType] ?? 0) + 1
    return acc
  }, {})
  const artifactEntries = Object.entries(artifactTypes).sort((a, b) => b[1] - a[1])

  const maxRows = Math.max(cats.length, artifactEntries.length)
  for (let i = 0; i < Math.min(maxRows, 7); i++) {
    let left = ' '.repeat(38)
    if (i < cats.length) {
      const [cat, count] = cats[i]!
      const bar = makeBar(count, maxCat, 12)
      left = `  ${dim(cat!.padEnd(10))} ${magenta(bar)} ${String(count).padStart(5)}`
    }

    let right = ''
    if (i < artifactEntries.length) {
      const [type, count] = artifactEntries[i]!
      right = `${dim(type!.padEnd(20))} ×${count}`
    }

    console.log(`${left.padEnd(42)}${right}`)
  }
  console.log()

  // ── Subagents ─────────────────────────────────────────────────────
  if (canonical.agents.length > 0) {
    console.log(`  ${dim('AGENTS')} ${dim(`(${canonical.agents.length})`)}`)
    console.log()
    for (const agent of canonical.agents.slice(0, 6)) {
      const eventCount = agent.events.length
      console.log(`  ${yellow('▸')} ${white(agent.title ?? agent.agentId)}  ${dim(`${eventCount} events`)}`)
    }
    if (canonical.agents.length > 6) {
      console.log(`  ${dim(`  + ${canonical.agents.length - 6} more agents`)}`)
    }
    console.log()
  }

  // ── Footer ────────────────────────────────────────────────────────
  console.log(dim(`  ─${'─'.repeat(65)}`))
  console.log(dim(`  Session type: ${digest.sessionType}  ·  ${formatRelativeTime(digest.updatedAt)}`))
  console.log()
}

// ── Helpers ──────────────────────────────────────────────────────────

type Turn = {
  timestamp?: string
  userText?: string
  assistantPreview?: string
  toolGroups: Array<[string, number]>
  errorCount: number
}

const groupEventsIntoTurns = (session: CanonicalSession): Turn[] => {
  const turns: Turn[] = []
  let current: Turn = { toolGroups: [], errorCount: 0 }

  const toolCounts = new Map<string, number>()

  const flushTools = () => {
    if (toolCounts.size > 0) {
      current.toolGroups = [...toolCounts.entries()]
      toolCounts.clear()
    }
  }

  for (const event of session.events) {
    if (event.type === 'user_message' && !event.isMeta) {
      flushTools()
      if (current.userText || current.toolGroups.length > 0) {
        turns.push(current)
      }
      current = {
        timestamp: event.timestamp,
        userText: event.text,
        toolGroups: [],
        errorCount: 0,
      }
    } else if (event.type === 'assistant_message' && !event.isMeta) {
      if (!current.assistantPreview) {
        current.assistantPreview = event.text
      }
    } else if (event.type === 'tool_call') {
      toolCounts.set(event.toolName, (toolCounts.get(event.toolName) ?? 0) + 1)
    } else if (event.type === 'tool_result' && event.status === 'error') {
      current.errorCount += 1
    }
  }

  flushTools()
  if (current.userText || current.toolGroups.length > 0) {
    turns.push(current)
  }

  return turns
}

const makeBar = (value: number, max: number, width: number): string => {
  if (max === 0) return ' '.repeat(width)
  const filled = Math.max(1, Math.round((value / max) * width))
  return '█'.repeat(filled) + ' '.repeat(Math.max(0, width - filled))
}
