/**
 * PocketBase Collections Schema
 *
 * This file defines the database schema for HowiCC - a platform for sharing
 * Claude Code conversations with AI-powered analysis and tagging.
 *
 * Collections:
 * - conversations: Stores uploaded AI chat conversations with metadata
 * - tags: Categorization labels for conversations
 * - api_keys: API authentication keys for users
 */

/**
 * Conversations Collection
 *
 * Stores Claude Code conversations that users upload and share.
 * Each conversation goes through a processing pipeline:
 * 1. Upload: User uploads markdown file via CLI or API
 * 2. Process: AI analyzes content, generates summary/tags
 * 3. Review: If PII/secrets detected, flagged for review
 * 4. Publish: User sets isPublic=true to make shareable
 *
 * The collection stores both the original markdown file and structured
 * JSON representation of messages for efficient querying.
 */
export const conversationsCollection = {
    name: 'conversations',
    type: 'base',
    system: false,

    // Field definitions - PocketBase API expects 'fields' not 'schema'
    fields: [
        // Title of the conversation (required, max 200 chars)
        {
            name: 'title',
            type: 'text',
            required: true,
            presentable: false,
            unique: false,
            min: 1,
            max: 200,
            pattern: '',
        },

        // URL-safe unique identifier (required, unique, lowercase alphanumeric + hyphens)
        {
            name: 'slug',
            type: 'text',
            required: true,
            presentable: false,
            unique: true,
            min: 1,
            max: 100,
            pattern: '^[a-z0-9-]+$',
        },

        // User who owns this conversation (relation to _pb_users_auth_)
        {
            name: 'user',
            type: 'relation',
            required: true,
            presentable: false,
            unique: false,
            collectionId: '_pb_users_auth_', // PocketBase system collection
            cascadeDelete: true, // Delete conversations when user is deleted
            minSelect: null,
            maxSelect: 1,
            displayFields: ['email'],
        },

        // Source platform: claude, chatgpt, or other
        {
            name: 'source',
            type: 'select',
            required: true,
            presentable: false,
            unique: false,
            maxSelect: 1,
            values: ['claude', 'chatgpt', 'other'],
        },

        // Processing status: uploaded → processed → needs_review → published
        {
            name: 'status',
            type: 'select',
            required: true,
            presentable: false,
            unique: false,
            maxSelect: 1,
            values: ['uploaded', 'processed', 'needs_review', 'published'],
        },

        // Visibility: private (owner only), unlisted (anyone with link), public (discoverable)
        {
            name: 'visibility',
            type: 'select',
            required: true,
            presentable: false,
            unique: false,
            maxSelect: 1,
            values: ['private', 'unlisted', 'public'],
        },

        // Whether conversation can appear on homepage/explore (requires visibility=public)
        {
            name: 'allowListing',
            type: 'bool',
            required: false,
            presentable: false,
            unique: false,
        },

        // Total view count (incremented on each view)
        {
            name: 'viewsTotal',
            type: 'number',
            required: false,
            presentable: false,
            unique: false,
            min: 0,
            max: null,
        },

        // Unique views in last 24 hours (estimated via cookie)
        {
            name: 'viewsUnique24h',
            type: 'number',
            required: false,
            presentable: false,
            unique: false,
            min: 0,
            max: null,
        },

        // Last time conversation was viewed
        {
            name: 'lastViewedAt',
            type: 'date',
            required: false,
            presentable: false,
            unique: false,
            min: '',
            max: '',
        },

        // When conversation was first made public (null if never public)
        {
            name: 'publicSince',
            type: 'date',
            required: false,
            presentable: false,
            unique: false,
            min: '',
            max: '',
        },

        // SHA-256 checksum for deduplication (optional, unique)
        {
            name: 'checksum',
            type: 'text',
            required: false,
            presentable: false,
            unique: true,
            min: null,
            max: 64,
            pattern: '^[a-f0-9]{64}$',
        },

        // Timeline structure with full conversation events (max 5MB)
        // Replaces both md file and messages_json with rich structured data
        {
            name: 'timeline',
            type: 'json',
            required: false,
            presentable: false,
            unique: false,
            maxSize: 5000000, // 5MB - larger to accommodate tool calls, diffs, and agent thoughts
        },

        // User-provided description (optional, max 1000 chars)
        {
            name: 'description_user',
            type: 'text',
            required: false,
            presentable: false,
            unique: false,
            min: null,
            max: 1000,
            pattern: '',
        },

        // AI-generated description (optional, max 2000 chars)
        {
            name: 'description_ai',
            type: 'text',
            required: false,
            presentable: false,
            unique: false,
            min: null,
            max: 2000,
            pattern: '',
        },

        // AI-generated summary (optional, max 5000 chars)
        {
            name: 'summary',
            type: 'text',
            required: false,
            presentable: false,
            unique: false,
            min: null,
            max: 5000,
            pattern: '',
        },

        // AI-generated key takeaways (JSON array of strings, max 10KB)
        {
            name: 'takeaways',
            type: 'json',
            required: false,
            presentable: false,
            unique: false,
            maxSize: 10000, // 10KB
        },

        // Safety flags from PII/secret detection (JSON object, max 1KB)
        {
            name: 'safety_flags',
            type: 'json',
            required: false,
            presentable: false,
            unique: false,
            maxSize: 1000, // 1KB
        },

        // Related tags (many-to-many relation)
        {
            name: 'tags',
            type: 'relation',
            required: false,
            presentable: false,
            unique: false,
            collectionId: 'tags', // Will be resolved to actual ID during setup
            cascadeDelete: false,
            minSelect: null,
            maxSelect: null,
            displayFields: ['name'],
        },
    ],

    // Database indexes for performance
    indexes: [
        'CREATE INDEX idx_conversations_slug ON conversations (slug)',
        'CREATE INDEX idx_conversations_status ON conversations (status)',
        'CREATE INDEX idx_conversations_checksum ON conversations (checksum)',
        'CREATE INDEX idx_conversations_user ON conversations (user)',
        'CREATE INDEX idx_conversations_visibility ON conversations (visibility)',
        'CREATE INDEX idx_conversations_allowListing ON conversations (allowListing)',
        'CREATE INDEX idx_conversations_viewsTotal ON conversations (viewsTotal DESC)',
        'CREATE INDEX idx_conversations_publicSince ON conversations (publicSince DESC)',
    ],

    // Access control rules
    // listRule: deny anonymous list - only public+listable or owner can list
    listRule: "(visibility = 'public' && allowListing = true) || user = @request.auth.id",
    // viewRule: allow unlisted view (anyone with link), public view, or owner
    viewRule: "visibility = 'public' || visibility = 'unlisted' || user = @request.auth.id",
    // createRule: users can only create conversations for themselves
    createRule: "user = @request.auth.id",
    // updateRule: users can only update their own conversations
    updateRule: "user = @request.auth.id",
    // deleteRule: users can only delete their own conversations
    deleteRule: "user = @request.auth.id",
};

