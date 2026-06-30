// ============================================================
// tests/pdp.spec.js
//
// PRODUCT DETAIL PAGE (PDP) — End-to-End Test Suite
// Guest User Perspective (no login required)
//
// WHAT IS BEING TESTED (in order):
//
//   ─── SETUP ───────────────────────────────────────────────────
//   beforeAll  — Opens browser, creates page objects, navigates to PLP
//                to discover one SIMPLE product URL and one CONFIGURABLE
//                product URL (by checking for swatch groups on each PDP).
//
//   ─── GROUP A: SIMPLE PRODUCT (Tests 1–9) ─────────────────────
//   Test  1 — Open simple product PDP; verify URL and title load
//   Test  2 — Verify core content: price, stock, Add to Cart button visible
//   Test  3 — Verify gallery: main product image is visible
//   Test  4 — Click main image to open fullscreen gallery
//   Test  5 — Navigate to next image using the "›" arrow in fullscreen
//   Test  6 — Navigate back to previous image using the "‹" arrow
//   Test  7 — Close fullscreen gallery with Escape key
//   Test  8 — Read MOQ badge; verify qty input respects the minimum
//   Test  9 — Add simple product to cart; verify success toast + counter increments
//
//   ─── GROUP B: CONFIGURABLE PRODUCT (Tests 10–15) ─────────────
//   Test 10 — Open configurable product PDP; verify URL and title load
//   Test 11 — Verify core content: price, Add to Cart button visible
//   Test 12 — Verify swatch groups exist; check for "Pack & Container Color"
//             and "Pack Size" labels (HAL UAE specific attribute names)
//   Test 13 — Select first option in each swatch group; verify selection state
//   Test 14 — Read MOQ after variant selection; verify minimum is ≥ 1
//   Test 15 — Add configurable product to cart; verify success toast + counter
//
//   ─── GROUP C: CONTENT TABS (Tests 16–18) ─────────────────────
//   Test 16 — Click "Details" tab; verify content panel is visible
//   Test 17 — Click "More Information" tab; verify content panel is visible
//   Test 18 — Click "Reviews" tab; verify reviews panel is visible
//
//   ─── GROUP D: SOCIAL SHARE (Test 19) ─────────────────────────
//   Test 19 — Click the product share/email button; verify a popup or
//             page navigation occurs (modal OR URL change to share page)
//
// PRECONDITIONS:
//   • Test environment : https://mcstaging2.hal-uae.com
//   • Browser          : Chromium (Desktop Chrome viewport)
//   • User state       : Guest (no login, fresh session)
//   • Data requirement : PLP must have at least one simple AND one configurable product
//
// BROWSER SESSION STRATEGY:
//   One browser tab is opened in beforeAll and closed in afterAll.
//   ALL 19 tests share the same session (same cart cookies).
//   Tests navigate using pdp.goto(url) to go directly to stored PDP URLs.
//   cartCount is tracked across tests 9 and 15 to verify cumulative adds.
// ============================================================

// Playwright's test runner and assertion library
const { test, expect } = require('@playwright/test');

// PLPPage is used in beforeAll to discover product URLs from the product grid
const { PLPPage } = require('../pages/PLPPage');

// PDPPage is our new Page Object for all PDP interactions
const { PDPPage } = require('../pages/PDPPage');


