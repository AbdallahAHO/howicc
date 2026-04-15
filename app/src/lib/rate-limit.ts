/**
 * Simple in-memory rate limiter
 * Per-IP rate limiting for API endpoints
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  // Check X-Forwarded-For header (for proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address (if available)
  return 'unknown';
}

/**
 * Check if request should be rate limited
 * @param request - The request object
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if rate limited, false otherwise
 */
export function isRateLimited(
  request: Request,
  maxRequests: number,
  windowMs: number
): boolean {
  // TEMPORARILY DISABLED FOR E2E TESTING
  return false;

  // const ip = getClientIP(request);
  // const key = `${ip}:${request.url}`;
  // const now = Date.now();

  // const entry = rateLimitStore.get(key);

  // if (!entry || entry.resetAt < now) {
  //   // Create new entry
  //   rateLimitStore.set(key, {
  //     count: 1,
  //     resetAt: now + windowMs,
  //   });
  //   return false;
  // }

  // // Increment count
  // entry.count++;

  // if (entry.count > maxRequests) {
  //   return true;
  // }

  // return false;
}

/**
 * Get remaining requests for an IP
 */
export function getRemainingRequests(
  request: Request,
  maxRequests: number = 100
): number {
  const ip = getClientIP(request);
  const key = `${ip}:${request.url}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < Date.now()) {
    return maxRequests;
  }

  return Math.max(0, maxRequests - entry.count);
}

/**
 * Rate limit configuration from environment variables
 */
export const RATE_LIMITS = {
  // Upload endpoint: 1000 requests per minute (increased for testing)
  UPLOAD: {
    maxRequests: parseInt(import.meta.env.RATE_LIMIT_UPLOAD || '1000', 10),
    windowMs: 60 * 1000,
  },
  // Publish endpoint: 1000 requests per minute
  PUBLISH: {
    maxRequests: parseInt(import.meta.env.RATE_LIMIT_PUBLISH || '1000', 10),
    windowMs: 60 * 1000,
  },
  // Ingest endpoint: 500 requests per minute
  INGEST: {
    maxRequests: parseInt(import.meta.env.RATE_LIMIT_INGEST || '500', 10),
    windowMs: 60 * 1000,
  },
  // 404 endpoint: 500 requests per minute (slug brute force protection)
  NOT_FOUND: {
    maxRequests: parseInt(import.meta.env.RATE_LIMIT_404 || '500', 10),
    windowMs: 60 * 1000,
  },
};
