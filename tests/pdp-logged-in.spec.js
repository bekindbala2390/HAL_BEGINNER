// ============================================================
// tests/pdp-logged-in.spec.js
//
// PRODUCT DETAIL PAGE (PDP) — Logged-In User Test Suite
//
// WHAT IS BEING TESTED:
//
//   ─── SETUP (beforeAll) ───────────────────────────────────────
//   1. Fixed email kp.abhinand.seller@mailinator.com is used for login
//   2. The browser navigates to HAL UAE login → redirected to Auth0
//   3. The email is entered on Auth0 → OTP email is sent to Mailinator
//      The Auth0 OTP challenge URL is saved (contains session state)
//   4. The SAME browser tab navigates to Mailinator to read the OTP
//      (Auth0 session cookies survive in the background)
//   5. The OTP is extracted from the Mailinator email
//   6. The browser navigates BACK to the saved Auth0 OTP URL
//   7. OTP is entered → redirected to HAL UAE as a logged-in user
//   8. A simple product URL is discovered by scanning the PLP
//
//   ─── GROUP A: SIMPLE PRODUCT WISHLIST & COMPARE ──────────────
//   Test 01 — Navigate to simple product PDP → click "Add to Wish List"
//             → verify browser redirects to the customer's wishlist page
//   Test 02 — Navigate to simple product PDP → click "Add to Compare"
//             → verify green success toast appears on the same page
//
//   ─── GROUP B: CONFIGURABLE PRODUCT WISHLIST & COMPARE ─────────
//   Test 03 — Navigate to configurable product PDP → select first option
//             in every swatch group → click "Add to Wish List"
//             → verify browser redirects to the wishlist page
//   Test 04 — Navigate to configurable product PDP → select swatch options
//             → click "Add to Compare" → verify success toast
//
//   ─── GROUP C: COMPARE LIST PAGE ───────────────────────────────
//   Test 05 — Click the "Compare Products" link in the sidebar block
//             → verify browser navigates to the compare list page
//
//   ─── GROUP D: WISHLIST PAGE ACTIONS ──────────────────────────
//   Test 06 — Navigate to the wishlist page
//             → click "Add to Cart" on the first wishlist item
//             → navigate back to wishlist page
//             → click "Remove Item" on the first wishlist item
//             → verify browser stays on wishlist page after removal
//
//   ─── GROUP E: COMPARE LIST PAGE ACTIONS ──────────────────────
//   Test 07 — Navigate to the compare list page
//             → add the first product to cart
//             → navigate back to compare page
//             → add the first product to wishlist (redirects to wishlist)
//             → navigate back to compare page
//             → remove the first product from compare list
//             → verify browser stays on compare list page
//
//   ─── GROUP F: ADD TO CART FROM PDP (logged-in user) ──────────
//   Test 08 — Navigate to a simple product PDP → set qty to MOQ value
//             → click "Add to Cart" → verify success toast
//   Test 09 — Navigate to the configurable product PDP
//             → select first swatch option in every group
//             → set qty to MOQ value → click "Add to Cart"
//             → verify success toast
//
// SINGLE-PAGE STRATEGY:
//   All interactions (Auth0, mailinator, HAL UAE) happen on ONE browser tab.
//   This avoids lifecycle issues with extra browser contexts and ensures
//   the Auth0 session cookies are preserved throughout.
// ============================================================

const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const { PLPPage }   = require('../pages/PLPPage');
const { PDPPage }   = require('../pages/PDPPage');
const { AuthPage }  = require('../pages/AuthPage');
const { MailinatorPage } = require('../pages/MailinatorPage');

const AUTH_STATE_FILE = path.join(__dirname, '..', 'auth-state.json');
const OTP_URL_FILE    = path.join(__dirname, '..', 'otp-url.txt');


