import type { PrivacyRule, PrivacyRuleMatch } from '../types'
import {
  collectMatches,
  escapeForRegExp,
  isPlaceholderUser,
  isPlaceholderValue,
  replaceHomeDirectoryPrefix,
  replaceWithCapturedPrefix,
} from './shared'

const secretlintSource = {
  name: 'Secretlint',
  url: 'https://github.com/secretlint/secretlint',
} as const

const detectSecretsSource = {
  name: 'detect-secrets',
  url: 'https://github.com/Yelp/detect-secrets',
} as const

const gitleaksSource = {
  name: 'Gitleaks',
  url: 'https://github.com/gitleaks/gitleaks',
} as const

const trufflehogSource = {
  name: 'TruffleHog',
  url: 'https://github.com/trufflesecurity/trufflehog',
} as const

const quotedSecretAssignmentPattern =
  /\b([A-Za-z0-9_.-]*?(?:api[_-]?key|access[_-]?key|auth[_-]?token|token|secret|password|passwd|pwd|client[_-]?secret|bearer)[A-Za-z0-9_.-]*)\b\s*(:=|=>|=|:)\s*(["'`])([^"'`\r\n]{8,})(\3)/gi

const envSecretAssignmentPattern =
  /\b([A-Z][A-Z0-9_]*(?:API_KEY|ACCESS_KEY|AUTH_TOKEN|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CLIENT_SECRET))\b\s*=\s*([^\s"'`#]{8,})/g

const buildExactHomeDirectoryPattern = (homeDirectory: string) =>
  new RegExp(`${escapeForRegExp(homeDirectory)}(?:[\\\\/][^\\s"'\\x60<>]*)?`, 'g')

const githubTokenRule: PrivacyRule = {
  id: 'github-token',
  category: 'secret',
  defaultSeverity: 'block',
  description: 'Detect GitHub personal access tokens.',
  keywords: ['ghp_', 'github_pat_'],
  priority: 110,
  sources: [secretlintSource, gitleaksSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,255}|github_pat_[A-Za-z0-9_]{20,255})\b/g,
    ),
  replace: match =>
    match.text.startsWith('github_pat_')
      ? 'github_pat_<redacted>'
      : replaceWithCapturedPrefix(match.text, /^(gh[pousr]_)/, '<redacted-secret>'),
}

const openAiTokenRule: PrivacyRule = {
  id: 'openai-api-token',
  category: 'secret',
  defaultSeverity: 'block',
  description: 'Detect OpenAI API tokens.',
  keywords: ['sk-proj-', 'sk-svcacct-', 'sk-admin-'],
  priority: 110,
  sources: [secretlintSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /\b(?:sk-(?:proj|svcacct|admin)-(?:[A-Za-z0-9_-]{58}|[A-Za-z0-9_-]{74})T3BlbkFJ(?:[A-Za-z0-9_-]{58}|[A-Za-z0-9_-]{74})|sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20})\b/g,
    ),
  replace: match =>
    replaceWithCapturedPrefix(
      match.text,
      /^(sk-(?:proj|svcacct|admin)-)/,
      'sk-<redacted>',
    ),
}

const anthropicTokenRule: PrivacyRule = {
  id: 'anthropic-api-key',
  category: 'secret',
  defaultSeverity: 'block',
  description: 'Detect Anthropic API and admin keys.',
  keywords: ['sk-ant-api', 'sk-ant-admin01'],
  priority: 110,
  sources: [secretlintSource, gitleaksSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /(?<!\p{L})(?:sk-ant-api0\d-[A-Za-z0-9_-]{90,128}AA|sk-ant-admin01-[A-Za-z0-9_-]{90,128}AA)(?![A-Za-z0-9_-])/gu,
    ),
  replace: match =>
    replaceWithCapturedPrefix(
      match.text,
      /^(sk-ant-(?:api0\d|admin01)-)/,
      'sk-ant-<redacted>',
    ),
}

const bearerTokenRule: PrivacyRule = {
  id: 'bearer-token',
  category: 'credential',
  defaultSeverity: 'block',
  description: 'Detect bearer tokens in headers and logs.',
  keywords: ['Bearer '],
  priority: 130,
  sources: [detectSecretsSource, trufflehogSource],
  detect: ({ text }) =>
    collectMatches(text, /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi),
  replace: () => 'Bearer <redacted>',
}

const privateKeyBlockRule: PrivacyRule = {
  id: 'private-key-block',
  category: 'secret',
  defaultSeverity: 'block',
  description: 'Detect PEM-style private key blocks.',
  keywords: ['BEGIN PRIVATE KEY', 'BEGIN RSA PRIVATE KEY'],
  priority: 125,
  sources: [gitleaksSource, trufflehogSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    ),
  replace: () => '<redacted-private-key>',
}

const basicAuthUrlRule: PrivacyRule = {
  id: 'basic-auth-url',
  category: 'credential',
  defaultSeverity: 'block',
  description: 'Detect inline basic auth credentials embedded in URLs.',
  keywords: ['://'],
  priority: 120,
  sources: [detectSecretsSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /:\/\/[^:/?#\[\]@!$&'()*+,;=\s]+:[^:/?#\[\]@!$&'()*+,;=\s]+@/g,
    ),
  replace: () => '://<redacted-user>:<redacted-pass>@',
}

const quotedSecretAssignmentRule: PrivacyRule = {
  id: 'quoted-secret-assignment',
  category: 'secret',
  defaultSeverity: 'block',
  description: 'Detect quoted secret assignments with suspicious key names.',
  keywords: ['api_key', 'password', 'secret', 'token'],
  priority: 70,
  sources: [detectSecretsSource, gitleaksSource],
  detect: ({ text, options }) =>
    collectMatches(text, quotedSecretAssignmentPattern, match => {
      const value = match[4] ?? ''
      if (isPlaceholderValue(value, options.secretValueStopwords)) {
        return undefined
      }

      const start = (match.index ?? 0) + match[0].indexOf(value)
      return {
        start,
        end: start + value.length,
        text: value,
      }
    }),
  replace: () => '<redacted-secret>',
}

const envSecretAssignmentRule: PrivacyRule = {
  id: 'env-secret-assignment',
  category: 'secret',
  defaultSeverity: 'block',
  description: 'Detect env-style secret assignments with unquoted values.',
  keywords: ['API_KEY=', 'TOKEN=', 'SECRET=', 'PASSWORD='],
  priority: 75,
  sources: [detectSecretsSource, gitleaksSource],
  detect: ({ text, options }) =>
    collectMatches(text, envSecretAssignmentPattern, match => {
      const value = match[2] ?? ''
      if (isPlaceholderValue(value, options.secretValueStopwords)) {
        return undefined
      }

      const start = (match.index ?? 0) + match[0].lastIndexOf(value)
      return {
        start,
        end: start + value.length,
        text: value,
      }
    }),
  replace: () => '<redacted-secret>',
}

const homeDirectoryRule: PrivacyRule = {
  id: 'home-directory-path',
  category: 'filesystem',
  defaultSeverity: 'review',
  description: 'Detect user home directory paths on macOS, Linux, and Windows.',
  keywords: ['/Users/', '/home/', '\\Users\\'],
  priority: 90,
  sources: [secretlintSource],
  detect: ({ text, options }) => {
    const matches = collectMatches(
      text,
      /(?<![A-Za-z0-9._-])(?:\/Users\/[^/\s"'`<>:]+(?:\/[^\s"'`<>]*)?|\/home\/[^/\s"'`<>:]+(?:\/[^\s"'`<>]*)?|[A-Za-z]:\\Users\\[^\\\s"'`<>:]+(?:\\[^\s"'`<>]*)?)/g,
      match => {
        const matchedPath = match[0]
        const userNameMatch = matchedPath.match(
          /^\/Users\/([^/]+)|^\/home\/([^/]+)|^[A-Za-z]:\\Users\\([^\\]+)/,
        )
        const userName = userNameMatch?.slice(1).find(Boolean)

        if (!userName || isPlaceholderUser(userName)) {
          return undefined
        }

        return {
          start: match.index ?? 0,
          end: (match.index ?? 0) + matchedPath.length,
          text: matchedPath,
        }
      },
    )

    const ranges = new Set(matches.map(match => `${match.start}:${match.end}`))

    for (const homeDirectory of options.homeDirectories) {
      for (const match of collectMatches(text, buildExactHomeDirectoryPattern(homeDirectory))) {
        const key = `${match.start}:${match.end}`
        if (!ranges.has(key)) {
          ranges.add(key)
          matches.push(match)
        }
      }
    }

    return matches.sort((left, right) => left.start - right.start)
  },
  replace: match => replaceHomeDirectoryPrefix(match.text),
}

const privateUrlRule: PrivacyRule = {
  id: 'private-url',
  category: 'network',
  defaultSeverity: 'review',
  description: 'Detect local and private URLs that should not be shared publicly.',
  keywords: ['localhost', '.local', '.internal', '192.168.'],
  priority: 80,
  sources: [gitleaksSource],
  detect: ({ text, options }) => {
    const suffixSource = options.privateHostSuffixes
      .map(escapeForRegExp)
      .join('|')

    const pattern = new RegExp(
      `\\bhttps?:\\/\\/(?:localhost|127(?:\\.\\d{1,3}){3}|10(?:\\.\\d{1,3}){3}|192\\.168(?:\\.\\d{1,3}){2}|172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2}|(?:[A-Za-z0-9-]+\\.)+(?:${suffixSource}))(?:\\:\\d{2,5})?(?:\\/[^\\s"'\\x60<>)]*)?`,
      'gi',
    )

    return collectMatches(text, pattern)
  },
  replace: match => {
    const urlMatch = match.text.match(/^(https?):\/\/([^/:]+|\[[^\]]+\])(:\d{2,5})?(\/.*)?$/i)
    if (!urlMatch) {
      return '<redacted-private-url>'
    }

    const [, scheme, host, port = '', pathname = ''] = urlMatch
    const normalizedHost = host?.toLowerCase() ?? ''
    const hostLabel =
      normalizedHost === 'localhost'
        ? '<local-host>'
        : /^(?:127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i.test(normalizedHost)
          ? '<private-ip>'
          : '<private-host>'

    return `${scheme}://${hostLabel}${port}${pathname}`
  },
}

const emailRule: PrivacyRule = {
  id: 'email-address',
  category: 'pii',
  defaultSeverity: 'review',
  description: 'Detect email addresses in shared text.',
  keywords: ['@'],
  priority: 40,
  sources: [secretlintSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi,
      match => {
        const candidate = match[0]
        const domain = candidate.split('@')[1]?.toLowerCase()

        if (!domain || ['example.com', 'example.org', 'example.net', 'test.com'].includes(domain)) {
          return undefined
        }

        return {
          start: match.index ?? 0,
          end: (match.index ?? 0) + candidate.length,
          text: candidate,
        }
      },
    ),
  replace: () => '<redacted-email>',
}

const phoneRule: PrivacyRule = {
  id: 'phone-number',
  category: 'pii',
  defaultSeverity: 'review',
  description: 'Detect phone numbers with enough digits to be personally identifying.',
  keywords: ['+1', '('],
  priority: 40,
  sources: [secretlintSource],
  detect: ({ text }) =>
    collectMatches(
      text,
      /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?!\w)/g,
      match => {
        const candidate = match[0]
        const digits = candidate.replace(/\D/g, '')

        if (digits.length < 10 || digits.length > 15) {
          return undefined
        }

        if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(candidate)) {
          return undefined
        }

        return {
          start: match.index ?? 0,
          end: (match.index ?? 0) + candidate.length,
          text: candidate,
        }
      },
    ),
  replace: () => '<redacted-phone>',
}

export const publicShareRules: PrivacyRule[] = [
  bearerTokenRule,
  privateKeyBlockRule,
  basicAuthUrlRule,
  githubTokenRule,
  openAiTokenRule,
  anthropicTokenRule,
  envSecretAssignmentRule,
  quotedSecretAssignmentRule,
  homeDirectoryRule,
  privateUrlRule,
  emailRule,
  phoneRule,
]

export const getPublicShareRuleById = (ruleId: string) =>
  publicShareRules.find(rule => rule.id === ruleId)
