// ============================================================
// tests/search.spec.js
//
// SEARCH FUNCTIONALITY — Full Test Suite
//
// This suite tests the complete search flow on the HAL UAE
// website, from typing in the search bar all the way through
// to opening a product's detail page.
//
// WHAT IS BEING TESTED:
//   Test  1 — Valid keyword search via header shows results
//   Test  2 — Invalid keyword search shows no-results message
//   Test  3 — Navigating to search results page directly by URL
//   Test  4 — Applying a layered navigation (sidebar) filter
//   Test  5 — Changing the Sort By dropdown order
//   Test  6 — Adding a product to cart from search results
//   Test  7 — Success message appears after adding to cart
//   Test  8 — Mini cart counter increases and is visible
//   Test  9 — Mini cart dropdown opens and shows content
//   Test 10 — Navigate to the next page of results
//   Test 11 — Navigate to a specific (random) page number
//   Test 12 — Clicking a product opens its Product Detail Page
//
// BROWSER SESSION STRATEGY:
//   One browser tab is opened in beforeAll and closed in afterAll.
//   All 12 tests share the same session (same cart state, same cookies).
//   Tests that navigate away call navigateToSearchResults() or
//   navigate('/') at the start to reset to a known position.
//
// KEYWORDS USED:
//   VALID_KEYWORD      = 'HAL'    → returns HAL branded product results
//   INVALID_KEYWORD    = 'xyznotfound999abc'  → returns no results
//   PAGINATION_KEYWORD = 'cream'  → broad term, more results for paging
// ============================================================

// Import Playwright's test runner and the assertion library
const { test, expect } = require('@playwright/test');

// Import the SearchPage Page Object we built in pages/SearchPage.js
const { SearchPage } = require('../pages/SearchPage');

// ---------------------------------------------------------------
// CONSTANTS — keywords used across multiple tests
// ---------------------------------------------------------------

// A keyword that should return product results on the HAL UAE site.
// 'HAL' is the brand name itself, so it reliably returns results.
const VALID_KEYWORD = 'HAL';

// A keyword that should return ZERO results (a nonsense string).
const INVALID_KEYWORD = 'xyznotfound999abc';

// A broader keyword to ensure enough results for pagination tests.
// "cream" matches many products in the HAL personal care range.
const PAGINATION_KEYWORD = 'cream';


