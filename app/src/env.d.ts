/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** PocketBase URL (internal network only) */
  readonly PB_URL: string;
  /** PocketBase admin email */
  readonly PB_ADMIN_EMAIL: string;
  /** PocketBase admin password */
  readonly PB_ADMIN_PASSWORD: string;
  /** Server API key for authentication */
  readonly SERVER_API_KEY: string;
  /** OpenRouter API key for AI analysis */
  readonly OPENROUTER_API_KEY: string;
  /**
   * OpenRouter model ID (optional, defaults to 'anthropic/claude-3.5-sonnet')
   * Format: provider/model-name
   * Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo
   * See https://openrouter.ai/models for full list
   */
  readonly OPENROUTER_MODEL?: string;
  /** Public site URL (used for CORS, OAuth callbacks, etc.) */
  readonly PUBLIC_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
