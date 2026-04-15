import type { APIRoute } from 'astro';
import { getPBClient, Collections } from '@/lib/pb';
import { LeaderboardResponseSchema, APIErrorSchema, TagSchema } from '@howicc/schemas';

export const prerender = false;

/**
 * Get leaderboard/trending conversations
 * GET /api/leaderboard?period=7d|30d&type=trending|alltime&limit=10
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const period = url.searchParams.get('period') || '7d';
    const type = url.searchParams.get('type') || 'trending';
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const pb = await getPBClient();

    // Build filter for public, listed conversations
    const filter = `visibility = "public" && allowListing = true`;

    // Get conversations with tags expanded
    const conversations = await pb
      .collection(Collections.CONVERSATIONS)
      .getList(1, limit * 2, {
        filter,
        sort: type === 'trending' ? '-publicSince' : '-viewsTotal',
        expand: 'tags',
      });

    // Calculate trending scores if needed
    let scored = conversations.items.map((conv) => {
      const views7d = conv.viewsUnique24h || 0; // Simplified: use 24h views as proxy
      const publicSince = conv.publicSince ? new Date(conv.publicSince) : new Date();
      const ageHours = (Date.now() - publicSince.getTime()) / (1000 * 60 * 60);

      // Trending score: uniqueViews_7d / (1 + age_hours / 24)^1.5
      const trendingScore = views7d / Math.pow(1 + ageHours / 24, 1.5);

      // Get expanded tags and validate them
      let tags: any[] = [];
      if (conv.expand?.tags) {
        const rawTags = Array.isArray(conv.expand.tags) ? conv.expand.tags : [conv.expand.tags];
        tags = rawTags.map(tag => TagSchema.parse(tag));
      }

      return {
        id: conv.id,
        slug: conv.slug,
        title: conv.title,
        summary: conv.summary || null,
        viewsTotal: conv.viewsTotal || 0,
        viewsUnique24h: conv.viewsUnique24h || 0,
        publicSince: conv.publicSince || null,
        trendingScore,
        tags,
      };
    });

    // Sort by trending score if type is trending
    if (type === 'trending') {
      scored.sort((a, b) => b.trendingScore - a.trendingScore);
    } else {
      // All-time: sort by viewsTotal, tie-break by recent velocity
      scored.sort((a, b) => {
        if (b.viewsTotal !== a.viewsTotal) {
          return b.viewsTotal - a.viewsTotal;
        }
        return b.viewsUnique24h - a.viewsUnique24h;
      });
    }

    // Limit results
    const results = scored.slice(0, limit);

    // Validate response
    const responseData = {
      period,
      type: type as 'trending' | 'alltime',
      conversations: results,
    };

    const validatedResponse = LeaderboardResponseSchema.parse(responseData);

    return new Response(
      JSON.stringify(validatedResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    const errorResponse = APIErrorSchema.parse({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
