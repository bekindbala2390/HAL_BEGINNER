// ============================================================
// tests/mini-cart.spec.js
//
// WHAT DOES THIS FILE TEST?
// --------------------------
// Full end-to-end validation of the Mini Cart flyout panel on
// the HAL UAE e-commerce website (mcstaging2.hal-uae.com).
//
// The "mini cart" is the small flyout that opens when you click
// the shopping bag icon (🛒) in the top-right header. It lets
// customers review, edit, and act on their cart without leaving
// the current page.
//
// ──────────────────────────────────────────────────────────────
// BEFORE RUNNING:
//
//   NORMAL RUN (Mailinator reads OTP automatically):
//     npx playwright test tests/mini-cart.spec.js --headed
//
//   FAST RE-RUN (skip Mailinator, use a saved OTP):
//     PowerShell:
//       $env:MOCK_OTP = "123456"
//       npx playwright test tests/mini-cart.spec.js --headed
//
// ──────────────────────────────────────────────────────────────
// COMPLETE TEST LIST (12 tests, run in order):
//
//   MC01 — Open mini cart from Home page        → verify items visible
//   MC02 — Open mini cart from PLP page         → verify items visible
//   MC03 — Open mini cart from PDP page         → verify items visible
//   MC04 — Open mini cart from My Account page  → verify items visible
//   MC05 — Open mini cart from Cart page        → verify items visible
//   MC06 — Delete one product from mini cart    → verify product count decreases
//   MC07 — Add one product to wishlist          → via mini cart (wishlist btn or edit → PDP)
//   MC08 — Increase item qty in mini cart       → click Update → verify new qty saved
//   MC09 — Decrease item qty in mini cart       → click Update → verify new qty saved
//   MC10 — Click "View and Edit Cart"           → verify redirect to /checkout/cart/
//   MC11 — Click "Proceed to Checkout"          → verify redirect to /checkout/
//   MC12 — Delete ALL items from mini cart      → verify empty state message
//
// ──────────────────────────────────────────────────────────────
// HOW TO RUN:
//   npx playwright test tests/mini-cart.spec.js --headed
//   npx playwright test tests/mini-cart.spec.js --headed --project=chromium
//
// HOW TO SEE THE RESULTS:
//   HTML report:   npx playwright show-report
//   Trace viewer:  npx playwright show-trace test-results/<name>/trace.zip
// ============================================================


// ── IMPORTS ──────────────────────────────────────────────────
const { test, expect } = require('@playwright/test');

const { PLPPage }        = require('../pages/PLPPage');        // Product Listing Page
const { PDPPage }        = require('../pages/PDPPage');        // Product Detail Page
const { CartPage }       = require('../pages/CartPage');       // Cart + Mini Cart
const { AuthPage }       = require('../pages/AuthPage');       // Auth0 login flow
const { MailinatorPage } = require('../pages/MailinatorPage'); // OTP email reader


// ============================================================
// TEST DATA
// ============================================================
const TEST_DATA = {

  // ── LOGIN ──────────────────────────────────────────────────
  // Same email used by cart.spec.js — the inbox is known to
  // work reliably with Auth0 + Mailinator.
  email: 'kp.abhinand.seller@mailinator.com',

  // Set MOCK_OTP=123456 in PowerShell to skip Mailinator.
  mockOtp: process.env.MOCK_OTP || null,

  // ── PRODUCTS ───────────────────────────────────────────────
  // A known configurable product (requires swatch selection).
  configurablePdpUrl: 'https://mcstaging2.hal-uae.com/dove-beauty-cream-bar.html',
};


