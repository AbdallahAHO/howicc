import { AIAnalysisSchema, type AIAnalysis, type TimelineEvent } from '@howicc/schemas';

/**
 * Remove code blocks (content between ``` and ```) from text
 * Handles both with and without language identifiers
 * Example: ```typescript\ncode\n``` or ```\ncode\n```
 * Also cleans up extra whitespace left after removal
 */
function removeCodeBlocks(text: string): string {
  // Match code blocks with optional language identifier
  // Pattern: ```[language]\n...code...\n```
  // Replace with empty string and clean up resulting whitespace
  return text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with double newline
    .replace(/[ \t]+/g, ' ') // Normalize multiple spaces/tabs to single space
    .replace(/\n /g, '\n') // Remove spaces after newlines
    .replace(/ \n/g, '\n') // Remove spaces before newlines
    .trim();
}

/**
 * Convert timeline events to a simplified text representation for AI analysis
 * Only includes user messages and raw assistant text (no tools, no tool results, no thoughts)
 * Code blocks are removed to focus on conversation content rather than code snippets
 * This focuses the analysis on the actual conversation content rather than execution details
 */
function timelineToText(timeline: TimelineEvent[]): string {
  return timeline.map(event => {
    // Include user prompts (with code blocks removed)
    if (event.type === 'user_prompt') {
      const cleanedContent = removeCodeBlocks(event.content);
      if (cleanedContent) {
        return `User: ${cleanedContent}`;
      }
    }

    // Include only text blocks from assistant turns (exclude tool calls and thoughts)
    if (event.type === 'assistant_turn') {
      const textBlocks = event.content
        .filter(c => c.type === 'text_block')
        .map(c => (c as any).text)
        .join('\n')
        .trim();

      // Remove code blocks and only include if there's actual text content
      if (textBlocks) {
        const cleanedText = removeCodeBlocks(textBlocks);
        if (cleanedText) {
          return `Assistant: ${cleanedText}`;
        }
      }
    }

    // Skip tool_result events entirely
    // Skip parsing_error events
    // Skip any other event types

    return '';
  }).filter(Boolean).join('\n\n');
}

/**
 * Analyze a conversation using OpenRouter's Claude model
 */
