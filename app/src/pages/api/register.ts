import type { APIRoute } from 'astro';
import { createPBClient } from '@/lib/pb';
import { createApiKeyForUser, createSessionCookie } from '@/lib/auth';
import { RegisterResponseSchema, APIErrorSchema } from '@howicc/schemas';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password, passwordConfirm } = body;

    // Validate inputs
    if (!email || !password || !passwordConfirm) {
      return new Response(
        JSON.stringify({ error: 'All fields are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password !== passwordConfirm) {
      return new Response(
        JSON.stringify({ error: 'Passwords do not match' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pb = createPBClient();

    // Create user account
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm,
      emailVisibility: true,
    });

    // Authenticate the user to get auth token
    await pb.collection('users').authWithPassword(email, password);

    // Generate API key for the user
    const { key: apiKey } = await createApiKeyForUser(pb, user.id);

    // Get the auth token
    const token = pb.authStore.token;
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create session cookie
    const cookie = createSessionCookie(token);

    // Validate and structure response
    const responseData = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
      },
      apiKey,
    };

    const validatedResponse = RegisterResponseSchema.parse(responseData);

    // Return success with user data and API key
    return new Response(
      JSON.stringify(validatedResponse),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      }
    );
  } catch (error: any) {
    console.error('Registration error:', error);

    // Handle PocketBase validation errors
    if (error?.response?.code === 400 || error?.status === 400) {
      const pbData = error?.response?.data || {};
      const fieldErrors = pbData.data || {};
      const baseMessage = pbData.message || error?.message || 'Registration failed';

      // Extract field-specific validation errors
      const fieldMessages = Object.entries(fieldErrors)
        .map(([field, msg]: [string, any]) => {
          const fieldMsg = typeof msg === 'object' ? msg?.message || JSON.stringify(msg) : String(msg);
          return `${field}: ${fieldMsg}`;
        })
        .filter(Boolean);

      const errorMessage = fieldMessages.length > 0
        ? `${baseMessage} (${fieldMessages.join(', ')})`
        : baseMessage;

      // Special handling for common errors
      if (errorMessage.toLowerCase().includes('email') &&
          (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('unique'))) {
        const errorResponse = APIErrorSchema.parse({
          error: 'This email is already registered',
          details: fieldMessages.length > 0 ? { fields: fieldMessages } : undefined
        });
        return new Response(
          JSON.stringify(errorResponse),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const errorResponse = APIErrorSchema.parse({
        error: errorMessage,
        details: fieldMessages.length > 0 ? { fields: fieldMessages } : undefined
      });
      return new Response(
        JSON.stringify(errorResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle other errors with better context
    const errorResponse = APIErrorSchema.parse({
      error: 'Registration failed',
      details: {
        message: error?.message || 'Unknown error',
        ...(error?.response?.data && { pbError: error.response.data }),
      },
    });

    return new Response(
      JSON.stringify(errorResponse),
      { status: error?.status || 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