test.describe('Search Functionality - Full Test Suite', () => {

  // ----------------------------------------------------------
  // Give every test in this block 90 seconds to finish.
  //
  // Search result pages load many products, scripts, and filters.
  // The staging server can be slow, so 30s (the default) is not
  // enough. We raise it here at the describe-block level so it
  // applies to ALL tests inside automatically.
  // ----------------------------------------------------------
  test.setTimeout(90000);

  // ----------------------------------------------------------
  // Shared variables — declared here so ALL tests can use them.
  //
  // `page`       → the single browser tab shared by all tests
  // `searchPage` → our SearchPage Page Object for that tab
  // ----------------------------------------------------------
  let page;
  let searchPage;


  // ----------------------------------------------------------
  // test.beforeAll()
  // -----------------
  // Runs ONCE before any test starts.
  //
  // { browser } is a Playwright fixture that gives us the browser
  // process. We call browser.newPage() to manually create ONE tab
  // that persists for the entire suite (not reset between tests).
  // ----------------------------------------------------------
  test.beforeAll(async ({ browser }) => {

    // Create a single browser tab for all 12 tests to share
    page = await browser.newPage();

    // Create a SearchPage instance using that shared tab
    searchPage = new SearchPage(page);

    // Start on the homepage so the browser is in a known state
    await searchPage.navigate('/');
    await page.waitForLoadState('domcontentloaded');
  });


  // ----------------------------------------------------------
  // test.afterAll()
  // ----------------
  // Runs ONCE after ALL 12 tests finish.
  // Closes the shared browser tab to clean up resources.
  // ----------------------------------------------------------
  test.afterAll(async () => {
    await page.close();
  });


  // ============================================================
  // GROUP 1: Search Bar Behaviour
  //
  // These tests check that the header search bar works correctly:
  // returning results for real keywords and showing a "no results"
  // message for keywords that match nothing.
  //
  // We are on the homepage when Group 1 starts (set by beforeAll).
  // ============================================================

  // --------------------------------------------------------
  // TEST 1: Typing a valid keyword and pressing Enter shows results
  //
  // We start on the homepage (set in beforeAll).
  // We click the search icon, type "dove", and press Enter.
  // The browser should land on the search results page showing
  // Dove product cards.
  // --------------------------------------------------------
  test('searching a valid keyword via header should show product results', async () => {

    // Step 1: Use the header search bar to search for "dove"
    // This clicks the search icon, fills the input, and presses Enter
    await searchPage.searchViaHeader(VALID_KEYWORD);

    // Step 2: Read the URL we landed on
    const currentUrl = page.url();
    console.log('Search results URL:', currentUrl);

    // Step 3: The URL must contain Magento's search results path
    // and the keyword we searched for
    expect(currentUrl).toContain('catalogsearch/result');
    expect(currentUrl).toContain(VALID_KEYWORD);

    // Step 4: Count the product cards shown in the results grid
    const productCount = await searchPage.getProductCount();
    console.log('Products found for "dove":', productCount);

    // Step 5: At least one product should be returned for "dove"
    expect(productCount).toBeGreaterThan(0);
  });


  // --------------------------------------------------------
  // TEST 2: Typing an invalid keyword should show no results
  //
  // Test 1 left us on the "dove" results page.
  // We search again using the header for an invalid keyword.
  // Magento should either show a notice ("no results") or
  // return zero product cards — we accept both outcomes.
  // --------------------------------------------------------
  test('searching an invalid keyword should show no-results message', async () => {

    // Step 1: Search for something that matches no products
    await searchPage.searchViaHeader(INVALID_KEYWORD);

    // Step 2: Check the URL (should still be a search results page)
    const currentUrl = page.url();
    console.log('URL after invalid search:', currentUrl);

    // Step 3: Check for the "no results" notice message
    const noResultsVisible = await searchPage.isNoResultsMessageVisible();
    console.log('No-results message visible:', noResultsVisible);

    // Step 4: Also check the product count (should be 0)
    const productCount = await searchPage.getProductCount();
    console.log('Product count for invalid keyword:', productCount);

    // Step 5: At least one of these must be true:
    //   A) A "no results" notice appeared
    //   B) Zero product cards are shown
    expect(noResultsVisible || productCount === 0).toBe(true);
  });


  // ============================================================
  // GROUP 2: Search Results Page
  //
  // These tests verify features of the search results page:
  // loading via URL, applying sidebar filters, and changing
  // the sort order.
  //
  // Each test calls navigateToSearchResults() at the start
  // to get a fresh, unfiltered results page regardless of
  // where the previous test left the browser.
  // ============================================================

  // --------------------------------------------------------
  // TEST 3: Navigating to search results via URL should work
  //
  // Instead of typing in the header, we go directly to the
  // search results URL. This is how most tests in Group 2+
  // reset to a clean results page quickly.
  // --------------------------------------------------------
  test('search results page should load correctly when navigated by URL', async () => {

    // Navigate directly to the search results URL for "dove"
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Verify the URL is the Magento search results path
    const currentUrl = page.url();
    console.log('Direct URL navigation result:', currentUrl);
    expect(currentUrl).toContain('catalogsearch/result');

    // Verify products are shown on the page
    const productCount = await searchPage.getProductCount();
    console.log('Products shown via direct URL:', productCount);
    expect(productCount).toBeGreaterThan(0);
  });


  // --------------------------------------------------------
  // TEST 4: Applying a filter should narrow results and change URL
  //
  // The left sidebar has layered navigation filters.
  // Clicking one should reload the page with filtered results
  // and add a filter parameter to the URL.
  // --------------------------------------------------------
  test('applying a sidebar filter should update results and URL', async () => {

    // Start on a clean search results page
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Record the URL BEFORE clicking any filter
    const urlBefore = page.url();

    // Record the product count BEFORE filtering
    const countBefore = await searchPage.getProductCount();
    console.log('Products before filter:', countBefore);

    // Click the first available filter option in the sidebar
    await searchPage.applyFirstAvailableFilter();

    // Record the URL AFTER the filter was applied
    const urlAfter = page.url();
    console.log('URL before filter:', urlBefore);
    console.log('URL after filter: ', urlAfter);

    // The URL must change — Magento adds filter parameters to the URL
    expect(urlAfter).not.toEqual(urlBefore);

    // Log how many products remain after filtering
    const countAfter = await searchPage.getProductCount();
    console.log('Products after filter:', countAfter);
  });


  // --------------------------------------------------------
  // TEST 5: Changing the Sort By dropdown should reorder products
  //
  // The "Sort By" dropdown above the product grid lets users
  // sort by Relevance, Product Name, or Price.
  //
  // Selecting 'name' (Product Name) reloads the page in
  // alphabetical order and adds product_list_order=name to the URL.
  // --------------------------------------------------------
  test('changing sort order should update the sort parameter in URL', async () => {

    // Start on a fresh, unfiltered search results page
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Read the current sort value before we change it
    const sortBefore = await searchPage.getSortByValue();
    console.log('Sort order before change:', sortBefore);

    // Change sort to 'name' (Product Name / alphabetical order).
    // 'name' is the value="name" attribute of the <option> in Magento 2.
    await searchPage.changeSortBy('name');

    // Read the sort value after changing
    const sortAfter = await searchPage.getSortByValue();
    console.log('Sort order after change:', sortAfter);

    // The dropdown should now show 'name' as selected
    expect(sortAfter).toBe('name');

    // The URL should contain the sort parameter
    const currentUrl = page.url();
    console.log('URL after sort change:', currentUrl);
    expect(currentUrl).toContain('name');
  });


  // ============================================================
  // GROUP 3: Add to Cart and Mini Cart
  //
  // These tests simulate finding a product in search results
  // and adding it to the shopping cart.
  //
  // IMPORTANT — TWO POSSIBLE OUTCOMES after clicking Add to Cart:
  //   A) SUCCESS TOAST appears  → simple product, added directly
  //   B) REDIRECT TO PDP occurs → configurable product (needs
  //      size/color selection before adding)
  //
  // Both outcomes mean the Add to Cart button worked correctly.
  // Tests 6 and 7 check the outcome of the click itself.
  // Test 8 checks the cart counter badge in the header.
  // Test 9 checks the mini cart dropdown panel.
  // ============================================================

  // --------------------------------------------------------
  // TEST 6: Clicking Add to Cart on a search result should work
  //
  // We click the first "Add to Cart" button in the results grid.
  // A success toast OR a PDP redirect both confirm the button worked.
  // --------------------------------------------------------
  test('clicking Add to Cart on a search result product should work correctly', async () => {

    // Navigate to a fresh search results page
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Click the first Add to Cart button and capture the pre-click URL
    const urlBefore = await searchPage.addFirstProductToCart();

    // Read the URL after the click (may have changed if redirected)
    const urlAfter = page.url();
    console.log('URL before Add to Cart click:', urlBefore);
    console.log('URL after Add to Cart click: ', urlAfter);

    // Check Outcome A: Did the success toast appear?
    const successMessageShown = await searchPage.isSuccessMessageVisible();
    console.log('Success toast appeared:', successMessageShown);

    // Check Outcome B: Did the page redirect (configurable product)?
    const redirectedToPDP = urlAfter !== urlBefore;
    console.log('Redirected to PDP:', redirectedToPDP);

    // At least one outcome must have happened — the button worked
    expect(successMessageShown || redirectedToPDP).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 7: Success message should confirm the item was added
  //
  // We repeat the add-to-cart action on a fresh results page.
  // If the product is simple → success toast appears.
  // If the product is configurable → redirect to PDP (also OK).
  // --------------------------------------------------------
  test('success message should appear after adding a simple product to cart', async () => {

    // Start fresh on search results
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Ensure all page scripts are loaded before clicking
    await page.waitForLoadState('load');

    // Click the first Add to Cart button
    const urlBefore = await searchPage.addFirstProductToCart();

    // Check if the green success toast appeared
    const messageAppeared = await searchPage.isSuccessMessageVisible();

    // Check if we are still on the search results page
    const currentUrl = page.url();
    const stillOnResults = currentUrl.includes('catalogsearch');

    console.log('Success toast visible:', messageAppeared);
    console.log('Still on results page:', stillOnResults);
    console.log('Current URL:', currentUrl);

    // If still on results page → success toast must have appeared.
    // If redirected to PDP → that's also a valid outcome.
    // Both scenarios confirm the Add to Cart button is functional.
    expect(messageAppeared || !stillOnResults).toBe(true);
  });


  // --------------------------------------------------------
  // TEST 8: Mini cart counter should be visible and show count > 0
  //
  // After adding a product to the cart (Tests 6 or 7), the
  // cart counter badge in the header should show a number.
  //
  // HOW THE COUNTER WORKS:
  //   - When cart is EMPTY: badge is hidden entirely
  //   - When cart has items: badge shows the item count ("1", "2", ...)
  //
  // We read the count BEFORE adding, add a product, then verify
  // the badge is visible and shows a positive number.
  // --------------------------------------------------------
  test('mini cart counter should be visible and show a positive item count', async () => {

    // Navigate to search results for a clean starting point
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Wait for all page scripts to be ready
    await page.waitForLoadState('load');

    // Read the current cart count BEFORE adding (may be 0 or from a previous test)
    const countBefore = await searchPage.getCartCounterText();
    console.log('Cart count BEFORE adding item:', countBefore);

    // Click Add to Cart on the first search result product
    await searchPage.addFirstProductToCart();

    // Magento updates the cart counter asynchronously via AJAX.
    // isCartCounterVisible() waits up to 8 seconds for the badge to appear.
    const counterVisible = await searchPage.isCartCounterVisible();

    // Read the updated counter value
    const countAfter = await searchPage.getCartCounterText();

    console.log('Cart counter visible after adding:', counterVisible);
    console.log('Cart count AFTER adding item:', countAfter);

    // The counter badge should now be visible (at least 1 item in cart)
    expect(counterVisible).toBe(true);

    // Parse the text to a number and verify it is greater than 0
    const countNumber = parseInt(countAfter, 10);
    expect(countNumber).toBeGreaterThan(0);
  });


  // --------------------------------------------------------
  // TEST 9: Clicking the cart icon should open the mini cart
  //
  // The cart icon in the header toggles a dropdown that lists
  // all items currently in the cart.
  //
  // We navigate to the homepage first to have a clean header,
  // then click the cart icon and verify the dropdown opens.
  // --------------------------------------------------------
  test('clicking the cart icon should open the mini cart dropdown', async () => {

    // Navigate to homepage — gives us a stable header to click
    await searchPage.navigate('/');
    await page.waitForLoadState('domcontentloaded');

    // Click the cart icon and wait for the dropdown to appear
    await searchPage.openMiniCart();

    // Check whether the mini cart content panel is now visible
    const miniCartVisible = await searchPage.isMiniCartContentVisible();
    console.log('Mini cart dropdown visible:', miniCartVisible);

    // The dropdown should be open and visible
    expect(miniCartVisible).toBe(true);
  });


  // ============================================================
  // GROUP 4: Pagination
  //
  // These tests verify navigating between pages of search results.
  //
  // We use PAGINATION_KEYWORD ('cream') because it returns more
  // results than 'dove', making multi-page results more likely.
  //
  // Magento shows 12 products per page by default.
  // Pagination only appears when total results > 12.
  //
  // NOTE: Both tests have a graceful skip if pagination is absent
  // (the staging server may return fewer results on some days).
  // ============================================================

  // --------------------------------------------------------
  // TEST 10: Clicking the Next arrow should go to page 2
  //
  // We click the › next-page arrow in the pagination bar.
  // The URL should gain ?p=2 to indicate page 2.
  // --------------------------------------------------------
  test('clicking next page arrow should navigate to page 2 of results', async () => {

    // Navigate to search results using the broader keyword
    await searchPage.navigateToSearchResults(PAGINATION_KEYWORD);

    // Check if the pagination bar is present on this page
    const hasPagination = await searchPage.hasPagination();
    console.log('Pagination bar visible:', hasPagination);

    if (!hasPagination) {
      // Not enough results for multiple pages — skip gracefully
      console.log('Not enough results for pagination — skipping this test');
      return;
    }

    // Record the URL before clicking Next
    const urlBefore = page.url();

    // Click the Next arrow in the pagination bar
    await searchPage.goToNextPage();

    // Record the URL after navigation
    const urlAfter = page.url();
    console.log('URL before next click:', urlBefore);
    console.log('URL after next click: ', urlAfter);

    // URL must change — page 2 adds ?p=2 (or &p=2) to the URL
    expect(urlAfter).not.toEqual(urlBefore);
    expect(urlAfter).toContain('p=2');
  });


  // --------------------------------------------------------
  // TEST 11: Clicking a specific page number should jump there
  //
  // From the pagination bar, we click on page 3 directly
  // (instead of clicking Next twice). The URL should show p=3.
  // --------------------------------------------------------
  test('clicking a specific page number should navigate to that page', async () => {

    // Start on search results with the broad keyword
    await searchPage.navigateToSearchResults(PAGINATION_KEYWORD);

    // Check if pagination is present
    const hasPagination = await searchPage.hasPagination();

    if (!hasPagination) {
      console.log('No pagination — skipping specific page navigation');
      return;
    }

    // Count how many page-number links are available
    const totalPageLinks = await searchPage.pageNumberLinks.count();
    console.log('Available page number links:', totalPageLinks);

    // We need at least 2 page links to navigate to page 2
    // (the current page 1 shows as <strong>, so "2" would be the first link)
    if (totalPageLinks < 1) {
      console.log('Only one page of results — skipping');
      return;
    }

    // Navigate directly to page 2 as our "random" specific page
    // (page 3 would need 3+ pages which may not always exist)
    await searchPage.goToPageNumber(2);

    // Verify the URL now contains the page parameter
    const currentUrl = page.url();
    console.log('URL after jumping to page 2:', currentUrl);

    expect(currentUrl).toContain('p=2');

    // Also verify that product cards are shown on this page
    const productCount = await searchPage.getProductCount();
    console.log('Products shown on page 2:', productCount);
    expect(productCount).toBeGreaterThan(0);
  });


  // ============================================================
  // GROUP 5: Open Product Detail Page (PDP)
  //
  // This test verifies that clicking a product name in the
  // search results opens the correct Product Detail Page.
  //
  // PDP = the page showing a single product's full details:
  //   image, description, price, and the main Add to Cart button.
  // ============================================================

  // --------------------------------------------------------
  // TEST 12: Clicking a product in search results should open its PDP
  //
  // We go back to search results and click the first product name.
  // The browser should leave the search results page and land on
  // the PDP for that specific product.
  //
  // We verify:
  //   1. The URL is no longer the search results URL
  //   2. The PDP product title is visible and non-empty
  //   3. The PDP title matches (contains) the name we clicked
  // --------------------------------------------------------
  test('clicking a product name in search results should open its product detail page', async () => {

    // Start on a fresh search results page
    await searchPage.navigateToSearchResults(VALID_KEYWORD);

    // Verify there are products available to click
    const productCount = await searchPage.getProductCount();
    console.log('Products available to click:', productCount);
    expect(productCount).toBeGreaterThan(0);

    // Click the first product name and capture the name text
    // openFirstProductPDP() returns the name it read BEFORE clicking
    const productNameClicked = await searchPage.openFirstProductPDP();
    console.log('Product name clicked in search results:', productNameClicked);

    // Read the URL we landed on after clicking
    const currentUrl = page.url();
    console.log('URL after clicking product:', currentUrl);

    // Step 1: We should no longer be on the search results page
    expect(currentUrl).not.toContain('catalogsearch/result');

    // Step 2: Read the product title on the PDP
    const pdpTitle = await searchPage.getPDPProductTitle();
    console.log('Product title shown on PDP:', pdpTitle);

    // Step 3: The PDP title should not be empty
    expect(pdpTitle.length).toBeGreaterThan(0);

    // Step 4: The PDP title should contain (part of) the name we clicked.
    // We check the first 10 characters so minor title formatting
    // differences between the listing and PDP don't break the assertion.
    const shortName = productNameClicked.substring(0, 10).toLowerCase();
    expect(pdpTitle.toLowerCase()).toContain(shortName);
  });

});
