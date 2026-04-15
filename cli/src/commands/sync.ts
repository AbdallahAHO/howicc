import { select, input, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../lib/config.js';
import { ClaudeExtractor, TimelineExtractor } from '../lib/extractor.js';
import { HowIClaudeCodeClient } from '../lib/api-client.js';
import type { ClaudeConversation } from '../types/index.js';
import {
  formatProjectDisplayPath,
  formatRelativeTime,
} from '../lib/formatting.js';
import { safePrompt } from '../lib/prompt-handler.js';

interface SyncOptions {
  all?: boolean;
  recent?: number;
  select?: boolean;
  public?: boolean;
  visibility?: 'private' | 'unlisted' | 'public';
  yes?: boolean;
  tags?: string[];
}

export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  const config = new ConfigManager();

  // Check if configured
  if (!config.isConfigured()) {
    console.log(
      chalk.red(
        '\n❌ Not configured. Run ' + chalk.bold('howicc config') + ' first.\n'
      )
    );
    return;
  }

  const extractor = new ClaudeExtractor();

  // Check Claude directory
  const hasClaudeDir = await extractor.checkClaudeDirectory();
  if (!hasClaudeDir) {
    console.log(
      chalk.red(
        '\n❌ Claude directory not found at ~/.claude/projects/\n' +
          chalk.dim('Have you used Claude Code on this machine?')
      )
    );
    return;
  }

  // Find sessions (filtered: excludes single-message and untitled)
  const spinner = ora('Finding conversations...').start();
  const { sessions, totalFound, filtered } = await extractor.findFilteredSessions();
  const filteredInfo = filtered > 0
    ? chalk.dim(` (${filtered} filtered out)`)
    : '';
  spinner.succeed(`Found ${chalk.cyan(sessions.length)} conversations${filteredInfo}`);

  if (sessions.length === 0) {
    if (totalFound > 0) {
      console.log(
        chalk.yellow(
          `\nNo conversations to sync. ${totalFound} found but all were filtered out ` +
            chalk.dim('(single message or untitled)') +
            '\n'
        )
      );
    } else {
      console.log(chalk.yellow('\nNo conversations found.\n'));
    }
    return;
  }

  // Filter out already synced sessions if not forcing
  const unsyncedSessions = sessions.filter(
    (path) => !config.isSessionSynced(getSessionId(path))
  );

  if (unsyncedSessions.length === 0 && !options.all) {
    console.log(
      chalk.green(
        '\n✓ All conversations are already synced!\n' +
          chalk.dim(
            'Use --all to re-sync everything or sync new conversations.'
          )
      )
    );
    return;
  }

  // Determine which sessions to sync
  let toSync: string[] = [];

  if (options.all) {
    // Sync all sessions
    toSync = sessions;
  } else if (options.recent && options.recent > 0) {
    // Sync N most recent
    toSync = unsyncedSessions.slice(0, options.recent);
  } else if (options.select) {
    // Interactive selection
    toSync = await selectConversations(extractor, unsyncedSessions);
  } else {
    // Default: show menu
    const choice = await safePrompt(() =>
      select({
        message: 'What would you like to sync?',
        choices: [
          { name: 'All unsynced conversations', value: 'all' },
          { name: '5 most recent', value: 'recent-5' },
          { name: 'Select specific conversations', value: 'select' },
        ],
      })
    );

    if (choice === 'all') {
      toSync = unsyncedSessions;
    } else if (choice === 'recent-5') {
      toSync = unsyncedSessions.slice(0, 5);
    } else {
      toSync = await selectConversations(extractor, unsyncedSessions);
    }
  }

  if (toSync.length === 0) {
    console.log(chalk.dim('\nNo conversations selected.\n'));
    return;
  }

  // Confirm sync (skip if --yes flag is set)
  const shouldSync =
    options.yes ||
    (await safePrompt(() =>
      confirm({
        message: `Sync ${chalk.cyan(toSync.length)} conversation(s) to How I Claude Code?`,
        default: true,
      })
    ));

  if (!shouldSync) {
    console.log(chalk.dim('\nCancelled.\n'));
    return;
  }

  // Get sync options
  const visibilityChoice =
    options.visibility ||
    ((await safePrompt(() =>
      select({
        message: 'Visibility level?',
        choices: [
          { name: 'Private (owner only)', value: 'private' },
          { name: 'Unlisted (anyone with link)', value: 'unlisted' },
          { name: 'Public (discoverable)', value: 'public' },
        ],
        default: 'private',
      })
    )) as 'private' | 'unlisted' | 'public');

  const allowListing =
    visibilityChoice === 'public' &&
    (options.public ??
      (options.yes
        ? false
        : await safePrompt(() =>
            confirm({
              message: 'Allow listing on homepage/explore?',
              default: false,
            })
          )));

  const tagsInput = options.tags
    ? options.tags
    : options.yes
    ? []
    : await safePrompt(() =>
        input({
          message: 'Tags (comma-separated, optional):',
          default: '',
        })
      );
  const tags = Array.isArray(tagsInput)
    ? tagsInput
    : tagsInput.split(',').map((tag: string) => tag.trim()).filter(Boolean);

  // Perform sync
  await performSync(toSync, config, {
    visibility: visibilityChoice as 'private' | 'unlisted' | 'public',
    allowListing,
    tags,
  });
}

