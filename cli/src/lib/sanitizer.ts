/**
 * Data cleaning heuristics ported from claude_code_log/utils.py
 * Aggressively removes internal Claude protocol tags and system noise
 */

// Regex patterns for noise removal
const SYSTEM_PATTERNS = [
  /^Caveat: The messages below were generated/,
  /^\[Request interrupted by user for tool use\]/,
  /^<local-command-stdout>/,
];

const XML_TAG_REMOVERS = [
  // Unwrap bash inputs to show just the command
  { regex: /<bash-input>(.*?)<\/bash-input>/gs, replace: '$1' },
  // Remove command wrapper tags
  { regex: /<command-name>.*?<\/command-name>/g, replace: '' },
  { regex: /<command-message>.*?<\/command-message>/g, replace: '' },
  { regex: /<command-contents>.*?<\/command-contents>/g, replace: '' },
  // Remove bash output markers
  { regex: /<\/?bash-stdout>/g, replace: '' },
  { regex: /<\/?bash-stderr>/g, replace: '' },
];

/**
 * Check if text is a system message that should be filtered out
 */
export function isSystemMessage(text: string): boolean {
  if (!text) return false;
  return SYSTEM_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Clean content by removing XML tags and protocol noise
 */
export function cleanContent(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Apply XML strippers
  for (const rule of XML_TAG_REMOVERS) {
    cleaned = cleaned.replace(rule.regex, rule.replace);
  }

  // Handle the specific Init command prettification
  if (text.includes('<command-name>init')) {
    return "Claude Initializes Codebase Documentation Guide (/init command)";
  }

  return cleaned.trim();
}

/**
 * Clean tool output by removing local command stdout tags
 */
export function cleanToolOutput(text: string): string {
  // Remove the specific local command stdout tag often found in tool results
  return text.replace(/^<local-command-stdout>\s*/, '');
}
