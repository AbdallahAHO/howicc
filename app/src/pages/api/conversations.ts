import type { APIRoute } from 'astro';
import { getPBClient, Collections, ConversationStatus, generateUniqueSlugFromChecksum, ensureTagsByNames } from '@/lib/pb';
import { ConversationSchema, type Conversation } from '@howicc/schemas';
import { calculateDeterministicChecksum } from '@/lib/checksum';
import { queueProcessing } from '@/lib/process';
import { validateApiKey } from '@/lib/auth';
import { isRateLimited, RATE_LIMITS } from '@/lib/rate-limit';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // Rate limiting
  if (isRateLimited(request, RATE_LIMITS.UPLOAD.maxRequests, RATE_LIMITS.UPLOAD.windowMs)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 1. Verify API key (user key, server key, or demo mode)
    const isDemoMode = import.meta.env.DEMO_MODE === 'true';
    let authenticatedUserId: string | null = null;

    if (!isDemoMode) {
      const authHeader = request.headers.get('authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid authorization header' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const apiKey = authHeader.replace('Bearer ', '');
      const pb = await getPBClient();

      // Check if it's a user API key (starts with hcc_)
      if (apiKey.startsWith('hcc_')) {
        authenticatedUserId = await validateApiKey(pb, apiKey);

        if (!authenticatedUserId) {
          return new Response(
            JSON.stringify({ error: 'Invalid API key' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      // Check if it's the server API key
      else if (apiKey !== import.meta.env.SERVER_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Ensure we have an authenticated user (required for user field)
    if (!authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: 'User authentication required. Use a user API key (hcc_*) to create conversations.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse JSON body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rawBody = await request.json();

    // 4. Validate with ConversationSchema
    const validationResult = ConversationSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid conversation format',
          details: validationResult.error.format(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conversation: Conversation = validationResult.data;

    // 5. Calculate deterministic checksum server-side
    const checksum = calculateDeterministicChecksum(conversation.timeline);

    // 6. Get PocketBase client
    const pb = await getPBClient();

    // 7. Check for duplicate by checksum
    try {
      const duplicate = await pb
        .collection(Collections.CONVERSATIONS)
        .getList(1, 1, {
          filter: `checksum="${checksum}"`,
        });

      if (duplicate.items[0]) {
        const existingConv = duplicate.items[0];
        console.log(`[API] Duplicate conversation found: ${existingConv.id} (slug: ${existingConv.slug})`);

        // Return the existing conversation with full timeline
        return new Response(
          JSON.stringify({
            ...conversation,
            id: existingConv.id,
            checksum,
            duplicate: true,
            slug: existingConv.slug,
            url: `/p/${existingConv.slug}`,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('[API] Error checking for duplicates:', error);
      // Continue with upload if check fails
    }

    // 8. Extract additional metadata from payload
    const visibility = (rawBody.visibility as 'private' | 'unlisted' | 'public') || 'private';
    const allowListing = rawBody.allowListing ?? false;
    const descriptionUser = rawBody.description_user;

    // 9. Ensure tags exist and get IDs
    const tagIds = conversation.tags && conversation.tags.length > 0
      ? await ensureTagsByNames(pb, conversation.tags)
      : [];

    // 10. Generate unique slug from checksum
    const uniqueSlug = await generateUniqueSlugFromChecksum(pb, checksum);

    // 11. Create record in PocketBase
    const pbData = {
      title: conversation.title,
      slug: uniqueSlug,
      status: ConversationStatus.UPLOADED,
      source: rawBody.source || 'claude',
      visibility,
      allowListing,
      viewsTotal: 0,
      viewsUnique24h: 0,
      user: authenticatedUserId,
      checksum,
      timeline: conversation.timeline,
      description_user: descriptionUser,
      tags: tagIds.length > 0 ? tagIds : undefined,
    };

    console.log(`[API] Creating conversation with slug: ${uniqueSlug}, checksum: ${checksum}`);
    const created = await pb.collection(Collections.CONVERSATIONS).create(pbData);
    console.log(`[API] Conversation created: ${created.id}`);

    // 12. Queue for processing
    queueProcessing(pb, created.id);
    console.log(`[API] Queued conversation ${created.id} for processing`);

    // 13. Return the full validated conversation object
    const responseConversation: Conversation & { url: string; checksum: string; slug: string } = {
      ...conversation,
      id: created.id,
      checksum,
      slug: created.slug,
      url: `/p/${created.slug}`,
    };

    return new Response(
      JSON.stringify(responseConversation),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in /api/conversations:', error);

    // If it's a PocketBase ClientResponseError, extract validation details
    if (error && typeof error === 'object' && 'response' in error) {
      const pbError = error as any;
      if (pbError.response?.data) {
        console.error('PocketBase validation errors:', JSON.stringify(pbError.response.data, null, 2));
        return new Response(
          JSON.stringify({
            error: 'Validation failed',
            details: pbError.response.data,
          }),
          { status: pbError.status || 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
