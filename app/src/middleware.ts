import type { MiddlewareHandler } from 'astro';

/**
 * Security middleware for CORS and security headers
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
  const response = await next();

  // Get allowed origin from env or use site URL
  const allowedOrigin = import.meta.env.PUBLIC_SITE_URL || context.url.origin;
  const origin = context.request.headers.get('origin');

  // CORS: Exact origin matching, not wildcard
  if (origin && origin === allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CSP: default-src 'self'; object-src 'none'
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://openrouter.ai;"
  );

  // HSTS (only for HTTPS)
  if (context.url.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Handle preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
};
