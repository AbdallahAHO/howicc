import chalk from 'chalk'
import ora from 'ora'
import type { UserProfile, SessionDigest } from '@howicc/canonical'
import { extractSessionDigest, buildUserProfile } from '@howicc/profile'
import { ClaudeCodeAdapter } from '@howicc/provider-claude-code'
import { getPricingCatalog } from '../lib/claude'

export const profileCommand = async () => {
  const spinner = ora('Fetching pricing catalog...').start()

  const pricingCatalog = await getPricingCatalog()
  spinner.text = 'Scanning sessions...'

  const sessions = await ClaudeCodeAdapter.discoverSessions()
  spinner.text = `Parsing ${sessions.length} sessions...`

  const digests: SessionDigest[] = []
  let errors = 0

  for (let i = 0; i < sessions.length; i++) {
    try {
      const bundle = await ClaudeCodeAdapter.buildSourceBundle(sessions[i]!)
      const canonical = await ClaudeCodeAdapter.parseCanonicalSession(bundle, { pricingCatalog })
      digests.push(extractSessionDigest(canonical))
      spinner.text = `Parsing sessions... ${i + 1}/${sessions.length}`
    } catch {
      errors += 1
    }
  }

  spinner.stop()

  if (digests.length === 0) {
    console.log(chalk.dim('No sessions found in ~/.claude/'))
    return
  }

  const profile = buildUserProfile('local', digests)
  renderProfile(profile, errors)
}

