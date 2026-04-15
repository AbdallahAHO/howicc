#!/usr/bin/env node

/**
 * CI script to check for secrets in client bundle
 * Scans built client artifacts for environment variables containing TOKEN, KEY, or SECRET
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLIENT_DIST_DIR = join(__dirname, '..', 'dist', 'client');
const SECRET_PATTERNS = [
  /TOKEN/i,
  /KEY/i,
  /SECRET/i,
  /PASSWORD/i,
  /API_KEY/i,
  /AUTH_TOKEN/i,
  /PRIVATE_KEY/i,
];

const EXCLUDED_PATTERNS = [
  /node_modules/,
  /\.map$/,
  /\.json$/,
];

/**
 * Check if a file should be excluded from scanning
 */
function shouldExclude(filePath: string): boolean {
  return EXCLUDED_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Scan a file for secrets
 */
async function scanFile(filePath: string): Promise<string[]> {
  const content = await readFile(filePath, 'utf-8');
  const found: string[] = [];

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      // Extract context around the match
      const matches = content.match(new RegExp(`.{0,50}${pattern.source}.{0,50}`, 'gi'));
      if (matches) {
        found.push(...matches.slice(0, 3)); // Limit to 3 matches per pattern
      }
    }
  }

  return found;
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(dir: string): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subResults = await scanDirectory(fullPath);
        for (const [path, secrets] of subResults.entries()) {
          results.set(path, secrets);
        }
      } else if (entry.isFile()) {
        const secrets = await scanFile(fullPath);
        if (secrets.length > 0) {
          results.set(fullPath, secrets);
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning client bundle for secrets...\n');

  const results = await scanDirectory(CLIENT_DIST_DIR);

  if (results.size === 0) {
    console.log('✅ No secrets found in client bundle');
    process.exit(0);
  }

  console.error('❌ Secrets found in client bundle:\n');

  for (const [filePath, secrets] of results.entries()) {
    console.error(`File: ${filePath}`);
    console.error('Matches:');
    for (const secret of secrets) {
      console.error(`  - ${secret.substring(0, 100)}...`);
    }
    console.error('');
  }

  console.error('⚠️  Error: Secrets should not be exposed in client bundle!');
  console.error('   Only variables prefixed with PUBLIC_* should be exposed.');
  process.exit(1);
}

main().catch((error) => {
  console.error('Error scanning for secrets:', error);
  process.exit(1);
});
