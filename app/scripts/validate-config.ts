#!/usr/bin/env node

/**
 * Config validation script
 * Checks configuration at boot time for security issues
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
let env: Record<string, string> = {};

try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !match[1].startsWith('#')) {
      env[match[1].trim()] = match[2].trim();
    }
  });
} catch (error) {
  // .env file might not exist in production
}

/**
 * Check if URL is public (not localhost/internal)
 */
function isPublicURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost/internal addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate OpenRouter model format
 * Models should be in format: provider/model-name
 * Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo
 */
function isValidModelFormat(model: string): boolean {
  // Check if it matches provider/model-name pattern
  // Provider: lowercase letters, numbers, hyphens
  // Model: lowercase letters, numbers, hyphens, dots, underscores
  const modelPattern = /^[a-z0-9-]+\/[a-z0-9._-]+$/;
  return modelPattern.test(model);
}

/**
 * Validate configuration
 */
function validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  const requiredVars = [
    'PB_URL',
    'PB_ADMIN_EMAIL',
    'PB_ADMIN_PASSWORD',
    'SERVER_API_KEY',
    'OPENROUTER_API_KEY',
    'PUBLIC_SITE_URL',
  ];

  for (const varName of requiredVars) {
    const value = env[varName] || process.env[varName];
    if (!value || value.trim() === '') {
      errors.push(`❌ ${varName} is required but not set or empty`);
    }
  }

  // Check PB_URL is not public
  const pbUrl = env.PB_URL || process.env.PB_URL;
  if (pbUrl && isPublicURL(pbUrl)) {
    errors.push(
      `⚠️  PB_URL appears to be public (${pbUrl}). PocketBase should only be accessible via internal network.`
    );
  }

  // Validate OPENROUTER_MODEL if set
  const openRouterModel = env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL;
  if (openRouterModel) {
    if (!isValidModelFormat(openRouterModel)) {
      warnings.push(
        `⚠️  OPENROUTER_MODEL format may be invalid: "${openRouterModel}". Expected format: provider/model-name (e.g., anthropic/claude-3.5-sonnet)`
      );
    }
  } else {
    warnings.push(
      'ℹ️  OPENROUTER_MODEL not set. Will use default: anthropic/claude-3.5-sonnet'
    );
  }

  // Check CORS origin is not wildcard in production
  const corsOrigin = env.CORS_ORIGIN || process.env.CORS_ORIGIN;
  if (corsOrigin === '*' && (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production')) {
    errors.push(
      '⚠️  CORS_ORIGIN is set to "*" in production. Use exact origin instead.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Main function
 */
function main() {
  const result = validateConfig();

  // Show warnings first (non-blocking)
  if (result.warnings.length > 0) {
    console.log('ℹ️  Configuration warnings:\n');
    for (const warning of result.warnings) {
      console.log(warning);
    }
    console.log();
  }

  if (result.valid) {
    console.log('✅ Configuration validation passed');
    process.exit(0);
  } else {
    console.error('❌ Configuration validation failed:\n');
    for (const error of result.errors) {
      console.error(error);
    }
    console.error('\n⚠️  Please fix these issues before deploying.');
    process.exit(1);
  }
}

main();
