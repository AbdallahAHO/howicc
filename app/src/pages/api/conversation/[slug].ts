import type { APIRoute } from 'astro';
import { getPBClient, Collections, getConversationFileURL } from '@/lib/pb';
import { getAuthenticatedPBClient } from '@/lib/auth';
import { ConversationResponseSchema, APIErrorSchema, type ConversationRecord } from '@howicc/schemas';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is authenticated
    const authResult = await getAuthenticatedPBClient(request);
    const currentUser = authResult?.user || null;

    // Fetch conversation from PocketBase
    const pb = await getPBClient();

    // First, fetch by slug (admin client can see all)
    let result;
    try {
      result = await pb
        .collection<ConversationRecord>(Collections.CONVERSATIONS)
        .getList(1, 1, {
          filter: `slug="${slug}"`,
          expand: 'tags',
        });
    } catch (error: any) {
      // If filter fails, try fetching all and filtering client-side
      console.warn('[API] Slug filter failed, using client-side filter:', error?.message);
      const allResult = await pb
        .collection<ConversationRecord>(Collections.CONVERSATIONS)
        .getList(1, 1000);

      const found = allResult.items.find((conv: any) => conv.slug === slug);
      if (found) {
        result = { items: [found], totalItems: 1 };
      } else {
        result = { items: [], totalItems: 0 };
      }
    }

    if (!result.items[0]) {
      const errorResponse = APIErrorSchema.parse({ error: 'Conversation not found' });
      return new Response(
        JSON.stringify(errorResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const conversation = result.items[0] as any;

    console.log(`[API] Fetching conversation ${slug}, status: ${conversation.status}, visibility: ${conversation.visibility}`);

    // Check visibility and ownership permissions
    const isOwner = currentUser && conversation.user === currentUser.id;
    const isPublic = conversation.visibility === 'public';
    const isUnlisted = conversation.visibility === 'unlisted';
    const isPrivate = conversation.visibility === 'private';

    // Access control: user must be owner for private, or conversation must be public/unlisted
    if (isPrivate && !isOwner) {
      console.log(`[API] Access denied: private conversation, user is not owner`);
      const errorResponse = APIErrorSchema.parse({ error: 'Conversation not found' });
      return new Response(
        JSON.stringify(errorResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isPublic && !isUnlisted && !isOwner) {
      console.log(`[API] Access denied: conversation not public/unlisted and user is not owner`);
      const errorResponse = APIErrorSchema.parse({ error: 'Conversation not found' });
      return new Response(
        JSON.stringify(errorResponse),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Ensure required fields are present
    if (!conversation.created) {
      conversation.created = conversation.created || new Date().toISOString();
    }
    if (!conversation.updated) {
      conversation.updated = conversation.updated || conversation.created || new Date().toISOString();
    }

    // Get expanded tags
    let tags: any[] = [];
    if (conversation.expand?.tags) {
      tags = Array.isArray(conversation.expand.tags)
        ? conversation.expand.tags
        : [conversation.expand.tags];
    } else if (conversation.tags && typeof conversation.tags === 'string') {
      // Handle case where tags is a string (shouldn't happen but handle gracefully)
      tags = [];
    }

    // Ensure tags field is an array of IDs, not a string
    if (conversation.tags && typeof conversation.tags === 'string') {
      try {
        conversation.tags = JSON.parse(conversation.tags);
      } catch {
        conversation.tags = [];
      }
    }
    if (!Array.isArray(conversation.tags)) {
      conversation.tags = [];
    }

    // Handle null values from PocketBase - convert to undefined or empty arrays/objects
    // Zod validation fails on null but accepts undefined
    if (conversation.messages_json === null) {
      conversation.messages_json = undefined;
    }
    if (conversation.takeaways === null) {
      conversation.takeaways = undefined;
    }
    if (conversation.safety_flags === null) {
      conversation.safety_flags = undefined;
    }

    // Get file URL if markdown file exists
    let fileUrl: string | null = null;
    if (conversation.md) {
      try {
        fileUrl = getConversationFileURL(pb, conversation);
      } catch (error) {
        console.error('Error getting file URL:', error);
      }
    }

    // Validate and structure response
    const responseData = {
      conversation,
      tags,
      fileUrl,
    };

    console.log(`[API] Response data prepared, messages_json: ${conversation.messages_json ? 'present' : 'null/undefined'}, takeaways: ${conversation.takeaways ? 'present' : 'null/undefined'}, safety_flags: ${conversation.safety_flags ? 'present' : 'null/undefined'}`);

    const validatedResponse = ConversationResponseSchema.parse(responseData);

    return new Response(
      JSON.stringify(validatedResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching conversation:', error);

    const errorResponse = APIErrorSchema.parse({
      error: 'Failed to fetch conversation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
