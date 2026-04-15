import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { ConfigManager } from '../lib/config.js';
import { HowIClaudeCodeClient } from '../lib/api-client.js';
import { safePrompt } from '../lib/prompt-handler.js';

export async function configCommand(): Promise<void> {
  const config = new ConfigManager();

  console.log(chalk.bold('\n🔧 HowiCC Configuration\n'));

  // Get current config
  const currentConfig = config.getAll();

  // API URL
  const apiUrl = await safePrompt(() =>
    input({
      message: 'API URL:',
      default: currentConfig.apiUrl || 'https://howi.cc',
    })
  );

  config.setApiUrl(apiUrl);

  // API Key
  const apiKey = await safePrompt(() =>
    input({
      message: 'API Key:',
      default: currentConfig.apiKey || '',
      validate: (value) => {
        if (!value || value.length < 10) {
          return 'Please enter a valid API key';
        }
        return true;
      },
    })
  );

  config.setApiKey(apiKey);

  // Test connection
  console.log(chalk.dim('\nTesting connection...'));

  const client = new HowIClaudeCodeClient(apiUrl, apiKey);
  const connected = await client.testConnection();

  if (connected) {
    console.log(chalk.green('✓ Connection successful!\n'));
    console.log(chalk.dim(`Config saved to: ${config.getPath()}`));
  } else {
    console.log(
      chalk.yellow('⚠ Could not connect to API. Config saved anyway.\n')
    );
    console.log(chalk.dim('Make sure your API key is correct and try again.'));
  }
}

export async function showConfig(): Promise<void> {
  const config = new ConfigManager();
  const cfg = config.getAll();

  console.log(chalk.bold('\n📋 Current Configuration:\n'));
  console.log(chalk.dim('API URL:     ') + cfg.apiUrl);
  console.log(
    chalk.dim('API Key:     ') +
      (cfg.apiKey ? '••••' + cfg.apiKey.slice(-4) : chalk.red('Not set'))
  );
  console.log(
    chalk.dim('Last Sync:   ') +
      (cfg.lastSync
        ? new Date(cfg.lastSync).toLocaleString()
        : chalk.dim('Never'))
  );
  console.log(
    chalk.dim('Synced:      ') +
      chalk.cyan(cfg.syncedSessions?.length || 0) +
      ' conversations'
  );
  console.log(chalk.dim('\nConfig file: ') + config.getPath());
  console.log();
}

export async function resetConfig(): Promise<void> {
  const config = new ConfigManager();

  const confirmed = await safePrompt(() =>
    confirm({
      message: 'Are you sure you want to reset all configuration?',
      default: false,
    })
  );

  if (confirmed) {
    config.clear();
    console.log(chalk.green('\n✓ Configuration reset\n'));
  } else {
    console.log(chalk.dim('\nCancelled\n'));
  }
}
