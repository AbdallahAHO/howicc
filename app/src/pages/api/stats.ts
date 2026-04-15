import type { APIRoute } from 'astro';
import { getPBClient, Collections } from '@/lib/pb';
import { StatsResponseSchema, APIErrorSchema } from '@howicc/schemas';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const pb = await getPBClient();

    const [conversationsResult, publicResult, tagsResult] = await Promise.all([
      pb.collection(Collections.CONVERSATIONS).getList(1, 1, { fields: 'id' }),
      pb.collection(Collections.CONVERSATIONS).getList(1, 1, {
        filter: 'visibility = "public" && allowListing = true',
        fields: 'id'
      }),
      pb.collection(Collections.TAGS).getList(1, 1, { fields: 'id' }),
    ]);

    const stats = {
      totalConversations: conversationsResult.totalItems,
      publicConversations: publicResult.totalItems,
      totalTags: tagsResult.totalItems,
    };

    // Validate response
    const validatedStats = StatsResponseSchema.parse(stats);

    return new Response(
      JSON.stringify(validatedStats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching stats:', error);

    const errorResponse = APIErrorSchema.parse({
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
