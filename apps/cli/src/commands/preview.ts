import ora from 'ora'
import { redactText } from '@howicc/privacy'
import { inspectClaudeSession } from '../lib/claude'
import {
  buildRedactedRenderPreview,
  formatPrivacyFinding,
  formatPrivacySummary,
  getTopPrivacyFindings,
  inspectSessionPrivacy,
} from '../lib/privacy'
import {
  formatAbsoluteTime,
  printHint,
  printInfo,
  printKeyValue,
  printSection,
  printTitle,
} from '../lib/output'

export const previewCommand = async (sessionId: string) => {
  const spinner = ora('Building local preview...').start()
  const result = await inspectClaudeSession(sessionId)

  if (!result) {
    spinner.fail(`Session ${sessionId} was not found in your local Claude storage.`)
    return
  }

  const privacy = await inspectSessionPrivacy({
    bundle: result.bundle,
    render: result.render,
  })
  const preview = buildRedactedRenderPreview(result.render)
  const safeTitle = redactText(result.render.session.title).value

  spinner.stop()

  printTitle('HowiCC Preview')
  printKeyValue('Session', safeTitle)
  printKeyValue('Overall', formatPrivacySummary(privacy.inspection.summary))
  printKeyValue('Source', formatPrivacySummary(privacy.sourceInspection.summary))
  printKeyValue('Render', formatPrivacySummary(privacy.renderInspection.summary))
  printKeyValue('Updated', formatAbsoluteTime(result.render.session.updatedAt))
  console.log()

  const findings = getTopPrivacyFindings(privacy.inspection, 6)

  if (findings.length > 0) {
    printSection('Findings')

    for (const finding of findings) {
      printInfo(formatPrivacyFinding(finding))
    }

    console.log()
  }

  printSection('Render Preview')

  if (preview.lines.length === 0) {
    printInfo('No renderable text blocks were produced for this session yet.')
  } else {
    for (const line of preview.lines) {
      printInfo(line)
    }
  }

  if (preview.hiddenLineCount > 0) {
    printHint(
      `... ${preview.hiddenLineCount} more preview line${preview.hiddenLineCount === 1 ? '' : 's'}`,
    )
  }

  console.log()

  if (privacy.status === 'block') {
    printHint(
      'This upload would be blocked by privacy pre-flight until the sensitive content is removed or redacted.',
    )
    return
  }

  if (privacy.status === 'review') {
    printHint(
      'This session contains review-level privacy findings. Sync will ask for confirmation before upload.',
    )
    return
  }

  printHint('This session is clear to sync from a privacy-preflight perspective.')
}
