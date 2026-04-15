import { test, expect } from '@playwright/test';
import { ApiMonitor } from './api-helpers';
import { HomePage } from './page-objects/HomePage';
import { RegisterPage } from './page-objects/RegisterPage';
import { SettingsPage } from './page-objects/SettingsPage';

test.describe('Network Debugging', () => {
  test('debug API key fetching - check network requests', async ({ page }) => {
    const apiMonitor = new ApiMonitor(page);
    await apiMonitor.start();

    const homePage = new HomePage(page);
    const registerPage = new RegisterPage(page);
    const settingsPage = new SettingsPage(page);

    // Step 1: Register a new user
    const testEmail = `debug-test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    await homePage.goto();
    await homePage.clickGetStarted();
    await registerPage.verifyPageLoaded();
    await registerPage.register(testEmail, testPassword);
    await registerPage.verifyRegistrationSuccess();

    // Step 2: Navigate to settings to trigger API key fetch
    await settingsPage.goto();
    await settingsPage.verifyPageLoaded();

    // Step 3: Wait for API requests to complete
    await page.waitForTimeout(2000);

    // Step 4: Analyze network requests
    const allRequests = apiMonitor.getRequests();
    const failedRequests = apiMonitor.getFailedRequests();
    const apiKeysRequests = apiMonitor.getRequestsByEndpoint('/api/keys');

    console.log('\n=== Network Debugging Report ===');
    console.log(`Total API requests: ${allRequests.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);
    console.log(`API Keys requests: ${apiKeysRequests.length}`);

    // Log all API requests
    console.log('\n--- All API Requests ---');
    allRequests.forEach((req, index) => {
      console.log(`${index + 1}. ${req.method} ${req.url}`);
      console.log(`   Status: ${req.status}`);
      if (req.status >= 400) {
        console.log(`   Error: ${req.error || JSON.stringify(req.response)}`);
      }
    });

    // Log failed requests in detail
    if (failedRequests.length > 0) {
      console.log('\n--- Failed Requests Details ---');
      failedRequests.forEach((req, index) => {
        console.log(`\n${index + 1}. ${req.method} ${req.url}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Response:`, JSON.stringify(req.response, null, 2));
        console.log(`   Error: ${req.error || 'N/A'}`);
      });
    }

    // Log API keys requests specifically
    if (apiKeysRequests.length > 0) {
      console.log('\n--- API Keys Requests Details ---');
      apiKeysRequests.forEach((req, index) => {
        console.log(`\n${index + 1}. ${req.method} ${req.url}`);
        console.log(`   Status: ${req.status}`);
        if (req.status >= 200 && req.status < 300) {
          console.log(`   Response:`, JSON.stringify(req.response, null, 2));
        } else {
          console.log(`   Error Response:`, JSON.stringify(req.response, null, 2));
          console.log(`   Error: ${req.error || 'N/A'}`);
        }
      });
    }

    // Step 5: Verify API keys endpoint works
    const apiKeysRequest = apiKeysRequests.find(req => req.method === 'GET');
    if (apiKeysRequest) {
      if (apiKeysRequest.status === 200) {
        console.log('\n✅ API Keys endpoint returned 200');
        expect(apiKeysRequest.response).toHaveProperty('keys');
        expect(Array.isArray(apiKeysRequest.response.keys)).toBe(true);
        console.log(`   Found ${apiKeysRequest.response.keys.length} API key(s)`);
      } else {
        console.log(`\n❌ API Keys endpoint returned ${apiKeysRequest.status}`);
        console.log(`   Error: ${apiKeysRequest.error || JSON.stringify(apiKeysRequest.response)}`);
      }
    } else {
      console.log('\n⚠️  No API Keys GET request found');
    }

    // Step 6: Check for any unexpected failures
    const unexpectedFailures = failedRequests.filter(
      req => !req.url.includes('/api/stats') // stats endpoint can fail for non-admin users
    );

    if (unexpectedFailures.length > 0) {
      console.log('\n--- Unexpected Failures ---');
      unexpectedFailures.forEach((req) => {
        console.log(`${req.method} ${req.url} - ${req.status}`);
      });
    }

    // Step 7: Verify settings page loaded correctly
    const apiKeysSectionVisible = await settingsPage.isApiKeysSectionVisible();
    expect(apiKeysSectionVisible).toBe(true);

    console.log('\n=== End Network Debugging Report ===\n');
  });

  test('debug network with detailed request/response logging', async ({ page }) => {
    const apiMonitor = new ApiMonitor(page);
    await apiMonitor.start();

    // Enable detailed network logging
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        console.log(`[REQUEST] ${request.method()} ${url}`);
        const headers = request.headers();
        if (headers['authorization']) {
          console.log(`  Authorization: ${headers['authorization'].substring(0, 20)}...`);
        }
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const status = response.status();
        const method = response.request().method();
        console.log(`[RESPONSE] ${method} ${url} - ${status}`);

        if (status >= 400) {
          try {
            const body = await response.text();
            console.log(`  Error Body: ${body.substring(0, 500)}`);
          } catch (e) {
            console.log(`  Could not read error body: ${e}`);
          }
        }
      }
    });

    // Navigate to settings page
    await page.goto('/settings');
    await page.waitForTimeout(2000);

    // Get all requests
    const requests = apiMonitor.getRequests();
    console.log(`\nCaptured ${requests.length} API requests during navigation\n`);
  });
});
