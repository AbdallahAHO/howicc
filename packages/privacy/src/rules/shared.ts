import type { PrivacyRuleMatch } from '../types'

export const escapeForRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const ensureGlobal = (pattern: RegExp) =>
  pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`)

export const collectMatches = (
  text: string,
  pattern: RegExp,
  mapMatch?: (match: RegExpExecArray) => PrivacyRuleMatch | undefined,
) => {
  const matches: PrivacyRuleMatch[] = []

  for (const match of text.matchAll(ensureGlobal(pattern))) {
    if (typeof match.index !== 'number') continue

    const nextMatch = mapMatch
      ? mapMatch(match)
      : {
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        }

    if (nextMatch) {
      matches.push(nextMatch)
    }
  }

  return matches
}

export const truncatePreview = (value: string, maxLength = 80) =>
  value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`

export const isPlaceholderValue = (
  value: string,
  stopwords: string[] = [],
) => {
  const normalizedValue = value.trim().toLowerCase()

  if (!normalizedValue) {
    return true
  }

  if (
    normalizedValue.includes('<redacted') ||
    normalizedValue === '[redacted]' ||
    normalizedValue === 'redacted'
  ) {
    return true
  }

  if (
    normalizedValue.includes('example') ||
    normalizedValue.includes('placeholder') ||
    normalizedValue.includes('changeme') ||
    normalizedValue.includes('change-me') ||
    normalizedValue.includes('your-') ||
    normalizedValue.includes('insert-') ||
    normalizedValue.includes('insert_') ||
    normalizedValue.includes('process.env') ||
    normalizedValue.includes('${') ||
    normalizedValue.includes('{{')
  ) {
    return true
  }

  if (/^[x*._-]{4,}$/i.test(normalizedValue)) {
    return true
  }

  return stopwords.some(stopword => normalizedValue.includes(stopword.toLowerCase()))
}

export const isPlaceholderUser = (value: string) => {
  const normalizedValue = value.trim().toLowerCase()

  return (
    normalizedValue.startsWith('<') ||
    normalizedValue.startsWith('{') ||
    [
      'user',
      'username',
      'yourname',
      'your-user',
      'example',
      'sample',
      'me',
    ].includes(normalizedValue)
  )
}

export const replaceHomeDirectoryPrefix = (value: string) => {
  const windowsMatch = value.match(/^([A-Za-z]:\\Users\\)([^\\]+)(.*)$/)
  if (windowsMatch) {
    return isPlaceholderUser(windowsMatch[2]!)
      ? value
      : `${windowsMatch[1]}<redacted>${windowsMatch[3]}`
  }

  const macMatch = value.match(/^(\/Users\/)([^/]+)(.*)$/)
  if (macMatch) {
    return isPlaceholderUser(macMatch[2]!)
      ? value
      : `${macMatch[1]}<redacted>${macMatch[3]}`
  }

  const linuxMatch = value.match(/^(\/home\/)([^/]+)(.*)$/)
  if (linuxMatch) {
    return isPlaceholderUser(linuxMatch[2]!)
      ? value
      : `${linuxMatch[1]}<redacted>${linuxMatch[3]}`
  }

  return value
}

export const replaceWithCapturedPrefix = (
  value: string,
  prefixPattern: RegExp,
  fallback: string,
) => {
  const match = value.match(prefixPattern)
  return match ? `${match[1] ?? match[0]}<redacted>` : fallback
}
