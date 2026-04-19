/**
 * Renders a human-readable label for a raw provider model ID.
 *
 * Keeps the date/suffix on the side (callers render it in muted mono)
 * so the common case (Claude Sonnet 4.5, GPT-4o) reads like a brand
 * name and the release stamp stays a footnote.
 *
 * @example
 * formatModelName('claude-sonnet-4-5-20250929')
 * // → { label: 'Claude Sonnet 4.5', suffix: '20250929' }
 */
export function formatModelName(raw: string): { label: string; suffix?: string } {
  if (!raw) return { label: 'Unknown' }

  const trimmed = raw.trim()

  // claude-{tier}-{major}-{minor?}-{datestamp?}
  const cc = trimmed.match(
    /^claude-(opus|sonnet|haiku)-(\d+)(?:-(\d+))?(?:-(\d{6,}))?$/i,
  )
  if (cc) {
    const tier = cc[1]!.charAt(0).toUpperCase() + cc[1]!.slice(1).toLowerCase()
    const major = cc[2]!
    const minor = cc[3]
    const date = cc[4]
    const version = minor ? `${major}.${minor}` : major
    return {
      label: `Claude ${tier} ${version}`,
      suffix: date,
    }
  }

  // claude-{major}-{minor}-{tier}-{datestamp?}
  const ccLegacy = trimmed.match(
    /^claude-(\d+)-(\d+)-(opus|sonnet|haiku)(?:-(\d{6,}))?$/i,
  )
  if (ccLegacy) {
    const tier =
      ccLegacy[3]!.charAt(0).toUpperCase() + ccLegacy[3]!.slice(1).toLowerCase()
    const version = `${ccLegacy[1]}.${ccLegacy[2]}`
    return { label: `Claude ${version} ${tier}`, suffix: ccLegacy[4] }
  }

  // gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini, etc.
  const gpt = trimmed.match(/^gpt-([0-9o]+(?:-[a-z]+)?)(?:-(\d{4,}))?$/i)
  if (gpt) {
    const version = gpt[1]!
      .split('-')
      .map((part) =>
        part.match(/^\d/) ? part : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(' ')
    return { label: `GPT-${version}`, suffix: gpt[2] }
  }

  return { label: trimmed }
}
