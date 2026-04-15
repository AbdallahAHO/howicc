import type { APIRoute } from 'astro';
import { getPBClient, Collections } from '@/lib/pb';
import { PublishRequestSchema } from '@howicc/schemas';
import { validateApiKey } from '@/lib/auth';

export const prerender = false;

/**
 * Publish a conversation (update visibility and listing status)
 * POST /api/publish/:id
 */
export const POST: APIRoute = async ({ request, params }) => {
  try {
    const conversationId = params?.id;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ error: 'Conversation ID required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Verify API key
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const pb = await getPBClient();

    // Validate API key and get user ID
    const authenticatedUserId = await validateApiKey(pb, apiKey);
    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get conversation
    const conversation = await pb
      .collection(Collections.CONVERSATIONS)
      .getOne(conversationId);

    // 3. Verify ownership
    if (conversation.user !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: not the owner' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Parse and validate request body
    const body = await request.json();
    const validationResult = PublishRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          details: validationResult.error.format(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { visibility, allowListing } = validationResult.data;

    // 5. Check if making public with secrets flag
    if (visibility === 'public') {
      const safetyFlags = conversation.safety_flags as { secrets?: boolean } | undefined;
      if (safetyFlags?.secrets === true) {
        return new Response(
          JSON.stringify({
            error: 'Cannot make public: secrets detected. Please redact secrets first.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Prepare updates
    const updates: Record<string, any> = {
      visibility,
      allowListing: allowListing ?? false,
    };

    // Set publicSince if making public for the first time
    if (visibility === 'public' && !conversation.publicSince) {
      updates.publicSince = new Date().toISOString();
    }

    // Clear publicSince if making private/unlisted
    if (visibility !== 'public' && conversation.publicSince) {
      updates.publicSince = null;
    }

    // Ensure allowListing is false if not public
    if (visibility !== 'public') {
      updates.allowListing = false;
    }

    // 7. Update conversation
    const updated = await pb
      .collection(Collections.CONVERSATIONS)
      .update(conversationId, updates);

    // 8. Return success
    return new Response(
      JSON.stringify({
        success: true,
        id: updated.id,
        slug: updated.slug,
        visibility: updated.visibility,
        allowListing: updated.allowListing,
        publicSince: updated.publicSince,
        url: `/p/${updated.slug}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error publishing conversation:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
