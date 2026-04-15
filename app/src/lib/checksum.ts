import { createHash } from 'node:crypto';
import type { TimelineEvent } from '@howicc/schemas';

/**
 * Sorts object keys recursively for deterministic JSON stringification
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  return Object.keys(obj)
    .sort()
    .reduce((sorted, key) => {
      sorted[key] = sortObjectKeys(obj[key]);
      return sorted;
    }, {} as any);
}

/**
 * Calculate a deterministic SHA-256 checksum from timeline events.
 * Sorts all object keys before stringifying to ensure consistent hashing
 * regardless of JavaScript engine or serialization order.
 *
 * @param timeline - Array of timeline events
 * @returns SHA-256 checksum as hexadecimal string
 */
export function calculateDeterministicChecksum(timeline: TimelineEvent[]): string {
  const sortedTimeline = sortObjectKeys(timeline);
  const normalized = JSON.stringify(sortedTimeline);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
