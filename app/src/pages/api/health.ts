import type { APIRoute } from 'astro';
import { getPBClient } from '@/lib/pb';
import { validateApiKey } from '@/lib/auth';

export const prerender = false;

/**
 * Health check endpoint that validates API key
 * GET /api/health
 * Headers: Authorization: Bearer <api_key>
 */
export const GET: APIRoute = async ({ request }) => {
  try {
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
      const userId = await validateApiKey(pb, apiKey);
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ ok: true, message: 'API key valid' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if it's the server API key
    if (apiKey === import.meta.env.SERVER_API_KEY) {
      return new Response(
        JSON.stringify({ ok: true, message: 'Server API key valid' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid API key' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in /api/health:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
