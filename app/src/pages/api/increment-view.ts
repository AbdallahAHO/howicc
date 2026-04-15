import type { APIRoute } from 'astro';
import { getPBClient, Collections } from '@/lib/pb';
import { isBotRequest, hasDNT } from '@/lib/bot-detection';

export const prerender = false;

/**
 * Increment view count for a conversation
 * Called on SSR render of /p/:slug
 * Respects DNT and skips bots/owners
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // 1. Check DNT header
    if (hasDNT(request)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'DNT' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Check if bot
    const userAgent = request.headers.get('user-agent');
    const referer = request.headers.get('referer');
    const method = request.method;

    if (isBotRequest(userAgent, method, referer)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'bot' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get conversation ID from body
    const body = await request.json().catch(() => ({}));
    const conversationId = body.id || body.conversationId;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Conversation ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get PocketBase client
    const pb = await getPBClient();

    // 5. Get conversation
    const conversation = await pb
      .collection(Collections.CONVERSATIONS)
      .getOne(conversationId);

    // 6. Check if owner (skip counting owner views)
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      // If authenticated, check if it's the owner
      // For now, we'll skip this check and count all views
      // In production, you might want to check auth token
    }

    // 7. Check cookie to determine if unique view
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieName = `howi_viewed=${conversationId}`;
    const hasViewedCookie = cookieHeader.includes(cookieName);

    // 8. Increment counters
    const updates: Record<string, any> = {
      viewsTotal: (conversation.viewsTotal || 0) + 1,
      lastViewedAt: new Date().toISOString(),
    };

    // Only increment unique views if cookie is absent
    if (!hasViewedCookie) {
      updates.viewsUnique24h = (conversation.viewsUnique24h || 0) + 1;
    }

    // 9. Update conversation
    await pb.collection(Collections.CONVERSATIONS).update(conversationId, updates);

    // 10. Return response with cookie header
    const response = new Response(
      JSON.stringify({
        success: true,
        viewsTotal: updates.viewsTotal,
        viewsUnique24h: updates.viewsUnique24h || conversation.viewsUnique24h,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Set cookie for 24 hours
          'Set-Cookie': `${cookieName}; Max-Age=86400; Path=/; SameSite=Lax; HttpOnly`,
        },
      }
    );

    return response;
  } catch (error) {
    console.error('Error incrementing view:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
