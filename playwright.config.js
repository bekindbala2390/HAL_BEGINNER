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
  // 30000ms = 30 seconds.
  // ---------------------------------------------------------
  timeout: 30000,

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

    // Take a screenshot automatically when a test fails.
    // Helps you see what went wrong without running the test again.
    screenshot: 'only-on-failure',

    // Record a video when a test fails.
    // You can replay it to understand what happened.
    video: 'retain-on-failure',

    // Capture a trace (detailed logs + screenshots) on first retry.
    // Open with: npx playwright show-trace trace.zip
    trace: 'on-first-retry',

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
  ],

});
