// ============================================================
// playwright.config.js
// This is the main configuration file for Playwright.
// Playwright reads this file automatically when you run tests.
// ============================================================

// Import the defineConfig helper from Playwright.
// This gives us autocomplete and validation for our settings.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({

  // ---------------------------------------------------------
  // testDir: Where Playwright should look for test files.
  // All files ending in .spec.js inside the 'tests' folder
  // will be picked up as tests.
  // ---------------------------------------------------------
  testDir: './tests',

  // ---------------------------------------------------------
  // timeout: Maximum time (in milliseconds) a single test
  // is allowed to run before it is marked as failed.
  // 120000ms = 2 minutes — needed for checkout and payment flows.
  // ---------------------------------------------------------
  timeout: 120000,

  // ---------------------------------------------------------
  // retries: If a test fails, how many times should
  // Playwright automatically retry it?
  // 0 means no retries - fail immediately.
  // ---------------------------------------------------------
  retries: 0,

  // ---------------------------------------------------------
  // reporter: Controls how test results are displayed.
  // 'html' creates a nice visual report you can open in a browser.
  // ---------------------------------------------------------
  reporter: [['html', { open: 'never' }]],

  // ---------------------------------------------------------
  // use: These settings apply to EVERY test by default.
  // ---------------------------------------------------------
  use: {

    // The base website URL. All page.goto('/some-path') calls
    // will be relative to this. So goto('/') goes to the homepage.
    baseURL: 'https://mcstaging2.hal-uae.com',

    // Take a screenshot for every test, whether it passes or fails.
    screenshot: 'on',

    // Record a video for every test, whether it passes or fails.
    video: 'on',

    // Capture a full trace for every test so you can inspect step-by-step.
    // Open with: npx playwright show-trace trace.zip
    trace: 'on',

    // How long to wait for a single action (like a click) to complete.
    actionTimeout: 15000,

    // How long to wait for a page to fully load after navigation.
    navigationTimeout: 30000,
  },

  // ---------------------------------------------------------
  // projects: Which browsers should run the tests?
  // We start with just Chromium (Google Chrome) to keep it simple.
  // You can add 'firefox' and 'webkit' (Safari) later.
  // ---------------------------------------------------------
  projects: [
    {
      name: 'chromium',
      use: {
        // Use a standard Desktop Chrome browser profile
        ...devices['Desktop Chrome'],
      },
    },

    // Firefox is needed for the checkout/payment tests because the
    // N-Genius sandbox payment page has an HTTP/2 bug that Chromium
    // rejects with ERR_HTTP2_PROTOCOL_ERROR.  Firefox's HTTP/2 stack
    // handles the server correctly.
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
  ],

});
