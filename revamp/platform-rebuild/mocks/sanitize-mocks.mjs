#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = process.argv[2] ?? 'revamp/platform-rebuild/mocks/api-responses';

const replacements = [
  [/abdallah\.ali\.hassan@gmail\.com/g, 'user@example.com'],
  [/qGPddmRuAI9nwp8T2t0Uy7yTvjkOzR0c/g, 'user_demo_01'],
  [/\/private\/tmp\/claude-\d+/g, '/tmp/claude'],
  [/\/Users\/abdallah\/Developer\/personal\/howicc/g, '/workspace/howicc'],
  [/\/Users\/abdallah\/\.superset/g, '/workspace/.superset'],
  [/\/Users\/abdallah\/\.claude/g, '~/.claude'],
  [/\/Users\/abdallah/g, '/home/demo'],
  [/-Users-abdallah-Developer-personal-howicc/g, '-workspace-howicc'],
  [/-Users-abdallah--superset/g, '-workspace-superset'],
  [/-Users-abdallah/g, '-home-demo'],
  [/hwi_2f8c/g, 'hwi_demo'],
  [/hwi_8b2d/g, 'hwi_prev'],
];

const walk = (dir) => {
  const entries = readdirSync(dir);

  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    return stats.isDirectory() ? walk(fullPath) : [fullPath];
  });
};

for (const filePath of walk(rootDir)) {
  if (!filePath.endsWith('.json')) {
    continue;
  }

  const original = readFileSync(filePath, 'utf8');
  const sanitized = replacements.reduce(
    (content, [pattern, replacement]) => content.replace(pattern, replacement),
    original,
  );

  if (sanitized !== original) {
    writeFileSync(filePath, sanitized);
  }
}
