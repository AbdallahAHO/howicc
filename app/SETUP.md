# How I Claude Code Setup Guide

This guide will walk you through setting up How I Claude Code (howicc) locally in under 10 minutes.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** ([download](https://nodejs.org/))
- **pnpm** (install with `npm install -g pnpm`)
- **PocketBase binary** ([download](https://pocketbase.io/docs/))
- **OpenRouter API Key** ([get one](https://openrouter.ai/))

## Step 1: Clone and Install Dependencies

```bash
git clone https://github.com/AbdallahAHO/howicc.git
cd howicc/app
pnpm install
```

## Step 2: Download and Run PocketBase

### macOS/Linux

```bash
# Download PocketBase
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.23.4/pocketbase_0.23.4_linux_amd64.zip

# Extract
unzip pocketbase_0.23.4_linux_amd64.zip

# Make executable
chmod +x pocketbase

# Run PocketBase
./pocketbase serve
```

### Windows

```powershell
# Download from: https://pocketbase.io/docs/
# Extract the zip file
# Run:
.\pocketbase.exe serve
```

PocketBase will start on `http://127.0.0.1:8090`

## Step 3: Configure PocketBase

1. **Open the Admin UI**: Navigate to `http://127.0.0.1:8090/_/`

2. **Create Admin Account**:
   - Email: `admin@howi.cc` (or your choice)
   - Password: Choose a strong password
   - Click "Create and login"

3. **Setup Collections**:

   **Option A: Automated Setup (Recommended)**
   ```bash
   # Run the setup script to automatically create collections
   pnpm pb:setup
   ```

   The script will:
   - Authenticate with your admin credentials from `.env`
   - Create `conversations` and `tags` collections
   - Configure all fields, indexes, and access rules
   - Show a summary of created/updated collections

   **Option B: Manual Import via Admin UI**
   - Go to **Settings** → **Import collections**
   - Click "Load from JSON file"
   - Upload `pocketbase-schema-new.json` from the project root
   - Click "Review" then "Confirm"
   - Two collections will be created: `conversations` and `tags`

4. **Verify Collections**:
   - Go to **Collections** in the sidebar
   - You should see `conversations` and `tags`

## Step 4: Set Up Environment Variables

1. **Copy the example env file**:
   ```bash
   cp .env.example .env
   ```

2. **Generate an API key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Edit `.env`** and fill in your values:

   ```env
   # PocketBase Configuration
   PB_URL=http://127.0.0.1:8090
   PB_ADMIN_EMAIL=admin@howi.cc    # Your admin email
   PB_ADMIN_PASSWORD=your_secure_password   # Your admin password

   # API Security (use generated key from step 2)
   SERVER_API_KEY=your_generated_api_key_here

   # OpenRouter for AI Analysis
   OPENROUTER_API_KEY=sk-or-v1-your-key-here

   # Public Site URL
   PUBLIC_SITE_URL=http://localhost:4321
   ```

## Step 5: Run the Development Server

```bash
pnpm dev
```

The site will be available at `http://localhost:4321`

## Step 6: Test the Setup

### Option 1: Using curl

Create a test markdown file (`test-conversation.md`):

```markdown
## 👤 User

Hello, can you help me with TypeScript?

## 🤖 Claude

Of course! I'd be happy to help you with TypeScript. What would you like to know?

## 👤 User

How do I define a type for a function that returns a Promise?

## 🤖 Claude

You can define it like this:

\`\`\`typescript
async function fetchData(): Promise<string> {
  const response = await fetch('https://api.example.com/data');
  return response.text();
}
\`\`\`

The `Promise<string>` type indicates this function returns a Promise that resolves to a string.
```

Upload it:

```bash
curl -X POST http://localhost:4321/api/conversations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@test-conversation.md" \
  -F "title=TypeScript Promise Help" \
  -F "description_user=Learning about Promise types" \
  -F "tags=[\"typescript\",\"async\"]" \
  -F "isPublic=true"
```

Response:

```json
{
  "id": "abc123xyz",
  "slug": "typescript-promise-help",
  "status": "uploaded",
  "url": "/p/typescript-promise-help"
}
```

### Option 2: Check the Homepage

Visit `http://localhost:4321` - you should see the How I Claude Code homepage.

## Step 7: View Your Conversation

The conversation will be processing in the background. After a few seconds:

1. Go to `http://localhost:4321/p/typescript-promise-help`
2. You should see:
   - The conversation title
   - AI-generated summary and tags
   - The formatted conversation
   - A "Copy Link" button

## Verification Checklist

- [ ] PocketBase is running on `http://127.0.0.1:8090`
- [ ] You can access the PocketBase admin UI
- [ ] Collections `conversations` and `tags` exist
- [ ] `.env` file is configured with all required values
- [ ] Astro dev server is running on `http://localhost:4321`
- [ ] You can upload a conversation via the API
- [ ] The conversation appears at `/p/[slug]`
- [ ] AI processing completes (check for tags and summary)

## Troubleshooting

### "Failed to authenticate with PocketBase"

- Check that `PB_URL`, `PB_ADMIN_EMAIL`, and `PB_ADMIN_PASSWORD` in `.env` match your PocketBase setup
- Verify PocketBase is running: `curl http://127.0.0.1:8090/api/health`

### "401 Unauthorized" when uploading

- Verify `SERVER_API_KEY` in `.env` matches the key in your `Authorization` header
- Make sure you're using `Bearer YOUR_KEY` format

### AI analysis fails

- Check that `OPENROUTER_API_KEY` is valid
- Verify you have credits in your OpenRouter account
- Check the server logs for error details

### Conversation shows "Processing..."

- This is normal - processing can take 5-30 seconds depending on conversation length
- Check the server console for processing logs
- If stuck, try manually triggering processing:

  ```bash
  curl -X POST http://localhost:4321/api/ingest \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"conversationId": "YOUR_CONVERSATION_ID"}'
  ```

### PocketBase collections not found

- Re-import the schema: Settings → Import collections → Load `pocketbase-schema.json`
- Or manually create collections following the schema in the file

## Next Steps

- **Integrate with CLI**: Build a CLI tool to extract Claude conversations
- **Customize Theme**: Edit `src/styles/global.css` to change colors
- **Add Authentication**: Set up PocketBase user auth for private pastes
- **Deploy**: See README.md for deployment instructions

## Need Help?

- Check the [full README](README.md)
- Open an issue on [GitHub](https://github.com/AbdallahAHO/howicc/issues)
- Review [PocketBase docs](https://pocketbase.io/docs/)
- Check [Astro docs](https://docs.astro.build/)

---

**You're all set!** 🎉

Start uploading your Claude conversations and sharing them with the world.
