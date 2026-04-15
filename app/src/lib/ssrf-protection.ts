/**
 * SSRF Protection Utilities
 * Validates URLs to prevent Server-Side Request Forgery attacks
 */

/**
 * Check if an IP address is in a private network range
 */
function isPrivateIP(ip: string): boolean {
  // RFC1918 private networks
  // 10.0.0.0/8
  if (/^10\./.test(ip)) return true;

  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;

  // 192.168.0.0/16
  if (/^192\.168\./.test(ip)) return true;

  // Loopback
  if (/^127\./.test(ip)) return true;
  if (ip === '::1' || ip === 'localhost') return true;

  // Link-local
  if (/^169\.254\./.test(ip)) return true;

  return false;
}

/**
 * Validate URL to prevent SSRF attacks
 * @param url - The URL to validate
 * @param allowedHosts - Optional list of allowed hosts (e.g., PocketBase instance)
 * @returns true if URL is safe, false otherwise
 */
export function isSafeURL(url: string, allowedHosts?: string[]): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // If allowed hosts are specified, check against them
    if (allowedHosts && allowedHosts.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      const isAllowed = allowedHosts.some(allowed => {
        const allowedHost = allowed.toLowerCase();
        return hostname === allowedHost || hostname.endsWith('.' + allowedHost);
      });

      if (!isAllowed) {
        return false;
      }
    }

    // Check if hostname resolves to private IP
    // Note: In production, you should actually resolve DNS to check
    // For now, we'll check common patterns
    const hostname = parsed.hostname.toLowerCase();

    // Reject if hostname looks like a private IP
    if (isPrivateIP(hostname)) {
      return false;
    }

    // Reject localhost variations
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '127.0.0.1') {
      return false;
    }

    return true;
  } catch (error) {
    // Invalid URL
    return false;
  }
}

/**
 * Safely fetch a URL with SSRF protection
 * @param url - The URL to fetch
 * @param allowedHosts - Optional list of allowed hosts
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Response or null if unsafe
 */
export async function safeFetch(
  url: string,
  allowedHosts?: string[],
  timeout: number = 5000
): Promise<Response | null> {
  if (!isSafeURL(url, allowedHosts)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.error('Safe fetch error:', error);
    return null;
  }
}