// ============================================================
// TEST SUITE
// ============================================================
test.describe('Mini Cart — Full E2E Flyout Validation', () => {

  // All 12 tests share one browser tab and run in written order.
  test.describe.configure({ mode: 'serial' });

  // 4 minutes per test — login + staging AJAX can be slow.
  test.setTimeout(240000);


  // ============================================================
  // SHARED STATE
  // ============================================================
  let page;
  let plp;
  let pdp;
  let cart;
  let auth;
  let mailinator;

  // URLs of two distinct simple products found on PLP.
  // Used in beforeAll to add 2 different items to the cart.
  let simplePdpUrl1 = null;
  let simplePdpUrl2 = null;

  // Item names recorded before MC06 deletion — used to verify
  // the correct item was removed.
  let namesBeforeDelete = [];


  // ============================================================
  // beforeAll — ONE-TIME SETUP
  // ============================================================
  // 1. Create shared browser page
  // 2. Log in via Auth0 (OTP from Mailinator or MOCK_OTP)
  // 3. Clear any leftover items from previous runs
  // 4. Add 2 simple products + 1 configurable to the cart
  // ============================================================
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(480000); // 8 min: OTP can take up to 5 min + clear cart + add products

    // ── STEP 1: Create shared page and page objects ─────────────
    page       = await browser.newPage();
    plp        = new PLPPage(page);
    pdp        = new PDPPage(page);
    cart       = new CartPage(page);
    auth       = new AuthPage(page);
    mailinator = new MailinatorPage(page);

    console.log('\n=== MINI CART SPEC SETUP: STARTING ===');
    console.log('Login email  :', TEST_DATA.email);
    console.log('MOCK_OTP mode:', TEST_DATA.mockOtp ? 'YES (' + TEST_DATA.mockOtp + ')' : 'NO (Mailinator)');


    // ── STEP 2A: Navigate to Auth0 login ────────────────────────
    await auth.navigateToLogin();

    // Entering the email triggers Auth0 to send the OTP email
    await auth.enterEmailAndSubmit(TEST_DATA.email);


    // ── STEP 2B: Obtain the OTP ──────────────────────────────────
    let otp;

    if (TEST_DATA.mockOtp) {
      otp = TEST_DATA.mockOtp;
      console.log('Setup: using MOCK_OTP →', otp);

    } else {
      // Navigate to Mailinator and wait for the OTP email.
      // If it doesn't arrive within 60s, auto-click Auth0 Resend
      // and keep waiting. Total budget: 5 minutes.
      await mailinator.openInbox(TEST_DATA.email);

      const emailArrived = await mailinator.waitForOTPEmail(
        300000,
        () => auth.resendOTP()
      );

      if (!emailArrived) {
        throw new Error(
          `Setup: OTP email did not arrive at ${TEST_DATA.email} within 5 minutes.\n` +
          `TIP: $env:MOCK_OTP = "123456"`
        );
      }

      otp = await mailinator.getOTPFromLatestEmail();
      if (!otp) throw new Error('Setup: email arrived but OTP not found in body.');

      console.log('Setup: OTP extracted →', otp);
    }


    // ── STEP 2C: Complete Auth0 login ────────────────────────────
    await auth.navigateBackToOTPPage();
    await auth.enterOTPAndSubmit(otp);

    const loggedIn = await auth.isLoggedIn();
    console.log('Setup: logged in =', loggedIn);
    if (!loggedIn) throw new Error('Setup: login failed. Check OTP or staging server.');


    // ── STEP 3: Clear any leftover cart items ────────────────────
    console.log('Setup: clearing cart...');
    await cart.goto();
    await cart.removeAllItems();
    console.log('Setup: cart cleared ✓');


    // ── STEP 4: Find 2 distinct simple product URLs on PLP ──────
    await plp.goto();

    const allLinks = await page
      .locator('a.product-item-link')
      .evaluateAll(anchors => anchors.map(a => a.href));

    console.log('Setup: PLP has', allLinks.length, 'products — scanning for simples...');

    const scanLimit = Math.min(allLinks.length, 25);

    for (let i = 0; i < scanLimit && simplePdpUrl2 === null; i++) {
      await page.goto(allLinks[i]);
      await page.waitForLoadState('domcontentloaded');

      const swatches = await pdp.getSwatchGroupCount();
      const hasBtn   = await page
        .locator('button#product-addtocart-button')
        .isVisible()
        .catch(() => false);

      if (swatches === 0 && hasBtn) {
        if (!simplePdpUrl1) {
          simplePdpUrl1 = allLinks[i];
          const name = await pdp.getProductTitle().catch(() => '');
          console.log('Setup: simple product 1 →', name);
        } else if (allLinks[i] !== simplePdpUrl1) {
          simplePdpUrl2 = allLinks[i];
          const name = await pdp.getProductTitle().catch(() => '');
          console.log('Setup: simple product 2 →', name);
        }
      }
    }

    if (!simplePdpUrl1) console.warn('Setup WARNING: no simple products found');
    if (!simplePdpUrl2) {
      console.warn('Setup WARNING: only 1 simple product — using same URL for product 2');
      simplePdpUrl2 = simplePdpUrl1;
    }


    // ── STEP 5: Add Product 1 — simple product from PLP ─────────
    console.log('Setup: adding product 1 from PLP...');
    await plp.goto();
    await plp.addProductAtIndex(0);
    let counter = parseInt(await cart.getMiniCartCount()) || 0;
    console.log('Setup: cart badge after product 1 =', counter);


    // ── STEP 6: Add Product 2 — simple product from PDP ─────────
    console.log('Setup: adding product 2 from PDP...');
    await pdp.goto(simplePdpUrl2);
    const { success: s2 } = await pdp.addToCartWithMOQ();
    console.log('Setup: product 2 added =', s2);
    counter = parseInt(await cart.getMiniCartCount()) || 0;
    console.log('Setup: cart badge after product 2 =', counter);


    // ── STEP 7: Add Product 3 — configurable product from PDP ───
    console.log('Setup: adding configurable product from PDP...');
    await pdp.goto(TEST_DATA.configurablePdpUrl);
    await pdp.selectAllFirstSwatchOptions();
    const { success: s3 } = await pdp.addToCartWithMOQ();
    console.log('Setup: configurable product added =', s3);
    counter = parseInt(await cart.getMiniCartCount()) || 0;
    console.log('Setup: cart badge after all 3 products =', counter);

    console.log('=== MINI CART SPEC SETUP: COMPLETE ===\n');
  });


  // ============================================================
  // afterAll — CLEANUP
  // ============================================================
  test.afterAll(async () => {
    if (page) await page.close();
  });


  // ============================================================
  // ──────────────────────────────────────────────────────────
  //  GROUP A: OPEN MINI CART FROM ALL FIVE PAGE TYPES (MC01–MC05)
  //
  //  The mini cart header icon is present on EVERY page. We
  //  verify that it opens correctly from each major page type:
  //  Home, PLP, PDP, My Account, and Cart page.
  // ──────────────────────────────────────────────────────────
  // ============================================================


  // ----------------------------------------------------------
  // TEST MC01 — Open Mini Cart from Home Page
  // ----------------------------------------------------------
  test('MC01 — open mini cart from Home page and verify items visible', async () => {
    console.log('\n── MC01: Mini cart from Home page ──');

    // Navigate to the homepage
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    console.log('MC01: on Home page →', page.url());

    // Open the mini cart flyout
    await cart.openMiniCart();
    console.log('MC01: mini cart opened ✓');

    // Read badge count and product names from the flyout
    const badgeCount  = await cart.getMiniCartCount();
    const productRows = await cart.getMiniCartItemsCount();
    const names       = await cart.getMiniCartItemNames();

    console.log('MC01: badge count (units) =', badgeCount);
    console.log('MC01: product rows in flyout =', productRows);
    names.forEach((n, i) => console.log(`  [${i}] ${n}`));

    // ASSERTION: flyout must show at least 3 distinct product rows
    expect(productRows).toBeGreaterThanOrEqual(3);

    await cart.closeMiniCart();
    console.log('MC01: PASS — mini cart opens from Home page ✓');
  });


  // ----------------------------------------------------------
  // TEST MC02 — Open Mini Cart from PLP Page
  // ----------------------------------------------------------
  test('MC02 — open mini cart from PLP page and verify items visible', async () => {
    console.log('\n── MC02: Mini cart from PLP page ──');

    // Navigate to the All Products listing page
    await plp.goto();
    console.log('MC02: on PLP →', page.url());

    await cart.openMiniCart();
    console.log('MC02: mini cart opened ✓');

    const productRows = await cart.getMiniCartItemsCount();
    const badgeCount  = await cart.getMiniCartCount();
    console.log('MC02: product rows =', productRows, '| badge =', badgeCount);

    expect(productRows).toBeGreaterThanOrEqual(3);

    await cart.closeMiniCart();
    console.log('MC02: PASS — mini cart opens from PLP ✓');
  });


  // ----------------------------------------------------------
  // TEST MC03 — Open Mini Cart from PDP Page
  // ----------------------------------------------------------
  test('MC03 — open mini cart from PDP page and verify items visible', async () => {
    console.log('\n── MC03: Mini cart from PDP page ──');

    // Navigate to the configurable product PDP
    await pdp.goto(TEST_DATA.configurablePdpUrl);
    console.log('MC03: on PDP →', page.url());

    await cart.openMiniCart();
    console.log('MC03: mini cart opened ✓');

    const productRows = await cart.getMiniCartItemsCount();
    const badgeCount  = await cart.getMiniCartCount();
    console.log('MC03: product rows =', productRows, '| badge =', badgeCount);

    expect(productRows).toBeGreaterThanOrEqual(3);

    await cart.closeMiniCart();
    console.log('MC03: PASS — mini cart opens from PDP ✓');
  });


  // ----------------------------------------------------------
  // TEST MC04 — Open Mini Cart from My Account Page
  // ----------------------------------------------------------
  test('MC04 — open mini cart from My Account page and verify items visible', async () => {
    console.log('\n── MC04: Mini cart from My Account ──');

    await page.goto('https://mcstaging2.hal-uae.com/customer/account/');
    await page.waitForLoadState('domcontentloaded');
    console.log('MC04: on My Account →', page.url());

    await cart.openMiniCart();
    console.log('MC04: mini cart opened ✓');

    const productRows = await cart.getMiniCartItemsCount();
    const badgeCount  = await cart.getMiniCartCount();
    console.log('MC04: product rows =', productRows, '| badge =', badgeCount);

    expect(productRows).toBeGreaterThanOrEqual(3);

    await cart.closeMiniCart();
    console.log('MC04: PASS — mini cart opens from My Account ✓');
  });


  // ----------------------------------------------------------
  // TEST MC05 — Open Mini Cart from Cart Page (/checkout/cart/)
  // ----------------------------------------------------------
  test('MC05 — open mini cart from Cart page and verify items visible', async () => {
    console.log('\n── MC05: Mini cart from Cart page ──');

    await cart.goto();
    console.log('MC05: on Cart page →', page.url());

    await cart.openMiniCart();
    console.log('MC05: mini cart opened ✓');

    const productRows = await cart.getMiniCartItemsCount();
    const badgeCount  = await cart.getMiniCartCount();
    console.log('MC05: product rows =', productRows, '| badge =', badgeCount);

    expect(productRows).toBeGreaterThanOrEqual(3);

    await cart.closeMiniCart();
    console.log('MC05: PASS — mini cart opens from Cart page ✓');
  });


  // ============================================================
  // ──────────────────────────────────────────────────────────
  //  GROUP B: ITEM OPERATIONS INSIDE THE MINI CART (MC06–MC09)
  //
  //  These tests modify the cart contents from within the mini
  //  cart flyout — no full cart page navigation needed.
  // ──────────────────────────────────────────────────────────
  // ============================================================


  // ----------------------------------------------------------
  // TEST MC06 — Delete One Product from Mini Cart
  //
  // WHAT HAPPENS:
  //   1. Open mini cart from the Home page
  //   2. Record the current list of product names (before)
  //   3. Click the trash/remove icon on the first product
  //   4. Confirm the deletion dialog (if present)
  //   5. Reopen mini cart and record names again (after)
  //   6. Verify one fewer product row
  // ----------------------------------------------------------
  test('MC06 — delete one product from mini cart and verify count decreases', async () => {
    console.log('\n── MC06: Delete one product from mini cart ──');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await cart.openMiniCart();

    // Snapshot names BEFORE deletion
    namesBeforeDelete = await cart.getMiniCartItemNames();
    const rowsBefore  = namesBeforeDelete.length;
    console.log('MC06: products BEFORE delete:', rowsBefore);
    namesBeforeDelete.forEach((n, i) => console.log(`  [${i}] ${n}`));

    if (rowsBefore === 0) {
      console.log('MC06 SKIP: mini cart is empty');
      return;
    }

    const deletedName = namesBeforeDelete[0];
    console.log('MC06: deleting →', deletedName);

    // Click the remove button for the first item
    await cart.deleteMiniCartItemAtIndex(0);
    console.log('MC06: deletion triggered');

    // Reopen mini cart to read the updated state
    await cart.openMiniCart();
    const namesAfter = await cart.getMiniCartItemNames();
    const rowsAfter  = namesAfter.length;
    console.log('MC06: products AFTER delete:', rowsAfter);
    namesAfter.forEach((n, i) => console.log(`  [${i}] ${n}`));

    // ASSERTION: exactly one fewer product row
    expect(rowsAfter).toBe(rowsBefore - 1);

    await cart.closeMiniCart();
    console.log('MC06: PASS — product removed, row count decreased by 1 ✓');
  });


  // ----------------------------------------------------------
  // TEST MC07 — Add One Product to Wishlist from Mini Cart
  //
  // STRATEGY:
  //   1. Open mini cart
  //   2. Try clicking the Wishlist button if it exists in
  //      the flyout (HAL UAE custom feature)
  //   3. If no wishlist button: click "Edit" to go to the
  //      product's PDP, then add to wishlist from there
  //
  // Either path ends with a redirect to the wishlist page.
  // ----------------------------------------------------------
  test('MC07 — add one product to wishlist via mini cart', async () => {
    console.log('\n── MC07: Add product to wishlist from mini cart ──');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await cart.openMiniCart();

    const names = await cart.getMiniCartItemNames();
    console.log('MC07: products in mini cart:', names);

    if (names.length === 0) {
      console.log('MC07 SKIP: mini cart is empty');
      return;
    }

    // ── APPROACH 1: Wishlist button inside mini cart ─────────────
    // Some Magento themes (including HAL UAE customisations) add
    // a small heart / "Add to Wishlist" icon per mini cart item.
    const wishlisted = await cart.addMiniCartItemToWishlist(0);

    if (wishlisted) {
      console.log('MC07: wishlist button found in mini cart — clicked ✓');

    } else {
      // ── APPROACH 2: Edit → PDP → Add to Wishlist ────────────────
      // The mini cart always has an "Edit" link per item that opens
      // the product's PDP. From there we use the standard wishlist flow.
      console.log('MC07: no wishlist button in mini cart — trying Edit → PDP approach');

      const editHref = await cart.getMiniCartEditLinkHref(0);
      console.log('MC07: edit link href =', editHref);

      const editBtn   = cart.miniCartEditBtns.first();
      const hasEditBtn = await editBtn.count().catch(() => 0);

      if (hasEditBtn > 0) {
        // Navigate to the product PDP via the Edit link
        await editBtn.click();
        await page.waitForLoadState('domcontentloaded');
        console.log('MC07: on PDP via edit →', page.url());
      } else {
        // Final fallback: navigate directly to the first simple PDP
        console.log('MC07: no edit button found — navigating directly to simple product PDP');
        await pdp.goto(simplePdpUrl1 || TEST_DATA.configurablePdpUrl);
      }

      // Add to wishlist from the PDP
      await pdp.clickAddToWishlist();
    }

    // ── VERIFY: navigate to the wishlist page and confirm item is there ──
    // HAL UAE's mini cart heart button silently adds the item to the
    // wishlist (no toast, no redirect to /wishlist/ — it just lands
    // on the home page after the action). The most reliable check is
    // to visit /wishlist/ directly and confirm at least one item exists.
    await page.waitForLoadState('domcontentloaded');

    console.log('MC07: current URL after click →', page.url());
    console.log('MC07: navigating to wishlist page to verify item was added...');

    await page.goto('https://mcstaging2.hal-uae.com/wishlist/');
    await page.waitForLoadState('domcontentloaded');

    const wishlistUrl = page.url();
    console.log('MC07: wishlist page URL →', wishlistUrl);

    // ASSERTION 1: landed on a wishlist page
    expect(wishlistUrl).toContain('/wishlist');

    // ASSERTION 2: at least one product item is in the wishlist
    const wishlistItemCount = await page
      .locator('.product-item, .item.product')
      .count()
      .catch(() => 0);
    console.log('MC07: items in wishlist =', wishlistItemCount);
    expect(wishlistItemCount).toBeGreaterThan(0);

    console.log('MC07: PASS — product added to wishlist ✓');
  });


  // ----------------------------------------------------------
  // TEST MC08 — Increase Qty in Mini Cart and Update
  //
  // WHAT HAPPENS:
  //   1. Navigate back to Home (we left the wishlist page in MC07)
  //   2. Open the mini cart
  //   3. Read the CURRENT qty for the first item
  //   4. Add 1 to it → type the new value into the qty input
  //   5. Click the per-item "Update" button (or press Enter)
  //   6. Verify the qty input now shows the increased value
  // ----------------------------------------------------------
  test('MC08 — increase qty in mini cart and click Update', async () => {
    console.log('\n── MC08: Increase mini cart item qty ──');

    // Navigate to home after wishlist redirect in MC07
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await cart.openMiniCart();

    const names = await cart.getMiniCartItemNames();
    console.log('MC08: products in mini cart:', names);

    if (names.length === 0) {
      console.log('MC08 SKIP: mini cart is empty');
      return;
    }

    // Read original qty for the first item
    const originalQty = await cart.getMiniCartItemQty(0);
    const increasedQty = originalQty + 1;
    console.log('MC08: current qty =', originalQty, '→ increasing to', increasedQty);

    // Type new qty and trigger the Update
    await cart.setMiniCartItemQty(0, increasedQty);

    // Re-read the qty input to confirm the server accepted the change
    // (we reopen the mini cart so the Knockout binding refreshes)
    await cart.openMiniCart();
    const qtyAfter = await cart.getMiniCartItemQty(0);
    console.log('MC08: qty after increase =', qtyAfter, '(expected', increasedQty, ')');

    expect(qtyAfter).toBe(increasedQty);

    await cart.closeMiniCart();
    console.log('MC08: PASS — qty increased and saved ✓');
  });


  // ----------------------------------------------------------
  // TEST MC09 — Decrease Qty in Mini Cart and Update
  //
  // WHAT HAPPENS:
  //   1. Open mini cart (on Home page)
  //   2. Read CURRENT qty for the first item (was increased in MC08)
  //   3. Subtract 1 → type the new value into the qty input
  //   4. Click "Update"
  //   5. Verify qty decreased by 1
  // ----------------------------------------------------------
  test('MC09 — decrease qty in mini cart and click Update', async () => {
    console.log('\n── MC09: Decrease mini cart item qty ──');

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await cart.openMiniCart();

    const names = await cart.getMiniCartItemNames();
    if (names.length === 0) {
      console.log('MC09 SKIP: mini cart is empty');
      return;
    }

    const currentQty  = await cart.getMiniCartItemQty(0);
    // Never go below 1 — Magento removes the item if qty = 0
    const decreasedQty = Math.max(1, currentQty - 1);
    console.log('MC09: current qty =', currentQty, '→ decreasing to', decreasedQty);

    await cart.setMiniCartItemQty(0, decreasedQty);

    // Reopen mini cart and verify the new qty
    await cart.openMiniCart();
    const qtyAfter = await cart.getMiniCartItemQty(0);
    console.log('MC09: qty after decrease =', qtyAfter, '(expected', decreasedQty, ')');

    expect(qtyAfter).toBe(decreasedQty);

    await cart.closeMiniCart();
    console.log('MC09: PASS — qty decreased and saved ✓');
  });


  // ============================================================
  // ──────────────────────────────────────────────────────────
  //  GROUP C: MINI CART NAVIGATION ACTIONS (MC10, MC11)
  //
  //  These tests click the two action buttons at the bottom
  //  of the mini cart:
  //    MC10 → "View and Edit Cart" navigates to /checkout/cart/
  //    MC11 → "Proceed to Checkout" navigates to /checkout/
  // ──────────────────────────────────────────────────────────
  // ============================================================


  // ----------------------------------------------------------
  // TEST MC10 — Click "View and Edit Cart" → verify cart page
  // ----------------------------------------------------------
  test('MC10 — click View and Edit Cart from mini cart and verify redirect to cart page', async () => {
    console.log('\n── MC10: View and Edit Cart redirect ──');

    // Navigate to Home so the mini cart header is fresh
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await cart.openMiniCart();
    console.log('MC10: mini cart opened on Home page');

    // Read subtotal before navigating away
    const subtotal = await cart.getMiniCartSubtotal();
    console.log('MC10: mini cart subtotal =', subtotal || '(not shown)');

    // Click "View and Edit Cart" link inside the mini cart flyout
    await cart.viewCartLink.waitFor({ state: 'visible', timeout: 8000 });
    await cart.viewCartLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const cartUrl = page.url();
    console.log('MC10: landed on →', cartUrl);

    // ASSERTION: URL must contain /cart (Magento 2 full cart page)
    expect(cartUrl).toContain('/cart');

    console.log('MC10: PASS — "View and Edit Cart" redirected to cart page ✓');
  });


  // ----------------------------------------------------------
  // TEST MC11 — Click "Proceed to Checkout" → verify checkout page
  //
  // NOTE: We do NOT complete the purchase.
  //   Submitting a real order on staging creates fake orders in
  //   the Magento Admin. We only verify the checkout URL loads.
  // ----------------------------------------------------------
  test('MC11 — click Proceed to Checkout from mini cart and verify redirect to checkout', async () => {
    console.log('\n── MC11: Proceed to Checkout redirect ──');

    // We are on the cart page from MC10 — open mini cart from here
    await cart.openMiniCart();
    console.log('MC11: mini cart opened on cart page');

    // Click the "Proceed to Checkout" button at the bottom of the flyout
    await cart.clickMiniCartCheckout();

    const checkoutUrl = page.url();
    console.log('MC11: landed on →', checkoutUrl);

    // ASSERTION: URL must include /checkout
    expect(checkoutUrl).toContain('/checkout');

    // Optional: verify the first checkout step heading is visible
    const stepHeading = page.locator('.step-title, h2:has-text("Shipping"), h3:has-text("Shipping Address")');
    try {
      await stepHeading.first().waitFor({ state: 'visible', timeout: 15000 });
      const stepText = await stepHeading.first().textContent();
      console.log('MC11: checkout step visible →', stepText.trim());
    } catch {
      console.log('MC11: checkout loaded (step heading style differs on this theme)');
    }

    console.log('MC11: PASS — "Proceed to Checkout" redirected to checkout page ✓');
  });


  // ============================================================
  // ──────────────────────────────────────────────────────────
  //  GROUP D: EMPTY MINI CART (MC12)
  //
  //  Delete ALL remaining products from the mini cart flyout
  //  and verify the "You have no items" empty state appears.
  // ──────────────────────────────────────────────────────────
  // ============================================================


  // ----------------------------------------------------------
  // TEST MC12 — Delete All Items from Mini Cart, Verify Empty State
  //
  // WHAT HAPPENS:
  //   1. Navigate to Home (we are on /checkout/ from MC11)
  //   2. Open the mini cart flyout
  //   3. Count how many products are there
  //   4. Delete them one by one (deleteAllMiniCartItems loop)
  //   5. Verify the "no items" empty message is visible
  //   6. Verify the header badge shows "0"
  //
  // WHY THIS MATTERS:
  //   The empty mini cart is a critical edge case. Customers who
  //   remove all items must see a clear confirmation that the
  //   cart is empty — not a blank panel or broken layout.
  //
  //   This test also cleans up after the suite, so the next run
  //   always starts with a clean cart.
  // ----------------------------------------------------------
  test('MC12 — delete all items from mini cart and verify empty state message', async () => {
    console.log('\n── MC12: Delete all items from mini cart ──');

    // Navigate back to Home after the checkout page in MC11
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    console.log('MC12: on Home page →', page.url());

    await cart.openMiniCart();
    console.log('MC12: mini cart opened ✓');

    const countBefore = await cart.getMiniCartItemsCount();
    const names       = await cart.getMiniCartItemNames();
    console.log('MC12: products before clearing:', countBefore);
    names.forEach((n, i) => console.log(`  [${i}] ${n}`));

    // Loop: delete item at index 0 until none remain
    console.log('MC12: deleting all items...');
    await cart.deleteAllMiniCartItems();
    console.log('MC12: all items deleted ✓');

    // ── VERIFY 1: empty state message in mini cart ────────────────
    const isEmpty = await cart.isMiniCartEmpty();
    console.log('MC12: mini cart empty state visible =', isEmpty);
    expect(isEmpty).toBe(true);

    // ── VERIFY 2: header badge shows "0" ─────────────────────────
    const badgeCount = await cart.getMiniCartCount();
    console.log('MC12: header badge =', badgeCount, '(expected "0")');
    expect(badgeCount).toBe('0');

    console.log('MC12: PASS — empty mini cart state verified ✓');
    console.log('\n=== ALL MINI CART TESTS COMPLETE ===');
    console.log('Tests MC01–MC12 ran with email:', TEST_DATA.email);
    console.log('Cart is now empty and ready for the next test run.');
  });

});


// ============================================================
// HOW TO RUN THESE TESTS
// ============================================================
//
// ── BASIC RUN ─────────────────────────────────────────────────
//   npx playwright test tests/mini-cart.spec.js --headed
//
// ── FAST RUN (skip Mailinator) ────────────────────────────────
//   $env:MOCK_OTP = "123456"
//   npx playwright test tests/mini-cart.spec.js --headed
//
// ── RUN A SINGLE TEST BY NAME ─────────────────────────────────
//   npx playwright test tests/mini-cart.spec.js --grep "MC06" --headed
//
// ── VIEW TEST REPORT ──────────────────────────────────────────
//   npx playwright show-report
//
// ── VIEW STEP-BY-STEP TRACE ───────────────────────────────────
//   npx playwright show-trace test-results/<test-name>/trace.zip
// ============================================================
