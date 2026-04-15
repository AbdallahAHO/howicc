import { z } from 'zod';
import { TimelineEventSchema } from '@howicc/schemas';

/**
 * Conversation Upload Schema
 * Used when CLI uploads a conversation file
 */
export const ConversationUploadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  description_user: z.string().max(1000).optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional().default('private'),
  allowListing: z.boolean().optional().default(false),
  isPublic: z.boolean().optional().default(false), // Alias for allowListing compatibility
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/).optional(), // SHA-256
  source: z.enum(['claude', 'chatgpt', 'other']).optional().default('claude'),
});

export type ConversationUpload = z.infer<typeof ConversationUploadSchema>;

/**
 * AI Analysis Result Schema
 * Response from OpenRouter analysis
 */
export const AIAnalysisSchema = z.object({
  title: z.string().max(200),
  summary: z.string().max(2000),
  takeaways: z.array(z.string().max(500)).max(10),
  generated_tags: z.array(z.string().max(50)).max(20),
  safety_flags: z.object({
    pii: z.boolean(),
    secrets: z.boolean(),
  }),
});

export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;

/**
 * Message Schema
 * Individual message in a conversation
 */
export const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string().optional(),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Conversation Record Schema
 * Full conversation as stored in PocketBase
 */
export const ConversationRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  collectionName: z.string(),
  created: z.string(),
  updated: z.string(),
  title: z.string(),
  slug: z.string(),
  source: z.string(),
  status: z.enum(['uploaded', 'processed', 'needs_review', 'published']),
  visibility: z.enum(['private', 'unlisted', 'public']),
  allowListing: z.boolean().optional(),
  viewsTotal: z.number().optional(),
  viewsUnique24h: z.number().optional(),
  lastViewedAt: z.string().optional(),
  publicSince: z.string().optional(),
  checksum: z.string().optional(),
  md: z.string().optional(), // filename - DEPRECATED, use timeline instead
  messages_json: z.array(MessageSchema).optional(), // DEPRECATED, use timeline instead
  timeline: z.array(TimelineEventSchema).optional(), // Rich timeline structure from @howicc/schemas
  description_user: z.string().optional(),
  description_ai: z.string().optional(),
  summary: z.string().optional(),
  takeaways: z.array(z.string()).optional(),
  safety_flags: z.object({
    pii: z.boolean(),
    secrets: z.boolean(),
  }).optional(),
  tags: z.array(z.string()).optional(), // relation IDs
});

export type ConversationRecord = z.infer<typeof ConversationRecordSchema>;

/**
 * Tag Schema
 */
export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export type Tag = z.infer<typeof TagSchema>;

/**
 * Ingest Request Schema
 * For triggering background processing
 */
export const IngestRequestSchema = z.object({
  conversationId: z.string().min(1),
});

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

/**
 * Publish Request Schema
 * For updating visibility and listing status
 */
export const PublishRequestSchema = z.object({
  visibility: z.enum(['private', 'unlisted', 'public']),
  allowListing: z.boolean().optional(),
});

export type PublishRequest = z.infer<typeof PublishRequestSchema>;

/**
 * API Response Schemas
 */
export const APISuccessSchema = z.object({
  id: z.string(),
  slug: z.string(),
  status: z.string(),
  url: z.string(),
  duplicate: z.boolean().optional(),
});

export type APISuccess = z.infer<typeof APISuccessSchema>;

export const APIErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});

export type APIError = z.infer<typeof APIErrorSchema>;

/**
 * Conversation API Response Schema
 * Response from /api/conversation/[slug]
 */
export const ConversationResponseSchema = z.object({
  conversation: ConversationRecordSchema,
  tags: z.array(TagSchema),
  fileUrl: z.string().nullable(),
});

export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;

/**
 * Leaderboard Conversation Item Schema
 * Individual conversation in leaderboard response
 */
export const LeaderboardConversationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  viewsTotal: z.number(),
  viewsUnique24h: z.number(),
  publicSince: z.string().nullable().optional(),
  trendingScore: z.number(),
  tags: z.array(TagSchema),
});

export type LeaderboardConversation = z.infer<typeof LeaderboardConversationSchema>;

/**
 * Leaderboard API Response Schema
 * Response from /api/leaderboard
 */
export const LeaderboardResponseSchema = z.object({
  period: z.string(),
  type: z.enum(['trending', 'alltime']),
  conversations: z.array(LeaderboardConversationSchema),
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

/**
 * Stats API Response Schema
 * Response from /api/stats
 */
export const StatsResponseSchema = z.object({
  totalConversations: z.number(),
  publicConversations: z.number(),
  totalTags: z.number(),
});

export type StatsResponse = z.infer<typeof StatsResponseSchema>;

/**
 * User API Response Schema
 * Response from /api/me
 */
export const UserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
  }).nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

/**
 * Login API Response Schema
 * Response from /api/login
 */
export const LoginResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/**
 * Register API Response Schema
 * Response from /api/register
 */
export const RegisterResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
  apiKey: z.string(),
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

/**
 * API Keys Response Schema
 * Response from /api/keys (GET)
 */
export const APIKeysResponseSchema = z.object({
  keys: z.array(z.object({
    id: z.string(),
    user: z.string(),
    key: z.string(),
    name: z.string().nullable().optional(),
    created: z.string().optional(), // Optional since PocketBase may not return it for user-authenticated clients
    last_used: z.string().nullable().optional(),
  })),
});

export type APIKeysResponse = z.infer<typeof APIKeysResponseSchema>;

/**
 * Create API Key Response Schema
 * Response from /api/keys (POST)
 */
export const CreateAPIKeyResponseSchema = z.object({
  id: z.string(),
  key: z.string(),
  success: z.boolean(),
});

export type CreateAPIKeyResponse = z.infer<typeof CreateAPIKeyResponseSchema>;

/**
 * User Conversation Item Schema
 * Individual conversation in user's dashboard
 */
export const UserConversationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  description_user: z.string().nullable().optional(),
  visibility: z.enum(['private', 'unlisted', 'public']),
  allowListing: z.boolean().optional(),
  status: z.enum(['uploaded', 'processed', 'needs_review', 'published']),
  viewsTotal: z.number().optional(),
  viewsUnique24h: z.number().optional(),
  created: z.string(),
  updated: z.string(),
  publicSince: z.string().nullable().optional(),
  tags: z.array(TagSchema).optional(),
});

export type UserConversation = z.infer<typeof UserConversationSchema>;

/**
 * User Conversations Response Schema
 * Response from /api/conversations/user
 */
export const UserConversationsResponseSchema = z.object({
  conversations: z.array(UserConversationSchema),
  total: z.number(),
});

export type UserConversationsResponse = z.infer<typeof UserConversationsResponseSchema>;
