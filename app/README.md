# How I Claude Code (howicc)

> **Pastebin for Claude Code Conversations**

Transform your local Claude Code conversations into beautifully formatted, shareable links with AI-powered summaries and tagging.

## Features

- 🗂️ **Extract Conversations** - Pull conversations from your local Claude Code directory
- 🤖 **AI Analysis** - Automatic summaries, tags, and metadata generation
- 🔒 **Privacy-First** - Self-hosted with PII/secret detection, private by default
- 👥 **User Accounts** - Registration, login, and API key management
- 🔐 **Visibility Controls** - Private, unlisted, or public conversations
- 📊 **View Tracking** - Privacy-preserving view counts and read reports
- 🏆 **Public Discovery** - Trending conversations and leaderboards
- 🎨 **Beautiful UI** - Clean, responsive design with syntax highlighting
- 🔗 **Shareable Links** - SEO-friendly URLs for each conversation
- ⚡ **Fast & Modern** - Built with Astro, PocketBase, and Tailwind v4

## Tech Stack

- **Frontend**: [Astro](https://astro.build) (SSR) + [Tailwind CSS v4](https://tailwindcss.com)
- **Backend**: [PocketBase](https://pocketbase.io) (SQLite database + auth + file storage)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai) + [OpenRouter](https://openrouter.ai)
- **Validation**: [Zod](https://zod.dev)
- **Testing**: [Vitest](https://vitest.dev)

## Prerequisites

- Node.js 20+ and pnpm
- PocketBase binary ([download](https://pocketbase.io/docs/))
- OpenRouter API key ([get one](https://openrouter.ai/))

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/AbdallahAHO/howicc.git
cd howicc/app
pnpm install
```

### 2. Set Up PocketBase

Download and run PocketBase:

```bash
# Download PocketBase (adjust for your OS)
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.23.4/pocketbase_0.23.4_linux_amd64.zip
unzip pocketbase_0.23.4_linux_amd64.zip
chmod +x pocketbase

# Run PocketBase
./pocketbase serve
```

Access the PocketBase admin panel at `http://127.0.0.1:8090/_/` and:

1. Create an admin account
2. Go to **Settings** → **Import collections**
3. Upload `pocketbase-schema.json` from this repo
4. Collections will be created automatically

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# PocketBase Configuration
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=your-admin@email.com
PB_ADMIN_PASSWORD=your-secure-password

# API Security (generate a random string)
SERVER_API_KEY=your-random-api-key-here

# OpenRouter for AI Analysis
OPENROUTER_API_KEY=sk-or-v1-...
# Optional: OpenRouter model ID (default: anthropic/claude-3.5-sonnet)
# OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Public Site URL
PUBLIC_SITE_URL=http://localhost:4321
```

**Generate a secure API key:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run the Development Server

```bash
pnpm dev
```

Visit `http://localhost:4321` to see your site!

## Project Structure

```
howicc/app/
├── src/
│   ├── components/         # Astro components
│   │   ├── BaseHead.astro
│   │   └── Navigation.astro
│   ├── layouts/           # Page layouts
│   │   └── BaseLayout.astro
│   ├── lib/               # Core libraries
│   │   ├── ai-analysis.ts    # AI analysis & safety checks
│   │   ├── pb.ts             # PocketBase client & helpers
│   │   ├── process.ts        # Background processing queue
│   │   └── schemas.ts        # Zod validation schemas
│   ├── pages/
│   │   ├── api/              # API endpoints
│   │   │   ├── conversations.ts  # Upload endpoint
│   │   │   └── ingest.ts         # Processing trigger
│   │   ├── p/                # Public conversation pages
│   │   │   └── [slug].astro
│   │   └── index.astro       # Homepage
│   ├── styles/
│   │   └── global.css        # Tailwind configuration
│   ├── tests/             # Vitest tests
│   └── env.d.ts          # TypeScript environment types
├── astro.config.mjs      # Astro configuration
├── pocketbase-schema.json # PocketBase collection schema
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## API Usage

### Upload a Conversation

```bash
curl -X POST http://localhost:4321/api/conversations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@conversation.md" \
  -F "title=My Awesome Chat" \
  -F "description_user=A discussion about TypeScript" \
  -F "tags=[\"typescript\", \"coding\"]" \
  -F "visibility=public" \
  -F "allowListing=true"
```

**Response:**

```json
{
  "id": "abc123",
  "slug": "my-awesome-chat",
  "status": "uploaded",
  "visibility": "public",
  "allowListing": true,
  "url": "/p/my-awesome-chat"
}
```

### Publish a Conversation

```bash
curl -X POST http://localhost:4321/api/publish/CONVERSATION_ID \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "visibility": "public",
    "allowListing": true
  }'
```

### Get Trending Conversations

```bash
curl http://localhost:4321/api/leaderboard?period=7d&type=trending&limit=10
```

### Get Read Report

```bash
curl http://localhost:4321/api/report/CONVERSATION_ID \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Trigger Processing

```bash
curl -X POST http://localhost:4321/api/ingest \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "abc123"}'
```

## How It Works

1. **Register**: Create an account and get your API key
2. **Upload**: CLI or API uploads a markdown conversation file to PocketBase
3. **Queue**: Conversation is queued for background processing
4. **Analyze**: AI (via OpenRouter) generates:
   - Title (if not provided)
   - Summary (3-6 sentences)
   - Key takeaways (bullet points)
   - Relevant tags
   - Safety flags (PII/secrets detection)
5. **Review**: If sensitive data detected, status → `needs_review`
6. **Publish**: Set visibility to `public` or `unlisted` to make shareable
7. **Share**: Get a beautiful link: `/p/your-conversation-slug`
8. **Track**: View counts and read reports are tracked privately

## Database Schema

### `conversations` Collection

| Field             | Type     | Description                          |
| ----------------- | -------- | ------------------------------------ |
| `title`           | text     | Conversation title                   |
| `slug`            | text     | URL-safe unique identifier           |
| `user`            | relation | Owner (relation to `_pb_users_auth_`)|
| `source`          | select   | `claude`, `chatgpt`, `other`         |
| `status`          | select   | Upload/processing state              |
| `visibility`      | select   | `private`, `unlisted`, `public`     |
| `allowListing`    | bool     | Allow on homepage/explore            |
| `viewsTotal`      | number   | Total view count                     |
| `viewsUnique24h`  | number   | Unique views in last 24h             |
| `lastViewedAt`    | date     | Last view timestamp                  |
| `publicSince`     | date     | When first made public               |
| `checksum`        | text     | SHA-256 for deduplication            |
| `md`              | file     | Original markdown file               |
| `messages_json`   | json     | Structured messages array            |
| `description_user`| text     | User-provided description            |
| `description_ai`  | text     | AI-generated description             |
| `summary`         | text     | AI-generated summary                 |
| `takeaways`       | json     | Array of key points                  |
| `safety_flags`    | json     | `{pii: bool, secrets: bool}`         |
| `tags`            | relation | Links to tags collection             |

### `tags` Collection

| Field  | Type | Description         |
| ------ | ---- | ------------------- |
| `name` | text | Display name        |
| `slug` | text | URL-safe identifier |

## Testing

Run tests with Vitest:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test -- --coverage
```

## Deployment

### Option 1: VPS with Node.js

1. Build the Astro app:
   ```bash
   pnpm build
   ```

2. Copy `dist/` folder and PocketBase to your server

3. Run PocketBase:
   ```bash
   ./pocketbase serve --http="0.0.0.0:8090"
   ```

4. Run Astro (using PM2 or similar):
   ```bash
   node dist/server/entry.mjs
   ```

### Option 2: Docker / Nixpacks

We provide a `Dockerfile` and `nixpacks.toml` for easy deployment:

**Docker:**
```bash
# Build the image
docker build -t howicc-app .

# Run with environment variables
docker run -p 4321:4321 \
  -e PB_URL=http://pocketbase:8090 \
  -e PB_ADMIN_EMAIL=your-admin@email.com \
  -e PB_ADMIN_PASSWORD=your-secure-password \
  -e SERVER_API_KEY=your-api-key \
  -e OPENROUTER_API_KEY=your-openrouter-key \
  -e PUBLIC_SITE_URL=https://your-domain.com \
  howicc-app
```

**Docker Compose (for local dev):**
```bash
# Use the provided docker-compose.yml
docker-compose up
```

**Nixpacks (Railway/Render):**
The `nixpacks.toml` file is automatically detected by Railway and Render. Just connect your repo and set environment variables.

> **⚠️ Security Note**: In production, PocketBase should run separately on an internal network. Only the Astro app (port 4321) should be exposed to the public internet. See `docker-compose.yml` for an example of secure network isolation.

## Environment Variables

| Variable              | Required | Description                           |
| --------------------- | -------- | ------------------------------------- |
| `PB_URL`              | Yes      | PocketBase URL (internal network only) |
| `PB_ADMIN_EMAIL`      | Yes      | PocketBase admin email                 |
| `PB_ADMIN_PASSWORD`   | Yes      | PocketBase admin password              |
| `SERVER_API_KEY`      | Yes      | API authentication key                 |
| `OPENROUTER_API_KEY`  | Yes      | OpenRouter API key for AI              |
| `OPENROUTER_MODEL`    | No       | OpenRouter model ID (default: `anthropic/claude-3.5-sonnet`) |
| `PUBLIC_SITE_URL`     | Yes      | Your site's public URL                 |

> **⚠️ Note**: PocketBase is never accessed from the client-side. All operations go through Astro SSR API endpoints. `PB_URL` should point to an internal network address only.

## Security Considerations

> **⚠️ IMPORTANT SECURITY NOTES FOR SELF-HOSTERS:**

### Critical Security Requirements

1. **🔒 Never expose PocketBase directly** - Keep PocketBase on an internal network only. It should NOT be accessible from the public internet. Only the Astro app should be exposed.

2. **🔑 Rotate tokens regularly** - Never use admin tokens in frontend `.env` files. All PocketBase operations go through Astro SSR API endpoints - there is no client-side PocketBase integration.

3. **👁️ Public + Listable is opt-in** - Conversations default to `private` visibility and `allowListing=false`. Users must explicitly opt-in to make conversations public and listable.

4. **🔐 Use secure defaults** - Generate strong API keys and admin passwords. Never commit secrets to version control.

### Security Features

- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **SSRF Protection**: URL validation prevents server-side request forgery
- **XSS Sanitization**: All user-generated content is sanitized with DOMPurify
- **CORS Protection**: Exact origin matching (no wildcards)
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **Private by Default**: Conversations are private unless explicitly made public
- **PocketBase Rules**: Anonymous list is denied - only public+listable or owner can list

### Security Checks

Before deploying, run:

```bash
# Check for secrets in client bundle
pnpm check-secrets

# Validate configuration
pnpm validate-config
```

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure process and [THREATMODEL.md](./THREATMODEL.md) for detailed threat model.

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

- Theme inspired by [Microstudio](https://github.com/michael-andreuzza/microstudio)
- Built with ❤️ using [Astro](https://astro.build)

## Roadmap

- [x] CLI tool for easy conversation uploads
- [x] User authentication and private pastes
- [x] Visibility controls (private/unlisted/public)
- [x] View tracking and read reports
- [x] Public discovery and leaderboards
- [ ] Batch upload support
- [ ] Search functionality
- [ ] Markdown export improvements
- [ ] Embed support for other sites

---

**Made for Claude Code users who want to share their conversations.**
