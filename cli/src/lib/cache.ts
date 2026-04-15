import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface CachedSession {
  sessionId: string;
  projectPath: string;
  fullPath: string;
  mtime: number; // Last modification time of the source file
  title: string;
  messageCount: number;
  gitBranch?: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  firstUserMessage?: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  tokenUsage?: TokenUsage;
}

interface CacheIndex {
  version: string;
  sessions: Record<string, CachedSession>;
}

const CACHE_VERSION = '1.0.0';

export class SessionCacheManager {
  private cacheDir: string;
  private indexFile: string;
  private cache: CacheIndex | null = null;

  constructor() {
    // Use ~/.howicc/cache/ directory
    this.cacheDir = join(homedir(), '.howicc', 'cache');
    this.indexFile = join(this.cacheDir, 'index.json');
  }

  /**
   * Initialize the cache manager (ensure directory exists)
   */
  async init(): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      // Ignore if already exists
    }
    await this.loadCache();
  }

  /**
   * Load the cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      const content = await readFile(this.indexFile, 'utf-8');
      this.cache = JSON.parse(content);

      // Invalidate if version mismatch
      if (this.cache && this.cache.version !== CACHE_VERSION) {
        this.cache = {
          version: CACHE_VERSION,
          sessions: {},
        };
      }
    } catch (error) {
      // If file doesn't exist or is corrupt, start with empty cache
      this.cache = {
        version: CACHE_VERSION,
        sessions: {},
      };
    }
  }

  /**
   * Save the cache to disk
   */
  async saveCache(): Promise<void> {
    if (!this.cache) return;
    try {
      await writeFile(this.indexFile, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save cache:', error);
    }
  }

  /**
   * Check if a file is cached and up to date
   */
  async getCachedSession(filePath: string): Promise<CachedSession | null> {
    if (!this.cache) await this.loadCache();
    if (!this.cache) return null;

    const stats = await stat(filePath).catch(() => null);
    if (!stats) return null;

    // Find session by path (we might want to index by path or sessionId)
    // For now, let's iterate or index by sessionId if we know it.
    // But we often look up by file path before opening it.
    // Let's find by fullPath.
    const session = Object.values(this.cache.sessions).find(s => s.fullPath === filePath);

    if (session && Math.abs(session.mtime - stats.mtime.getTime()) < 1000) {
      // Cache hit (allow 1s difference for filesystem resolution quirks)
      return session;
    }

    return null;
  }

  /**
   * Update or add a session to the cache
   */
  async updateSession(session: CachedSession): Promise<void> {
    if (!this.cache) await this.loadCache();
    if (!this.cache) return;

    this.cache.sessions[session.sessionId] = session;
  }

  /**
   * Get all cached sessions
   */
  getAllSessions(): CachedSession[] {
    if (!this.cache) return [];
    return Object.values(this.cache.sessions);
  }

  /**
   * Remove a session from cache
   */
  removeSession(sessionId: string): void {
    if (!this.cache) return;
    delete this.cache.sessions[sessionId];
  }
}
