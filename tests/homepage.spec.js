// ============================================================
// tests/homepage.spec.js
//
// FULL HOMEPAGE TEST SUITE — Single Browser Session
//
// All 11 tests run inside ONE continuous browser session.
// The browser opens once (beforeAll) and closes once (afterAll).
// There is NO browser restart between tests.
//
// HOW IT WORKS:
//   - beforeAll  : opens the browser, goes to the homepage ONCE
//   - afterAll   : closes the browser ONCE at the very end
//   - Tests run  : sequentially in the order written below
//
// IMPORTANT TRADE-OFF (compared to beforeEach approach):
//   + No browser restart → smoother visual flow in headed mode
//   + Cart/login session is PRESERVED across tests
//   + Faster overall run time
//   ─────────────────────────────────────────────────────
//   ⚠ Tests are now ORDER-DEPENDENT. A failure in an early
//     test may cause later tests to fail for the wrong reason.
//   ⚠ Tests that navigate away from the homepage must call
//     homePage.goto() at their own start to reset position.
//
// GROUPS (organised with comments inside one describe block):
//   Group 1 — Core Elements      (tests  1–6): stay on homepage
//   Group 2 — Section Redirects  (tests  7–8): navigate away
//   Group 3 — Product Interactions (tests 9–11): navigate away
// ============================================================

// Import Playwright's test runner and assertion library
const { test, expect } = require('@playwright/test');

// Import our HomePage Page Object
const { HomePage } = require('../pages/HomePage');


