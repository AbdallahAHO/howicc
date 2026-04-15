import { homedir } from 'node:os';
import { normalizeProjectPath } from './path-utils.js';

const HOME_DIR = homedir();

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return diffSeconds === 1 ? '1 second ago' : `${diffSeconds} seconds ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }

  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function formatProjectDisplayPath(
  path: string,
  options: { maxHead?: number; maxTail?: number } = {}
): string {
  if (!path || path === 'Unknown Project') {
    return 'Unknown Project';
  }

  let normalized = normalizeProjectPath(path)
    .replace(/\\/g, '/')
    .replace(/\/\/+/g, '/');

  if (HOME_DIR && normalized.startsWith(HOME_DIR)) {
    normalized = `~${normalized.slice(HOME_DIR.length)}`;
  }

  if (normalized.startsWith('~') && !normalized.startsWith('~/')) {
    normalized = normalized === '~' ? '~' : normalized.replace(/^~/, '~/');
  }

  const segments = splitPath(normalized);
  const maxHead = options.maxHead ?? 2;
  const maxTail = options.maxTail ?? 2;

  if (segments.length <= maxHead + maxTail) {
    return joinSegments(segments);
  }

  const head = segments.slice(0, maxHead);
  const tail = segments.slice(-maxTail);

  return joinSegments([...head, '...', ...tail]);
}

export function truncateText(
  text: string,
  maxLength: number,
  ellipsis = '…'
): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  if (maxLength <= ellipsis.length) {
    return ellipsis.slice(0, maxLength);
  }

  return text.slice(0, maxLength - ellipsis.length).trimEnd() + ellipsis;
}

function splitPath(path: string): string[] {
  if (!path) return [];

  if (path === '~') {
    return ['~'];
  }

  let marker = '';
  let rest = path;

  if (path.startsWith('~/')) {
    marker = '~';
    rest = path.slice(2);
  } else if (path.startsWith('~')) {
    marker = '~';
    rest = path.slice(1);
  } else if (path.startsWith('/')) {
    marker = '/';
    rest = path.slice(1);
  }

  const parts = rest
    ? rest.split('/').filter((segment) => segment.length > 0)
    : [];

  return marker ? [marker, ...parts] : parts;
}

function joinSegments(segments: string[]): string {
  if (segments.length === 0) {
    return '';
  }

  if (segments[0] === '~') {
    if (segments.length === 1) {
      return '~';
    }
    return `~/${segments.slice(1).join('/')}`;
  }

  if (segments[0] === '/') {
    const remainder = segments.slice(1).join('/');
    return remainder ? `/${remainder}` : '/';
  }

  return segments.join('/');
}
