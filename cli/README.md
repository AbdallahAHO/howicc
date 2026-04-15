# How I Claude Code CLI

> Share your Claude Code conversations to [howi.cc](https://howi.cc) - like Pastebin for AI chats

[![npm version](https://img.shields.io/npm/v/@howicc/cli.svg)](https://www.npmjs.com/package/@howicc/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 **One-command sync** - Upload conversations with a single command
- 🔍 **Smart detection** - Automatically finds all Claude Code conversations
- 🎯 **Selective sync** - Choose which conversations to share
- 🔒 **Privacy-first** - Control visibility: private, unlisted, or public
- 📊 **Progress tracking** - Never sync the same conversation twice
- 🏷️ **Tagging** - Organize conversations with custom tags
- ⚡ **Non-interactive mode** - Use `--yes` flag for automation

## Installation

### Using npx (Recommended)

No installation needed! Just run:

```bash
npx @howicc/cli config
npx @howicc/cli sync
```

### Global Installation

```bash
npm install -g @howicc/cli

# Or with pnpm
pnpm add -g @howicc/cli

# Or with yarn
yarn global add @howicc/cli
```

## Quick Start

### 1. Configure Your API Key

Get your API key from [howi.cc/settings](https://howi.cc/settings) and configure the CLI:

```bash
howicc config
```

You'll be prompted for:
- **API URL** (default: https://howi.cc)
- **API Key** (get from howi.cc)

### 2. List Your Conversations

See all your local Claude Code conversations:

```bash
howicc list
```

Output:
```
📚 Recent Conversations:

1. my-awesome-project
   Session: abc123de ✓ synced
   Date:    11/7/2024 3:45:23 PM
   Messages: 42
   Preview: "How do I implement authentication in Next.js?..."

2. typescript-helpers
   Session: def456gh not synced
   Date:    11/6/2024 10:22:15 AM
   Messages: 18
   Preview: "Can you help me write TypeScript utility types?..."
```

### 3. Sync Conversations

Upload your conversations to How I Claude Code:

```bash
# Interactive mode (recommended)
howicc sync

# Sync all conversations
howicc sync --all

# Sync 5 most recent
howicc sync --recent 5

# Make public with listing enabled and add tags
howicc sync --visibility public --public --tags "typescript,tutorial"

# Make unlisted (anyone with link can view)
howicc sync --visibility unlisted

# Private by default (owner only)
howicc sync --visibility private

# Non-interactive mode
howicc sync --recent 1 --visibility public --yes
```

### 4. Share Your Conversations

After syncing, you'll get shareable URLs like:

```
✓ abc123de → https://howi.cc/p/typescript-authentication-guide
✓ def456gh → https://howi.cc/p/utility-types-examples
```

## Commands

### `howicc config`

Configure API credentials.

```bash
howicc config
```

### `howicc config:show`

Display current configuration.

```bash
howicc config:show
```

Output:
```
📋 Current Configuration:

API URL:     https://howi.cc
API Key:     ••••xyz123
Last Sync:   11/7/2024, 3:45:23 PM
Synced:      12 conversations

Config file: ~/.config/howicc/config.json
```

### `howicc config:reset`

Reset all configuration.

```bash
howicc config:reset
```

### `howicc sync`

Sync conversations to How I Claude Code.

**Options:**

| Flag | Description |
|------|-------------|
| `-a, --all` | Sync all conversations (including already synced) |
| `-r, --recent <N>` | Sync N most recent conversations |
| `-s, --select` | Interactively select conversations |
| `-v, --visibility <level>` | Visibility: `private`, `unlisted`, or `public` |
| `-p, --public` | Allow listing on homepage/explore (requires `--visibility public`) |
| `-y, --yes` | Skip confirmation prompts (non-interactive mode) |
| `-t, --tags <tags>` | Comma-separated tags |

**Examples:**

```bash
# Interactive selection
howicc sync --select

# Sync 3 most recent, make public with listing
howicc sync --recent 3 --visibility public --public

# Sync all with tags (unlisted)
howicc sync --all --visibility unlisted --tags "tutorial,nextjs,typescript"

# Sync recent and tag (non-interactive)
howicc sync --recent 5 --visibility public --tags "debugging" --yes

# Private conversation (default)
howicc sync --recent 1 --visibility private
```

### `howicc list` (alias: `ls`)

List local conversations.

**Options:**

| Flag | Description |
|------|-------------|
| `-a, --all` | Show all conversations |
| `-l, --limit <N>` | Limit number shown (default: 10) |

**Examples:**

```bash
# Show 10 most recent
howicc list

# Show all
howicc list --all

# Show 20 most recent
howicc list --limit 20
```

## How It Works

### 1. Discovery

The CLI scans `~/.claude/projects/` for all JSONL conversation files.

### 2. Extraction

Each JSONL file is parsed to extract:
- User and assistant messages
- Timestamps
- Project context

### 3. Upload

Conversations are converted to markdown and uploaded to How I Claude Code via API:

```
┌─────────────────┐
│ Local JSONL     │
│ ~/.claude/      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract & Parse │
│ (TypeScript)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Upload to API   │
│ (howi.cc)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Analysis     │
│ Tags & Summary  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Public URL      │
│ /p/your-slug    │
└─────────────────┘
```

### 4. Tracking

Synced conversations are tracked locally to avoid duplicates:

```json
{
  "apiUrl": "https://howi.cc",
  "apiKey": "sk-...",
  "lastSync": "2024-11-07T15:45:23.000Z",
  "syncedSessions": ["abc123", "def456", "ghi789"]
}
```

## Configuration

### Config File Location

- **Linux/macOS**: `~/.config/howicc/config.json`
- **Windows**: `%APPDATA%\howicc\Config\config.json`

### Manual Configuration

You can edit the config file directly:

```json
{
  "apiUrl": "https://howi.cc",
  "apiKey": "your-api-key-here",
  "lastSync": "2024-11-07T15:45:23.000Z",
  "syncedSessions": []
}
```

## API Key

Get your API key from [howi.cc/settings](https://howi.cc/settings):

1. Sign up at howi.cc
2. Go to Settings → API Keys
3. Generate a new key
4. Copy and paste into `howicc config`

## Privacy

- **Private by default** - Conversations are private unless you set `--visibility public` or `--visibility unlisted`
- **Visibility levels**:
  - `private`: Only you can access
  - `unlisted`: Anyone with the link can view (not on homepage)
  - `public`: Discoverable on homepage/explore (requires `--public` for listing)
- **Local tracking** - Sync state is stored locally on your machine
- **No auto-sync** - You control what gets uploaded
- **Delete anytime** - Remove conversations from howi.cc at any time

## Troubleshooting

### "Claude directory not found"

Make sure you've used Claude Code at least once. The CLI looks for conversations at:

```
~/.claude/projects/
```

### "Not configured"

Run `howicc config` to set up your API key.

### "Connection failed"

Check:
1. Your API key is correct (`howicc config:show`)
2. You have internet connection
3. howi.cc is accessible

### "No conversations found"

Claude Code saves conversations as `.jsonl` files in `~/.claude/projects/`. Make sure you have some conversations saved.

## Development

### Setup

```bash
git clone https://github.com/AbdallahAHO/howicc.git
cd howicc/cli
pnpm install
```

### Build

```bash
pnpm build
```

### Test Locally

#### Link Globally for Testing

Link your local development version globally to test the latest build:

```bash
# Build the CLI first
pnpm build

# Link globally
pnpm link --global

# Now you can test it anywhere
howicc --version
howicc config
howicc list
howicc sync
```

With `pnpm dev` running in watch mode, changes will automatically rebuild and be available globally.

To unlink:
```bash
pnpm unlink --global
```

#### Alternative: Local Link

```bash
pnpm link
howicc --help
```

### Publish

```bash
pnpm prepublishOnly
npm publish
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

MIT © [Abdallah Othman](https://abdallahaho.com)

## Links

- **Website**: [howi.cc](https://howi.cc)
- **Documentation**: [howi.cc/docs](https://howi.cc/docs)
- **GitHub**: [github.com/AbdallahAHO/howicc](https://github.com/AbdallahAHO/howicc)
- **Issues**: [github.com/AbdallahAHO/howicc/issues](https://github.com/AbdallahAHO/howicc/issues)
- **Maintainer**: [Abdallah Othman](https://abdallahaho.com) ([@AbdallahAHO](https://github.com/AbdallahAHO)) - contact@abdallahaho.com

---

**Made with ❤️ for Claude Code users**