test.describe('Homepage - Full Test Suite', () => {

  // ----------------------------------------------------------
  // Set a 60-second time limit for EVERY test in this block.
  // The staging server can be slow (AJAX, page loads, etc.),
  // so 30s (the default) is too tight for some of these tests.
  // ----------------------------------------------------------
  test.setTimeout(60000);

  // ----------------------------------------------------------
  // Shared variables — declared OUTSIDE individual tests so
  // ALL tests in this describe block can read and write them.
  //
  // `page`     → the single browser tab shared across all tests
  // `homePage` → our HomePage Page Object for that tab
  // ----------------------------------------------------------
  let page;
  let homePage;


  // ----------------------------------------------------------
  // test.beforeAll()
  // -----------------
  // Runs ONCE before any test starts.
  //
  // { browser } is a Playwright fixture — it gives us access
  // to the browser process so we can manually create a page.
  //
  // We use beforeAll (not beforeEach) so the browser opens
  // exactly ONCE, stays open for all 11 tests, and only
  // closes when afterAll runs at the very end.
  // ----------------------------------------------------------
  test.beforeAll(async ({ browser }) => {

    // Create a single browser tab (page) for the whole suite
    page = await browser.newPage();

    // Create the HomePage Page Object using that shared tab
    homePage = new HomePage(page);

    // Navigate to the homepage (uses baseURL from playwright.config.js)
    await homePage.goto();

    // Wait for the HTML to be ready before any test starts
    await page.waitForLoadState('domcontentloaded');
  });


  // ----------------------------------------------------------
  // test.afterAll()
  // ----------------
  // Runs ONCE after ALL tests have finished.
  // Closes the shared browser tab.
  // ----------------------------------------------------------
  test.afterAll(async () => {
    await page.close();
  });


  // ============================================================
  // GROUP 1: Core Elements
  //
  // These tests check that the homepage loads correctly.
  // None of them navigate away from the homepage, so after
  // all 6 tests the browser is still on the homepage.
  // ============================================================

  // --------------------------------------------------------
  // TEST 1: Page title should contain "HAL"
  // --------------------------------------------------------
  test('page title should contain HAL', async () => {

    // getPageTitle() returns the text in the browser tab
    const title = await homePage.getPageTitle();

    // Check that the title includes "HAL"
    expect(title).toContain('HAL');

    console.log('Page title is:', title);
  });


  // --------------------------------------------------------
  // TEST 2: Navigation bar should be visible
  // --------------------------------------------------------
  test('navigation bar should be visible', async () => {

    const isVisible = await homePage.isNavigationBarVisible();

    // toBe(true) checks the value is exactly true
    expect(isVisible).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 3: Footer should be visible
  // --------------------------------------------------------
  test('footer should be visible', async () => {

    const isVisible = await homePage.isFooterVisible();
    expect(isVisible).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 4: Cart icon should be visible in header
  // --------------------------------------------------------
  test('cart icon should be visible in header', async () => {

    // toBeVisible() is Playwright's web-first assertion —
    // it auto-retries for a few seconds before failing
    await expect(homePage.cartIcon).toBeVisible();
  });


  // --------------------------------------------------------
  // TEST 5: Page URL should be the homepage
  // --------------------------------------------------------
  test('page URL should be the homepage', async () => {

    // toHaveURL() checks the current browser URL.
    // We pass a regex so it matches any URL containing the domain.
    await expect(page).toHaveURL(/mcstaging2\.hal-uae\.com/);
  });


  // --------------------------------------------------------
  // TEST 6: Page should not show error messages on load
  // --------------------------------------------------------
  test('page should load without visible error messages', async () => {

    // Count how many elements contain "404" text
    const errorCount = await page.locator('text=404').count();

    // We expect zero — no error page
    expect(errorCount).toBe(0);
  });


  // ============================================================
  // GROUP 2: Section Redirections
  //
  // These tests click sections of the homepage and verify that
  // the browser navigates to a new URL.
  //
  // GROUP 1 left the browser on the homepage, so Test 7 can
  // start directly. Test 7 navigates to food-beverage, so
  // Test 8 must call homePage.goto() first to return.
  // ============================================================

  // --------------------------------------------------------
  // TEST 7: Clicking the homepage promotional banner redirects
  //
  // The browser is still on the homepage after Group 1.
  // No goto() needed here.
  // --------------------------------------------------------
  test('clicking first homepage banner should redirect away from homepage', async () => {

    // Save the URL before clicking (should be the homepage)
    const urlBefore = page.url();

    // Click the "Buy Now" link in the Food & Daily Meal section
    await homePage.clickFirstBannerLink();

    // Save the URL after the click and page load
    const urlAfter = page.url();

    console.log('URL before banner click:', urlBefore);
    console.log('URL after banner click: ', urlAfter);

    // The URL must have changed — we should be on a new page now
    expect(urlAfter).not.toEqual(urlBefore);
  });


  // --------------------------------------------------------
  // TEST 8: Clicking the About Us nav link redirects
  //
  // Test 7 left us on the food-beverage page.
  // We call homePage.goto() first to return to the homepage.
  // --------------------------------------------------------
  test('clicking About Us navigation link should redirect away from homepage', async () => {

    // Return to homepage — Test 7 left us on food-beverage
    await homePage.goto();
    await page.waitForLoadState('domcontentloaded');

    // Save the URL (now the homepage again)
    const urlBefore = page.url();

    // Click the About Us link in the nav bar
    await homePage.clickFirstCategoryLink();

    // Save the URL after clicking
    const urlAfter = page.url();

    console.log('URL before nav click:', urlBefore);
    console.log('URL after nav click:  ', urlAfter);

    // URL must have changed to the About Us page
    expect(urlAfter).not.toEqual(urlBefore);
  });


  // ============================================================
  // GROUP 3: Product Interactions
  //
  // These tests interact with product cards shown on the homepage.
  // Test 8 left the browser on the About Us page, so Test 9
  // calls homePage.goto() to return to the homepage.
  //
  // After that:
  //   Test  9 → stays on homepage (just counts products)
  //   Test 10 → navigates to PDP (configurable product redirect)
  //   Test 11 → needs homepage → calls goto() first
  //
  // ──────────────────────────────────────────────────────────
  // SUGGESTION — Cart Page Verification:
  // The first homepage product (Dove) is a CONFIGURABLE product.
  // Clicking its "Add to Cart" redirects to the PDP because
  // the user must first select options (Pack Size, etc.).
  //
  // To verify that items actually appear in the cart, add a
  // future test that:
  //   Step 1: On the PDP (after the redirect), select Pack Size
  //           e.g. page.locator('.swatch-option').first().click()
  //   Step 2: Click the main "Add to Cart" button on the PDP
  //   Step 3: Wait for the green success toast to appear
  //   Step 4: Navigate to /checkout/cart
  //   Step 5: Assert the product name appears in the cart table
  // ──────────────────────────────────────────────────────────
  // ============================================================

  // --------------------------------------------------------
  // TEST 9: Homepage should display product cards
  //
  // Test 8 left us on About Us. Return to homepage first.
  // --------------------------------------------------------
  test('homepage should display at least one product card', async () => {

    // Return to homepage — Test 8 left us on About Us
    await homePage.goto();
    await page.waitForLoadState('domcontentloaded');

    // Count how many product cards are shown on the homepage
    const count = await homePage.getProductCount();

    console.log('Product cards found on homepage:', count);

    // Expect at least one product to be shown
    expect(count).toBeGreaterThan(0);
  });


  // --------------------------------------------------------
  // TEST 10: Add to Cart button works correctly
  //
  // Test 9 left us on the homepage — no goto() needed.
  //
  // Two valid outcomes after clicking Add to Cart:
  //   A) Success toast appears  → simple product, added directly
  //   B) Redirect to PDP        → configurable product (needs options)
  // Both mean the button worked correctly.
  // --------------------------------------------------------
  test('clicking Add to Cart on homepage product should work correctly', async () => {

    // Record the URL before clicking
    const urlBefore = page.url();

    // Click the "Add to Cart" button on the first product card
    await homePage.clickFirstAddToCart();

    // Check outcome A: Did a toast message appear?
    const messageAppeared = await homePage.isSuccessMessageVisible();

    // Check outcome B: Did the page redirect to the PDP?
    const urlAfter = page.url();
    const redirectedToPDP = urlAfter !== urlBefore;

    console.log('Toast message appeared:', messageAppeared);
    console.log('Redirected to PDP:     ', redirectedToPDP);
    console.log('URL after click:       ', urlAfter);

    // At least one outcome must have happened
    expect(messageAppeared || redirectedToPDP).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 11: Clicking a product title goes to the PDP
  //
  // Test 10 left us on the PDP (Dove redirect).
  // Return to homepage so we can test the product title click.
  // --------------------------------------------------------
  test('clicking a homepage product title should navigate to the product page', async () => {

    // Return to homepage — Test 10 left us on the PDP
    await homePage.goto();
    await page.waitForLoadState('domcontentloaded');

    // Read the product's href BEFORE clicking so we know the target
    const expectedHref = await homePage.getFirstProductHref();

    console.log('Expected product page URL:', expectedHref);

    // Click the product title — browser navigates to PDP
    await homePage.clickFirstProductTitle();

    // Read the URL we actually landed on
    const actualUrl = page.url();

    console.log('Actual URL after clicking product:', actualUrl);

    // The URL should contain the product's href
    expect(actualUrl).toContain(expectedHref);
  });

});
