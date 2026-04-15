# How I Claude Code (howicc)

> **Share your Claude Code conversations - like Pastebin for AI chats**

🌐 **Website**: [howi.cc](https://howi.cc)
📦 **CLI**: [@howicc/cli](./cli)
⚡ **App**: [@howicc/app](./app)

---

## What is How I Claude Code?

How I Claude Code (howicc) is an open-source platform that transforms your local Claude Code conversations into beautiful, shareable links with AI-powered summaries and tags. Think of it as Pastebin, but specifically designed for sharing AI chat conversations.

### ✨ Key Features

- 🚀 **One-command sync** - Upload conversations with `npx @howicc/cli sync`
- 🤖 **AI-powered analysis** - Automatic summaries, takeaways, and tags
- 🔒 **Privacy-first** - PII/secret detection, private by default
- 👥 **User Accounts** - Registration, login, and API key management
- 🔐 **Visibility Controls** - Private, unlisted, or public conversations
- 📊 **View Tracking** - Privacy-preserving view counts and read reports
- 🏆 **Public Discovery** - Trending conversations and leaderboards
- 🎨 **Beautiful UI** - Syntax highlighting and responsive design
- 🛠️ **Self-hostable** - Run on your own infrastructure

---

## Quick Start

### 1. Share Your First Conversation

```bash
# Configure your API key
npx @howicc/cli config

# View your local conversations
npx @howicc/cli list

# Upload to howicc
npx @howicc/cli sync

# With visibility options
npx @howicc/cli sync --visibility public --public
npx @howicc/cli sync --visibility unlisted
npx @howicc/cli sync --visibility private
```

### 2. Get a Shareable Link

After syncing, you'll get a URL like:

```
https://howi.cc/p/your-conversation-slug
```

That's it! Your conversation is now beautifully formatted with AI-generated summaries, tags, and syntax highlighting.

---

## Architecture

This monorepo contains two main packages:

### 📦 [CLI](./cli)
TypeScript command-line tool that:
- Scans `~/.claude/projects/` for conversations
- Extracts and parses JSONL files
- Uploads to the How I Claude Code API
- Tracks sync state locally

**Tech Stack**: TypeScript, Commander, Inquirer, tsup

### ⚡ [App](./app)
Astro SSR application that:
- Serves the public website and conversation pages
- Provides REST API for uploads
- Performs AI analysis with Claude 3.5 Sonnet
- Stores data in PocketBase

**Tech Stack**: Astro, PocketBase, Tailwind v4, Zod

---

## Installation

### For Users

Just use the CLI with npx (no installation required):

```bash
npx @howicc/cli config
npx @howicc/cli sync
```

Or install globally:

```bash
npm install -g @howicc/cli
```

### For Developers

Clone and setup:

```bash
git clone https://github.com/AbdallahAHO/howicc.git
cd howicc

# Install all dependencies (root, CLI, and App)
pnpm install:all

# Or install individually
pnpm install           # Root (for scripts & e2e testing)
cd cli && pnpm install
cd ../app && pnpm install
```

---

## Development

### Quick Start (Recommended)

From the root directory, run everything at once:

```bash
# Run Astro + CLI (all in watch mode)
pnpm dev
```

This uses `concurrently` to run both services with color-coded output:
- 🟣 **Astro** - Magenta
- 🟢 **CLI** - Green

> **Note**: PocketBase runs in a separate environment and connects via env variables.

### Individual Development

**CLI Development**:
```bash
pnpm dev:cli      # Watch mode from root
# or
cd cli && pnpm dev
pnpm build:cli    # Build from root
pnpm cli:start    # Build and run from root
```

**Link CLI Globally for Testing**:
```bash
# Build first
cd cli && pnpm build

# Link globally
pnpm link --global

# Test anywhere
howicc --version
howicc config
howicc sync

# With pnpm dev running, changes auto-rebuild globally
# To unlink: pnpm unlink --global
```

**App Development**:
```bash
pnpm dev:app      # Start Astro from root
# or
cd app && pnpm dev
pnpm build:app    # Build from root
pnpm preview      # Preview production build
```

### Testing

```bash
# Run all tests (app + CLI)
pnpm test

# Run specific test suites
pnpm test:app     # Vitest tests in app
pnpm test:cli     # Vitest tests in CLI
pnpm test:e2e     # Playwright E2E tests
pnpm test:e2e:ui  # Playwright with UI
```

### Type Checking

```bash
# Check all TypeScript code
pnpm type-check

# Check specific packages
pnpm type-check:app
pnpm type-check:cli
```

### Build

```bash
# Build everything
pnpm build

# Build specific packages
pnpm build:app
pnpm build:cli
```

### Utilities

```bash
pnpm check-secrets      # Check for secrets in code
pnpm validate-config    # Validate config files
pnpm install:all        # Install all dependencies
```

---

## Project Structure

```
howicc/
├── app/                      # Astro web application
│   ├── src/
│   │   ├── components/       # Astro components
│   │   ├── layouts/          # Page layouts
│   │   ├── lib/              # Core libraries
│   │   │   ├── ai-analysis.ts   # AI processing
│   │   │   ├── pb.ts            # PocketBase client
│   │   │   ├── process.ts       # Background queue
│   │   │   └── schemas.ts       # Zod schemas
│   │   ├── pages/
│   │   │   ├── api/             # API endpoints
│   │   │   ├── p/[slug].astro   # Public pages
│   │   │   └── index.astro      # Homepage
│   │   └── tests/            # Vitest tests
│   ├── pocketbase-schema.json
│   ├── package.json
│   └── README.md
├── cli/                      # TypeScript CLI tool
│   ├── src/
│   │   ├── commands/         # CLI commands
│   │   ├── lib/              # Core libraries
│   │   │   ├── extractor.ts     # JSONL parser
│   │   │   ├── api-client.ts    # API client
│   │   │   └── config.ts        # Config manager
│   │   ├── types/            # TypeScript types
│   │   └── index.ts          # Entry point
│   ├── package.json
│   └── README.md
├── e2e/                      # Playwright E2E tests
│   ├── page-objects/         # Page object models
│   ├── api-helpers.ts        # API test utilities
│   └── *.spec.ts             # Test files
├── package.json              # Root package with unified scripts
├── playwright.config.ts      # Playwright configuration
├── README.md                 # This file
└── LICENSE
```

---

## How It Works

```
┌─────────────────────────────────────────────────┐
│                    USER                         │
└────────────┬────────────────────────────────────┘
             │
             ▼
    ┌─────────────────┐
    │   howicc sync   │  (CLI)
    └────────┬────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  Scan ~/.claude/projects/**/*.jsonl             │
│  Extract conversations from JSONL               │
│  Convert to markdown                            │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  POST /api/conversations                        │
│  Upload file + metadata to PocketBase           │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Background Processing (Astro)                  │
│  ├─ Parse markdown to messages                  │
│  ├─ Call OpenRouter (Claude 3.5 Sonnet)         │
│  ├─ Generate summary, takeaways, tags           │
│  ├─ Detect PII/secrets                          │
│  └─ Update PocketBase record                    │
└────────┬────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Public URL: https://howi.cc/p/your-slug        │
│  ├─ AI-generated summary & takeaways            │
│  ├─ Automatic tags                              │
│  ├─ Syntax highlighted code                     │
│  └─ Beautiful, responsive design                │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **CLI** | TypeScript, Commander, Inquirer, tsup |
| **Frontend** | Astro v5, Tailwind CSS v4 |
| **Backend** | PocketBase (SQLite) |
| **AI** | OpenRouter (Claude 3.5 Sonnet) |
| **Validation** | Zod |
| **Testing** | Vitest |

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./app/CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---

## Deployment

### Deploy the App

The Astro app can be deployed to:

- **VPS** (Recommended for self-hosting)
- **Vercel/Netlify** (with SSR adapter)
- **Cloudflare Pages**
- **Docker** (add Dockerfile)

See [app/SETUP.md](./app/SETUP.md) for detailed deployment instructions.

### Publish the CLI

```bash
cd cli
pnpm build
npm publish
```

---

## License

MIT © [Abdallah Othman](https://abdallahaho.com)

---

## Links

- **Website**: [howi.cc](https://howi.cc)
- **Documentation**: [howi.cc/docs](https://howi.cc/docs)
- **GitHub**: [github.com/AbdallahAHO/howicc](https://github.com/AbdallahAHO/howicc)
- **Issues**: [github.com/AbdallahAHO/howicc/issues](https://github.com/AbdallahAHO/howicc/issues)
- **CLI Package**: [@howicc/cli on npm](https://npmjs.com/package/@howicc/cli)
- **Maintainer**: [Abdallah Othman](https://abdallahaho.com) ([@AbdallahAHO](https://github.com/AbdallahAHO)) - contact@abdallahaho.com

---

**Made with ❤️ for Claude Code users who want to share their conversations**
