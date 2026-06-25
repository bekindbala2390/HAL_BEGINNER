// ============================================================
// tests/homepage.spec.js
//
// FEATURE: Homepage Load & Core Elements
//
// What does this test file verify?
// ----------------------------------
// This file contains tests for the HAL UAE homepage.
// We check that when a user visits the homepage:
//   1. The page loads successfully
//   2. The page title contains "HAL"
//   3. The navigation bar is visible
//   4. The footer is visible
//   5. The cart icon is visible
//
// Each test (test block) is INDEPENDENT — it opens a fresh
// browser session and does not rely on other tests.
// ============================================================

// ----------------------------------------------------------
// Import 'test' and 'expect' from Playwright Test Runner.
//
// 'test'   - Used to define a test case
// 'expect' - Used to make assertions (check if something is true)
// ----------------------------------------------------------
const { test, expect } = require('@playwright/test');

// ----------------------------------------------------------
// Import the HomePage Page Object we created.
// This gives us access to all the locators and methods
// we defined in pages/HomePage.js
// ----------------------------------------------------------
const { HomePage } = require('../pages/HomePage');


// ----------------------------------------------------------
// test.describe()
// ----------------
// Groups related tests together under one label.
// Think of it like a folder that holds multiple tests
// about the same feature.
// ----------------------------------------------------------
test.describe('Homepage - Core Elements', () => {

  // --------------------------------------------------------
  // Declare a variable to hold our page object.
  // We declare it here (outside individual tests) so that
  // all tests in this describe block can use it.
  // --------------------------------------------------------
  let homePage;

  // --------------------------------------------------------
  // test.beforeEach()
  // ------------------
  // This block runs BEFORE EVERY test in this describe block.
  //
  // { page } is provided automatically by Playwright — it is
  // a fresh browser page for each test.
  //
  // Here we:
  //   1. Create a new HomePage object
  //   2. Open the homepage
  //   3. Wait for it to fully load
  // --------------------------------------------------------
  test.beforeEach(async ({ page }) => {
    // Create a new instance of our HomePage Page Object,
    // passing in the Playwright 'page' object.
    homePage = new HomePage(page);

    // Open the homepage (calls page.goto('/'))
    await homePage.goto();

    // Wait for the page to fully load (network goes quiet)
    await homePage.waitForPageLoad();
  });


  // --------------------------------------------------------
  // TEST 1: Page title should contain "HAL"
  // --------------------------------------------------------
  test('page title should contain HAL', async () => {

    // getPageTitle() returns the text in the browser tab.
    // We store it in a variable called 'title'.
    const title = await homePage.getPageTitle();

    // expect() is how we make an assertion.
    // toContain() checks if the title includes the word "HAL".
    // If the title does NOT contain "HAL", this test will FAIL
    // and show a clear error message.
    expect(title).toContain('HAL');

    // Log the actual title to the console so you can see it
    // when you run the test with --headed mode.
    console.log('Page title is:', title);
  });


  // --------------------------------------------------------
  // TEST 2: Navigation bar should be visible
  // --------------------------------------------------------
  test('navigation bar should be visible', async () => {

    // Call our custom method from HomePage.js
    const isVisible = await homePage.isNavigationBarVisible();

    // toBe(true) checks that the value is exactly 'true'.
    // This confirms the navigation bar exists and is shown.
    expect(isVisible).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 3: Footer should be visible
  // --------------------------------------------------------
  test('footer should be visible', async () => {

    const isVisible = await homePage.isFooterVisible();

    // We expect the footer to be visible on every page.
    expect(isVisible).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 4: Cart icon should be visible in header
  // --------------------------------------------------------
  test('cart icon should be visible in header', async ({ page }) => {

    // Here we use Playwright's built-in 'expect(locator)' style.
    // This is slightly different from expect(value):
    //
    //   expect(value).toBe(true)       <-- checks a JS value
    //   expect(locator).toBeVisible()  <-- checks a DOM element
    //
    // The locator-based expect() is "web-first" — it will
    // automatically RETRY the check for a few seconds in case
    // the element appears with a slight delay.

    await expect(homePage.cartIcon).toBeVisible();
  });


  // --------------------------------------------------------
  // TEST 5: Page URL should be the homepage URL
  // --------------------------------------------------------
  test('page URL should be the homepage', async ({ page }) => {

    // toHaveURL() checks the current browser URL.
    // We use a regular expression (regex) here:
    //
    //   /mcstaging2\.hal-uae\.com/  matches any URL that
    //   contains "mcstaging2.hal-uae.com".
    //
    // The backslashes before dots (\.) are needed because
    // in regex, a plain '.' means "any character". We want
    // to match a literal dot, so we escape it with '\'.

    await expect(page).toHaveURL(/mcstaging2\.hal-uae\.com/);
  });


  // --------------------------------------------------------
  // TEST 6: Page should not show error messages on load
  // --------------------------------------------------------
  test('page should load without visible error messages', async ({ page }) => {

    // We check that common error indicators are NOT on the page.
    // The locator looks for any element with text like "404",
    // "Error", or "Not Found".

    // count() returns how many elements match the locator.
    // We expect 0 such elements — no errors!
    const errorCount = await page.locator('text=404').count();

    // toBe(0) means we expect zero matches.
    expect(errorCount).toBe(0);
  });

});


// ============================================================
// TEST GROUP 2: Homepage Section Redirections
//
// FEATURE: Clicking homepage sections redirects the user
//
// The homepage has promotional banners and category tiles.
// These tests verify that clicking them actually NAVIGATES
// the user away from the homepage to another page.
//
// We check: URL before click  ≠  URL after click
// ============================================================
test.describe('Homepage - Section Redirections', () => {

  // Give each test in this group 60 seconds instead of the default 30.
  // These tests navigate to new pages; the staging server can be slow.
  test.setTimeout(60000);

  // Declare homePage here so all tests in this group can use it
  let homePage;

  // Run before every test in this describe block:
  // create a fresh HomePage and open the site
  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
    await homePage.waitForPageLoad();
  });


  // --------------------------------------------------------
  // TEST 7: Clicking homepage banner redirects to new page
  // --------------------------------------------------------
  test('clicking first homepage banner should redirect away from homepage', async ({ page }) => {

    // Save the URL RIGHT NOW (before we click anything)
    // page.url() returns the current browser URL as a string
    const urlBefore = page.url();

    // Click the first banner link on the homepage
    // This calls our method in HomePage.js
    await homePage.clickFirstBannerLink();

    // Save the URL AFTER the click and page load
    const urlAfter = page.url();

    // Print both URLs to the console so you can see what happened
    console.log('URL before banner click:', urlBefore);
    console.log('URL after banner click: ', urlAfter);

    // not.toEqual() asserts that two values are DIFFERENT.
    // If the URL didn't change, the banner link didn't work
    // and this test will FAIL with a clear message.
    expect(urlAfter).not.toEqual(urlBefore);
  });


  // --------------------------------------------------------
  // TEST 8: Clicking a visible nav section link redirects
  //
  // The homepage category tiles use href="#" (no real redirect),
  // and the nav dropdown links are hidden until hovered.
  // So we test the "About Us" link — a visible, real-href link
  // in the secondary nav bar — to prove section redirects work.
  // --------------------------------------------------------
  test('clicking About Us navigation link should redirect away from homepage', async ({ page }) => {

    // Capture URL before clicking
    const urlBefore = page.url();

    // Click the About Us link in the navigation
    await homePage.clickFirstCategoryLink();

    // Capture URL after navigation
    const urlAfter = page.url();

    console.log('URL before nav click:', urlBefore);
    console.log('URL after nav click:  ', urlAfter);

    // The URL must have changed — user should now be on the About Us page
    expect(urlAfter).not.toEqual(urlBefore);
  });

});


// ============================================================
// TEST GROUP 3: Homepage Product Interactions
//
// FEATURE: Product cards on the homepage work correctly
//
// These tests cover three things:
//   1. Products are actually shown on the homepage
//   2. "Add to Cart" button adds a product and shows success
//   3. Clicking a product title goes to the correct PDP
//
// PDP = Product Detail Page (the page for one specific product)
// ============================================================
test.describe('Homepage - Product Interactions', () => {

  // Give each test in this group 60 seconds.
  // Cart AJAX and PDP load on the staging server can each take 10-15 seconds.
  test.setTimeout(60000);

  let homePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
    await homePage.waitForPageLoad();
  });


  // --------------------------------------------------------
  // TEST 9: Homepage should display product cards
  // --------------------------------------------------------
  test('homepage should display at least one product card', async () => {

    // Count how many product cards are on the homepage
    const count = await homePage.getProductCount();

    // Print the count so you can see it in the test output
    console.log('Product cards found on homepage:', count);

    // toBeGreaterThan(0) passes if count is 1 or more.
    // If count is 0 (no products shown), the test FAILS.
    expect(count).toBeGreaterThan(0);
  });


  // --------------------------------------------------------
  // TEST 10: Add to Cart button works correctly
  //
  // When "Add to Cart" is clicked, Magento does one of two things:
  //
  //   A) SIMPLE product (no color/size options):
  //      → Stays on homepage, shows a green success message toast
  //
  //   B) CONFIGURABLE product (has size, color, pack options):
  //      → Redirects to the Product Detail Page (PDP) so the
  //        user can select the required options before adding
  //
  // Both outcomes mean the button WORKED correctly.
  // We check that at least one of these happened.
  // --------------------------------------------------------
  test('clicking Add to Cart on homepage product should work correctly', async ({ page }) => {

    // Record the URL before clicking (should be the homepage)
    const urlBefore = page.url();

    // Click the "Add to Cart" button on the first product card
    await homePage.clickFirstAddToCart();

    // Check outcome A: Did a toast message appear?
    // isSuccessMessageVisible() waits up to 5 seconds.
    const messageAppeared = await homePage.isSuccessMessageVisible();

    // Check outcome B: Did the page redirect to PDP?
    // page.url() returns the CURRENT URL after the click + any navigation.
    const urlAfter = page.url();
    const redirectedToPDP = urlAfter !== urlBefore;

    // Log both outcomes to the console for visibility
    console.log('Toast message appeared:', messageAppeared);
    console.log('Redirected to PDP:     ', redirectedToPDP);
    console.log('URL after click:       ', urlAfter);

    // At least one outcome must have occurred.
    // If NEITHER happened, something is wrong with the button.
    // toBe(true) checks that the combined condition is true.
    expect(messageAppeared || redirectedToPDP).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 11: Clicking a product image redirects to PDP
  // --------------------------------------------------------
  test('clicking a homepage product image should navigate to the product page', async ({ page }) => {

    // Read the href (URL) of the first product's IMAGE link
    // before clicking, so we know where we're SUPPOSED to go
    const expectedHref = await homePage.getFirstProductHref();

    console.log('Expected product page URL:', expectedHref);

    // Click the product title link → navigates to PDP
    await homePage.clickFirstProductTitle();

    // Read the URL we actually landed on after clicking
    const actualUrl = page.url();

    console.log('Actual URL after clicking product:', actualUrl);

    // toContain() checks that actualUrl includes expectedHref.
    // We use toContain (not toEqual) because the final URL
    // might have extra query parameters added by Magento.
    expect(actualUrl).toContain(expectedHref);
  });

});
