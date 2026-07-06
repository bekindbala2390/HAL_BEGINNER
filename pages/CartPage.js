// ============================================================
// pages/CartPage.js
//
// What is this file?
// -------------------
// Page Object for the HAL UAE Shopping Cart page.
//
// The cart is the page at /checkout/cart/ where customers
// review their selected products before buying.
//
// Features covered by this Page Object:
//   1. Mini Cart        — the header flyout panel
//   2. Cart Items       — the table of products in the cart
//   3. Qty Update       — changing quantities per item
//   4. Remove Items     — deleting products from the cart
//   5. Seller Links     — "Sold by <Supplier>" links per item
//   6. Estimate Shipping — the "Estimate Shipping and Tax" section
//   7. Coupon Codes     — "Apply Discount Code" section
//   8. Order Totals     — subtotal, discount, shipping, tax, grand total
//   9. Checkout         — "Proceed to Checkout" button
//  10. Empty Cart       — the message shown when cart is cleared
//
// HOW MAGENTO 2 RENDERS THE CART:
//   The cart page has two main areas:
//     LEFT SIDE:  A table of all cart items with qty inputs
//     RIGHT SIDE: The Order Summary sidebar with:
//                   - "Estimate Shipping and Tax" accordion
//                   - "Apply Discount Code" accordion
//                   - Subtotal / Discount / Shipping / Tax / Grand Total
//                   - "Proceed to Checkout" button
//
// This class EXTENDS BasePage to inherit:
//   navigate(), waitForPageLoad(), getPageTitle(), takeScreenshot()
// ============================================================

const { BasePage } = require('./BasePage');

