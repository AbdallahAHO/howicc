import chalk from 'chalk';
import ora from 'ora';
import { ClaudeExtractor } from '../lib/extractor.js';
import { ConfigManager } from '../lib/config.js';
import type { ClaudeConversation } from '../types/index.js';
import {
  formatRelativeTime,
  formatProjectDisplayPath,
  truncateText,
} from '../lib/formatting.js';

const SECONDARY_INDENT = ' '.repeat(14);
const STATUS_LABEL_WIDTH = 9;

function getDivider(): string {
  const maxWidth = process.stdout.columns ?? 80;
  const width = Math.max(20, Math.min(80, maxWidth - 2));
  return chalk.dim('─'.repeat(width));
}

export async function listCommand(options: {
  all?: boolean;
  limit?: number;
}): Promise<void> {
  const extractor = new ClaudeExtractor();

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

  const spinner = ora('Loading conversations...').start();
  const { sessions, totalFound, filtered } = await extractor.findFilteredSessions();

  if (sessions.length === 0) {
    spinner.stop();
    if (totalFound > 0) {
      console.log(
        chalk.yellow(
          `\nNo conversations to show. ${totalFound} found but all were filtered out ` +
            chalk.dim('(single message or untitled)') +
            '\n'
        )
      );
    } else {
      console.log(chalk.yellow('\nNo conversations found.\n'));
    }
    return;
  }

  const limitInput = options.limit ?? 10;
  const resolvedLimit = options.all
    ? sessions.length
    : Math.min(Math.max(1, limitInput), sessions.length);
  const toShow = sessions.slice(0, resolvedLimit);

  const failedSessions: string[] = [];
  const conversations = (
    await Promise.all(
      toShow.map(async (path) => {
        try {
          return await extractor.extractMetadata(path);
        } catch (error) {
          failedSessions.push(path);
          return null;
        }
      })
    )
  ).filter((conv): conv is ClaudeConversation => Boolean(conv));

  spinner.stop();

  if (conversations.length === 0) {
    console.log(chalk.red('\nUnable to load any conversations.\n'));
    return;
  }

  const config = new ConfigManager();
  const conversationsByProject = new Map<string, ClaudeConversation[]>();

  for (const conv of conversations) {
    const projectConversations = conversationsByProject.get(conv.projectName) || [];
    projectConversations.push(conv);
    conversationsByProject.set(conv.projectName, projectConversations);
  }

  const filteredInfo = filtered > 0
    ? chalk.dim(` (${filtered} filtered out)`)
    : '';
  console.log(
    `\n📚 Found ${chalk.cyan(conversationsByProject.size)} projects with ${chalk.cyan(
      conversations.length
    )} conversations${filteredInfo}\n`
  );

  if (failedSessions.length > 0) {
    console.log(
      chalk.yellow(
        `⚠️ Skipped ${failedSessions.length} conversation${
          failedSessions.length === 1 ? '' : 's'
        } due to read errors.`
      )
    );
    console.log();
  }

  const divider = getDivider();
  let printedProjects = 0;

  for (const [projectName, convs] of conversationsByProject.entries()) {
    if (printedProjects > 0) {
      console.log();
    }

    const projectLabel = formatProjectDisplayPath(projectName);
    console.log(`${chalk.bold.yellow('Project:')} ${chalk.bold(projectLabel)}`);
    console.log(divider);

    for (const conv of convs) {
      const isSynced = config.isSessionSynced(conv.sessionId);
      const statusIcon = isSynced ? chalk.green('✓') : chalk.gray('•');
      const statusLabel = isSynced ? 'Synced' : 'Unsynced';
      const paddedStatus = statusLabel.padEnd(STATUS_LABEL_WIDTH, ' ');
      const coloredStatus = isSynced
        ? chalk.green(paddedStatus)
        : chalk.gray(paddedStatus);
      const shortId =
        conv.sessionId.length > 8
          ? `${conv.sessionId.slice(0, 8)}...`
          : conv.sessionId;
      const msgLabel = `${conv.messageCount} msg${conv.messageCount === 1 ? '' : 's'}`;
      const branchLabel = conv.gitBranch ? conv.gitBranch : undefined;
      const columns = process.stdout.columns ?? 80;
      const titleWidth = Math.max(24, columns - 32);
      const displayTitle = truncateText(conv.title, titleWidth);
      const metaParts = [`ID: ${shortId}`];
      if (branchLabel) {
        metaParts.push(chalk.magenta(branchLabel));
      }
      metaParts.push(msgLabel);
      metaParts.push(formatRelativeTime(conv.modifiedAt));
      const metaLineRaw = metaParts.join(' · ');
      const metaWidth = Math.max(20, columns - SECONDARY_INDENT.length - 4);

      console.log(`  ${statusIcon} ${coloredStatus} ${chalk.bold(displayTitle)}`);
      console.log(
        `${SECONDARY_INDENT}${chalk.dim(truncateText(metaLineRaw, metaWidth))}`
      );
      console.log();
    }

    printedProjects++;
  }

  if (sessions.length > resolvedLimit) {
    const remaining = sessions.length - resolvedLimit;
    const suggestedLimit = Math.min(sessions.length, resolvedLimit + 10);
    const hintLine =
      chalk.dim(`... and ${remaining} more conversations. Use '`) +
      chalk.white(`howicc list --limit ${suggestedLimit}`) +
      chalk.dim("' to see more.\n");
    console.log(hintLine);
  }
}
