import type { Page, Response } from '@playwright/test';

/**
 * API Helpers for E2E Tests
 * Monitor and debug API requests during tests
 */

export interface ApiRequest {
  url: string;
  method: string;
  status: number;
  response?: any;
  error?: string;
}

/**
 * Monitor API requests during test execution
 */
export class ApiMonitor {
  private requests: ApiRequest[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Start monitoring API requests
   */
  async start() {
    this.requests = [];

    // Monitor both requests and responses for complete debugging
    this.page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        const method = request.method();
        const headers = request.headers();

        // Log request details
        console.log(`[API Request] ${method} ${url}`);
        if (headers['authorization']) {
          const authHeader = headers['authorization'];
          console.log(`  Authorization: ${authHeader.substring(0, 20)}...`);
        }

        // Try to capture request body for POST/PUT requests
        try {
          const postData = request.postData();
          if (postData) {
            console.log(`  Request Body: ${postData.substring(0, 200)}...`);
          }
        } catch (e) {
          // Ignore errors reading post data
        }
      }
    });

    this.page.on('response', async (response) => {
      const url = response.url();

      // Only monitor API endpoints
      if (url.includes('/api/')) {
        const request = response.request();
        const method = request.method();
        const status = response.status();

        let responseBody: any = null;
        let error: string | undefined;

        try {
          if (status >= 200 && status < 300) {
            responseBody = await response.json().catch(() => null);
          } else {
            const text = await response.text().catch(() => '');
            try {
              responseBody = JSON.parse(text);
            } catch {
              error = text || `HTTP ${status}`;
            }
          }
        } catch (e) {
          error = e instanceof Error ? e.message : 'Unknown error';
        }

        const apiRequest: ApiRequest = {
          url,
          method,
          status,
          response: responseBody,
          error,
        };

        this.requests.push(apiRequest);

        // Log API failures with detailed information
        if (status >= 400) {
          console.error(`[API Error] ${method} ${url} - ${status}`);
          console.error(`  Response:`, JSON.stringify(responseBody, null, 2));
          if (error) {
            console.error(`  Error: ${error}`);
          }

          // Log response headers for debugging
          try {
            const headers = response.headers();
            console.error(`  Response Headers:`, JSON.stringify(headers, null, 2));
          } catch (e) {
            // Ignore errors reading headers
          }
        } else {
          console.log(`[API Success] ${method} ${url} - ${status}`);
        }
      }
    });
  }

  /**
   * Get all API requests
   */
  getRequests(): ApiRequest[] {
    return [...this.requests];
  }

  /**
   * Get failed API requests
   */
  getFailedRequests(): ApiRequest[] {
    return this.requests.filter(req => req.status >= 400);
  }

  /**
   * Get API requests by endpoint
   */
  getRequestsByEndpoint(endpoint: string): ApiRequest[] {
    return this.requests.filter(req => req.url.includes(endpoint));
  }

  /**
   * Get last API request
   */
  getLastRequest(): ApiRequest | null {
    return this.requests.length > 0 ? this.requests[this.requests.length - 1] : null;
  }

  /**
   * Clear requests history
   */
  clear() {
    this.requests = [];
  }

  /**
   * Wait for API request to complete
   */
  async waitForApiRequest(
    endpoint: string,
    method: string = 'GET',
    timeout: number = 5000
  ): Promise<ApiRequest | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const request = this.requests.find(
        req => req.url.includes(endpoint) && req.method === method
      );

      if (request) {
        return request;
      }

      await this.page.waitForTimeout(100);
    }

    return null;
  }

  /**
   * Assert no API failures occurred
   */
  assertNoFailures() {
    const failures = this.getFailedRequests();
    if (failures.length > 0) {
      const errorMessages = failures.map(
        req => `${req.method} ${req.url} - ${req.status}: ${req.error || JSON.stringify(req.response)}`
      );
      throw new Error(`API failures detected:\n${errorMessages.join('\n')}`);
    }
  }
}

/**
 * Wait for API response and verify it's successful
 */
export async function waitForApiResponse(
  page: Page,
  endpoint: string,
  method: string = 'GET',
  timeout: number = 5000
): Promise<Response> {
  const response = await page.waitForResponse(
    (response) => {
      const url = response.url();
      return url.includes(endpoint) && response.request().method() === method;
    },
    { timeout }
  );

  if (response.status() >= 400) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `API request failed: ${method} ${endpoint} - ${response.status()}\n${body}`
    );
  }

  return response;
}

/**
 * Verify API response is successful
 */
export async function verifyApiResponse(
  response: Response,
  expectedStatus: number = 200
): Promise<void> {
  const status = response.status();

  if (status !== expectedStatus) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Expected status ${expectedStatus}, got ${status}\n${body}`
    );
  }
}
