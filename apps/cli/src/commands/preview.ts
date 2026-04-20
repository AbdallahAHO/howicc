import ora from 'ora'
import { redactText } from '@howicc/privacy'
import { inspectClaudeSession } from '../lib/claude'
import {
  buildPrivacySafeUpload,
  buildRedactedRenderPreview,
  formatPrivacyFinding,
  formatPrivacySanitizationReport,
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
    canonical: result.canonical,
    render: result.render,
  })
  const safeUpload = await buildPrivacySafeUpload({
    bundle: result.bundle,
    canonical: result.canonical,
    render: result.render,
    mode: 'sanitize',
  })
  const preview = buildRedactedRenderPreview(safeUpload.render)
  const safeTitle = redactText(safeUpload.render.session.title).value

  spinner.stop()

  printTitle('HowiCC Preview')
  printKeyValue('Session', safeTitle)
  printKeyValue('Overall', formatPrivacySummary(privacy.inspection.summary))
  printKeyValue('Source', formatPrivacySummary(privacy.sourceInspection.summary))
  printKeyValue('Canonical', formatPrivacySummary(privacy.canonicalInspection.summary))
  printKeyValue('Render', formatPrivacySummary(privacy.renderInspection.summary))
  printKeyValue(
    'Upload',
    formatPrivacySummary(safeUpload.privacy.uploadInspection.inspection.summary),
  )
  printKeyValue(
    'Sanitized',
    formatPrivacySanitizationReport(safeUpload.privacy.report),
  )
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

  printSection('Upload-safe Preview')

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

  if (safeUpload.privacy.action === 'block') {
    printHint(
      'This session still contains blocking privacy findings after upload-time sanitization and would be rejected in sync.',
    )
    return
  }

  if (safeUpload.privacy.action === 'sanitized') {
    printHint(
      'Default sync will upload the sanitized version shown above. `howicc sync --privacy strict` keeps the old block/review behavior.',
    )
    return
  }

  if (privacy.status === 'block') {
    printHint(
      'Strict privacy mode would block this upload. Default sync sanitizes it before upload instead.',
    )
    return
  }

  if (privacy.status === 'review') {
    printHint(
      'Strict privacy mode would ask before upload. Default sync can upload the sanitized version immediately.',
    )
    return
  }

  printHint('This session is clear to sync without upload-time sanitization.')
}
