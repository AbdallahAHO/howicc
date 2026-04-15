import type { APIRoute } from 'astro';
import { clearSessionCookie } from '@/lib/auth';

export const prerender = false;

export const POST: APIRoute = async () => {
  const cookie = clearSessionCookie();

  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    }
  );
};
