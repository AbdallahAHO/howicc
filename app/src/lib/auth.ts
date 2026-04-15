import { randomBytes } from 'node:crypto';
import type PocketBase from 'pocketbase';
import { Collections, createPBClient } from './pb';

/**
 * Generate a secure API key with the format: hcc_[32+ alphanumeric chars]
 * Pattern must match: ^hcc_[a-zA-Z0-9]{32,}$
 */
export function generateApiKey(): string {
  // Generate 24 random bytes (192 bits) and encode as hex (48 chars)
  // Then take first 32 characters to ensure alphanumeric only
  const randomPart = randomBytes(24).toString('hex').substring(0, 32);
  return `hcc_${randomPart}`;
}

/**
 * Create an API key for a user
 */
export async function createApiKeyForUser(
  pb: PocketBase,
  userId: string,
  name?: string
): Promise<{ id: string; key: string }> {
  const apiKey = generateApiKey();

  try {
    const record = await pb.collection(Collections.API_KEYS).create({
      user: userId,
      key: apiKey,
      name: name || 'Default API Key',
    });

    return {
      id: record.id,
      key: apiKey,
    };
  } catch (error: any) {
    // Re-throw with better error context
    if (error?.response?.data) {
      const pbError = error.response.data;
      const fieldErrors = pbError.data || {};
      const errorMessage = pbError.message || 'Failed to create API key';

      // Extract field-specific errors
      const fieldMessages = Object.entries(fieldErrors)
        .map(([field, msg]: [string, any]) => `${field}: ${msg?.message || msg}`)
        .join(', ');

      const enhancedError = new Error(
        fieldMessages
          ? `${errorMessage} (${fieldMessages})`
          : errorMessage
      );
      (enhancedError as any).response = error.response;
      (enhancedError as any).status = error.status;
      throw enhancedError;
    }
    throw error;
  }
}

/**
 * Validate an API key and return the associated user ID
 */
export async function validateApiKey(
  pb: PocketBase,
  apiKey: string
): Promise<string | null> {
  try {
    const result = await pb.collection(Collections.API_KEYS).getFirstListItem(`key="${apiKey}"`);

    // Update last_used timestamp
    await pb.collection(Collections.API_KEYS).update(result.id, {
      last_used: new Date().toISOString(),
    }).catch(() => {
      // Ignore errors updating last_used
    });

    return result.user;
  } catch (error) {
    return null;
  }
}

/**
 * Get all API keys for a user
 */
export async function getUserApiKeys(pb: PocketBase, userId: string) {
  try {
    // Use getList with pagination instead of getFullList to avoid potential issues
    // Fetch with a reasonable limit (500 should be enough for any user)
    // Sort by -id instead of -created since 'created' field may not be sortable for user-authenticated clients
    const result = await pb.collection(Collections.API_KEYS).getList(1, 500, {
      filter: `user="${userId}"`,
      sort: '-id', // Use id for sorting (newest first, since id is auto-incrementing)
    });
    return result.items;
  } catch (error: any) {
    // Log the error for debugging
    console.error('Error fetching API keys:', {
      userId,
      error: error?.message,
      status: error?.status,
      response: error?.response,
    });

    // If it's a permission error or collection doesn't exist, return empty array
    if (error?.status === 400 || error?.status === 403 || error?.status === 404) {
      console.warn('API keys collection query failed, returning empty array');
      return [];
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(pb: PocketBase, keyId: string): Promise<boolean> {
  try {
    await pb.collection(Collections.API_KEYS).delete(keyId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Session cookie name
 */
export const SESSION_COOKIE_NAME = 'pb_auth_token';

/**
 * Get session token from request cookies
 */
export function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies[SESSION_COOKIE_NAME] || null;
}

/**
 * Create a session cookie with the PocketBase auth token
 */
export function createSessionCookie(token: string, maxAge: number = 60 * 60 * 24 * 7): string {
  const isProduction = import.meta.env.PROD;
  const secure = isProduction ? 'Secure;' : '';
  const sameSite = 'SameSite=Strict;';

  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; ${secure}${sameSite}Path=/; Max-Age=${maxAge}`;
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict;`;
}

/**
 * Get authenticated PocketBase client from session token
 */
export async function getAuthenticatedPBClient(request: Request): Promise<{ pb: PocketBase; user: any } | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  try {
    const pb = createPBClient();

    // Set the auth token
    pb.authStore.save(token, null);

    // Verify the token is still valid by refreshing auth
    // This will fetch the current user and update the auth store
    try {
      await pb.collection('users').authRefresh();
    } catch (refreshError) {
      // Token might be expired or invalid
      return null;
    }

    const user = pb.authStore.model;
    if (!user) {
      return null;
    }

    return { pb, user };
  } catch (error) {
    console.error('Failed to authenticate with session token:', error);
    return null;
  }
}

// Client-side PocketBase integration removed for security
// All PocketBase operations must go through Astro SSR API endpoints