async function selectConversations(
  extractor: ClaudeExtractor,
  sessions: string[]
): Promise<string[]> {
  const spinner = ora('Loading conversation previews...').start();

  const MAX_CHOICES = 20;
  const limitedSessions = sessions.slice(0, MAX_CHOICES);

  const choices = await Promise.all(
    limitedSessions.map(async (path, index) => {
      try {
        const conv = await extractor.extractConversation(path);
        return {
          name: formatConversationChoice(conv),
          value: path,
          checked: false,
        };
      } catch {
        return {
          name: `${index + 1}. [Error loading conversation]`,
          value: path,
          checked: false,
        };
      }
    })
  );

  spinner.stop();

  if (choices.length === 0) {
    console.log(chalk.yellow('\nNo conversations available to select.\n'));
    return [];
  }

  if (sessions.length > MAX_CHOICES) {
    console.log(
      chalk.dim(
        `Showing the ${MAX_CHOICES} most recent unsynced conversations. Use --recent or --all for older sessions.\n`
      )
    );
  }

  return await safePrompt(() =>
    checkbox({
      message: 'Select conversations to sync:',
      choices,
      loop: false,
      pageSize: Math.min(choices.length, 10),
    })
  );
}

function formatConversationChoice(conv: ClaudeConversation): string {
  const truncatedTitle =
    conv.title.length > 80 ? `${conv.title.slice(0, 77)}...` : conv.title;
  const branchText = conv.gitBranch ? ` ${chalk.magenta(`(${conv.gitBranch})`)}` : '';
  const shortId =
    conv.sessionId.length > 8 ? `${conv.sessionId.slice(0, 8)}...` : conv.sessionId;
  const messageLabel = `${conv.messageCount} msg${conv.messageCount === 1 ? '' : 's'}`;
  const meta = `ID: ${shortId} │ ${messageLabel} │ ${formatRelativeTime(conv.modifiedAt)}`;
  const projectLabel = formatProjectDisplayPath(conv.projectName);

  return (
    `${chalk.bold(projectLabel)}${branchText}\n` +
    `  ${chalk.cyan(truncatedTitle)}\n` +
    `  ${chalk.dim(meta)}`
  );
}

async function performSync(
  sessions: string[],
  config: ConfigManager,
  options: {
    visibility: 'private' | 'unlisted' | 'public';
    allowListing: boolean;
    tags: string[];
  }
): Promise<void> {
  const client = new HowIClaudeCodeClient(config.getApiUrl(), config.getApiKey()!);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < sessions.length; i++) {
    const path = sessions[i];
    const sessionId = getSessionId(path);

    const spinner = ora(
      `[${i + 1}/${sessions.length}] Syncing ${sessionId.slice(0, 8)}...`
    ).start();

    try {
      // Extract conversation using timeline extractor
      const timelineExtractor = new TimelineExtractor(sessionId);
      const conversation = await timelineExtractor.extract();

      // Merge user-provided tags with existing tags
      const mergedTags = Array.from(new Set([
        ...(conversation.tags || []),
        ...options.tags,
      ]));

      // Upload to API
      const result = await client.uploadConversation(
        { ...conversation, tags: mergedTags },
        {
          visibility: options.visibility,
          allowListing: options.allowListing,
        }
      );

      if (result.success) {
        // Construct full URL from base URL and relative path
        const baseUrl = config.getApiUrl().replace(/\/$/, ''); // Remove trailing slash
        const fullUrl = result?.url?.startsWith('http')
          ? result.url
          : `${baseUrl}${result?.url?.startsWith('/') ? '' : '/'}${result?.url}`;

        // Create clickable link (ANSI escape code for hyperlinks - works in modern terminals)
        // Format: \u001b]8;;URL\u001b\\TEXT\u001b]8;;\u001b\\
        // Note: Styling is applied after the hyperlink escape codes
        const hyperlinkStart = `\u001b]8;;${fullUrl}\u001b\\`;
        const hyperlinkEnd = `\u001b]8;;\u001b\\`;
        const clickableLink = `${hyperlinkStart}${chalk.cyan.underline(fullUrl)}${hyperlinkEnd}`;

        const duplicateLabel = result.duplicate ? chalk.dim(' (duplicate)') : '';
        spinner.succeed(
          `[${i + 1}/${sessions.length}] ${chalk.green('✓')} ${sessionId.slice(0, 8)} → ${clickableLink}${duplicateLabel}`
        );

        // Mark as synced
        config.markSessionSynced(sessionId);
        successCount++;
      } else {
        spinner.fail(
          `[${i + 1}/${sessions.length}] ${chalk.red('✗')} ${sessionId.slice(0, 8)} - ${result.error}`
        );
        failCount++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error';

      // Log extraction errors separately from API errors
      if (errorMessage.includes('extract') || errorMessage.includes('parse') || errorMessage.includes('file')) {
        spinner.fail(
          `[${i + 1}/${sessions.length}] ${chalk.red('✗')} ${sessionId.slice(0, 8)} - Extraction failed: ${errorMessage}`
        );
      } else {
        spinner.fail(
          `[${i + 1}/${sessions.length}] ${chalk.red('✗')} ${sessionId.slice(0, 8)} - ${errorMessage}`
        );
      }
      failCount++;
    }
  }

  // Update last sync time
  if (successCount > 0) {
    config.updateLastSync();
  }

  // Summary
  console.log(chalk.bold('\n📊 Sync Summary:\n'));
  console.log(chalk.green(`✓ Success: ${successCount}`));
  if (failCount > 0) {
    console.log(chalk.red(`✗ Failed:  ${failCount}`));
  }
  console.log();
}

function getSessionId(path: string): string {
  return path.split('/').pop()?.replace('.jsonl', '') || 'unknown';
}
