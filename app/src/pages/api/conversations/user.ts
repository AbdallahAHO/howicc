import type { APIRoute } from 'astro';
import { getAuthenticatedPBClient } from '@/lib/auth';
import { Collections, getPBClient } from '@/lib/pb';
import { UserConversationsResponseSchema, APIErrorSchema } from '@howicc/schemas';

export const prerender = false;

/**
 * Get all conversations for the authenticated user
 * Returns all conversations - pagination/filtering handled client-side
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    const authResult = await getAuthenticatedPBClient(request);

    if (!authResult) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { user } = authResult;
    const pb = await getPBClient();

    // Fetch all conversations - use minimal query that works
    let allItems: any[] = [];
    try {
      // Try minimal query first
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const result = await pb
            .collection(Collections.CONVERSATIONS)
            .getList(page, 10);

          allItems.push(...result.items);

          if (result.items.length < 10 || page >= result.totalPages) {
            hasMore = false;
          } else {
            page++;
          }
        } catch (e) {
          console.warn(`[API] Failed to fetch page ${page}:`, e);
          hasMore = false;
        }
      }

      // Filter by user only (required)
      allItems = allItems.filter((conv: any) => conv.user === user.id);

      // Sort by created date (newest first)
      allItems.sort((a: any, b: any) => {
        const aTime = new Date(a.created || 0).getTime();
        const bTime = new Date(b.created || 0).getTime();
        return bTime - aTime;
      });

      console.log(`[API] Fetched ${allItems.length} conversations for user ${user.id}`);
    } catch (error: any) {
      console.error('[API] Failed to fetch conversations:', error?.message);
      allItems = [];
    }

    // Process conversations
    const conversations = allItems.map((conv: any) => {
      // Extract tags from expanded relation or direct field
      let tags: any[] = [];
      if (conv.expand?.tags) {
        tags = Array.isArray(conv.expand.tags) ? conv.expand.tags : [conv.expand.tags];
      } else if (conv.tags) {
        // If tags is a string, try to parse it
        if (typeof conv.tags === 'string') {
          try {
            const tagIds = JSON.parse(conv.tags);
            tags = Array.isArray(tagIds) ? tagIds : [];
          } catch {
            tags = [];
          }
        } else if (Array.isArray(conv.tags)) {
          tags = conv.tags;
        }
      }

      // Ensure created and updated are always strings (PocketBase should provide these, but handle missing)
      const now = new Date().toISOString();
      const created = conv.created || conv['@created'] || now;
      const updated = conv.updated || conv['@updated'] || created;

      return {
        id: conv.id,
        slug: conv.slug,
        title: conv.title,
        summary: conv.summary || null,
        description_user: conv.description_user || null,
        visibility: conv.visibility,
        allowListing: conv.allowListing || false,
        status: conv.status,
        viewsTotal: conv.viewsTotal || 0,
        viewsUnique24h: conv.viewsUnique24h || 0,
        created: typeof created === 'string' ? created : now,
        updated: typeof updated === 'string' ? updated : created,
        publicSince: conv.publicSince || null,
        tags,
      };
    });

    // Validate and structure response
    const responseData = {
      conversations,
      total: conversations.length,
    };
    const validatedResponse = UserConversationsResponseSchema.parse(responseData);

    return new Response(
      JSON.stringify(validatedResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting user conversations:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    const errorResponse = APIErrorSchema.parse({
      error: 'Failed to get conversations',
      details: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
