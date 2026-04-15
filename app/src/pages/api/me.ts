import type { APIRoute } from 'astro';
import { getAuthenticatedPBClient } from '@/lib/auth';
import { UserResponseSchema } from '@howicc/schemas';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  try {
    const authResult = await getAuthenticatedPBClient(request);

    const responseData = {
      user: authResult ? {
        id: authResult.user.id,
        email: authResult.user.email,
      } : null,
    };

    const validatedResponse = UserResponseSchema.parse(responseData);

    return new Response(
      JSON.stringify(validatedResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting current user:', error);
    const responseData = { user: null };
    const validatedResponse = UserResponseSchema.parse(responseData);
    return new Response(
      JSON.stringify(validatedResponse),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
