#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { configCommand, showConfig, resetConfig } from './commands/config.js';
import { syncCommand } from './commands/sync.js';
import { listCommand } from './commands/list.js';
import { extractCommand } from './commands/extract.js';

const program = new Command();

program
  .name('howicc')
  .description('Share your Claude Code conversations to howi.cc')
  .version('1.0.0');

// Config command
program
  .command('config')
  .description('Configure API credentials')
  .action(async () => {
    await configCommand();
  });

// Show config
program
  .command('config:show')
  .description('Show current configuration')
  .action(async () => {
    await showConfig();
  });

// Reset config
program
  .command('config:reset')
  .description('Reset configuration')
  .action(async () => {
    await resetConfig();
  });

// Sync command
program
  .command('sync')
  .description('Sync conversations to How I Claude Code')
  .option('-a, --all', 'Sync all conversations')
  .option('-r, --recent <number>', 'Sync N most recent conversations', parseInt)
  .option('-s, --select', 'Select specific conversations')
  .option('-p, --public', 'Make conversations public')
  .option('-v, --visibility <visibility>', 'Visibility level: private, unlisted, or public')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('-t, --tags <tags>', 'Comma-separated tags')
  .action(async (options) => {
    const tags = options.tags
      ? options.tags.split(',').map((t: string) => t.trim())
      : undefined;
    await syncCommand({ ...options, tags });
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('List local conversations')
  .option('-a, --all', 'Show all conversations')
  .option('-l, --limit <number>', 'Limit number of conversations', parseInt)
  .action(async (options) => {
    await listCommand(options);
  });

// Extract command
program
  .command('extract <session-id>')
  .description('Extract a conversation as structured JSON')
  .option('--logs-dir <path>', 'Custom path to Claude logs directory')
  .action(async (sessionId, options) => {
    await extractCommand(sessionId, options);
  });

// Default action (show help)
program.action(() => {
  console.log(
    chalk.bold.cyan('\n🌐 How I Claude Code - Share Your Claude Conversations\n')
  );
  console.log(chalk.dim('Quick start:\n'));
  console.log('  1. ' + chalk.white('howicc config') + '  - Set up your API key');
  console.log('  2. ' + chalk.white('howicc list') + '    - See your conversations');
  console.log('  3. ' + chalk.white('howicc sync') + '    - Upload to howi.cc\n');
  console.log(chalk.dim('Need help? Visit https://howi.cc/docs\n'));
  program.help();
});

// Parse arguments
program.parse();
