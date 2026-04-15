import Conf from 'conf';
import type { Config } from '../types/index.js';

const schema = {
  apiUrl: {
    type: 'string',
    default: 'https://howi.cc',
  },
  apiKey: {
    type: 'string',
  },
  lastSync: {
    type: 'string',
  },
  syncedSessions: {
    type: 'array',
    items: {
      type: 'string',
    },
    default: [],
  },
} as const;

export class ConfigManager {
  private config: Conf<Config>;

  constructor() {
    this.config = new Conf({
      projectName: 'howicc',
      schema: schema as any,
    });
  }

  /**
   * Get the API URL
   */
  getApiUrl(): string {
    return this.config.get('apiUrl', 'https://howi.cc');
  }

  /**
   * Set the API URL
   */
  setApiUrl(url: string): void {
    this.config.set('apiUrl', url);
  }

  /**
   * Get the API key
   */
  getApiKey(): string | undefined {
    return this.config.get('apiKey');
  }

  /**
   * Set the API key
   */
  setApiKey(key: string): void {
    this.config.set('apiKey', key);
  }

  /**
   * Check if configuration is complete
   */
  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  /**
   * Get last sync timestamp
   */
  getLastSync(): string | undefined {
    return this.config.get('lastSync');
  }

  /**
   * Update last sync timestamp
   */
  updateLastSync(): void {
    this.config.set('lastSync', new Date().toISOString());
  }

  /**
   * Check if session has been synced
   */
  isSessionSynced(sessionId: string): boolean {
    const synced = this.config.get('syncedSessions', []);
    return synced.includes(sessionId);
  }

  /**
   * Mark session as synced
   */
  markSessionSynced(sessionId: string): void {
    const synced = this.config.get('syncedSessions', []);
    if (!synced.includes(sessionId)) {
      synced.push(sessionId);
      this.config.set('syncedSessions', synced);
    }
  }

  /**
   * Get all configuration
   */
  getAll(): Config {
    return {
      apiUrl: this.getApiUrl(),
      apiKey: this.getApiKey() || '',
      lastSync: this.getLastSync(),
      syncedSessions: this.config.get('syncedSessions', []),
    };
  }

  /**
   * Clear all configuration
   */
  clear(): void {
    this.config.clear();
  }

  /**
   * Get config file path
   */
  getPath(): string {
    return this.config.path;
  }
}
