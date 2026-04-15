import PocketBase from 'pocketbase';
import type { ConversationRecord, Tag } from './schemas';

/**
 * Server-side PocketBase client with admin authentication
 */
export function createPBClient() {
  const pb = new PocketBase(import.meta.env.PB_URL);

  // Authenticate with admin credentials for server operations
  // Note: This should only be used server-side
  pb.autoCancellation(false);

  return pb;
}

/**
 * Authenticate the PocketBase client as admin
 */
export async function authenticateAdmin(pb: PocketBase) {
  try {
    await pb.admins.authWithPassword(
      import.meta.env.PB_ADMIN_EMAIL,
      import.meta.env.PB_ADMIN_PASSWORD
    );
    return true;
  } catch (error) {
    console.error('Failed to authenticate with PocketBase:', error);
    return false;
  }
}

/**
 * Get a server-side authenticated PocketBase client
 */
export async function getPBClient() {
  const pb = createPBClient();
  await authenticateAdmin(pb);
  return pb;
}

/**
 * Collection names
 */
export const Collections = {
  CONVERSATIONS: 'conversations',
  TAGS: 'tags',
  API_KEYS: 'api_keys',
} as const;

/**
 * Conversation status values
 */
export const ConversationStatus = {
  UPLOADED: 'uploaded',
  PROCESSED: 'processed',
  NEEDS_REVIEW: 'needs_review',
  PUBLISHED: 'published',
} as const;

/**
 * Helper to get the file URL for a conversation's markdown file
 */
export function getConversationFileURL(
  pb: PocketBase,
  conversation: ConversationRecord
): string {
  if (!conversation.md) {
    throw new Error('No markdown file attached to conversation');
  }
  return pb.files.getURL(conversation, conversation.md);
}

/**
 * Helper to ensure tags exist and return their IDs
 */
export async function ensureTagsByNames(
  pb: PocketBase,
  tagNames: string[]
): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of Array.from(new Set(tagNames))) {
    const slug = slugify(name);

    try {
      // Try to find existing tag
      const result = await pb.collection<Tag>(Collections.TAGS).getList(1, 1, {
        filter: `slug="${slug}"`,
      });

      if (result.items[0]) {
        tagIds.push(result.items[0].id);
      } else {
        // Create new tag
        const created = await pb.collection<Tag>(Collections.TAGS).create({
          name,
          slug,
        });
        tagIds.push(created.id);
      }
    } catch (error) {
      console.error(`Failed to ensure tag ${name}:`, error);
    }
  }

  return tagIds;
}

/**
 * Create a URL-safe slug from a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Trim hyphens from start and end
    .slice(0, 100); // Limit length
}

/**
 * Generate a short random slug (8-12 chars, lowercase alphanumeric)
 */
function generateShortSlug(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

/**
 * Generate a unique slug from checksum (first 8 chars, deterministic)
 */
export async function generateUniqueSlugFromChecksum(
  pb: PocketBase,
  checksum: string
): Promise<string> {
  // Use first 8 characters of checksum as base slug
  const baseSlug = checksum.substring(0, 8).toLowerCase();

  // Check if it's already taken
  try {
    const result = await pb.collection(Collections.CONVERSATIONS).getList(1, 1, {
      filter: `slug="${baseSlug}"`,
    });

    if (result.items.length === 0) {
      return baseSlug;
    }

    // Collision detected - try with more characters from checksum
    // Use up to 12 chars (max length), appending more from checksum
    for (let length = 9; length <= 12 && length <= checksum.length; length++) {
      const slug = checksum.substring(0, length).toLowerCase();
      const check = await pb.collection(Collections.CONVERSATIONS).getList(1, 1, {
        filter: `slug="${slug}"`,
      });

      if (check.items.length === 0) {
        return slug;
      }
    }

    // If still colliding, append a short hash
    const hash = Math.random().toString(36).substring(2, 4);
    return `${baseSlug}${hash}`.slice(0, 12);
  } catch (error) {
    console.error('Error checking slug uniqueness:', error);
    // If check fails, return the base slug anyway
    return baseSlug;
  }
}

/**
 * Generate a unique short slug by checking for collisions
 */
export async function generateUniqueSlug(
  pb: PocketBase,
  _baseSlug?: string // Ignored - we always generate random slugs
): Promise<string> {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate a random slug between 8-12 characters
    const slugLength = 8 + Math.floor(Math.random() * 5); // 8-12 chars
    const slug = generateShortSlug(slugLength);

    try {
      const result = await pb.collection(Collections.CONVERSATIONS).getList(1, 1, {
        filter: `slug="${slug}"`,
      });

      if (result.items.length === 0) {
        return slug;
      }
    } catch (error) {
      console.error('Error checking slug uniqueness:', error);
      // If check fails, try again with a new slug
    }

    attempts++;
  }

  // Fallback: if all attempts failed, use timestamp-based slug
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}${random}`.slice(0, 12);
}
