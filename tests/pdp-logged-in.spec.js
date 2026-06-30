// ============================================================
// tests/pdp-logged-in.spec.js
//
// PRODUCT DETAIL PAGE (PDP) — Logged-In User Test Suite
//
// WHAT IS BEING TESTED:
//
//   ─── SETUP (beforeAll) ───────────────────────────────────────
//   1. Fixed email sprint@mailnesia.com is used for login
//   2. The browser navigates to HAL UAE login → redirected to Auth0
//   3. The mailinator email is entered on Auth0 → OTP email is sent
//      The Auth0 OTP challenge URL is saved (contains session state)
//   4. The SAME browser tab navigates to mailinator.com to read the OTP
//      (Auth0 session cookies survive in the background)
//   5. The OTP is extracted from the mailinator email
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
// SINGLE-PAGE STRATEGY:
//   All interactions (Auth0, mailinator, HAL UAE) happen on ONE browser tab.
//   This avoids lifecycle issues with extra browser contexts and ensures
//   the Auth0 session cookies are preserved throughout.
// ============================================================

const { test, expect } = require('@playwright/test');

const { PLPPage }        = require('../pages/PLPPage');
const { PDPPage }        = require('../pages/PDPPage');
const { AuthPage }       = require('../pages/AuthPage');
const { MailinatorPage } = require('../pages/MailinatorPage');


test.describe('PDP — Logged-In User: Wishlist & Compare Suite', () => {

  // ----------------------------------------------------------
  // Give every test in this suite 3 minutes.
  //
  // The full beforeAll (Auth0 redirect + mailinator polling + PLP scan)
  // can take up to 2 minutes on the slow staging server.
  // ----------------------------------------------------------
  test.setTimeout(180000);

  // ----------------------------------------------------------
  // Fixed test email — uses a known mailinator.com public inbox.
  // The inbox "sprint" at mailinator.com receives the Auth0 OTP.
  // ----------------------------------------------------------
  const testEmail = 'sprint@mailnesia.com';

  // Shared variables declared at describe scope
  let page;       // single browser tab shared by ALL steps and tests
  let plp;        // PLPPage Page Object
  let pdp;        // PDPPage Page Object
  let auth;       // AuthPage Page Object
  let mailinator; // MailinatorPage Page Object

  let simplePDPUrl = null;

  // Fixed URL for the known configurable product
  const configurablePDPUrl = 'https://mcstaging2.hal-uae.com/dove-beauty-cream-bar.html';


  // ----------------------------------------------------------
  // test.beforeAll()
  // -----------------
  // Runs ONCE before any of the 4 tests.
  //
  // Steps:
  //   1. Create a single browser page for the whole suite
  //   2. Navigate to HAL UAE login → Auth0 redirect
  //   3. Enter the mailinator email → Auth0 sends OTP, saves challenge URL
  //   4. Navigate the SAME PAGE to mailinator to read the OTP
  //   5. Navigate back to the saved Auth0 OTP URL
  //   6. Submit OTP → logged into HAL UAE
  //   7. Discover simple product URL from the PLP
  // ----------------------------------------------------------
  test.beforeAll(async ({ browser }) => {

    // This timeout applies to the beforeAll hook itself.
    // 3 minutes covers Auth0 redirect + OTP polling + PLP scan.
    test.setTimeout(180000);

    // ── STEP 1: Create the single shared browser page ─────────────
    page     = await browser.newPage();
    plp       = new PLPPage(page);
    pdp       = new PDPPage(page);
    auth      = new AuthPage(page);
    mailinator = new MailinatorPage(page); // SAME page, not a separate tab

    console.log(`\nbeforeAll: test run email → ${testEmail}`);

    // ── STEP 2: Start the Auth0 login flow ────────────────────────
    // Visits /customer/account/login/ → Magento redirects to Auth0
    await auth.navigateToLogin();

    // ── STEP 3: Submit the email → Auth0 sends OTP ────────────────
    // After this call:
    //   • Auth0 has sent the OTP to testEmail
    //   • The browser is on the Auth0 OTP challenge page
    //   • auth.otpPageUrl holds the URL (we navigate back to it later)
    await auth.enterEmailAndSubmit(testEmail);

    // ── STEP 4: Navigate the SAME PAGE to mailnesia to read OTP ─────
    // openInbox() navigates the browser tab to mailnesia.com.
    // Auth0's session cookies (scoped to auth0.com) survive this
    // because cookies are domain-scoped and not lost by navigation.
    await mailinator.openInbox(testEmail);

    // Poll mailnesia by reloading until the OTP email arrives.
    const emailArrived = await mailinator.waitForOTPEmail(90000);
    if (!emailArrived) {
      throw new Error(
        `beforeAll: OTP email did not arrive at ${testEmail} within 90s. ` +
        `Check that Auth0 is delivering to mailnesia.com (screenshot in test-results/).`
      );
    }

    // ── STEP 5: Read the OTP from the email ───────────────────────
    const otp = await mailinator.getOTPFromLatestEmail();
    if (!otp) {
      throw new Error(
        `beforeAll: OTP email arrived but no 6-digit code found in body. ` +
        `Check MailinatorPage.getOTPFromLatestEmail() regex against the email content.`
      );
    }
    console.log(`beforeAll: OTP extracted → ${otp}`);

    // ── STEP 6: Navigate back to Auth0 OTP page and submit ────────
    // auth.otpPageUrl was saved by enterEmailAndSubmit().
    // Returning to it restores the Auth0 session (cookies intact).
    await auth.navigateBackToOTPPage();
    await auth.enterOTPAndSubmit(otp);

    // Confirm login
    const loggedIn = await auth.isLoggedIn();
    console.log(`beforeAll: logged in → ${loggedIn}`);
    if (!loggedIn) {
      throw new Error(
        `beforeAll: Login failed — not showing logged-in state on HAL UAE. ` +
        `Current URL: ${page.url()}`
      );
    }

    // ── STEP 7: Discover simple product URL ───────────────────────
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

    console.log('\n=== PDP LOGGED-IN TEST SUITE COMPLETE ===');
    console.log(`Test email used: ${testEmail}`);
  });

});
