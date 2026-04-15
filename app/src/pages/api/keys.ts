import type { APIRoute } from 'astro';
import { getAuthenticatedPBClient, getUserApiKeys, createApiKeyForUser, deleteApiKey } from '@/lib/auth';
import { Collections } from '@/lib/pb';
import { APIKeysResponseSchema, CreateAPIKeyResponseSchema } from '@howicc/schemas';

export const prerender = false;

// Get all API keys for the authenticated user
export const GET: APIRoute = async ({ request }) => {
  try {
    const authResult = await getAuthenticatedPBClient(request);

    if (!authResult) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { pb, user } = authResult;

    // getUserApiKeys now handles errors internally and returns empty array on failure
    const keys = await getUserApiKeys(pb, user.id);

    // Transform keys to ensure consistent structure
    // PocketBase may not return 'created' for user-authenticated clients (now optional in schema)
    const transformedKeys = keys.map((key: any) => ({
      id: key.id,
      user: key.user,
      key: key.key,
      name: key.name || null,
      ...(key.created && { created: key.created }), // Only include if present
      last_used: key.last_used || null,
    }));

    // Validate response
    const responseData = { keys: transformedKeys };
    const validatedResponse = APIKeysResponseSchema.parse(responseData);

    return new Response(
      JSON.stringify(validatedResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting API keys:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to get API keys',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Create a new API key for the authenticated user
export const POST: APIRoute = async ({ request }) => {
  try {
    const authResult = await getAuthenticatedPBClient(request);

    if (!authResult) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { pb, user } = authResult;
    const body = await request.json();
    const { name } = body;

    // Generate API key for the user
    const { id, key } = await createApiKeyForUser(pb, user.id, name || 'API Key');

    // Validate response
    const responseData = {
      id,
      key,
      success: true,
    };
    const validatedResponse = CreateAPIKeyResponseSchema.parse(responseData);

    return new Response(
      JSON.stringify(validatedResponse),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating API key:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Delete an API key
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const authResult = await getAuthenticatedPBClient(request);

    if (!authResult) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { pb, user } = authResult;
    const url = new URL(request.url);
    const keyId = url.searchParams.get('id');

    if (!keyId) {
      return new Response(
        JSON.stringify({ error: 'API key ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify the key belongs to the user
    try {
      const key = await pb.collection(Collections.API_KEYS).getOne(keyId);
      if (key.user !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'API key not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const success = await deleteApiKey(pb, keyId);

    if (!success) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete API key' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting API key:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to delete API key',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