class CartPage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ----------------------------------------------------------
  constructor(page) {
    super(page);

    // ========================================================
    // CART PAGE URL
    // ========================================================
    // Magento 2 standard cart path — relative to baseURL in
    // playwright.config.js (https://mcstaging2.hal-uae.com)
    this.CART_URL = '/checkout/cart/';

    // ========================================================
    // SECTION 1: MINI CART (header flyout)
    // ========================================================
    //
    // The mini cart is the small flyout panel that opens when
    // you click the cart icon in the top-right of every page.
    // It shows item count, product thumbnails, and a
    // "View and Edit Cart" link.
    //
    // .showcart = the clickable cart icon link in the header
    // #minicart-content-wrapper = the flyout panel itself
    // .counter-number = the red badge showing total item count
    // .action.viewcart = the "View and Edit Cart" button

    // The clickable cart icon link in the header
    this.miniCartIcon    = page.locator('a.showcart, .minicart-wrapper a.showcart');

    // The numeric badge on the cart icon (e.g. "3")
    this.miniCartCounter = page.locator(
      '.counter.qty .counter-number, .minicart-wrapper .counter-number'
    );

    // The flyout panel that appears after clicking the icon.
    // Use only the specific ID — the theme also has a .block-minicart jQuery UI
    // dialog wrapper in the DOM, causing a strict-mode violation if we combine them.
    this.miniCartPanel   = page.locator('#minicart-content-wrapper');

    // "View and Edit Cart" link inside the mini cart panel
    this.viewCartLink    = page.locator('a.action.viewcart, .block-minicart .action.viewcart');


    // ========================================================
    // SECTION 2: CART ITEM TABLE (on /checkout/cart/ page)
    // ========================================================
    //
    // Magento 2 cart table structure:
    //   .cart.item (or tr.item-info)   ← ONE row per product
    //   └── .product-item-name a       ← product name link → PDP
    //   └── input.qty                  ← quantity number input
    //   └── a.action-delete            ← "Remove item" link (×)
    //
    // Note: HAL UAE uses class "action-delete" (one hyphenated word)
    // NOT "action delete" (two separate classes) for the remove link.

    // All cart row wrappers — count these to know how many items
    this.cartItems       = page.locator('.cart.item, tr.item-info');

    // Product name links — one per row — clicking opens the PDP
    this.itemNameLinks   = page.locator(
      '.cart.item .product-item-name a, tr.item-info .product-item-name a'
    );

    // Quantity inputs — one per row — users type a new number here
    this.itemQtyInputs   = page.locator('.cart.item input.qty, tr.item-info input.qty');

    // "Remove item" links — clicking one deletes that cart row
    // Multiple selector fallbacks because HAL UAE has custom theming
    this.itemRemoveLinks = page.locator(
      'a.action-delete[title="Remove item"], ' + // HAL UAE specific (AJAX href="#")
      'a[title="Remove item"], ' +               // title-only fallback
      '.cart.item .action.delete, ' +            // standard Magento Luma
      '.item-actions .action.delete'             // alternative custom theme
    );

    // "Update Shopping Cart" button — applies ALL qty changes at once
    // This button is ONLY active after you change a qty input value
    this.updateCartButton = page.locator(
      'button.action.update, ' +
      'button[title="Update Shopping Cart"], ' +
      'input[name="update_cart_action"]'
    );


    // ========================================================
    // SECTION 3: SELLER / BRAND LINKS
    // ========================================================
    //
    // HAL UAE shows a "Sold by <Supplier Name>" link for each
    // product in the cart. These links navigate to the supplier's
    // brand/seller page.
    //
    // The exact DOM structure varies by theme customisation —
    // we try multiple selector patterns to find these links.
    this.sellerLinks = page.locator(
      '.cart.item a[href*="brand"], ' +
      '.cart.item a[href*="supplier"], ' +
      '.cart.item a[href*="seller"], ' +
      '.cart.item .sold-by a, ' +
      'tr.item-info a[href*="brand"], ' +
      'tr.item-info a[href*="supplier"], ' +
      'tr.item-info .sold-by a'
    );


    // ========================================================
    // SECTION 4: ESTIMATE SHIPPING AND TAX
    // ========================================================
    //
    // This is an ACCORDION panel on the right side of the cart.
    // An accordion is an expand/collapse UI element — clicking
    // the title row opens or closes the form beneath it.
    //
    // DOM structure:
    //   #block-shipping                    ← accordion wrapper
    //   └── .title                         ← click to toggle open/close
    //   └── .content                       ← the form (hidden when closed)
    //       ├── select#country-shipping    ← "Country" dropdown
    //       ├── select#region_id           ← "State/Province" dropdown
    //       ├── input#postcode             ← "Zip/Postal Code" text field
    //       └── button                     ← "Get a Quote" button
    //
    // After clicking "Get a Quote", Magento makes an AJAX call and
    // shows shipping method options (radio buttons) below the button.

    // The outer wrapper of the entire estimate section
    this.estimateSection       = page.locator('#block-shipping');

    // The clickable title row ("Estimate Shipping and Tax")
    this.estimateTitle         = page.locator('#block-shipping .title');

    // The form area — only visible when the accordion is open
    this.estimateContent       = page.locator('#block-shipping .content');

    // Country selector (UAE store = AE by default)
    this.estimateCountrySelect = page.locator(
      'select#country-shipping, select[name="country_id"]'
    );

    // State/Region selector (UAE emirates: Dubai, Abu Dhabi, etc.)
    this.estimateRegionSelect  = page.locator(
      'select#region_id, select[name="region_id"]'
    );

    // Postal code / ZIP input
    this.estimatePostcode      = page.locator(
      'input#postcode, input[name="postcode"]'
    );

    // "Get a Quote" button — triggers the shipping AJAX call
    this.estimateGetQuoteBtn   = page.locator(
      'button#shopping-cart-table-totals-button, ' +
      'button[value="Get a Quote"], ' +
      '.action.primary.update'
    );

    // Shipping option rows — appear AFTER clicking "Get a Quote"
    // Each row shows: ◉ Carrier Name — Price
    this.shippingMethodItems   = page.locator(
      '.shipping-method, .available-methods .item'
    );

    // Radio button inputs for each shipping option
    this.shippingMethodRadios  = page.locator(
      'input[type="radio"][name="shipping_method"]'
    );


    // ========================================================
    // SECTION 5: APPLY DISCOUNT CODE (Coupon)
    // ========================================================
    //
    // Another accordion panel in the cart summary sidebar.
    //
    // DOM structure:
    //   #block-discount                   ← wrapper
    //   └── .title                        ← click to toggle
    //   └── .content                      ← coupon form
    //       ├── input#coupon_code         ← type the discount code
    //       ├── button.action.apply       ← "Apply Discount" button
    //       └── button.action.cancel      ← "Cancel Coupon" (shown after applying)

    // Outer wrapper
    this.discountSection      = page.locator('#block-discount');

    // Clickable title row ("Apply Discount Code")
    this.discountTitle        = page.locator('#block-discount .title');

    // The form area (hidden until opened)
    this.discountContent      = page.locator('#block-discount .content');

    // Text input where you type the code (e.g. "HAL10")
    this.couponInput          = page.locator('input#coupon_code');

    // "Apply Discount" button
    this.applyCouponButton    = page.locator(
      'button.action.apply.coupon, ' +
      'button[value="Apply Discount"], ' +
      '.apply.coupon'
    );

    // "Cancel Coupon" button — only visible AFTER a coupon is applied
    this.cancelCouponButton   = page.locator(
      'button.action.cancel.coupon, ' +
      'button[value="Cancel Coupon"], ' +
      '.cancel.coupon'
    );


    // ========================================================
    // SECTION 6: ORDER SUMMARY TOTALS
    // ========================================================
    //
    // The order summary on the right side shows a table of lines:
    //   Subtotal:         AED 120.00   ← price of all items before discounts
    //   Discount (HAL10): -AED 12.00   ← only shown when a coupon is applied
    //   Shipping & Handling: AED 15.00 ← only shown after selecting a shipping method
    //   Tax:              AED 5.00     ← VAT or other taxes
    //   Order Total:      AED 128.00   ← the final amount to pay
    //
    // Each row has a specific CSS class in Magento 2 Blank/Luma theme.
    // We use .first() where multiple price elements exist (e.g. shipping can
    // have "excl. tax" and "incl. tax" variants, each with its own .price).

    // Subtotal row and its price text
    this.subtotalRow   = page.locator('.totals.sub, tr.totals.sub');
    this.subtotalPrice = page.locator('.totals.sub .price, tr.totals.sub .price');

    // Discount row — only visible when a coupon code is active
    this.discountRow   = page.locator('.totals.discount, tr.totals.discount');
    this.discountPrice = page.locator('.totals.discount .price, tr.totals.discount .price');

    // Shipping row — only visible after selecting a shipping method
    this.shippingRow   = page.locator(
      '.totals.shipping.excl, tr.totals.shipping, .totals-tax-shipping'
    );
    this.shippingPrice = page.locator(
      '.totals.shipping.excl .price, .totals.shipping .price'
    );

    // Tax row — may not appear if the store has no tax configured
    this.taxRow   = page.locator('.totals-tax, tr.totals-tax, .totals.tax');
    this.taxPrice = page.locator('.totals-tax .price, .totals.tax .price');

    // Grand total row (the big bold "Order Total" line)
    this.grandTotalRow   = page.locator('.grand.totals, tr.grand.totals');
    this.grandTotalPrice = page.locator('.grand.totals .price, tr.grand.totals .price');


    // ========================================================
    // SECTION 7: PROCEED TO CHECKOUT BUTTON
    // ========================================================
    //
    // The large orange "Proceed to Checkout" button at the bottom
    // of the cart summary sidebar. Clicking it navigates to
    // /checkout/ where the user enters shipping and payment info.
    //
    // Exclude #top-cart-btn-checkout which is the MINI-CART's hidden checkout button.
    // The real cart-page checkout button is inside .checkout-methods-items.
    this.proceedToCheckoutButton = page.locator(
      '.checkout-methods-items .action.primary.checkout, ' +
      '.cart-summary button.action.primary.checkout, ' +
      'button[title="Proceed to Checkout"]:not(#top-cart-btn-checkout)'
    ).first();


    // ========================================================
    // SECTION 8: EMPTY CART MESSAGE
    // ========================================================
    //
    // When all items are removed, Magento hides the cart table and
    // shows a message like: "You have no items in your shopping cart."
    // The exact class varies slightly between theme versions.
    this.emptyCartMessage = page.locator(
      '.cart-empty, p.cart-empty, .message.info.empty'
    );


    // ========================================================
    // SECTION 9: FLASH MESSAGES
    // ========================================================
    //
    // Magento uses a "message bar" at the top of the page for
    // notifications after actions like adding a coupon or
    // removing an item.
    //
    // Types:
    //   .message-success → green  (e.g. "Coupon was applied")
    //   .message-notice  → blue   (e.g. informational)
    //   .message-error   → red    (e.g. "Invalid coupon code")
    this.successMessage = page.locator('.message-success, .message.success');
    this.errorMessage   = page.locator('.message-error, .message.error');
    this.noticeMessage  = page.locator('.message-notice, .message.notice');
  }


  // ===========================================================
  // 1. NAVIGATION
  // ===========================================================

  // ----------------------------------------------------------
  // goto()
  // -------
  // Opens the cart page directly via URL.
  // Uses the CART_URL set in the constructor ('/checkout/cart/')
  // combined with the baseURL from playwright.config.js.
  // ----------------------------------------------------------
  async goto() {
    await this.navigate(this.CART_URL);
    await this.waitForPageLoad();
  }


  // ===========================================================
  // 2. CART ITEM COUNT
  // ===========================================================

  // ----------------------------------------------------------
  // getCartItemCount()
  // -------------------
  // Returns the number of distinct product rows in the cart.
  //
  // Returns 0 if the cart is empty or if no item rows are found.
  // ----------------------------------------------------------
  async getCartItemCount() {
    // Count by product NAME LINKS (one per unique product) rather than
    // by cart item rows (.cart.item / tr.item-info), which double-count
    // because HAL UAE renders a separate action row per product.
    try {
      await this.itemNameLinks.first().waitFor({ state: 'visible', timeout: 5000 });
      return await this.itemNameLinks.count();
    } catch {
      return 0;
    }
  }


  // ===========================================================
  // 3. CART ITEM NAMES
  // ===========================================================

  // ----------------------------------------------------------
  // getItemNames()
  // ---------------
  // Returns an array of all product name strings currently
  // in the cart, in order from top to bottom.
  //
  // Example: ['HAL Dove Beauty Cream Bar 100g', 'Almarai Fresh Cream']
  // ----------------------------------------------------------
  async getItemNames() {
    try {
      await this.itemNameLinks.first().waitFor({ state: 'visible', timeout: 5000 });
      const count = await this.itemNameLinks.count();
      const names = [];
      for (let i = 0; i < count; i++) {
        const text = await this.itemNameLinks.nth(i).textContent();
        names.push(text.trim());
      }
      return names;
    } catch {
      return [];
    }
  }


  // ===========================================================
  // 4. QUANTITY UPDATE
  // ===========================================================

  // ----------------------------------------------------------
  // getItemQuantity(index)
  // -----------------------
  // Reads the current value from the qty input in a specific
  // cart row (0-based index).
  //
  // index = 0 means the FIRST product in the cart table.
  // Returns 1 as a default if the input cannot be read.
  // ----------------------------------------------------------
  async getItemQuantity(index = 0) {
    try {
      const input = this.itemQtyInputs.nth(index);
      await input.waitFor({ state: 'visible', timeout: 5000 });
      const val = await input.inputValue();
      return parseInt(val, 10) || 1;
    } catch {
      return 1;
    }
  }

  // ----------------------------------------------------------
  // setItemQuantity(index, qty)
  // ----------------------------
  // Changes the quantity input for a specific cart row to `qty`.
  //
  // IMPORTANT: After calling this, you MUST call clickUpdateCart()
  // to actually apply the change. Changing the input alone does
  // nothing until the update button is pressed.
  //
  // index → 0-based position of the cart row
  // qty   → new quantity (must be a positive integer ≥ MOQ)
  // ----------------------------------------------------------
  async setItemQuantity(index, qty) {
    const input = this.itemQtyInputs.nth(index);
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill(String(qty));
  }

  // ----------------------------------------------------------
  // clickUpdateCart()
  // ------------------
  // Clicks the "Update Shopping Cart" button.
  //
  // Magento recalculates all totals after this click — the page
  // reloads and the updated quantities are confirmed.
  //
  // Call this AFTER setItemQuantity() to save the change.
  // ----------------------------------------------------------
  async clickUpdateCart() {
    await this.updateCartButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.updateCartButton.click();

    // Wait for the page to reload with updated quantities
    await this.waitForPageLoad();

    // Extra wait for Magento's cart AJAX to finish updating totals
    await this.page.waitForTimeout(2000);
  }


  // ===========================================================
  // 5. REMOVE ITEMS
  // ===========================================================

  // ----------------------------------------------------------
  // removeItemAtIndex(index)
  // -------------------------
  // Clicks the "Remove item" (×) link for the cart row at
  // the given 0-based index.
  //
  // Magento reloads the cart page after deletion.
  // ----------------------------------------------------------
  async removeItemAtIndex(index = 0) {
    const removeBtn = this.itemRemoveLinks.nth(index);

    // HAL UAE's delete buttons exist in the DOM but are CSS-hidden (no bounding box).
    // Using evaluate() fires a native JS click that bypasses Playwright visibility checks.
    await removeBtn.waitFor({ state: 'attached', timeout: 10000 });
    await removeBtn.evaluate(el => el.click());

    // HAL UAE shows a confirmation dialog: "Are you sure you want to remove this item?"
    // We must click the OK/confirm button, otherwise the item is NOT deleted.
    const confirmOk = this.page.locator(
      '.modal-popup button.action-primary, ' +
      'button:has-text("OK"), ' +
      '.modal-footer button.action-accept'
    );
    try {
      await confirmOk.waitFor({ state: 'visible', timeout: 5000 });
      await confirmOk.click();
    } catch {
      // No confirmation dialog — some themes skip it; proceed to page load
    }

    // Wait for the page to reload / AJAX to update after item removal
    await this.waitForPageLoad();
    await this.page.waitForTimeout(1500);
  }

  // ----------------------------------------------------------
  // removeFirstItem()
  // ------------------
  // Shorthand: remove the item at index 0 (top of the list).
  // ----------------------------------------------------------
  async removeFirstItem() {
    return this.removeItemAtIndex(0);
  }

  // ----------------------------------------------------------
  // removeAllItems()
  // -----------------
  // Clears the entire cart by repeatedly clicking the first
  // "Remove item" link until no more items remain.
  //
  // A safety limit of 20 iterations prevents infinite loops
  // in case of unexpected DOM behaviour.
  // ----------------------------------------------------------
  async removeAllItems() {
    console.log('CartPage.removeAllItems — starting cart clear');

    // Wait for the page JS (Knockout/RequireJS) to finish binding cart actions
    // before we start looking for remove buttons.
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const confirmOk = this.page.locator(
      '.modal-popup button.action-primary, ' +
      'button:has-text("OK"), ' +
      '.modal-footer button.action-accept'
    );
    let safety = 20;
    while (safety-- > 0) {
      // Wait up to 6s for a remove button to appear in the DOM.
      // After a page reload the buttons can take a moment to re-render.
      let hasItem = false;
      try {
        await this.itemRemoveLinks.first().waitFor({ state: 'attached', timeout: 6000 });
        hasItem = (await this.itemRemoveLinks.count().catch(() => 0)) > 0;
      } catch {
        hasItem = false;
      }
      if (!hasItem) break;

      // JS click bypasses Playwright actionability — works even on CSS-hidden buttons
      await this.itemRemoveLinks.first().evaluate(el => el.click());

      // Confirm the removal dialog if HAL UAE shows one
      try {
        await confirmOk.waitFor({ state: 'visible', timeout: 5000 });
        await confirmOk.click();
      } catch { /* no dialog — continue */ }

      await this.waitForPageLoad();
      await this.page.waitForTimeout(1500);
    }
    console.log('CartPage.removeAllItems — cart cleared');
  }


  // ===========================================================
  // 6. ESTIMATE SHIPPING AND TAX
  // ===========================================================

  // ----------------------------------------------------------
  // isEstimateShippingExpanded()
  // -----------------------------
  // Returns true if the "Estimate Shipping and Tax" accordion
  // panel is currently open (its form is visible).
  // ----------------------------------------------------------
  async isEstimateShippingExpanded() {
    try {
      await this.estimateContent.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // expandEstimateShipping()
  // -------------------------
  // Opens the "Estimate Shipping and Tax" accordion if it is
  // currently closed. Does nothing if already open.
  // ----------------------------------------------------------
  async expandEstimateShipping() {
    const alreadyOpen = await this.isEstimateShippingExpanded();
    if (!alreadyOpen) {
      // Click the title row to expand the panel
      await this.estimateTitle.waitFor({ state: 'visible', timeout: 10000 });
      await this.estimateTitle.click();

      // Wait for the form to animate into view
      await this.estimateContent.waitFor({ state: 'visible', timeout: 8000 });
    }
    console.log('CartPage.expandEstimateShipping — section is open');
  }

  // ----------------------------------------------------------
  // setEstimateCountry(countryCode)
  // --------------------------------
  // Selects a country from the Country dropdown.
  //
  // countryCode → ISO 2-letter code, e.g. 'AE' for UAE
  //
  // On most UAE stores the country defaults to AE — you only
  // need to call this if you want to change from the default.
  // ----------------------------------------------------------
  async setEstimateCountry(countryCode) {
    await this.expandEstimateShipping();
    await this.estimateCountrySelect.waitFor({ state: 'visible', timeout: 5000 });
    await this.estimateCountrySelect.selectOption(countryCode);

    // Wait for the State/Region dropdown to refresh (AJAX update)
    await this.page.waitForTimeout(1500);
  }

  // ----------------------------------------------------------
  // setEstimateState(stateOption)
  // ------------------------------
  // Selects a state/region from the State/Province dropdown.
  //
  // stateOption → can be the VISIBLE TEXT (e.g. 'Dubai')
  //               OR the option VALUE (e.g. 'AE-DU')
  //
  // We try matching by label text first (more readable), then
  // fall back to matching by value if the label match fails.
  // ----------------------------------------------------------
  async setEstimateState(stateOption) {
    await this.expandEstimateShipping();
    await this.estimateRegionSelect.waitFor({ state: 'visible', timeout: 8000 });
    try {
      // Attempt to match by visible option text (e.g. "Dubai")
      await this.estimateRegionSelect.selectOption({ label: stateOption });
    } catch {
      // Fallback: match by option value (e.g. "AE-DU")
      await this.estimateRegionSelect.selectOption(stateOption);
    }
    await this.page.waitForTimeout(500);
  }

  // ----------------------------------------------------------
  // setEstimatePostcode(postcode)
  // ------------------------------
  // Fills in the postal code / ZIP field.
  //
  // UAE postcodes are usually numeric (e.g. "00000" or "12345").
  // Some UAE emirates don't use postcodes; "00000" is a safe value.
  // ----------------------------------------------------------
  async setEstimatePostcode(postcode) {
    await this.expandEstimateShipping();
    await this.estimatePostcode.waitFor({ state: 'visible', timeout: 5000 });
    await this.estimatePostcode.fill(postcode);
  }

  // ----------------------------------------------------------
  // clickGetQuote()
  // ----------------
  // Clicks the "Get a Quote" button if it exists.
  //
  // HAL UAE auto-calculates shipping when fields change —
  // there is no button on this theme. If the button is absent,
  // this method skips the click and just waits for the AJAX
  // shipping rates that already appeared automatically.
  // ----------------------------------------------------------
  async clickGetQuote() {
    try {
      // Some Magento themes have an explicit "Get a Quote" button;
      // others (like HAL UAE) auto-update when you change fields.
      await this.estimateGetQuoteBtn.waitFor({ state: 'visible', timeout: 3000 });
      await this.estimateGetQuoteBtn.click();
    } catch {
      // No button found — shipping rates auto-calculated on this theme
      console.log('CartPage.clickGetQuote — no button found, auto-calculate mode');
    }

    // Wait for shipping rate AJAX to finish (button click OR auto-update)
    await this.page.waitForTimeout(3000);
  }

  // ----------------------------------------------------------
  // getShippingOptions()
  // ---------------------
  // Returns an array of shipping option description strings
  // that appeared after clicking "Get a Quote".
  //
  // Example return: ['Flat Rate — AED 15.00', 'DHL Express — AED 45.00']
  // Returns [] if no options were found within the timeout.
  // ----------------------------------------------------------
  async getShippingOptions() {
    // Strategy 1: look for .shipping-method or .available-methods items
    try {
      await this.shippingMethodItems.first().waitFor({ state: 'visible', timeout: 10000 });
      const count = await this.shippingMethodItems.count();
      const options = [];
      for (let i = 0; i < count; i++) {
        const text = await this.shippingMethodItems.nth(i).textContent();
        options.push(text.trim().replace(/\s+/g, ' '));
      }
      if (options.length > 0) return options;
    } catch { /* no items — try fallback */ }

    // Strategy 2: look for labels next to the radio buttons
    try {
      const labels = this.page.locator(
        '.available-methods label, .shipping-method label, ' +
        '.methods-shipping label, .col.col-method label'
      );
      await labels.first().waitFor({ state: 'visible', timeout: 5000 });
      const count = await labels.count();
      const options = [];
      for (let i = 0; i < count; i++) {
        const text = await labels.nth(i).textContent();
        options.push(text.trim().replace(/\s+/g, ' '));
      }
      if (options.length > 0) return options;
    } catch { /* try next strategy */ }

    // Strategy 3: HAL UAE auto-displays shipping radios inside #block-shipping
    // The shipping rates appear automatically when the address fields change
    try {
      const radios = this.page.locator(
        '#block-shipping input[type="radio"][name="shipping_method"]'
      );
      await radios.first().waitFor({ state: 'visible', timeout: 5000 });
      const count = await radios.count();
      const options = [];
      for (let i = 0; i < count; i++) {
        // Get the parent row text (carrier name + price)
        const row = radios.nth(i).locator('xpath=ancestor::*[1]');
        const text = await row.textContent().catch(() => '');
        options.push(text.trim().replace(/\s+/g, ' ') || `Option ${i + 1}`);
      }
      return options;
    } catch {
      return [];
    }
  }

  // ----------------------------------------------------------
  // selectShippingMethodByLabel(labelText)
  // ----------------------------------------
  // Selects a shipping method radio button whose label text
  // CONTAINS the given `labelText` (case-insensitive).
  //
  // Example: selectShippingMethodByLabel('fixed') selects
  //          any method whose label includes the word "fixed".
  //
  // Returns true if a matching method was found and selected.
  // Returns false if no match was found.
  // ----------------------------------------------------------
  async selectShippingMethodByLabel(labelText) {
    try {
      // Wait for the method list to be visible
      await this.shippingMethodItems.first().waitFor({ state: 'visible', timeout: 10000 });
      const count = await this.shippingMethodItems.count();

      for (let i = 0; i < count; i++) {
        const item = this.shippingMethodItems.nth(i);
        const text = await item.textContent();

        if (text.toLowerCase().includes(labelText.toLowerCase())) {
          // Found a matching row — click the radio button inside it
          const radio = item.locator('input[type="radio"]');
          await radio.check();

          // Wait a moment for the totals to recalculate
          await this.page.waitForTimeout(1500);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // selectFixedShipping()
  // ----------------------
  // Tries to select a "Fixed" or "Flat Rate" shipping option.
  //
  // Checks these keywords in order:
  //   1. 'fixed'     — HAL UAE's fixed-rate shipping
  //   2. 'flat rate' — standard Magento Flat Rate method
  //   3. 'standard'  — common third-party standard shipping
  //
  // If none match, selects the FIRST available shipping radio.
  //
  // Returns true if any shipping method was selected.
  // ----------------------------------------------------------
  async selectFixedShipping() {
    const keywords = ['fixed', 'flat rate', 'standard'];

    for (const kw of keywords) {
      const found = await this.selectShippingMethodByLabel(kw);
      if (found) {
        console.log('CartPage.selectFixedShipping — selected method matching:', kw);
        return true;
      }
    }

    // Fallback: just check the first radio button available
    try {
      const firstRadio = this.shippingMethodRadios.first();
      await firstRadio.waitFor({ state: 'visible', timeout: 5000 });
      await firstRadio.check();
      await this.page.waitForTimeout(1500);
      console.log('CartPage.selectFixedShipping — selected first available shipping method');
      return true;
    } catch {
      console.log('CartPage.selectFixedShipping — no shipping options found');
      return false;
    }
  }


  // ===========================================================
  // 7. COUPON / DISCOUNT CODE
  // ===========================================================

  // ----------------------------------------------------------
  // isDiscountSectionExpanded()
  // ----------------------------
  // Returns true if the "Apply Discount Code" accordion is open.
  // ----------------------------------------------------------
  async isDiscountSectionExpanded() {
    try {
      await this.discountContent.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // expandDiscountSection()
  // ------------------------
  // Opens the "Apply Discount Code" accordion if it is closed.
  // ----------------------------------------------------------
  async expandDiscountSection() {
    const alreadyOpen = await this.isDiscountSectionExpanded();
    if (!alreadyOpen) {
      await this.discountTitle.waitFor({ state: 'visible', timeout: 10000 });
      await this.discountTitle.click();
      await this.discountContent.waitFor({ state: 'visible', timeout: 8000 });
    }
  }

  // ----------------------------------------------------------
  // applyCouponCode(code)
  // ----------------------
  // Applies a discount coupon code to the cart.
  //
  // Steps:
  //   1. Open the accordion (if collapsed)
  //   2. Type the code into the input field
  //   3. Click "Apply Discount"
  //   4. Wait for the page to reload with the discount applied
  //
  // If the code is valid: a green success message appears AND
  // a discount row is added to the order summary.
  //
  // If the code is invalid: a red error message appears.
  // ----------------------------------------------------------
  async applyCouponCode(code) {
    await this.expandDiscountSection();

    // Type the coupon code into the input field
    await this.couponInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.couponInput.fill(code);

    // Click the "Apply Discount" button
    await this.applyCouponButton.waitFor({ state: 'visible', timeout: 5000 });
    await this.applyCouponButton.click();

    // Magento reloads the cart page after applying — wait for it
    await this.waitForPageLoad();
    await this.page.waitForTimeout(2000);
  }

  // ----------------------------------------------------------
  // cancelCoupon()
  // ---------------
  // Removes a previously applied coupon code.
  //
  // The "Cancel Coupon" button only appears AFTER a valid coupon
  // has been applied. Calling this on a cart without an active
  // coupon will return false (button not found).
  // ----------------------------------------------------------
  async cancelCoupon() {
    try {
      await this.cancelCouponButton.waitFor({ state: 'visible', timeout: 5000 });
      await this.cancelCouponButton.click();
      await this.waitForPageLoad();
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // isCouponApplied()
  // ------------------
  // Returns true if a discount row is currently visible in
  // the order totals (indicating a coupon was applied).
  // ----------------------------------------------------------
  async isCouponApplied() {
    try {
      await this.discountRow.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }


  // ===========================================================
  // 8. ORDER SUMMARY TOTALS
  // ===========================================================

  // ----------------------------------------------------------
  // getSubtotal()
  // --------------
  // Returns the Subtotal text (e.g. "AED 120.00").
  // Subtotal = sum of item prices BEFORE discount/shipping/tax.
  // Returns null if the row is not found.
  // ----------------------------------------------------------
  async getSubtotal() {
    try {
      await this.subtotalPrice.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.subtotalPrice.first().textContent()).trim();
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // getDiscount()
  // --------------
  // Returns the Discount text (e.g. "-AED 12.00").
  // Only visible after applying a valid coupon code.
  // Returns null if no discount is applied.
  // ----------------------------------------------------------
  async getDiscount() {
    try {
      await this.discountPrice.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.discountPrice.first().textContent()).trim();
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // getShippingCost()
  // ------------------
  // Returns the Shipping cost text (e.g. "AED 15.00").
  // Only visible after selecting a shipping method.
  // Returns null if no shipping method has been selected.
  // ----------------------------------------------------------
  async getShippingCost() {
    try {
      await this.shippingPrice.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.shippingPrice.first().textContent()).trim();
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // getTax()
  // ---------
  // Returns the Tax amount text (e.g. "AED 5.25").
  // May not appear on all stores (depends on tax configuration).
  // Returns null if no tax row is visible.
  // ----------------------------------------------------------
  async getTax() {
    try {
      await this.taxPrice.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.taxPrice.first().textContent()).trim();
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // getGrandTotal()
  // ----------------
  // Returns the Grand Total / Order Total text (e.g. "AED 128.00").
  // This is the final amount the customer pays.
  // ----------------------------------------------------------
  async getGrandTotal() {
    try {
      await this.grandTotalPrice.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.grandTotalPrice.first().textContent()).trim();
    } catch {
      return null;
    }
  }


  // ===========================================================
  // 9. PRODUCT AND SELLER LINKS
  // ===========================================================

  // ----------------------------------------------------------
  // openProductPDP(index)
  // ----------------------
  // Clicks the product NAME LINK for the cart row at `index`
  // to navigate to that product's Product Detail Page (PDP).
  //
  // Returns the product name text that was clicked.
  // ----------------------------------------------------------
  async openProductPDP(index = 0) {
    const link = this.itemNameLinks.nth(index);
    await link.waitFor({ state: 'visible', timeout: 5000 });
    const name = (await link.textContent()).trim();
    console.log('CartPage.openProductPDP — clicking:', name);
    await link.click();
    await this.waitForPageLoad();
    return name;
  }

  // ----------------------------------------------------------
  // openSellerPage(index)
  // ----------------------
  // Clicks the "Sold by <Supplier>" link for the cart row at
  // `index` and navigates to the seller's brand page.
  //
  // Returns true if a seller link was found and clicked.
  // Returns false if no seller link exists for this cart item.
  // ----------------------------------------------------------
  async openSellerPage(index = 0) {
    try {
      const link = this.sellerLinks.nth(index);
      await link.waitFor({ state: 'visible', timeout: 5000 });
      const href  = await link.getAttribute('href');
      const label = await link.textContent();
      console.log(`CartPage.openSellerPage — seller: "${label.trim()}" → ${href}`);
      await link.click();
      await this.waitForPageLoad();
      return true;
    } catch {
      console.log('CartPage.openSellerPage — no seller link found at index', index);
      return false;
    }
  }


  // ===========================================================
  // 10. CHECKOUT
  // ===========================================================

  // ----------------------------------------------------------
  // clickProceedToCheckout()
  // -------------------------
  // Clicks the "Proceed to Checkout" button in the cart summary.
  //
  // Navigates to /checkout/ which is the multi-step checkout page
  // where the customer enters shipping address and payment info.
  // ----------------------------------------------------------
  async clickProceedToCheckout() {
    // Use attached (not visible) because HAL UAE themes the button with
    // display:none initially; JS click bypasses Playwright visibility checks.
    await this.proceedToCheckoutButton.waitFor({ state: 'attached', timeout: 10000 });
    await this.proceedToCheckoutButton.evaluate(el => el.click());
    await this.waitForPageLoad();
  }


  // ===========================================================
  // 11. EMPTY CART
  // ===========================================================

  // ----------------------------------------------------------
  // isEmptyCartMessageVisible()
  // ----------------------------
  // Returns true if the "You have no items in your shopping cart"
  // message is currently visible.
  //
  // This message appears AFTER all items have been removed.
  // ----------------------------------------------------------
  async isEmptyCartMessageVisible() {
    try {
      await this.emptyCartMessage.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }


  // ===========================================================
  // 12. FLASH MESSAGES
  // ===========================================================

  // ----------------------------------------------------------
  // getSuccessMessage()
  // --------------------
  // Returns the text of the green success message bar.
  //
  // Appears after actions like applying a coupon or updating qty.
  // Returns null if no success message is visible.
  // ----------------------------------------------------------
  async getSuccessMessage() {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 8000 });
      return (await this.successMessage.first().textContent()).trim();
    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------
  // getErrorMessage()
  // ------------------
  // Returns the text of the red error message bar.
  //
  // Appears after actions like applying an invalid coupon code.
  // Returns null if no error message is visible.
  // ----------------------------------------------------------
  async getErrorMessage() {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.errorMessage.first().textContent()).trim();
    } catch {
      return null;
    }
  }


  // ===========================================================
  // 13. MINI CART (header flyout)
  // ===========================================================

  // ----------------------------------------------------------
  // openMiniCart()
  // ---------------
  // Clicks the cart icon in the header to open the flyout panel.
  //
  // The mini cart shows a summary of items without navigating
  // to the full cart page. Use this to verify item count after
  // adding a product without leaving the current page.
  // ----------------------------------------------------------
  async openMiniCart() {
    // Wait for the page JS (Knockout/RequireJS) to finish binding the mini cart.
    // On the staging server this can take several seconds after navigation.
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    await this.miniCartIcon.waitFor({ state: 'visible', timeout: 10000 });
    await this.miniCartIcon.click();

    // Give the panel up to 15s to appear; if it doesn't, click the icon once more
    // (Magento sometimes swallows the first click while still initializing).
    try {
      await this.miniCartPanel.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      console.log('CartPage.openMiniCart — panel not visible after first click, retrying...');
      await this.miniCartIcon.click();
      await this.miniCartPanel.waitFor({ state: 'visible', timeout: 15000 });
    }
  }

  // ----------------------------------------------------------
  // getMiniCartCount()
  // -------------------
  // Returns the number shown on the cart badge in the header.
  //
  // Returns '0' if the badge is hidden (empty cart).
  // ----------------------------------------------------------
  async getMiniCartCount() {
    try {
      await this.miniCartCounter.waitFor({ state: 'visible', timeout: 5000 });
      return (await this.miniCartCounter.textContent()).trim();
    } catch {
      return '0';
    }
  }

}

// ============================================================
// Export so test files can import:
//   const { CartPage } = require('../pages/CartPage');
// ============================================================
module.exports = { CartPage };
