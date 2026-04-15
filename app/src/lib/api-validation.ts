/**
 * Client-side API response validation utilities
 * Uses Zod schemas to validate API responses
 */

import { z } from 'zod';
import {
  ConversationResponseSchema,
  LeaderboardResponseSchema,
  StatsResponseSchema,
  UserResponseSchema,
  LoginResponseSchema,
  RegisterResponseSchema,
  APIKeysResponseSchema,
  CreateAPIKeyResponseSchema,
  APIErrorSchema,
  type ConversationResponse,
  type LeaderboardResponse,
  type StatsResponse,
  type UserResponse,
  type LoginResponse,
  type RegisterResponse,
  type APIKeysResponse,
  type CreateAPIKeyResponse,
  type APIError,
} from './schemas';

/**
 * Safely parse and validate an API response
 * Returns the validated data or throws an error
 */
export function validateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('API response validation failed:', result.error);
    throw new Error('Invalid API response format');
  }
  return result.data;
}

/**
 * Validate conversation response
 */
export function validateConversationResponse(data: unknown): ConversationResponse {
  return validateResponse(ConversationResponseSchema, data);
}

/**
 * Validate leaderboard response
 */
export function validateLeaderboardResponse(data: unknown): LeaderboardResponse {
  return validateResponse(LeaderboardResponseSchema, data);
}

/**
 * Validate stats response
 */
export function validateStatsResponse(data: unknown): StatsResponse {
  return validateResponse(StatsResponseSchema, data);
}

/**
 * Validate user response
 */
export function validateUserResponse(data: unknown): UserResponse {
  return validateResponse(UserResponseSchema, data);
}

/**
 * Validate login response
 */
export function validateLoginResponse(data: unknown): LoginResponse {
  return validateResponse(LoginResponseSchema, data);
}

/**
 * Validate register response
 */
export function validateRegisterResponse(data: unknown): RegisterResponse {
  return validateResponse(RegisterResponseSchema, data);
}

/**
 * Validate API keys response
 */
export function validateAPIKeysResponse(data: unknown): APIKeysResponse {
  return validateResponse(APIKeysResponseSchema, data);
}

/**
 * Validate create API key response
 */
export function validateCreateAPIKeyResponse(data: unknown): CreateAPIKeyResponse {
  return validateResponse(CreateAPIKeyResponseSchema, data);
}

/**
 * Validate API error response
 */
export function validateAPIError(data: unknown): APIError {
  return validateResponse(APIErrorSchema, data);
}
