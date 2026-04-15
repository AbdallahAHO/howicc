import { beforeAll } from 'vitest';

// Configure test timeout for integration tests with large files
beforeAll(() => {
  // Increase timeout for tests that process large JSONL files
  // Default is 5000ms, we set to 30000ms for integration tests
});

// Custom snapshot serializer for deterministic output
export const snapshotSerializers = {
  // Remove absolute paths from snapshots
  test: (val: any) => typeof val === 'string' && val.includes('/Users/'),
  print: (val: string) => {
    return `"${val.replace(/\/Users\/[^/]+\//, '/Users/<user>/')}"`;
  },
};