const renderProfile = (p: UserProfile, parseErrors: number) => {
  const hrs = (ms: number) => `${(ms / 3_600_000).toFixed(1)}h`
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`
  const dim = chalk.dim
  const bold = chalk.bold
  const cyan = chalk.cyan
  const green = chalk.green
  const yellow = chalk.yellow
  const red = chalk.red
  const white = chalk.white
  const magenta = chalk.magenta

  // ── Hero ──────────────────────────────────────────────────────────
  console.log()
  console.log(
    `  ${cyan('◆')} ${bold('HowiCC Profile')}`,
  )
  console.log()
  console.log(
    `  ${bold(String(p.activity.totalSessions))} sessions · ` +
    `${bold(String(p.activity.activeDays))} active days · ` +
    `${bold(hrs(p.activity.totalDurationMs))} with AI · ` +
    `since ${dim(p.activity.firstSessionAt?.slice(0, 10) ?? 'unknown')}`,
  )

  const primaryModel = p.models[0]?.model ?? 'unknown'
  const streak = p.activity.currentStreak
  const best = p.activity.longestStreak
  console.log(
    `  Primary: ${white(primaryModel)}` +
    (streak > 0 ? `  ·  ${yellow('🔥')} ${bold(String(streak))}-day streak` : '') +
    (best > streak ? dim(` (best: ${best})`) : ''),
  )
  console.log()

  // ── Activity sparkline ────────────────────────────────────────────
  console.log(`  ${dim('ACTIVITY')}`)
  console.log()
  renderHourlyChart(p.activity.hourlyDistribution)
  console.log()

  // ── Projects ──────────────────────────────────────────────────────
  console.log(`  ${dim('PROJECTS')}${' '.repeat(36)}${dim('LANGUAGES')}`)
  console.log()

  const topProjects = p.projects.slice(0, 6)
  const topLangs = p.productivity.topLanguages.slice(0, 6)
  const maxRows = Math.max(topProjects.length, topLangs.length)

  for (let i = 0; i < maxRows; i++) {
    let left = ' '.repeat(42)
    let right = ''

    if (i < topProjects.length) {
      const proj = topProjects[i]!
      const name = truncate(proj.displayName, 28)
      const count = String(proj.sessionCount).padStart(3)
      const bar = makeBar(proj.sessionCount, topProjects[0]!.sessionCount, 6)
      left = `  ${white(name.padEnd(28))} ${count}  ${cyan(bar)}`
      left = left.padEnd(42)
    }

    if (i < topLangs.length) {
      const lang = topLangs[i]!
      const name = `.${lang.language}`
      const count = String(lang.fileCount).padStart(5)
      const bar = makeBar(lang.fileCount, topLangs[0]!.fileCount, 12)
      right = `${dim(name.padEnd(8))} ${count}  ${green(bar)}`
    }

    console.log(`${left}  ${right}`)
  }
  console.log()

  // ── Tools ─────────────────────────────────────────────────────────
  console.log(`  ${dim('TOOLS')}  ${dim(`${p.toolcraft.totalToolRuns.toLocaleString()} total runs`)}`)
  console.log()

  const cats = Object.entries(p.toolcraft.categoryBreakdown)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  const maxCatCount = cats[0]?.[1] ?? 1

  for (const [cat, count] of cats.slice(0, 7)) {
    const bar = makeBar(count, maxCatCount, 30)
    const countStr = String(count).padStart(6)
    const pctStr = pct(count / p.toolcraft.totalToolRuns).padStart(4)
    console.log(`  ${dim(cat.padEnd(10))} ${magenta(bar)} ${countStr} ${dim(pctStr)}`)
  }
  console.log()

  const signals = [
    `Plan: ${pct(p.toolcraft.planUsageRate)}`,
    `Agents: ${pct(p.toolcraft.agentUsageRate)}`,
    `Errors: ${pct(p.toolcraft.errorRate)}`,
    `Rejections: ${pct(p.toolcraft.rejectionRate)}`,
  ]

  if (p.providerProfiles?.claudeCode?.cacheHitRate != null) {
    signals.push(`Cache: ${pct(p.providerProfiles.claudeCode.cacheHitRate)}`)
  }

  signals.push(`Avg ${p.activity.averageTurnsPerSession.toFixed(1)} turns/session`)

  console.log(`  ${dim(signals.join('  ·  '))}`)
  console.log()

  // ── Productivity ──────────────────────────────────────────────────
  console.log(`  ${dim('PRODUCTIVITY')}`)
  console.log()

  const prod = p.productivity
  const left1 = `  ${bold(String(prod.totalFilesChanged))} file edits · ${bold(String(prod.uniqueFilesChanged))} unique files`
  const right1 = `${bold(String(prod.totalGitCommits))} commits · ${bold(String(prod.totalGitPushes))} pushes`
  console.log(`${left1}     ${right1}`)

  if (prod.totalPrLinks > 0) {
    const repos = prod.prRepositories.map(r => `${r.repository} (${r.prCount})`).join(', ')
    console.log(`  ${bold(String(prod.totalPrLinks))} PRs created: ${dim(repos)}`)
  }

  const iterDepth = prod.averageFileIterationDepth
  const timeToEdit = prod.averageTimeToFirstEditMs
  const metaLine = [
    `${iterDepth.toFixed(1)} edits/file avg`,
    timeToEdit != null ? `${(timeToEdit / 60_000).toFixed(0)}m avg to first edit` : null,
  ].filter(Boolean).join('  ·  ')
  console.log(`  ${dim(metaLine)}`)
  console.log()

  // Session type distribution
  const types = prod.sessionTypeDistribution
  const typeEntries = Object.entries(types).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])
  if (typeEntries.length > 0) {
    const typeStr = typeEntries.map(([type, count]) => {
      const color = type === 'building' ? green : type === 'debugging' ? red : type === 'exploring' ? cyan : dim
      return `${color(type)} ${count}`
    }).join(dim('  ·  '))
    console.log(`  ${typeStr}`)
    console.log()
  }

  // ── MCP & Skills ──────────────────────────────────────────────────
  if (p.integrations.mcpServers.length > 0 || p.integrations.skills.length > 0) {
    console.log(`  ${dim('INTEGRATIONS')}`)
    console.log()

    for (const server of p.integrations.mcpServers.slice(0, 5)) {
      const used = server.usedCount > 0
        ? green(`→ ${server.usedCount} sessions, ${server.totalToolCalls} calls`)
        : dim('configured only')
      console.log(`  ${white(server.server.padEnd(25))} ${server.configuredCount} configured  ${used}`)
    }

    if (p.integrations.skills.length > 0) {
      console.log()
      const skillStr = p.integrations.skills
        .map(s => `${cyan('/' + s.name)} (${s.totalInvocations})`)
        .join('  ')
      console.log(`  Skills: ${skillStr}`)
    }
    console.log()
  }

  // ── Models & Cost ──────────────────────────────────────────────────
  if (p.models.length > 0) {
    const totalCost = p.cost.totalUsd
    const costStr = totalCost > 0 ? `  ·  ${bold(usd(totalCost))} total` : ''
    console.log(`  ${dim('MODELS')}${costStr}`)
    console.log()

    const maxSessions = p.models[0]!.sessionCount

    for (const m of p.models.slice(0, 4)) {
      const tokens = m.inputTokens + m.outputTokens
      const tokenStr = tokens > 1_000_000
        ? `${(tokens / 1_000_000).toFixed(1)}M`
        : `${(tokens / 1_000).toFixed(0)}K`
      const bar = makeBar(m.sessionCount, maxSessions, 20)
      const costPart = m.estimatedCostUsd > 0 ? green(usd(m.estimatedCostUsd)) : ''
      console.log(
        `  ${white(m.model.padEnd(26))} ${String(m.sessionCount).padStart(4)} sess  ${cyan(bar)}  ${dim(tokenStr + ' tokens')}  ${costPart}`,
      )
    }

    if (totalCost > 0) {
      console.log()
      console.log(`  ${dim(`Avg ${usd(p.cost.averagePerSessionUsd)}/session`)}`)
    }
    console.log()
  }

  // ── Footer ────────────────────────────────────────────────────────
  const syncedCount = 0 // TODO: read from local sync state
  console.log(dim(`  ─${'─'.repeat(65)}`))
  if (parseErrors > 0) {
    console.log(dim(`  ${parseErrors} sessions failed to parse`))
  }
  console.log(dim(`  Run ${white('howicc sync')} to upload sessions to howi.cc`))
  console.log()
}

// ── Rendering helpers ─────────────────────────────────────────────────

const usd = (n: number): string => {
  if (n >= 100) return `$${n.toFixed(0)}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(3)}`
}

const makeBar = (value: number, max: number, width: number): string => {
  if (max === 0) return ' '.repeat(width)
  const filled = Math.max(1, Math.round((value / max) * width))
  return '█'.repeat(filled) + ' '.repeat(Math.max(0, width - filled))
}

const truncate = (text: string, maxLen: number): string =>
  text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text

const renderHourlyChart = (distribution: number[]) => {
  const max = Math.max(...distribution)
  if (max === 0) return

  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']
  const chart = distribution
    .map(count => {
      if (count === 0) return chalk.dim('▁')
      const level = Math.min(Math.round((count / max) * 7), 7)
      return chalk.cyan(blocks[level]!)
    })
    .join('')

  console.log(`  ${chart}`)
  console.log(`  ${chalk.dim('12a     6a      12p     6p      12a')}`)

  const peakHour = distribution.indexOf(max)
  const hourLabels = ['12a', '1a', '2a', '3a', '4a', '5a', '6a', '7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p', '11p']
  console.log(`  ${chalk.dim(`Peak: ${hourLabels[peakHour]} (${max} sessions)`)}`)
}