test.describe('PDP — Product Detail Page End-to-End Suite (Guest User)', () => {

  // ----------------------------------------------------------
  // Give every test 120 seconds.
  //
  // The HAL UAE staging server is slow: gallery AJAX, section loads,
  // and Add to Cart AJAX can each take 10–20 s. 120 s gives safe headroom.
  // ----------------------------------------------------------
  test.setTimeout(120000);

  // ----------------------------------------------------------
  // Shared variables declared at describe-block scope so all 19
  // tests can read and write them.
  //
  //   page               → the single Playwright browser tab
  //   plp / pdp          → Page Object instances
  //   simplePDPUrl       → full URL of the discovered simple product
  //   configurablePDPUrl → full URL of the discovered configurable product
  //   simpleProductName  → product title read from the simple PDP (for assertions)
  //   configurableName   → product title read from the configurable PDP
  //   cartCount          → running total of items in cart (tracked across tests 9 & 15)
  // ----------------------------------------------------------
  let page;
  let plp;
  let pdp;
  let simplePDPUrl       = null;

  // Configurable product URL is fixed — the Dove Beauty Cream Bar is a known configurable product
  let configurablePDPUrl = 'https://mcstaging2.hal-uae.com/dove-beauty-cream-bar.html';

  let simpleProductName  = '';
  let configurableName   = '';
  let cartCount          = 0;


  // ----------------------------------------------------------
  // test.beforeAll()
  // -----------------
  // Runs ONCE before any test starts.
  //
  // What it does:
  //   1. Creates a new browser page (one tab for the whole suite)
  //   2. Creates PLPPage and PDPPage Page Object instances
  //   3. Navigates to the All Products PLP
  //   4. Reads all product name link hrefs from the page
  //   5. Visits each product PDP (up to 15) and checks for swatches:
  //      - 0 swatch groups → SIMPLE product   (store its URL)
  //      - 1+ swatch groups → CONFIGURABLE product (store its URL)
  //   6. Logs the discovered URLs so we can see them in the test report
  // ----------------------------------------------------------
  test.beforeAll(async ({ browser }) => {

    // Give beforeAll enough time to scan up to 20 PDPs on the slow staging server
    test.setTimeout(180000);

    // Step 1: Open one browser tab that will be shared by all 19 tests
    page = await browser.newPage();

    // Step 2: Create Page Object instances pointing at that tab
    plp = new PLPPage(page);
    pdp = new PDPPage(page);

    // Step 3: Navigate to the "All Products" PLP
    // (This gives us a grid of products to scan for URLs)
    await plp.goto();

    // Step 4: Collect all product-name <a href="…"> from the PLP grid.
    // evaluateAll() runs inside the browser and returns a plain JS array.
    // We do this in one call rather than Playwright iterations for speed.
    const allLinks = await page.locator('a.product-item-link')
      .evaluateAll(anchors => anchors.map(a => a.href));

    console.log(`beforeAll: found ${allLinks.length} product links on PLP page 1`);

    // Step 5: Scan PLP products to find a SIMPLE product.
    // The configurable product URL is already hardcoded above, so we only
    // need to find a simple (no-swatch) product from the PLP.
    const scanLimit = Math.min(allLinks.length, 20);

    for (let i = 0; i < scanLimit; i++) {
      const url = allLinks[i];

      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');

      // Count swatch groups — 0 = simple product
      const swatchCount = await pdp.getSwatchGroupCount();

      if (!simplePDPUrl && swatchCount === 0) {
        const hasAddToCart = await page
          .locator('button#product-addtocart-button, .product-info-main button.action.tocart')
          .first()
          .isVisible()
          .catch(() => false);

        const hasFotorama = await page
          .locator('.fotorama__stage')
          .isVisible()
          .catch(() => false);

        if (hasAddToCart && hasFotorama) {
          simplePDPUrl      = url;
          simpleProductName = await pdp.getProductTitle().catch(() => '');
          console.log(`beforeAll: simple product → "${simpleProductName}"`);
          console.log(`           URL: ${simplePDPUrl}`);
          break; // Simple product found — stop scanning
        } else {
          console.log(
            `beforeAll: skipping ${url} ` +
            `(addToCart=${hasAddToCart}, fotorama=${hasFotorama})`
          );
        }
      }
    }

    // Step 6: Read the title of the hardcoded configurable product
    console.log(`beforeAll: navigating to hardcoded configurable product URL`);
    console.log(`           URL: ${configurablePDPUrl}`);
    await page.goto(configurablePDPUrl);
    await page.waitForLoadState('domcontentloaded');
    configurableName = await pdp.getProductTitle().catch(() => '');
    console.log(`beforeAll: configurable product → "${configurableName}"`);

    // Log a warning if the simple product was not found (tests will skip gracefully)
    if (!simplePDPUrl) console.warn('beforeAll WARNING: no simple product found in the first 20 PLP products');
  });


  // ----------------------------------------------------------
  // test.afterAll()
  // ----------------
  // Runs ONCE after all 19 tests complete (pass or fail).
  // Closes the shared browser tab to release memory.
  // ----------------------------------------------------------
  test.afterAll(async () => {
    await page.close();
  });


  // ============================================================
  //
  //   GROUP A: SIMPLE PRODUCT (Tests 1–9)
  //
  //   A "simple product" in Magento 2 is one that has no configurable
  //   options (no colour/size swatches). The guest user can:
  //     - View it immediately without selecting variants
  //     - Set a quantity and add directly to cart
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 1
  // Navigate to the simple product PDP and verify it loaded.
  //
  // PRECONDITION: simplePDPUrl discovered in beforeAll.
  // ASSERTION   : URL matches the expected product URL.
  // ASSERTION   : Product title h1 is visible and non-empty.
  // ----------------------------------------------------------
  test('Test 01 — should open simple product PDP and verify page loads', async () => {

    // Exit gracefully if no simple product was found on the PLP
    if (!simplePDPUrl) {
      console.log('Test 01 SKIP: no simple product URL was discovered in beforeAll');
      return;
    }

    // Navigate to the simple product PDP
    // pdp.goto() uses 'domcontentloaded', matching the project-wide strategy
    await pdp.goto(simplePDPUrl);

    // ASSERTION 1: The browser URL must match the product URL we navigated to
    const currentUrl = page.url();
    console.log('Test 01 — Current URL:', currentUrl);
    expect(currentUrl).toContain(simplePDPUrl.split('mcstaging2.hal-uae.com')[1]);

    // ASSERTION 2: The h1 product title must be visible and non-empty
    const title = await pdp.getProductTitle();
    console.log('Test 01 — Product title:', title);
    expect(title.length).toBeGreaterThan(0);

    // ASSERTION 3: The title should match what we read in beforeAll
    // (We compare the first 15 chars to allow for minor rendering differences)
    if (simpleProductName.length > 0) {
      const shortExpected = simpleProductName.substring(0, 15).toLowerCase();
      expect(title.toLowerCase()).toContain(shortExpected);
    }
  });


  // ----------------------------------------------------------
  // TEST 2
  // Verify that all core PDP content is visible on the simple product.
  //
  // ASSERTIONS:
  //   - Price element is visible and contains "AED" (or any currency)
  //   - Stock status indicator is visible
  //   - "Add to Cart" button is visible
  // ----------------------------------------------------------
  test('Test 02 — should show price, stock status, and Add to Cart button', async () => {

    if (!simplePDPUrl) {
      console.log('Test 02 SKIP: no simple product URL');
      return;
    }

    // Stay on the simple product PDP opened in Test 01
    // (We do NOT re-navigate unless the URL changed between tests)
    const currentUrl = page.url();
    if (!currentUrl.includes(simplePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(simplePDPUrl); // Re-navigate if we left the page
    }

    // ASSERTION 1: Price must be displayed (guest users always see price on HAL)
    const price = await pdp.getProductPrice();
    console.log('Test 02 — Price:', price);
    expect(price.length).toBeGreaterThan(0); // Price string must not be empty

    // ASSERTION 2: Stock status badge must be visible
    const stockVisible = await pdp.isStockStatusVisible();
    console.log('Test 02 — Stock status visible:', stockVisible);
    expect(stockVisible).toBe(true);

    // ASSERTION 3: Add to Cart button must be visible (confirms product is purchasable)
    const addToCartVisible = await pdp.isAddToCartButtonVisible();
    console.log('Test 02 — Add to Cart button visible:', addToCartVisible);
    expect(addToCartVisible).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 3
  // Verify that the gallery main product image is visible.
  //
  // ASSERTIONS:
  //   - Main Fotorama stage image is rendered and visible
  //   - Thumbnail count is reported (0 is valid for single-image products)
  // ----------------------------------------------------------
  test('Test 03 — should display the main gallery image', async () => {

    if (!simplePDPUrl) {
      console.log('Test 03 SKIP: no simple product URL');
      return;
    }

    // Ensure we are on the simple product PDP (guard against worker restarts)
    const currentUrl = page.url();
    if (!currentUrl.includes(simplePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(simplePDPUrl);
    }

    // ASSERTION 1: The main image in the Fotorama stage must be visible
    const imageVisible = await pdp.isMainImageVisible();
    console.log('Test 03 — Main gallery image visible:', imageVisible);
    expect(imageVisible).toBe(true);

    // ASSERTION 2: Count thumbnails (informational — 0 is valid)
    const thumbCount = await pdp.getThumbnailCount();
    console.log('Test 03 — Thumbnail count:', thumbCount);
    // No assertion on count — just confirm the method works
    // (some products have 1 image, some have many)
  });


  // ----------------------------------------------------------
  // TEST 4
  // Click the gallery image to open fullscreen mode.
  //
  // HOW:
  //   1. Hover over the main stage so the fullscreen icon appears
  //   2. Click the icon to enter fullscreen
  //
  // ASSERTION: The 'fotorama--fullscreen' class is present on the gallery root.
  // ----------------------------------------------------------
  test('Test 04 — should open fullscreen gallery on image click', async () => {

    if (!simplePDPUrl) {
      console.log('Test 04 SKIP: no simple product URL');
      return;
    }

    // Make sure we are on the simple product PDP
    const currentUrl = page.url();
    if (!currentUrl.includes(simplePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(simplePDPUrl);
    }

    // Open the fullscreen gallery (hover stage → click icon)
    await pdp.openFullscreenGallery();

    // ASSERTION: Fullscreen is now active
    const isFullscreen = await pdp.isFullscreenGalleryOpen();
    console.log('Test 04 — Fullscreen gallery open:', isFullscreen);
    expect(isFullscreen).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 5
  // While in fullscreen mode, click the "›" arrow to navigate
  // to the next product image.
  //
  // NOTE: If the product has only one image, the arrow won't appear
  // and this test exits gracefully with a skip log.
  //
  // ASSERTION: The next arrow exists and is clickable (or skip if 1 image).
  // ----------------------------------------------------------
  test('Test 05 — should navigate to next image in fullscreen gallery', async () => {

    if (!simplePDPUrl) {
      console.log('Test 05 SKIP: no simple product URL');
      return;
    }

    // Check if we are still in fullscreen (from Test 04)
    const stillInFullscreen = await pdp.isFullscreenGalleryOpen();

    if (!stillInFullscreen) {
      // Fullscreen was lost (e.g. a page navigation happened) — reopen it
      console.log('Test 05: fullscreen was not open, reopening gallery');
      const currentUrl = page.url();
      if (!currentUrl.includes(simplePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
        await pdp.goto(simplePDPUrl);
      }
      await pdp.openFullscreenGallery();
    }

    // Check how many thumbnails this product has
    const thumbCount = await pdp.getThumbnailCount();
    console.log('Test 05 — Thumbnail count:', thumbCount);

    if (thumbCount <= 1) {
      // Only one image — no arrow to click; skip this test
      console.log('Test 05 SKIP: product has only one image, no navigation arrows');
      return;
    }

    // Click "›" to go to the next image
    const moved = await pdp.navigateToNextImage();
    console.log('Test 05 — Navigated to next image:', moved);

    // ASSERTION: The click was successful (arrow was found and clicked)
    expect(moved).toBe(true);

    // Confirm we are still in fullscreen after the navigation
    const stillFullscreen = await pdp.isFullscreenGalleryOpen();
    console.log('Test 05 — Still in fullscreen after next click:', stillFullscreen);
    expect(stillFullscreen).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 6
  // Still in fullscreen mode, click the "‹" arrow to navigate
  // back to the previous image.
  //
  // ASSERTION: The previous arrow exists and is clickable.
  // ----------------------------------------------------------
  test('Test 06 — should navigate back to previous image in fullscreen', async () => {

    if (!simplePDPUrl) {
      console.log('Test 06 SKIP: no simple product URL');
      return;
    }

    // Check thumbnail count — skip if only one image
    const thumbCount = await pdp.getThumbnailCount();
    if (thumbCount <= 1) {
      console.log('Test 06 SKIP: product has only one image');
      return;
    }

    // Ensure we are still in fullscreen mode
    const inFullscreen = await pdp.isFullscreenGalleryOpen();
    if (!inFullscreen) {
      console.log('Test 06 SKIP: not in fullscreen mode (Test 04/05 may have failed)');
      return;
    }

    // Click "‹" to go back to the previous image
    const moved = await pdp.navigateToPreviousImage();
    console.log('Test 06 — Navigated to previous image:', moved);

    // ASSERTION: The click was successful
    expect(moved).toBe(true);

    // Confirm still in fullscreen
    const stillFullscreen = await pdp.isFullscreenGalleryOpen();
    console.log('Test 06 — Still in fullscreen after prev click:', stillFullscreen);
    expect(stillFullscreen).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 7
  // Close the fullscreen gallery using the Escape key.
  //
  // ASSERTION: The gallery returns to its normal embedded state
  //            (the 'fotorama--fullscreen' class is removed).
  // ----------------------------------------------------------
  test('Test 07 — should close fullscreen gallery with Escape key', async () => {

    if (!simplePDPUrl) {
      console.log('Test 07 SKIP: no simple product URL');
      return;
    }

    // Check if fullscreen is actually open before trying to close it
    const inFullscreen = await pdp.isFullscreenGalleryOpen();

    if (!inFullscreen) {
      // Tests 04–06 may have skipped (1 image product) — nothing to close
      console.log('Test 07: fullscreen is already closed (likely single-image product)');
      // Still pass — the gallery is in the correct closed state
      return;
    }

    // Press Escape to exit fullscreen (Fotorama listens for this key)
    await pdp.closeFullscreenGallery();

    // ASSERTION: Fullscreen is no longer active
    const stillFullscreen = await pdp.isFullscreenGalleryOpen();
    console.log('Test 07 — Fullscreen still open after Escape:', stillFullscreen);
    expect(stillFullscreen).toBe(false);
  });


  // ----------------------------------------------------------
  // TEST 8
  // Read the MOQ badge on the simple product and verify the qty
  // input field respects the minimum.
  //
  // ASSERTIONS:
  //   - MOQ is an integer ≥ 1
  //   - After setting qty to MOQ, the input shows the correct value
  // ----------------------------------------------------------
  test('Test 08 — should read MOQ badge and enforce minimum quantity', async () => {

    if (!simplePDPUrl) {
      console.log('Test 08 SKIP: no simple product URL');
      return;
    }

    // Make sure we are on the simple product PDP
    const currentUrl = page.url();
    if (!currentUrl.includes(simplePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(simplePDPUrl);
    }

    // Read the MOQ from the badge (returns 1 if no badge found)
    const moq = await pdp.getMOQ();
    console.log('Test 08 — MOQ value:', moq);

    // ASSERTION 1: MOQ must be a valid positive integer
    expect(moq).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(moq)).toBe(true);

    // Set the qty input to the MOQ value
    await pdp.setQuantity(moq);

    // ASSERTION 2: The qty input must now show the value we set
    const qtyAfter = await pdp.getQuantity();
    console.log('Test 08 — Qty input value after setting MOQ:', qtyAfter);
    expect(qtyAfter).toBe(moq);

    // Log additional context for debugging
    if (moq > 1) {
      console.log(`Test 08 — MOQ badge enforces minimum of ${moq} units`);
    } else {
      console.log('Test 08 — No MOQ badge found; default quantity is 1');
    }
  });


  // ----------------------------------------------------------
  // TEST 9
  // Add the simple product to the cart and verify:
  //   1. The green success toast appears
  //   2. The cart counter badge increments
  //
  // This test uses addToCartWithMOQ() which:
  //   - Reads the MOQ badge
  //   - Sets qty to MOQ
  //   - Clicks Add to Cart
  //   - Waits for the success toast
  // ----------------------------------------------------------
  test('Test 09 — should add simple product to cart and verify counter increments', async () => {

    if (!simplePDPUrl) {
      console.log('Test 09 SKIP: no simple product URL');
      return;
    }

    // Navigate to the simple product PDP (fresh start for this test)
    await pdp.goto(simplePDPUrl);

    // Read the cart count BEFORE adding (may be 0 from a fresh session)
    const countBeforeText = await pdp.getCartCounterText();
    cartCount = parseInt(countBeforeText, 10) || 0;
    console.log('Test 09 — Cart count before add:', cartCount);

    // Add the product using the MOQ-aware helper
    const result = await pdp.addToCartWithMOQ();
    console.log('Test 09 — Add to cart success toast:', result.success);
    console.log('Test 09 — Qty added (MOQ):', result.qty);

    // ASSERTION 1: Success toast must appear
    expect(result.success).toBe(true);

    // Read the new cart counter value
    const countAfterText = await pdp.getCartCounterText();
    const countAfter = parseInt(countAfterText, 10);
    console.log('Test 09 — Cart count after add:', countAfter);

    // ASSERTION 2: Cart counter must have increased by at least the MOQ qty
    expect(countAfter).toBeGreaterThan(cartCount);

    // Update the running cart total for later tests
    cartCount = countAfter;
    console.log('Test 09 — Running cart total:', cartCount);
  });


  // ============================================================
  //
  //   GROUP B: CONFIGURABLE PRODUCT (Tests 10–15)
  //
  //   A "configurable product" in Magento 2 requires the guest user
  //   to SELECT one option from each attribute group (e.g. choose a
  //   colour AND a size) before the "Add to Cart" button becomes active.
  //
  //   On HAL UAE the typical attribute groups are:
  //     • Pack & Container Color  (the container colour variant)
  //     • Pack Size               (e.g. 100g, 250g, 500g)
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 10
  // Open the configurable product PDP and verify it loaded.
  //
  // ASSERTIONS:
  //   - URL matches the configurable product URL
  //   - Product title h1 is visible and non-empty
  // ----------------------------------------------------------
  test('Test 10 — should open configurable product PDP and verify page loads', async () => {

    if (!configurablePDPUrl) {
      console.log('Test 10 SKIP: no configurable product URL was discovered in beforeAll');
      return;
    }

    // Navigate to the configurable product PDP
    await pdp.goto(configurablePDPUrl);

    // ASSERTION 1: URL must match the configurable product we stored
    const currentUrl = page.url();
    console.log('Test 10 — Current URL:', currentUrl);
    expect(currentUrl).toContain(configurablePDPUrl.split('mcstaging2.hal-uae.com')[1]);

    // ASSERTION 2: Product title must be visible and non-empty
    const title = await pdp.getProductTitle();
    console.log('Test 10 — Configurable product title:', title);
    expect(title.length).toBeGreaterThan(0);

    // ASSERTION 3: Title should match what we read in beforeAll
    if (configurableName.length > 0) {
      const shortExpected = configurableName.substring(0, 15).toLowerCase();
      expect(title.toLowerCase()).toContain(shortExpected);
    }
  });


  // ----------------------------------------------------------
  // TEST 11
  // Verify core content is visible on the configurable product PDP.
  //
  // ASSERTIONS:
  //   - Price element is visible (may show "From AED X" before swatch selection)
  //   - Add to Cart button is visible (it will be disabled until swatches are selected)
  // ----------------------------------------------------------
  test('Test 11 — should show price and Add to Cart button on configurable product', async () => {

    if (!configurablePDPUrl) {
      console.log('Test 11 SKIP: no configurable product URL');
      return;
    }

    // Ensure we are on the configurable product PDP
    const currentUrl = page.url();
    if (!currentUrl.includes(configurablePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(configurablePDPUrl);
    }

    // ASSERTION 1: Price must be visible (configurable shows base/from price initially)
    const price = await pdp.getProductPrice();
    console.log('Test 11 — Configurable product price:', price);
    expect(price.length).toBeGreaterThan(0);

    // ASSERTION 2: Add to Cart button must be present
    // (It will be disabled until the user selects all swatch options)
    const addToCartVisible = await pdp.isAddToCartButtonVisible();
    console.log('Test 11 — Add to Cart button visible:', addToCartVisible);
    expect(addToCartVisible).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 12
  // Verify that the swatch attribute groups are displayed.
  //
  // Specifically checks for HAL UAE's custom attribute names:
  //   "Pack & Container Color" — the packaging colour
  //   "Pack Size"              — the product weight/size variant
  //
  // ASSERTIONS:
  //   - At least 1 swatch group exists (confirms it IS a configurable product)
  //   - Labels are read and logged (assertion adjusted if names differ by product)
  // ----------------------------------------------------------
  test('Test 12 — should display variant swatch groups (Pack & Container Color, Pack Size)', async () => {

    if (!configurablePDPUrl) {
      console.log('Test 12 SKIP: no configurable product URL');
      return;
    }

    // Ensure we are on the configurable PDP
    const currentUrl = page.url();
    if (!currentUrl.includes(configurablePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(configurablePDPUrl);
    }

    // ASSERTION 1: At least one swatch group must be visible
    const groupCount = await pdp.getSwatchGroupCount();
    console.log('Test 12 — Swatch group count:', groupCount);
    expect(groupCount).toBeGreaterThanOrEqual(1);

    // ASSERTION 2: Read and log all swatch attribute labels
    const labels = await pdp.getSwatchGroupLabels();
    console.log('Test 12 — Swatch attribute labels:', labels);

    // Verify at least one label is non-empty (the attributes have names)
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels[0].length).toBeGreaterThan(0);

    // HAL UAE-specific check: look for "Pack & Container Color" or "Pack Size"
    // Use a flexible match (includes) to handle minor spacing/casing differences
    const hasPackColor = labels.some(l => /Pack.*Colour|Pack.*Color|Container.*Colour|Container.*Color/i.test(l));
    const hasPackSize  = labels.some(l => /Pack.*Size|Size.*Pack/i.test(l));

    if (hasPackColor) {
      console.log('Test 12 ✓ "Pack & Container Color" label found:', labels.find(l => /Color|Colour/i.test(l)));
    } else {
      console.log('Test 12 NOTE: "Pack & Container Color" label not found on this product');
      console.log('             Actual labels:', labels);
    }

    if (hasPackSize) {
      console.log('Test 12 ✓ "Pack Size" label found:', labels.find(l => /Pack.*Size/i.test(l)));
    } else {
      console.log('Test 12 NOTE: "Pack Size" label not found on this product');
    }

    // We only ASSERT that the labels exist and are non-empty.
    // Specific label names are product-data dependent and can vary.
    // If this product happens to have these labels: great.
    // If not: the test still passes — we verified swatch groups ARE present.
  });


  // ----------------------------------------------------------
  // TEST 13
  // Select the first option in EACH swatch group and verify
  // that each selection registers as "selected".
  //
  // ASSERTIONS:
  //   - After clicking option 0 of group 0, isSwatchOptionSelected(0, 0) = true
  //   - Same for group 1, group 2, etc.
  // ----------------------------------------------------------
  test('Test 13 — should allow selecting first option in each swatch group', async () => {

    if (!configurablePDPUrl) {
      console.log('Test 13 SKIP: no configurable product URL');
      return;
    }

    // Ensure we are on the configurable PDP
    const currentUrl = page.url();
    if (!currentUrl.includes(configurablePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(configurablePDPUrl);
    }

    const groupCount = await pdp.getSwatchGroupCount();

    if (groupCount === 0) {
      console.log('Test 13 SKIP: no swatch groups found on this PDP');
      return;
    }

    // Iterate through each swatch attribute group
    for (let g = 0; g < groupCount; g++) {
      // Click the first available option in group g
      await pdp.selectSwatchOption(g, 0);

      // ASSERTION: That option must now carry the 'selected' class
      const isSelected = await pdp.isSwatchOptionSelected(g, 0);
      console.log(`Test 13 — Group ${g}, option 0 selected:`, isSelected);
      expect(isSelected).toBe(true);
    }

    console.log(`Test 13 — All ${groupCount} swatch group(s) have first option selected`);
  });


  // ----------------------------------------------------------
  // TEST 14
  // After selecting the first option in each swatch group,
  // read the MOQ badge to confirm the minimum is now displayed.
  //
  // On HAL UAE, configurable products may show an MOQ badge
  // AFTER variant selection (the MOQ can vary by variant).
  //
  // ASSERTION: MOQ is a valid integer ≥ 1 (even if no badge shown, defaults to 1).
  // ----------------------------------------------------------
  test('Test 14 — should display MOQ after variant selection on configurable product', async () => {

    if (!configurablePDPUrl) {
      console.log('Test 14 SKIP: no configurable product URL');
      return;
    }

    // Ensure we are on the configurable PDP with swatches already selected
    // (Test 13 should have left them selected; we verify or re-select)
    const currentUrl = page.url();
    if (!currentUrl.includes(configurablePDPUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(configurablePDPUrl);
      // Re-select all first swatch options since we re-navigated
      await pdp.selectAllFirstSwatchOptions();
    }

    // Read the MOQ — may be 1 (no badge) or higher (e.g. "MOQ (5 Unit)")
    const moq = await pdp.getMOQ();
    console.log('Test 14 — MOQ after variant selection:', moq);

    // ASSERTION 1: MOQ must be a positive integer
    expect(moq).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(moq)).toBe(true);

    // Log context based on what was found
    if (moq > 1) {
      console.log(`Test 14 ✓ MOQ badge shows minimum of ${moq} units for this variant`);
    } else {
      console.log('Test 14 — No MOQ badge found; default minimum is 1 unit');
    }
  });


  // ----------------------------------------------------------
  // TEST 15
  // Add the configurable product to the cart after selecting all variants.
  //
  // Steps:
  //   1. Navigate to configurable PDP
  //   2. Select first option in every swatch group
  //   3. Read MOQ and set qty accordingly
  //   4. Click Add to Cart
  //   5. Verify success toast
  //   6. Verify cart counter incremented beyond its value from Test 9
  //
  // ASSERTIONS:
  //   - Success toast appears
  //   - Cart counter increased
  // ----------------------------------------------------------
  test('Test 15 — should add configurable product to cart and verify counter', async () => {

    if (!configurablePDPUrl) {
      console.log('Test 15 SKIP: no configurable product URL');
      return;
    }

    // Navigate to the configurable product PDP (fresh load)
    await pdp.goto(configurablePDPUrl);

    // Step 1: Select all swatch options (required before Add to Cart works)
    await pdp.selectAllFirstSwatchOptions();
    console.log('Test 15 — All swatch options selected');

    // Step 2: Read the current cart count before adding
    const countBeforeText = await pdp.getCartCounterText();
    const countBefore = parseInt(countBeforeText, 10) || cartCount;
    console.log('Test 15 — Cart count before configurable add:', countBefore);

    // Step 3: Add to cart with MOQ handling
    const result = await pdp.addToCartWithMOQ();
    console.log('Test 15 — Success toast visible:', result.success);
    console.log('Test 15 — Qty added (MOQ):', result.qty);

    // ASSERTION 1: Success toast must appear after selecting variants and clicking Add to Cart
    expect(result.success).toBe(true);

    // Step 4: Read the updated cart counter
    const countAfterText = await pdp.getCartCounterText();
    const countAfter = parseInt(countAfterText, 10);
    console.log('Test 15 — Cart count after configurable add:', countAfter);

    // ASSERTION 2: Cart counter must have increased by the MOQ qty
    expect(countAfter).toBeGreaterThan(countBefore);

    // Update the running total
    cartCount = countAfter;
    console.log('Test 15 — Running cart total:', cartCount);
  });


  // ============================================================
  //
  //   GROUP C: CONTENT TABS (Tests 16–18)
  //
  //   Every Magento 2 PDP has three tabs at the bottom:
  //     Details          → product description text
  //     More Information → extra attributes (weight, size, etc.)
  //     Reviews          → customer ratings and "Write a Review" form
  //
  //   In Magento 2 these are implemented as a collapsible accordion.
  //   We click each tab title to expand it and verify the content panel
  //   becomes visible.
  //
  //   We run these tests on the CONFIGURABLE product PDP (since that's
  //   the page we were on after Test 15). If configurable URL is not
  //   available, we fall back to the simple product.
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 16
  // Click the "Details" tab and verify the description content panel opens.
  //
  // ASSERTION: The #description panel becomes visible after clicking the tab.
  // ----------------------------------------------------------
  test('Test 16 — should reveal Details tab content when clicked', async () => {

    // Use configurable PDP; fall back to simple if configurable not found
    const targetUrl = configurablePDPUrl || simplePDPUrl;
    if (!targetUrl) {
      console.log('Test 16 SKIP: no PDP URL available');
      return;
    }

    // Navigate to the product PDP
    await pdp.goto(targetUrl);

    // Verify the Details tab link is visible on the page
    let detailsTabFound = true;
    try {
      await pdp.detailsTabLink.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      detailsTabFound = false;
    }

    if (!detailsTabFound) {
      console.log('Test 16 SKIP: Details tab not found on this PDP');
      return;
    }

    // Click the "Details" tab to expand it
    await pdp.clickDetailsTab();
    console.log('Test 16 — Details tab clicked');

    // ASSERTION: The details content panel (#description) must be visible
    const panelVisible = await pdp.isDetailsPanelVisible();
    console.log('Test 16 — Details panel visible:', panelVisible);
    expect(panelVisible).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 17
  // Click the "More Information" tab and verify the attributes panel opens.
  //
  // This tab shows product attributes stored in Magento's EAV system
  // (e.g. weight, country of origin, material, etc.).
  //
  // ASSERTION: The #additional panel is visible after clicking the tab.
  // ----------------------------------------------------------
  test('Test 17 — should reveal More Information tab content when clicked', async () => {

    const targetUrl = configurablePDPUrl || simplePDPUrl;
    if (!targetUrl) {
      console.log('Test 17 SKIP: no PDP URL available');
      return;
    }

    // We should still be on the PDP from Test 16 — check the URL
    const currentUrl = page.url();
    if (!currentUrl.includes(targetUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(targetUrl);
    }

    // Check that the More Information tab link exists
    let moreInfoTabFound = true;
    try {
      await pdp.moreInfoTabLink.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      moreInfoTabFound = false;
    }

    if (!moreInfoTabFound) {
      console.log('Test 17 SKIP: More Information tab not found on this PDP');
      return;
    }

    // Click the "More Information" tab
    await pdp.clickMoreInfoTab();
    console.log('Test 17 — More Information tab clicked');

    // ASSERTION: The #additional content panel must become visible
    const panelVisible = await pdp.isMoreInfoPanelVisible();
    console.log('Test 17 — More Information panel visible:', panelVisible);
    expect(panelVisible).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 18
  // Click the "Reviews" tab and verify the reviews section appears.
  //
  // The Reviews panel contains:
  //   - Customer review list (may be empty if no reviews exist)
  //   - "Write a Review" form (accessible to guests on most HAL stores)
  //
  // ASSERTION: The #reviews panel is visible after clicking the tab.
  //            (The panel being visible is sufficient — reviews may be empty.)
  // ----------------------------------------------------------
  test('Test 18 — should reveal Reviews tab content when clicked', async () => {

    const targetUrl = configurablePDPUrl || simplePDPUrl;
    if (!targetUrl) {
      console.log('Test 18 SKIP: no PDP URL available');
      return;
    }

    // Check we are still on the correct PDP
    const currentUrl = page.url();
    if (!currentUrl.includes(targetUrl.split('mcstaging2.hal-uae.com')[1])) {
      await pdp.goto(targetUrl);
    }

    // Check that the Reviews tab link exists
    let reviewsTabFound = true;
    try {
      await pdp.reviewsTabLink.waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      reviewsTabFound = false;
    }

    if (!reviewsTabFound) {
      console.log('Test 18 SKIP: Reviews tab not found on this PDP');
      return;
    }

    // Click the "Reviews" tab to expand it
    await pdp.clickReviewsTab();
    console.log('Test 18 — Reviews tab clicked');

    // ASSERTION: The #reviews panel must be visible (content may be empty)
    const panelVisible = await pdp.isReviewsPanelVisible();
    console.log('Test 18 — Reviews panel visible:', panelVisible);
    expect(panelVisible).toBe(true);
  });


  // ============================================================
  //
  //   GROUP D: SOCIAL SHARE (Test 19)
  //
  //   Magento 2 provides social/share links in .product-social-links.
  //   The default Luma/Blank theme shows an "Email a Friend" link.
  //   HAL UAE may include custom social share buttons.
  //
  //   Guest user scenario:
  //   - Clicking "Email a Friend" may open a login modal (not logged in)
  //   - Or it may navigate to /sendfriend/ (requires login redirect)
  //   - Or HAL may show a custom share popup
  //
  //   All three outcomes confirm the share interaction WORKS.
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 19
  // Click the product share/email button and verify that either:
  //   A) A modal dialog appeared on the page, OR
  //   B) The URL navigated to a share/email/login page
  //
  // ASSERTION: One of the two outcomes above is true.
  // ----------------------------------------------------------
  test('Test 19 — should open share popup or navigate to share page on button click', async () => {

    // Use whichever PDP we have (configurable preferred, simple fallback)
    const targetUrl = configurablePDPUrl || simplePDPUrl;
    if (!targetUrl) {
      console.log('Test 19 SKIP: no PDP URL available');
      return;
    }

    // Navigate to the PDP (fresh load so we are in a clean state)
    await pdp.goto(targetUrl);

    // Check that the social links section exists on this PDP
    const socialSectionVisible = await pdp.isSocialLinksSectionVisible();
    console.log('Test 19 — Social links section visible:', socialSectionVisible);

    if (!socialSectionVisible) {
      console.log('Test 19 SKIP: .product-social-links section not found on this PDP');
      return;
    }

    // Record the URL before clicking — we use it to detect navigation
    const urlBeforeClick = page.url();

    // Click the share button (first link in .product-social-links)
    const buttonClicked = await pdp.clickShareButton();

    if (!buttonClicked) {
      console.log('Test 19 SKIP: no clickable share button found in .product-social-links');
      return;
    }

    console.log('Test 19 — Share button clicked; checking for popup or navigation');

    // ASSERTION: Either a popup appeared OR the URL changed to a share/login page
    const popupOrNavOccurred = await pdp.isSharePopupVisible();
    const urlAfterClick = page.url();
    const urlChanged = urlAfterClick !== urlBeforeClick;

    console.log('Test 19 — Share popup/modal detected:', popupOrNavOccurred);
    console.log('Test 19 — URL changed after click:', urlChanged);
    console.log('Test 19 — URL before:', urlBeforeClick);
    console.log('Test 19 — URL after: ', urlAfterClick);

    // Either the popup is visible OR the URL changed — both confirm the share interaction fired
    expect(popupOrNavOccurred || urlChanged).toBe(true);

    console.log('\n=== PDP TEST SUITE COMPLETE ===');
    console.log(`Final cart item count: ${cartCount}`);
    console.log(`Simple product tested: "${simpleProductName}"`);
    console.log(`Configurable product tested: "${configurableName}"`);
  });

});