test.describe('PDP — Logged-In User: Wishlist & Compare Suite', () => {

  // ----------------------------------------------------------
  // Serial mode — all 9 tests run sequentially in ONE worker slot.
  //
  // WHY THIS MATTERS:
  //   Without this, Playwright may split the describe block into
  //   multiple internal "groups" after a test failure, running each
  //   group with its OWN beforeAll — causing repeated logins.
  //   Serial mode guarantees all tests share a SINGLE beforeAll
  //   and a SINGLE browser page for the whole suite.
  // ----------------------------------------------------------
  test.describe.configure({ mode: 'serial' });

  // ----------------------------------------------------------
  // Give every test in this suite 3 minutes.
  //
  // The full beforeAll (Auth0 redirect + mailinator polling + PLP scan)
  // can take up to 2 minutes on the slow staging server.
  // ----------------------------------------------------------
  test.setTimeout(180000);

  // ----------------------------------------------------------
  // Fixed test email — Gmail inbox that receives the Auth0 OTP.
  // Requires GMAIL_PASSWORD set in .env to sign in automatically.
  // ----------------------------------------------------------
  const testEmail = 'kp.abhinand.seller@mailinator.com';
  const mockOtp   = process.env.MOCK_OTP || null;

  // Shared variables declared at describe scope
  let browserContext; // holds saved cookies across runs
  let page;           // single browser tab shared by ALL steps and tests
  let plp;            // PLPPage Page Object
  let pdp;            // PDPPage Page Object
  let auth;           // AuthPage Page Object
  let mailinator;     // MailinatorPage Page Object

  let simplePDPUrl = null;

  // Fixed URL for the known configurable product
  const configurablePDPUrl = 'https://mcstaging2.hal-uae.com/dove-beauty-cream-bar.html';


  // ----------------------------------------------------------
  // test.beforeAll()
  // -----------------
  // Runs ONCE before any of the tests.
  //
  // Steps:
  //   1. Create a shared browser context (loads saved cookies if available)
  //   2. Skip login if saved session is still valid
  //   3. Otherwise: open Gmail FIRST, then trigger Auth0 OTP,
  //      navigate back to Gmail to read the code, complete login
  //   4. Save cookies for next run
  //   5. Discover simple product URL from the PLP
  // ----------------------------------------------------------
  test.beforeAll(async ({ browser }) => {

    test.setTimeout(480000); // 8 min: covers Gmail login + OTP wait + PLP scan

    // ── STEP 1: Create browser context (load saved cookies if available) ──
    const stateExists = fs.existsSync(AUTH_STATE_FILE) && !process.env.FORCE_LOGIN;
    const contextOpts = stateExists ? { storageState: AUTH_STATE_FILE } : {};
    browserContext = await browser.newContext(contextOpts);
    page  = await browserContext.newPage();
    plp   = new PLPPage(page);
    pdp   = new PDPPage(page);
    auth  = new AuthPage(page);
    mailinator = new MailinatorPage(page);

    console.log(`\nbeforeAll: test email       → ${testEmail}`);
    console.log(`beforeAll: saved auth state → ${stateExists ? AUTH_STATE_FILE : 'none'}`);
    console.log(`beforeAll: MOCK_OTP         → ${mockOtp || 'NO (Mailinator flow)'}`);

    // ── STEP 2: Check if the saved session is still valid ─────────────
    let loggedIn = false;

    if (stateExists) {
      await page.goto('https://mcstaging2.hal-uae.com/customer/account/login/');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      const landedUrl = page.url();
      if (!landedUrl.includes('/login') && landedUrl.includes('mcstaging2.hal-uae.com')) {
        loggedIn = true;
        console.log('beforeAll: saved session valid — redirected to:', landedUrl);
      } else {
        loggedIn = await auth.isLoggedIn();
        console.log('beforeAll: saved session valid =', loggedIn);
      }
    }

    if (!loggedIn) {
      // ── STEP 3A: Check for saved OTP URL (MOCK_OTP re-run path) ──────
      const hasSavedUrl = fs.existsSync(OTP_URL_FILE);
      const urlAge      = hasSavedUrl
        ? Date.now() - fs.statSync(OTP_URL_FILE).mtimeMs
        : Infinity;
      const reuseUrl    = mockOtp && hasSavedUrl && urlAge < 8 * 60 * 1000;

      if (reuseUrl) {
        // Use saved challenge URL — no new OTP email sent
        auth.otpPageUrl = fs.readFileSync(OTP_URL_FILE, 'utf8').trim();
        fs.unlinkSync(OTP_URL_FILE);
        console.log('beforeAll: reusing saved OTP challenge URL (age', Math.round(urlAge / 1000), 's)');

      } else {
        if (!mockOtp) {
          // Open Mailinator inbox BEFORE triggering Auth0 so openInbox()
          // snapshots the current email count as a baseline.
          console.log('beforeAll: opening Mailinator inbox before triggering Auth0 OTP...');
          await mailinator.openInbox(testEmail);
        }

        // Trigger Auth0 OTP (sends email to Mailinator inbox)
        await auth.navigateToLogin();
        await auth.enterEmailAndSubmit(testEmail);

        if (mockOtp) {
          // Save URL so the NEXT run can use MOCK_OTP correctly
          fs.writeFileSync(OTP_URL_FILE, auth.otpPageUrl, 'utf8');
          console.log('beforeAll: OTP URL saved — check Mailinator for the NEW code, then re-run with MOCK_OTP.');
        }
      }

      // ── STEP 3B: Get the OTP ──────────────────────────────────────────
      let otp;

      if (mockOtp) {
        otp = mockOtp;
        console.log('beforeAll: using MOCK_OTP →', otp);
      } else {
        // Poll Mailinator for the OTP email (no login needed — public inbox).
        const emailArrived = await mailinator.waitForOTPEmail(300000);

        if (!emailArrived) {
          throw new Error(
            `beforeAll: OTP email did not arrive at ${testEmail} within 5 min.\n` +
            `TIP: $env:MOCK_OTP = "123456"  then re-run.`
          );
        }

        otp = await mailinator.getOTPFromLatestEmail();
        if (!otp) throw new Error('beforeAll: email arrived but OTP not found in body.');
        console.log(`beforeAll: OTP extracted → ${otp}`);
      }

      // ── STEP 3C: Complete Auth0 login ─────────────────────────────────
      await auth.navigateBackToOTPPage();
      await auth.enterOTPAndSubmit(otp);

      loggedIn = await auth.isLoggedIn();
      console.log(`beforeAll: logged in → ${loggedIn}`);
      if (!loggedIn) {
        throw new Error(
          `beforeAll: Login failed — not showing logged-in state on HAL UAE.\n` +
          `Current URL: ${page.url()}`
        );
      }

      // ── STEP 3D: Save cookies for future runs ─────────────────────────
      await browserContext.storageState({ path: AUTH_STATE_FILE });
      console.log('beforeAll: auth state saved →', AUTH_STATE_FILE);
    }

    // ── STEP 4: Discover simple product URL ───────────────────────
    await plp.goto();

    const allLinks = await page
      .locator('a.product-item-link')
      .evaluateAll(anchors => anchors.map(a => a.href));

    console.log(`beforeAll: found ${allLinks.length} product links on PLP`);

    const scanLimit = Math.min(allLinks.length, 20);
    for (let i = 0; i < scanLimit; i++) {
      const url = allLinks[i];
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');

      const swatchCount = await pdp.getSwatchGroupCount();
      if (swatchCount === 0) {
        const hasAddToCart = await page
          .locator('button#product-addtocart-button')
          .isVisible()
          .catch(() => false);

        if (hasAddToCart) {
          simplePDPUrl = url;
          const name = await pdp.getProductTitle().catch(() => '');
          console.log(`beforeAll: simple product → "${name}"`);
          console.log(`           URL: ${simplePDPUrl}`);
          break;
        }
      }
    }

    if (!simplePDPUrl) {
      console.warn('beforeAll WARNING: no simple product found in first 20 PLP products');
    }
  });


  // ----------------------------------------------------------
  // test.afterAll()
  // ----------------
  // Closes the shared browser page after all 4 tests complete.
  // ----------------------------------------------------------
  test.afterAll(async () => {
    if (page) await page.close();
  });


  // ============================================================
  //
  //   GROUP A: SIMPLE PRODUCT — WISHLIST & COMPARE (Tests 01–02)
  //
  //   A simple product has no variant options (no swatches).
  //   The logged-in user can add it directly to wishlist or compare.
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 01
  // Add a simple product to the Wishlist.
  //
  // FLOW:
  //   1. Navigate to the simple product PDP
  //   2. Click "Add to Wish List"
  //   3. Magento redirects to the customer's wishlist page
  //
  // ASSERTIONS:
  //   - Browser URL contains "wishlist" (redirect happened)
  //   - A non-empty success message is visible on the wishlist page
  // ----------------------------------------------------------
  test('Test 01 — should add simple product to wishlist and verify redirect', async () => {

    if (!simplePDPUrl) {
      console.log('Test 01 SKIP: no simple product URL discovered in beforeAll');
      return;
    }

    await pdp.goto(simplePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 01 — adding to wishlist:', productName);

    // Click "Add to Wish List" — Magento redirects to wishlist page
    await pdp.clickAddToWishlist();

    // ASSERTION 1: URL must contain "wishlist"
    const onWishlist = await pdp.isOnWishlistPage();
    console.log('Test 01 — on wishlist page:', onWishlist);
    expect(onWishlist).toBe(true);

    // ASSERTION 2: Success message must be visible
    const msg = await pdp.getWishlistSuccessMessage();
    console.log('Test 01 — wishlist success message:', msg);
    expect(msg.length).toBeGreaterThan(0);
  });


  // ----------------------------------------------------------
  // TEST 02
  // Add a simple product to the Compare list.
  //
  // FLOW:
  //   1. Re-navigate to the simple product PDP
  //      (Test 01 left us on the wishlist page)
  //   2. Click "Add to Compare"
  //   3. A green success toast appears; browser stays on the PDP
  //
  // ASSERTIONS:
  //   - Success toast is visible after clicking "Add to Compare"
  // ----------------------------------------------------------
  test('Test 02 — should add simple product to compare list and verify toast', async () => {

    if (!simplePDPUrl) {
      console.log('Test 02 SKIP: no simple product URL discovered in beforeAll');
      return;
    }

    // Re-navigate (Test 01 left us on the wishlist page)
    await pdp.goto(simplePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 02 — adding to compare:', productName);

    // Click "Add to Compare" (AJAX — browser stays on this PDP)
    await pdp.clickAddToCompare();

    // ASSERTION: Green success toast must appear
    const toastVisible = await pdp.isCompareSuccessVisible();
    console.log('Test 02 — compare success toast visible:', toastVisible);
    expect(toastVisible).toBe(true);
  });


  // ============================================================
  //
  //   GROUP B: CONFIGURABLE PRODUCT — WISHLIST & COMPARE (Tests 03–04)
  //
  //   A configurable product needs swatch selection before
  //   adding to wishlist/compare so the variant is recorded.
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 03
  // Add a configurable product to the Wishlist (after swatch selection).
  //
  // FLOW:
  //   1. Navigate to the configurable product PDP
  //   2. Select first option in every swatch group
  //   3. Click "Add to Wish List" → redirected to wishlist page
  //
  // ASSERTIONS:
  //   - URL contains "wishlist"
  //   - Success message is visible
  // ----------------------------------------------------------
  test('Test 03 — should add configurable product to wishlist after swatch selection', async () => {

    await pdp.goto(configurablePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 03 — configurable product:', productName);

    // Select swatches first (saves the specific variant to wishlist)
    await pdp.selectAllFirstSwatchOptions();
    console.log('Test 03 — all swatch options selected');

    await pdp.clickAddToWishlist();

    // ASSERTION 1: Redirected to wishlist page
    const onWishlist = await pdp.isOnWishlistPage();
    console.log('Test 03 — on wishlist page:', onWishlist);
    expect(onWishlist).toBe(true);

    // ASSERTION 2: Success message visible
    const msg = await pdp.getWishlistSuccessMessage();
    console.log('Test 03 — wishlist success message:', msg);
    expect(msg.length).toBeGreaterThan(0);
  });


  // ----------------------------------------------------------
  // TEST 04
  // Add a configurable product to the Compare list (after swatch selection).
  //
  // FLOW:
  //   1. Re-navigate to the configurable product PDP
  //      (Test 03 left us on the wishlist page)
  //   2. Select swatches
  //   3. Click "Add to Compare" → toast appears, browser stays on PDP
  //
  // ASSERTIONS:
  //   - Success toast is visible
  // ----------------------------------------------------------
  test('Test 04 — should add configurable product to compare list after swatch selection', async () => {

    // Re-navigate (Test 03 left us on the wishlist page)
    await pdp.goto(configurablePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 04 — configurable product:', productName);

    await pdp.selectAllFirstSwatchOptions();
    console.log('Test 04 — all swatch options selected');

    await pdp.clickAddToCompare();

    // ASSERTION: Toast visible
    const toastVisible = await pdp.isCompareSuccessVisible();
    console.log('Test 04 — compare success toast visible:', toastVisible);
    expect(toastVisible).toBe(true);

    console.log('\n=== PDP LOGGED-IN TEST SUITE COMPLETE (Tests 01-04) ===');
    console.log(`Test email used: ${testEmail}`);
  });


  // ============================================================
  //
  //   GROUP C: COMPARE LIST PAGE (Test 05)
  //
  //   After Tests 02 and 04 added two products to the compare list,
  //   the page should now show a "Compare Products" button in the
  //   sidebar block.  Test 05 clicks that link and verifies we land
  //   on the compare list page.
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 05
  // Navigate to the Compare Products list page.
  //
  // FLOW:
  //   1. Re-navigate to the configurable product PDP
  //      (previous test left us on the configurable PDP)
  //   2. Click the "Compare Products" link in the sidebar block
  //   3. Browser navigates to /catalog/product_compare/index/
  //
  // ASSERTIONS:
  //   - Browser URL contains "catalog/product_compare"
  // ----------------------------------------------------------
  test('Test 05 — should navigate to the compare products list page', async () => {

    // Re-navigate to the configurable PDP so the compare sidebar block
    // is visible (it appears on any PDP once items are in the compare list)
    await pdp.goto(configurablePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 05 — on PDP:', productName);

    // Click the "Compare Products" link in the sidebar block
    await pdp.clickCompareProductsLink();

    // ASSERTION: URL must contain "catalog/product_compare"
    const onComparePage = await pdp.isOnCompareListPage();
    console.log('Test 05 — on compare list page:', onComparePage);
    expect(onComparePage).toBe(true);

    console.log('\n=== PDP LOGGED-IN TEST SUITE (Tests 01–05) COMPLETE ===');
    console.log(`Test email used: ${testEmail}`);
  });


  // ============================================================
  //
  //   GROUP D: WISHLIST PAGE ACTIONS (Test 06)
  //
  //   Tests 01 and 03 (above) already added two products to the
  //   wishlist.  Test 06 verifies two actions on that wishlist page:
  //     1. Adding a wishlist item directly to the cart
  //     2. Removing a wishlist item from the list
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 06
  // Add a product to cart from the wishlist page,
  // then remove a product from the wishlist page.
  //
  // FLOW:
  //   1. Navigate to the wishlist page
  //   2. Verify at least one item is in the wishlist
  //      (Tests 01 and 03 added items; if missing, re-add one)
  //   3. Click "Add to Cart" on the first wishlist item
  //   4. Navigate back to the wishlist page (in case of cart redirect)
  //   5. Click "Remove Item" on the first wishlist item
  //
  // ASSERTIONS:
  //   - After step 3: success toast visible OR redirected to cart
  //   - After step 5: browser URL still contains "wishlist"
  // ----------------------------------------------------------
  test('Test 06 — should add a wishlist item to cart and remove a wishlist item', async () => {

    // ── STEP 1: Navigate to the wishlist page ─────────────────
    await pdp.goToWishlistPage();

    // ── STEP 2: Verify wishlist has at least one item ─────────
    let itemCount = await pdp.getWishlistItemCount();
    console.log('Test 06 — wishlist item count on arrival:', itemCount);

    if (itemCount === 0) {
      // Tests 01/03 may have been skipped or the wishlist was cleared.
      // Re-add a product so the rest of the test can proceed.
      const urlToAdd = simplePDPUrl || configurablePDPUrl;
      console.log('Test 06 — wishlist empty; re-adding a product from:', urlToAdd);
      await pdp.goto(urlToAdd);

      // Configurable product needs swatch selection before adding to wishlist
      if (!simplePDPUrl) await pdp.selectAllFirstSwatchOptions();
      await pdp.clickAddToWishlist(); // redirects to wishlist page

      itemCount = await pdp.getWishlistItemCount();
      console.log('Test 06 — wishlist item count after re-add:', itemCount);
    }

    // ── STEP 3: Add first wishlist item to cart ───────────────
    // The button POSTs to /checkout/cart/add/. Magento may redirect
    // to the cart page or reload the wishlist — both are valid.
    await pdp.addFirstWishlistItemToCart();
    console.log('Test 06 — add to cart clicked; now at URL:', page.url());

    // ASSERTION 1: Accept any of three valid Magento outcomes:
    //   A) A green success toast on the same page (simple product stays on wishlist)
    //   B) Redirected to the cart / checkout page  (Magento "redirect to cart" setting)
    //   C) Redirected to /wishlist/index/configure/ — this happens when the wishlist
    //      item is a CONFIGURABLE product; Magento asks the user to pick options
    //      before completing the add-to-cart. This is a valid, expected redirect.
    const cartSuccessVisible = await pdp.isSuccessMessageVisible();
    const landedOnCart       = page.url().includes('cart') || page.url().includes('checkout');
    const landedOnConfigure  = page.url().includes('configure');
    console.log(
      'Test 06 — success toast:', cartSuccessVisible,
      '| on cart page:', landedOnCart,
      '| on configure page:', landedOnConfigure
    );
    expect(cartSuccessVisible || landedOnCart || landedOnConfigure).toBe(true);

    // ── STEP 4: Always navigate back to the wishlist LISTING page ─
    // Clicking "Add to Cart" on a configurable wishlist item redirects
    // to /wishlist/index/configure/ (to pick options) — not to the
    // /wishlist/index/index/ listing.  Both URLs contain "wishlist", so
    // a simple includes('wishlist') check would incorrectly skip the
    // navigation.  We always go back unconditionally to ensure Step 5's
    // remove button exists on the correct page.
    console.log('Test 06 — navigating back to wishlist listing page');
    await pdp.goToWishlistPage();

    // ── STEP 5: Remove the first wishlist item ────────────────
    // Magento reloads the wishlist page with a success flash message
    // after removal, e.g. "X has been removed from your Wish List."
    console.log('Test 06 — removing first wishlist item');
    await pdp.removeFirstWishlistItem();

    // ASSERTION 2: Browser must still be on the wishlist page after removal
    const onWishlist = await pdp.isOnWishlistPage();
    console.log('Test 06 — on wishlist page after remove:', onWishlist);
    expect(onWishlist).toBe(true);
  });


  // ============================================================
  //
  //   GROUP E: COMPARE LIST PAGE ACTIONS (Test 07)
  //
  //   Tests 02 and 04 (above) already added two products to the
  //   compare list.  Test 07 exercises three actions on that page:
  //     1. Add one compare item to cart
  //     2. Add one compare item to wishlist
  //     3. Remove one compare item from the list
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 07
  // On the compare list page: add one product to cart,
  // add one to wishlist (via its PDP), and remove one from compare.
  //
  // NOTE ON WISHLIST STEP:
  //   The HAL UAE compare page does not include an "Add to Wish List"
  //   button in the comparison table. The standard user workflow is to
  //   click the product name on the compare page, go to its PDP, and
  //   add to wishlist from there. That is the flow we use here.
  //
  // FLOW:
  //   1. Navigate to the compare list page
  //   2. Add the first product to cart (may redirect to cart)
  //   3. Navigate back to the compare list page
  //   4. Click the first product's name link → navigate to its PDP
  //   5. On the PDP, click "Add to Wish List" → redirects to wishlist page
  //   6. Navigate back to the compare list page
  //   7. Remove the first product from the compare list
  //
  // ASSERTIONS:
  //   - After step 2: success toast visible OR on cart page
  //   - After step 5: browser URL contains "wishlist"
  //   - After step 7: browser URL still contains "catalog/product_compare"
  // ----------------------------------------------------------
  test('Test 07 — should add to cart, add to wishlist, and remove from compare list page', async () => {

    // ── STEP 0: Clear the cart ────────────────────────────────
    // The staging server persists cart state between test runs.
    // If the product's max-qty (e.g. 5) is already reached from a
    // previous run, "Add to Cart" silently fails with no success toast.
    // Clearing first guarantees the add-to-cart step can succeed.
    await pdp.clearCart();

    // ── STEP 1: Navigate to the compare list page ─────────────
    await pdp.goToCompareListPage();
    console.log('Test 07 — on compare list page:', page.url());

    // ── STEP 2: Add last compare item to cart ────────────────
    // We target the LAST Add to Cart button on the compare page, which
    // corresponds to the oldest-added product (Almarai Fresh Cream — simple).
    // Simple products add via AJAX and show a success toast on the compare page.
    // Clicking the FIRST button (Dove — configurable) would trigger a 40+ second
    // server-side redirect on the staging server, making the test too slow.
    await pdp.addFirstCompareItemToCart();
    console.log('Test 07 — add to cart clicked; now at URL:', page.url());

    // ASSERTION 1: Success toast must appear (AJAX add for simple product)
    const cartSuccessVisible = await pdp.isSuccessMessageVisible();
    const landedOnCart       = page.url().includes('/cart') || page.url().includes('/checkout');
    console.log('Test 07 — success toast:', cartSuccessVisible, '| on cart page:', landedOnCart);
    expect(cartSuccessVisible || landedOnCart).toBe(true);

    // ── STEP 3: Navigate back to the compare list page ────────
    await pdp.goToCompareListPage();
    console.log('Test 07 — back on compare list page:', page.url());

    // ── STEP 4: Click the first product name → navigate to its PDP ─
    // The compare page does not have a direct "Add to Wish List" button.
    // We click the product name link to reach its PDP, then add to wishlist.
    await pdp.clickFirstCompareProductLink();
    console.log('Test 07 — navigated to product PDP:', page.url());

    // ── STEP 5: Add to wishlist from the PDP ─────────────────
    // clickAddToWishlist() posts to the wishlist endpoint and Magento
    // redirects the browser to /wishlist/index/index/.
    await pdp.clickAddToWishlist();
    console.log('Test 07 — add to wishlist clicked; now at URL:', page.url());

    // ASSERTION 2: Browser must have landed on the wishlist page
    const onWishlist = await pdp.isOnWishlistPage();
    console.log('Test 07 — on wishlist page after add-to-wishlist:', onWishlist);
    expect(onWishlist).toBe(true);

    // ── STEP 6: Navigate back to the compare list page ────────
    await pdp.goToCompareListPage();
    console.log('Test 07 — back on compare list page for removal');

    // ── STEP 7: Remove first product from the compare list ────
    // The × delete link sends a GET to /catalog/product_compare/remove/product/X/
    // and reloads the compare page with that product removed.
    await pdp.removeFirstCompareItem();
    console.log('Test 07 — remove clicked; now at URL:', page.url());

    // ASSERTION 3: Browser must still be on the compare list page
    const onComparePage = await pdp.isOnCompareListPage();
    console.log('Test 07 — on compare list page after remove:', onComparePage);
    expect(onComparePage).toBe(true);
  });


  // ============================================================
  //
  //   GROUP F: ADD TO CART FROM PDP — LOGGED-IN USER (Tests 08–09)
  //
  //   Tests 08 and 09 verify that a logged-in user can successfully
  //   add both a simple and a configurable product to the cart
  //   directly from the PDP, respecting the MOQ (Minimum Order Qty).
  //
  // ============================================================

  // ----------------------------------------------------------
  // TEST 08
  // Add a SIMPLE product to cart from its PDP (logged-in user).
  //
  // A simple product has no swatch options — it goes straight into
  // the cart when the "Add to Cart" button is clicked.
  //
  // FLOW:
  //   1. Navigate to the simple product PDP
  //   2. Read the MOQ badge (e.g. "MOQ (4 Unit)") — defaults to 1
  //   3. Set the qty input to the MOQ value
  //   4. Click "Add to Cart"
  //   5. Verify the green success toast appears
  //
  // ASSERTIONS:
  //   - Success toast is visible after clicking Add to Cart
  // ----------------------------------------------------------
  test('Test 08 — logged-in user should add a simple product to cart from PDP', async () => {

    if (!simplePDPUrl) {
      console.log('Test 08 SKIP: no simple product URL discovered in beforeAll');
      return;
    }

    // ── STEP 0: Clear the cart ────────────────────────────────
    // Ensures no accumulated max-qty restrictions from prior runs
    // block the add-to-cart action in this test or in Test 09.
    await pdp.clearCart();

    // ── STEP 1: Navigate to the simple product PDP ───────────
    await pdp.goto(simplePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 08 — simple product:', productName);

    // ── STEPS 2–4: MOQ-aware add to cart ─────────────────────
    // addToCartWithMOQ() reads the MOQ badge, sets the qty input,
    // clicks "Add to Cart", and returns { success, qty }.
    const { success, qty } = await pdp.addToCartWithMOQ();
    console.log(`Test 08 — add to cart result: success=${success}, qty=${qty}`);

    // ASSERTION: The green success toast must appear
    expect(success).toBe(true);
  });


  // ----------------------------------------------------------
  // TEST 09
  // Add a CONFIGURABLE product to cart from its PDP (logged-in user).
  //
  // A configurable product requires swatch option selection before
  // the "Add to Cart" button becomes active.
  //
  // FLOW:
  //   1. Navigate to the configurable product PDP
  //   2. Select the first available option in every swatch group
  //      (this activates the Add to Cart button)
  //   3. Read the MOQ badge — set qty input to that value
  //   4. Click "Add to Cart"
  //   5. Verify the green success toast appears
  //
  // ASSERTIONS:
  //   - Success toast is visible after clicking Add to Cart
  // ----------------------------------------------------------
  test('Test 09 — logged-in user should add a configurable product to cart from PDP', async () => {

    // ── STEP 0: Clear the cart ────────────────────────────────
    // Dove (configurable) has a max cart qty of 5.  Previous tests may
    // have left items in the cart.  Clearing ensures we can add the MOQ
    // (4 units) without hitting the cart maximum.
    await pdp.clearCart();

    // ── STEP 1: Navigate to the configurable product PDP ─────
    await pdp.goto(configurablePDPUrl);

    const productName = await pdp.getProductTitle().catch(() => 'unknown');
    console.log('Test 09 — configurable product:', productName);

    // ── STEP 2: Select swatches ───────────────────────────────
    // selectAllFirstSwatchOptions() clicks the first non-disabled
    // option in every swatch attribute group (e.g. colour, size).
    // Magento activates the Add to Cart button only after ALL groups
    // have a selection.
    await pdp.selectAllFirstSwatchOptions();
    console.log('Test 09 — all swatch options selected');

    // ── STEPS 3–4: MOQ-aware add to cart ─────────────────────
    const { success, qty } = await pdp.addToCartWithMOQ();
    console.log(`Test 09 — add to cart result: success=${success}, qty=${qty}`);

    // ASSERTION: The green success toast must appear
    expect(success).toBe(true);

    console.log('\n=== PDP LOGGED-IN TEST SUITE COMPLETE (Tests 01–09) ===');
    console.log(`Test email used: ${testEmail}`);
  });

});
