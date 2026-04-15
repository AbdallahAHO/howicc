import type { APIRoute } from 'astro';
import { createPBClient } from '@/lib/pb';
import { createSessionCookie } from '@/lib/auth';
import { LoginResponseSchema, APIErrorSchema } from '@howicc/schemas';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pb = createPBClient();

    // Authenticate with PocketBase
    const authData = await pb.collection('users').authWithPassword(email, password);

    // Get the auth token
    const token = pb.authStore.token;
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create session cookie
    const cookie = createSessionCookie(token);

    // Validate and structure response
    const responseData = {
      success: true,
      user: {
        id: authData.record.id,
        email: authData.record.email,
      },
    };

    const validatedResponse = LoginResponseSchema.parse(responseData);

    // Return success with user data
    return new Response(
      JSON.stringify(validatedResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      }
    );
  } catch (error: any) {
    console.error('Login error:', error);

    // Handle PocketBase auth errors
    if (error?.status === 400 || error?.response?.code === 400) {
      const errorResponse = APIErrorSchema.parse({ error: 'Invalid email or password' });
      return new Response(
        JSON.stringify(errorResponse),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const errorResponse = APIErrorSchema.parse({
      error: 'Login failed',
      details: error?.message || 'Unknown error',
    });

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