/**
 * Tags Collection
 *
 * Categorization labels for conversations.
 * Tags are created automatically by AI analysis or manually by users.
 * Each tag has a unique name and slug for URL-friendly access.
 */
export const tagsCollection = {
    name: 'tags',
    type: 'base',
    system: false,

    fields: [
        // Tag name (required, unique, max 50 chars, presentable in UI)
        {
            name: 'name',
            type: 'text',
            required: true,
            presentable: true,
            unique: true,
            min: 1,
            max: 50,
            pattern: '',
        },

        // URL-safe slug (required, unique, lowercase alphanumeric + hyphens)
        {
            name: 'slug',
            type: 'text',
            required: true,
            presentable: false,
            unique: true,
            min: 1,
            max: 50,
            pattern: '^[a-z0-9-]+$',
        },
    ],

    indexes: [
        'CREATE UNIQUE INDEX idx_tags_slug ON tags (slug)',
    ],

    // Access control rules
    listRule: '', // Public read access
    viewRule: '', // Public read access
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
};

/**
 * API Keys Collection
 *
 * API authentication keys for users to access the HowiCC API.
 * Keys are prefixed with 'hcc_' and are 32-64 characters long.
 * Each key is tied to a user account and tracks last usage.
 */
export const apiKeysCollection = {
    name: 'api_keys',
    type: 'base',
    system: false,

    fields: [
        // User who owns this API key (relation to _pb_users_auth_)
        {
            name: 'user',
            type: 'relation',
            required: true,
            presentable: false,
            unique: false,
            collectionId: '_pb_users_auth_', // PocketBase system collection
            cascadeDelete: true, // Delete keys when user is deleted
            minSelect: null,
            maxSelect: 1,
            displayFields: ['email'],
        },

        // API key value (required, unique, format: hcc_<32+ alphanumeric chars>)
        {
            name: 'key',
            type: 'text',
            required: true,
            presentable: false,
            unique: true,
            min: 32,
            max: 64,
            pattern: '^hcc_[a-zA-Z0-9]{32,}$',
        },

        // Human-readable name for the key (optional, max 100 chars)
        {
            name: 'name',
            type: 'text',
            required: false,
            presentable: true,
            unique: false,
            min: null,
            max: 100,
            pattern: '',
        },

        // Last time this key was used (optional, for analytics)
        {
            name: 'last_used',
            type: 'date',
            required: false,
            presentable: false,
            unique: false,
            min: '',
            max: '',
        },
    ],

    indexes: [
        'CREATE UNIQUE INDEX idx_api_keys_key ON api_keys (key)',
        'CREATE INDEX idx_api_keys_user ON api_keys (user)',
    ],

    // Access control rules - users can only see/manage their own keys
    listRule: "@request.auth.id != '' && user = @request.auth.id",
    viewRule: "@request.auth.id != '' && user = @request.auth.id",
    createRule: "@request.auth.id != '' && user = @request.auth.id",
    updateRule: "@request.auth.id != '' && user = @request.auth.id",
    deleteRule: "@request.auth.id != '' && user = @request.auth.id",
};

/**
 * Export all collections as a single object
 * Collections are ordered by dependencies (tags first, then conversations)
 */
export const collections = {
    tags: tagsCollection,
    conversations: conversationsCollection,
    api_keys: apiKeysCollection,
};

/**
 * Get collections as an array, sorted by dependencies
 * Collections without relations come first
 */
export function getCollectionsArray() {
    const collectionsArray = Object.values(collections);

    // Sort: collections without relation fields first
    return collectionsArray.sort((a, b) => {
        const aHasRelations = a.fields?.some(f => f.type === 'relation') || false;
        const bHasRelations = b.fields?.some(f => f.type === 'relation') || false;
        if (aHasRelations && !bHasRelations) return 1;
        if (!aHasRelations && bHasRelations) return -1;
        return 0;
    });
}
