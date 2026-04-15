import type { APIRoute } from 'astro';
import { getPBClient, Collections } from '@/lib/pb';

export const prerender = false;

/**
 * Get read report for a conversation
 * GET /api/report/:id
 * Returns aggregate stats (no per-user data)
 */
export const GET: APIRoute = async ({ params }) => {
  try {
    const conversationId = params?.id;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Conversation ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pb = await getPBClient();

    // Get conversation
    const conversation = await pb
      .collection(Collections.CONVERSATIONS)
      .getOne(conversationId);

    // Build aggregate report
    const report = {
      id: conversation.id,
      slug: conversation.slug,
      title: conversation.title,
      totals: {
        viewsTotal: conversation.viewsTotal || 0,
        viewsUnique24h: conversation.viewsUnique24h || 0,
      },
      engagement: {
        // Placeholder for future engagement metrics
        // These would be tracked separately (e.g., in a separate collection)
        engagedMinutes: 0,
        copyEvents: 0,
      },
      referrers: {
        // Placeholder for referrer tracking
        // Would need separate tracking collection
        topDomains: [] as Array<{ domain: string; count: number }>,
      },
      timeline: {
        // Placeholder for daily view timeline
        // Would need separate tracking collection
        dailyViews: [] as Array<{ date: string; views: number }>,
      },
      lastViewedAt: conversation.lastViewedAt || null,
      publicSince: conversation.publicSince || null,
    };

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
