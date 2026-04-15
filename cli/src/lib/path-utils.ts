import { normalize } from 'node:path';

export function decodeProjectFolderName(folderName: string): string {
  if (!folderName) {
    return 'Unknown Project';
  }

  let normalized = folderName.trim();

  if (normalized.startsWith('-')) {
    normalized = normalized.slice(1);
  }

  normalized = normalized.replace(/--/g, '/').replace(/-/g, '/');

  if (
    normalized &&
    !normalized.startsWith('/') &&
    !normalized.startsWith('~')
  ) {
    normalized = `/${normalized}`;
  }

  return normalized || 'Unknown Project';
}

export function normalizeProjectPath(rawPath: string): string {
  if (!rawPath) {
    return '';
  }

  const trimmed = rawPath.trim();
  const encodedMatch = trimmed.match(/\.claude\/projects\/(-[^/]+)/);

  if (encodedMatch) {
    return decodeProjectFolderName(encodedMatch[1]);
  }

  return normalize(trimmed);
}
