import type { APIRoute } from 'astro';
import { getPBClient } from '@/lib/pb';
import { IngestRequestSchema } from '@howicc/schemas';
import { queueProcessing } from '@/lib/process';
import { isRateLimited, RATE_LIMITS } from '@/lib/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Rate limiting
  if (isRateLimited(request, RATE_LIMITS.INGEST.maxRequests, RATE_LIMITS.INGEST.windowMs)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }
  try {
    // 1. Verify API key
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${import.meta.env.SERVER_API_KEY}`;

    if (authHeader !== expectedAuth) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const validationResult = IngestRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.format(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { conversationId } = validationResult.data;

    // 3. Get PocketBase client
    const pb = await getPBClient();

    // 4. Verify conversation exists
    try {
      await pb.collection('conversations').getOne(conversationId);
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Queue for processing
    queueProcessing(pb, conversationId);

    // 6. Return success
    return new Response(
      JSON.stringify({ ok: true, message: 'Processing queued' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in /api/ingest:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