export async function analyzeConversation(timeline: TimelineEvent[]): Promise<AIAnalysis> {
  const systemPrompt = `You are a precise archivist analyzing Claude Code conversation timelines.
Your task is to extract metadata that helps users understand and find conversations.

The conversation includes only user messages and assistant text responses (tool calls and results are excluded to focus on the core conversation).

Return ONLY valid JSON with this exact structure:
{
  "title": "A concise title (max 80 characters)",
  "summary": "A 3-6 sentence overview of the conversation's purpose and outcome",
  "takeaways": ["Key point 1", "Key point 2", ...],
  "generated_tags": ["tag1", "tag2", ...],
  "safety_flags": {
    "pii": false,
    "secrets": false
  }
}

Guidelines:
- title: Should be descriptive and searchable, reflecting what was accomplished
- summary: Focus on what was built, debugged, or discussed
- takeaways: 3-8 bullet points of key insights, solutions, or outcomes
- generated_tags: 5-12 relevant tags (lowercase, use hyphens for multi-word tags)
- safety_flags.pii: Set to true if email addresses, phone numbers, or personal info detected
- safety_flags.secrets: Set to true if API keys, tokens, passwords, or credentials detected`;

  const conversationText = timelineToText(timeline);
  const userPrompt = `Analyze this Claude Code conversation timeline and extract metadata:

<<<BEGIN_CONVERSATION>>>
${conversationText.slice(0, 50000)}
<<<END_CONVERSATION>>>

Return ONLY the JSON object, no additional text.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': import.meta.env.PUBLIC_SITE_URL,
        'X-Title': 'How I Claude Code',
      },
      body: JSON.stringify({
        // Use OPENROUTER_MODEL from .env, fallback to default if not set
        // See .env.example for configuration options
        model: import.meta.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';

    // Parse and validate the response
    const parsed = JSON.parse(text);
    const validated = AIAnalysisSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error('AI analysis failed:', error);

    // Return a basic fallback analysis
    return {
      title: 'Conversation',
      summary: 'Failed to analyze conversation content.',
      takeaways: [],
      generated_tags: ['unprocessed'],
      safety_flags: {
        pii: false,
        secrets: false,
      },
    };
  }
}

/**
 * Simple, fast regex-based safety checks for howi.cc
 * - Keep patterns lean to minimize false positives
 * - Do not do network calls or heavy parsing
 */
export type RedactionType =
  | "email"
  | "phone"
  | "ssn"
  | "uuid"
  | "dotenv_kv"
  | "password_kv"
  | "ssh_private_key"
  | "rsa_private_key"
  | "ec_private_key"
  | "pgp_private_key"
  | "openai_key"
  | "stripe_key"
  | "github_token"
  | "slack_token"
  | "google_api_key"
  | "aws_access_key_id"
  | "aws_secret_access_key"
  | "jwt"
  | "bearer_token"
  | "sendgrid_key"
  | "twilio_sid"
  | "twilio_auth_token"
  | "gcp_service_account_key";

/** PII patterns (lightweight) */
const PII_PATTERNS: Array<{ type: RedactionType; regex: RegExp }> = [
  // Email
  { type: "email", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // North American-ish phones: 123-456-7890, (123) 456-7890, 123.456.7890, 1234567890
  { type: "phone", regex: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g },
  // US SSN
  { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  // UUID (standard format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
  { type: "uuid", regex: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g },
];

/** Secret / credential patterns */
const SECRET_PATTERNS: Array<{ type: RedactionType; regex: RegExp }> = [
  // .env-style lines with obviously sensitive keys
  // e.g. OPENROUTER_API_KEY=..., SERVER_API_KEY=..., SECRET=..., TOKEN=..., PASSWORD=...
  {
    type: "dotenv_kv",
    regex:
      /^(?:export\s+)?(?:[A-Z0-9_]*?(?:SECRET|TOKEN|API[_-]?KEY|PASSWORD|PWD|PASS|PRIVATE_KEY))\s*[:=]\s*[^\s#'"]{8,}.*$/gim,
  },
  // Common "password in text" forms
  { type: "password_kv", regex: /(password|pwd|passwd)\s*[:=]\s*[^\s'"]{8,}/gi },
  // Private key blocks
  { type: "ssh_private_key", regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { type: "rsa_private_key", regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----/g },
  { type: "ec_private_key", regex: /-----BEGIN EC PRIVATE KEY-----/g },
  { type: "pgp_private_key", regex: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g },
  // OpenAI / Anthropic / generic sk- style keys
  { type: "openai_key", regex: /\bsk-[A-Za-z0-9]{16,}\b/g },
  // Stripe (live/test + publishable/secret)
  { type: "stripe_key", regex: /\b(?:sk_(?:live|test)|pk_(?:live|test))[A-Za-z0-9_]{16,}\b/g },
  // GitHub: classic + fine-grained tokens
  { type: "github_token", regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  // Slack tokens (bot/user/app/refresh/etc.)
  { type: "slack_token", regex: /\bxox(?:[abprs]|o[as])-[A-Za-z0-9-]{10,}\b/g },
  // Google API key
  { type: "google_api_key", regex: /\bAIza[0-9A-Za-z_\-]{35}\b/g },
  // AWS keys (pair these for higher confidence)
  { type: "aws_access_key_id", regex: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA)[A-Z0-9]{16}\b/g },
  {
    type: "aws_secret_access_key",
    // 40 base64-ish chars; prefer labeled occurrences to cut false positives
    regex:
      /\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*[A-Za-z0-9/+=]{40}\b/g,
  },
  // JWTs (three base64url segments)
  { type: "jwt", regex: /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g },
  // Bearer tokens (generic)
  { type: "bearer_token", regex: /\bbearer\s+[A-Za-z0-9_\-\.=]{20,}\b/gi },
  // SendGrid
  { type: "sendgrid_key", regex: /\bSG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{30,}\b/g },
  // Twilio
  { type: "twilio_sid", regex: /\bAC[0-9a-fA-F]{32}\b/g },
  { type: "twilio_auth_token", regex: /\b[0-9a-fA-F]{32}\b/g },
  // GCP service account JSON (private key field)
  {
    type: "gcp_service_account_key",
    regex: /"private_key"\s*:\s*"-----BEGIN PRIVATE KEY-----/g,
  },
];

/**
 * Original boolean flags API (non-breaking)
 */
export function performSafetyCheck(content: string): {
  pii: boolean;
  secrets: boolean;
} {
  const hasPII = PII_PATTERNS.some(({ regex }) =>
    new RegExp(regex.source, regex.flags.replace("g", "")).test(content)
  );

  const hasSecrets = SECRET_PATTERNS.some(({ regex }) =>
    new RegExp(regex.source, regex.flags.replace("g", "")).test(content)
  );

  return { pii: hasPII, secrets: hasSecrets };
}

/**
 * Optional: collect counts per redaction type for your `flags.redactions[]`.
 * Keeps things fast by using /g matches only.
 */
export function collectRedactionStats(content: string): {
  pii: boolean;
  secrets: boolean;
  redactions: { type: RedactionType; count: number }[];
} {
  const counts = new Map<RedactionType, number>();

  const bump = (t: RedactionType, n: number) =>
    counts.set(t, (counts.get(t) ?? 0) + n);

  for (const { type, regex } of [...PII_PATTERNS, ...SECRET_PATTERNS]) {
    let count = 0;
    // reset lastIndex for safety if regex is reused
    regex.lastIndex = 0;
    for (const _ of content.matchAll(regex)) count++;
    if (count > 0) bump(type, count);
  }

  const pii = PII_PATTERNS.some(({ type }) => (counts.get(type) ?? 0) > 0);
  const secrets = SECRET_PATTERNS.some(({ type }) => (counts.get(type) ?? 0) > 0);

  return {
    pii,
    secrets,
    redactions: Array.from(counts.entries()).map(([type, count]) => ({ type, count })),
  };
}

/**
 * Parse markdown content into structured messages
 * Simple parser for Claude conversation format
 */
export function parseMarkdownToMessages(markdown: string): Array<{
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}> {
  const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

  // Split by common delimiters
  const sections = markdown.split(/(?=^##?\s)/m);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Detect speaker from headers
    if (/^##?\s*👤\s*(user|human)/i.test(trimmed)) {
      const content = trimmed.replace(/^##?\s*👤\s*(user|human)\s*/i, '').trim();
      if (content) {
        messages.push({ role: 'user', content });
      }
    } else if (/^##?\s*🤖\s*(claude|assistant)/i.test(trimmed)) {
      const content = trimmed.replace(/^##?\s*🤖\s*(claude|assistant)\s*/i, '').trim();
      if (content) {
        messages.push({ role: 'assistant', content });
      }
    } else if (/^##?\s*ℹ️\s*system/i.test(trimmed)) {
      const content = trimmed.replace(/^##?\s*ℹ️\s*system\s*/i, '').trim();
      if (content) {
        messages.push({ role: 'system', content });
      }
    }
  }

  // Fallback: if no structured messages found, treat entire content as one message
  if (messages.length === 0 && markdown.trim()) {
    messages.push({
      role: 'user',
      content: markdown.trim(),
    });
  }

  return messages;
}
