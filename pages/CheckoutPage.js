// ============================================================
// pages/CheckoutPage.js
//
// What is this file?
// -------------------
// Page Object for the HAL UAE Magento 2 One-Page Checkout.
//
// The checkout has two main steps that happen on the same URL
// (/checkout/#shipping → /checkout/#payment):
//
//   STEP 1 — SHIPPING
//     • Select a saved address (or create a new one)
//     • Choose a shipping method (e.g. Free Shipping, Express)
//     • Optionally apply a discount/promo code
//     • Review the order summary sidebar
//     • Click "Next" to go to the Payment step
//
//   STEP 2 — PAYMENT (Review & Payment)
//     • Choose a payment method (e.g. N-Genius card payment)
//     • Verify / update the billing address
//     • Review the order summary (subtotal, tax, grand total)
//     • Optionally apply a discount/promo code
//     • Click "Place Order"
//
// After clicking "Place Order", the browser is redirected to
// the N-Genius payment gateway (a third-party page at
// api-gateway.ngenius-payments.com). That payment flow is
// handled directly in the test file.
//
// HOW MAGENTO 2 OPC WORKS INTERNALLY:
//   The entire checkout is a Single-Page Application built with
//   KnockoutJS. Page content changes without a full browser
//   reload — that is why we use waitForLoadState('networkidle')
//   and waitForTimeout() generously to let AJAX/Knockout finish
//   before we interact with elements.
// ============================================================

const { BasePage } = require('./BasePage');

class CheckoutPage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ----------------------------------------------------------
  constructor(page) {
    super(page);

    // ============================================================
    // CHECKOUT URL
    // ============================================================

    this.CHECKOUT_URL = 'https://mcstaging2.hal-uae.com/checkout/';

    // ============================================================
    // SECTION 1: SHIPPING STEP — Address selection
    // ============================================================

    // Each saved address appears as a clickable card.
    // When selected, the card gets the "selected-item" CSS class.
    this.shippingAddressItems = page.locator('.shipping-address-item');
    this.selectedAddressItem  = page.locator('.shipping-address-item.selected-item');

    // Button that opens the "New Address" modal popup
    this.newAddressBtn = page.locator(
      'button.action-show-popup, ' +
      '.action.action-show-popup, ' +
      'button:has-text("New Address")'
    ).first();

    // ============================================================
    // SECTION 2: NEW ADDRESS FORM (inside the modal)
    // ============================================================
    // Magento renders the new-address form inside a modal overlay.
    // The inputs are standard HTML form fields.

    this.modalFirstName = page.locator('.modal-content input[name="firstname"]');
    this.modalLastName  = page.locator('.modal-content input[name="lastname"]');
    this.modalPhone     = page.locator('.modal-content input[name="telephone"]');
    this.modalStreet    = page.locator('.modal-content input[name="street[0]"]');

    // City has NO name/id attribute on this site — it is a KnockoutJS
    // <select> dropdown (not a text input). Its wrapper <div> carries
    // name="shippingAddress.city", which is the only reliable hook.
    this.modalCity       = page.locator('.modal-content input[name="city"]'); // fallback for text-input themes
    this.modalCitySelect = page.locator('.modal-content div[name="shippingAddress.city"] select');

    this.modalCountry   = page.locator('.modal-content select[name="country_id"]');
    this.modalRegion    = page.locator('.modal-content select[name="region_id"]');
    this.modalRegionTxt = page.locator('.modal-content input[name="region"]');

    // NOTE: on this UAE site, Magento's "postcode" field is relabeled
    // "Makani Number" (a 10-digit UAE address code) — same input, new label.
    this.modalPostcode  = page.locator('.modal-content input[name="postcode"]');

    // "Ship Here" / save button inside the currently-open new-address modal.
    // Scoped to .modal-popup._show so it never picks a "Ship Here" button
    // on the background address cards (those share the same text but live
    // outside the modal and would cause the click to intercept the modal overlay).
    this.saveAddressBtn = page.locator('.modal-popup._show').locator(
      'button.action.primary, button.action-save-address, button:has-text("Ship Here")'
    ).first();

    // ============================================================
    // SECTION 3: SHIPPING METHOD TABLE
    // ============================================================
    // Magento shows available shipping methods in a table.
    // Each row has a radio button, carrier name, method name, price.

    this.shippingMethodRadios = page.locator(
      '.table-checkout-shipping-method tbody input[type="radio"], ' +
      '#co-shipping-method-form input[type="radio"]'
    );

    this.shippingMethodRows = page.locator(
      '.table-checkout-shipping-method tbody tr'
    );

    // ============================================================
    // SECTION 4: DISCOUNT / PROMO CODE (order summary sidebar)
    // ============================================================
    // The discount section lives inside the right-hand order
    // summary sidebar. On some Magento themes it starts collapsed;
    // you click the heading to expand the input field.

    // On this site the section heading reads "Apply Promo Code" and the
    // Apply button's visible text is just "Apply" (not "Apply Discount") —
    // selectors below are scoped to the real markup: <div class="discount-code">
    // > <form id="discount-form"> > input#discount-code + button.action-apply.
    this.discountToggle = page.locator(
      '#block-discount-heading, ' +
      '.discount-code .title, ' +
      'span:has-text("Apply Promo Code"), ' +
      'button:has-text("Apply Promo Code")'
    ).first();

    this.promoCodeInput = page.locator(
      '#discount-code, ' +
      'input[name="discount_code"]'
    ).first();

    this.applyPromoBtn = page.locator(
      '#discount-form button.action-apply, ' +
      '.discount-code button.action-apply'
    ).first();

    this.cancelPromoBtn = page.locator(
      '#discount-form button.action-cancel, ' +
      '.discount-code button.action-cancel'
    ).first();

    // ============================================================
    // SECTION 5: ORDER SUMMARY SIDEBAR (totals)
    // ============================================================
    // The sidebar shows item list, subtotal, shipping cost, tax,
    // discount (if applied), and the grand total.

    this.summaryItems = page.locator(
      '.opc-block-summary .product-item, ' +
      '.opc-block-summary .minicart-items .product-item'
    );

    this.summarySubtotal = page.locator(
      '.opc-block-summary .totals.sub .price'
    ).first();

    this.summaryShipping = page.locator(
      '.opc-block-summary .totals.shipping .price'
    ).first();

    this.summaryTax = page.locator(
      '.opc-block-summary .totals-tax .price, ' +
      '.opc-block-summary [class*="tax"] .price'
    ).first();

    this.summaryGrandTotal = page.locator(
      '.opc-block-summary .grand.totals .price'
    ).first();

    this.summaryDiscount = page.locator(
      '.opc-block-summary .discount .price, ' +
      '.opc-block-summary [class*="discount"] .price'
    ).first();

    // ============================================================
    // SECTION 6: STEP NAVIGATION BUTTON
    // ============================================================
    // "Next" button at the bottom of the shipping step takes the
    // customer to the payment step.

    this.nextBtn = page.locator(
      'button.action.continue.primary, ' +
      'button.button.action.continue, ' +
      '.actions-toolbar > .primary button.action.primary'
    ).first();

    // ============================================================
    // SECTION 7: PAYMENT STEP — Payment method selection
    // ============================================================
    // Each payment method has a radio button and a label.
    // Selecting one may reveal an inline form (e.g. billing address).

    this.paymentMethodRadios = page.locator(
      '.payment-method .payment-method-title input[type="radio"]'
    );

    // ============================================================
    // SECTION 8: BILLING ADDRESS (payment step)
    // ============================================================
    // Magento shows a "same as shipping" checkbox and the address
    // details below the selected payment method.

    this.billingSameCheckbox = page.locator(
      '[name="billing-address-same-as-shipping"], ' +
      'input[type="checkbox"][id*="billing-address-same"]'
    ).first();

    this.billingAddressDetails = page.locator(
      '.billing-address-details'
    ).first();

    // "Update" button inside the billing address edit form
    this.billingUpdateBtn = page.locator(
      '.payment-method._active button.action.action-update, ' +
      '.billing-address-form button.action.action-update, ' +
      'button:has-text("Update")'
    ).first();

    // ============================================================
    // SECTION 9: PLACE ORDER BUTTON
    // ============================================================

    this.placeOrderBtn = page.locator(
      'button.action.primary.checkout, ' +
      '#review-buttons-container button.action.primary, ' +
      'button[title="Place Order"]'
    ).first();

    // ============================================================
    // SECTION 10: ORDER SUCCESS PAGE
    // ============================================================

    this.successHeading = page.locator(
      '.page-title .base, ' +
      '.checkout-success .page-title'
    ).first();

    // The order number link on the success page.
    // Magento renders it as: "Your order # is: <strong>000123</strong>"
    this.orderNumberEl = page.locator(
      '.checkout-success .order-number strong, ' +
      '.checkout-success a[href*="sales/order/view"], ' +
      '.checkout-success p strong'
    ).first();
  }


  // ----------------------------------------------------------
  // waitForShippingStep()
  // ----------------------
  // Waits until the Shipping Address step is fully rendered.
  // Call this right after navigating to /checkout/.
  //
  // WHY networkidle?
  //   Magento 2 OPC loads customer data (saved addresses,
  //   shipping methods) via AJAX after the page opens.
  //   networkidle = no AJAX requests in-flight for 500ms.
  // ----------------------------------------------------------
  async waitForShippingStep() {
    console.log('CheckoutPage.waitForShippingStep — waiting for address section...');
    await this.page.waitForSelector(
      '#checkout-step-shipping, .checkout-shipping-address',
      { state: 'visible', timeout: 60000 }
    );
    await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    console.log('CheckoutPage.waitForShippingStep — step loaded');
  }


  // ----------------------------------------------------------
  // waitForPaymentStep()
  // ---------------------
  // Waits until the Payment step UI is visible.
  // Call this after clicking the "Next" button.
  // ----------------------------------------------------------
  async waitForPaymentStep() {
    console.log('CheckoutPage.waitForPaymentStep — waiting for payment section...');
    await this.page.waitForSelector(
      '#checkout-step-payment, .checkout-payment-method',
      { state: 'visible', timeout: 60000 }
    );
    await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    console.log('CheckoutPage.waitForPaymentStep — step loaded');
  }


  // ----------------------------------------------------------
  // getShippingAddressCount()
  // --------------------------
  // Returns how many saved address cards are shown on the
  // shipping step. Returns 0 if the customer has no saved
  // addresses (new address form will be shown directly).
  // ----------------------------------------------------------
  async getShippingAddressCount() {
    return await this.shippingAddressItems.count().catch(() => 0);
  }


  // ----------------------------------------------------------
  // selectShippingAddress(index)
  // -----------------------------
  // Selects the saved shipping address at the given position
  // (0 = first). If it is already selected, skips the click.
  // ----------------------------------------------------------
  async selectShippingAddress(index = 0) {
    const item = this.shippingAddressItems.nth(index);
    await item.waitFor({ state: 'visible', timeout: 8000 });

    const cls = await item.getAttribute('class').catch(() => '');
    if (cls.includes('selected-item')) {
      console.log(`CheckoutPage.selectShippingAddress — address ${index} already selected`);
      return;
    }

    // Some themes wrap a radio inside the card; click that.
    const radio = item.locator('input[type="radio"]');
    if (await radio.count() > 0) {
      await radio.click();
    } else {
      await item.click();
    }
    await this.page.waitForTimeout(1000);
    console.log(`CheckoutPage.selectShippingAddress — selected address ${index}`);
  }


  // ----------------------------------------------------------
  // openNewAddressModal()
  // ----------------------
  // Clicks the "New Address" button to open the address modal.
  // ----------------------------------------------------------
  async openNewAddressModal() {
    await this.newAddressBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.newAddressBtn.click();
    // Wait until the first form field is visible — this ensures KnockoutJS has
    // fully rendered the modal content before we start filling fields.
    await this.modalFirstName.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(500);
    console.log('CheckoutPage.openNewAddressModal — modal opened');
  }


  // ----------------------------------------------------------
  // fillNewAddressForm(data)
  // -------------------------
  // Fills in the new address form inside the modal.
  //
  // data = {
  //   firstName : 'Test',
  //   lastName  : 'User',
  //   phone     : '0501234567',
  //   street    : '123 Test Street',
  //   city      : 'Dubai',
  //   country   : 'AE',        ← ISO 2-letter country code
  //   region    : 'Dubai',     ← state/emirate name or code
  //   postcode  : '00000',
  // }
  // ----------------------------------------------------------
  async fillNewAddressForm(data) {
    if (data.firstName) await this._fillField(this.modalFirstName, data.firstName);
    if (data.lastName)  await this._fillField(this.modalLastName,  data.lastName);
    if (data.phone)     await this._fillField(this.modalPhone,     data.phone);
    if (data.street)    await this._fillField(this.modalStreet,    data.street);

    if (data.city) {
      const hasCitySelect = await this.modalCitySelect.count().catch(() => 0);
      if (hasCitySelect > 0) {
        // City is a dropdown here — try the requested city by label, and if
        // it isn't one of the offered options, just pick the first real
        // option (index 0 is the "Please select a city" placeholder).
        await this.modalCitySelect
          .selectOption({ label: data.city })
          .catch(() => this.modalCitySelect.selectOption({ index: 1 }).catch(() => {}));
        console.log('CheckoutPage.fillNewAddressForm — city selected (dropdown):', data.city);
      } else {
        await this._fillField(this.modalCity, data.city);
      }
    }

    if (data.country) {
      await this.modalCountry.selectOption(data.country);
      await this.page.waitForTimeout(1500); // region dropdown reloads after country change
      console.log('CheckoutPage.fillNewAddressForm — country set to', data.country);
    }

    if (data.region) {
      const hasSelect = await this.modalRegion.count();
      if (hasSelect > 0) {
        // Try matching by visible text, fall back to option value
        await this.modalRegion
          .selectOption({ label: data.region })
          .catch(() => this.modalRegion.selectOption(data.region).catch(() => {}));
      } else {
        await this._fillField(this.modalRegionTxt, data.region);
      }
    }

    if (data.postcode) await this._fillField(this.modalPostcode, data.postcode);

    console.log('CheckoutPage.fillNewAddressForm — form filled');
  }


  // ----------------------------------------------------------
  // saveNewAddress()
  // -----------------
  // Clicks "Ship Here" (or "Save Address") to confirm the new
  // address and close the modal.
  // ----------------------------------------------------------
  async saveNewAddress() {
    await this.saveAddressBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.saveAddressBtn.scrollIntoViewIfNeeded().catch(() => {});
    await this.page.waitForTimeout(300); // let scroll settle
    await this.saveAddressBtn.click({ timeout: 15000 }).catch(async (e) => {
      console.log('CheckoutPage.saveNewAddress — normal click blocked, retrying with force:', e.message.split('\n')[0]);
      await this.saveAddressBtn.click({ force: true });
    });
    // Wait for the modal overlay to fully disappear before any further clicks
    await this.page.locator('.modals-overlay').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(800);

    // A Magento modal that is still open has class "_show" on its aside element.
    // Wait up to 10 s for it to disappear (normal close animation).
    // If it persists, click its close button (×) to force-dismiss it.
    const openModal = this.page.locator('.modal-popup._show').first();
    const stillOpen = await openModal.isVisible().catch(() => false);
    if (stillOpen) {
      const errText = await this.page.locator('.modal-popup._show .field-error, .modal-popup._show .mage-error').first().textContent().catch(() => '');
      console.log('CheckoutPage.saveNewAddress — WARNING: modal still open. Validation error:', errText.trim() || '(none found)');
      // Try close button first, fall back to Escape key
      const closeBtn = this.page.locator('.modal-popup._show .action-close').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
      } else {
        await this.page.keyboard.press('Escape');
      }
      await openModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    }

    console.log('CheckoutPage.saveNewAddress — address saved and modal closed');
  }


  // ----------------------------------------------------------
  // getShippingMethodCount()
  // -------------------------
  // Returns the number of shipping methods available for the
  // selected address.  Returns 0 if the table hasn't loaded yet.
  // ----------------------------------------------------------
  async getShippingMethodCount() {
    try {
      // Wait up to 15 s for the shipping method table to appear
      await this.shippingMethodRadios.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch { /* table may not have loaded */ }
    return await this.shippingMethodRadios.count().catch(() => 0);
  }


  // ----------------------------------------------------------
  // selectShippingMethod(index)
  // ----------------------------
  // Selects the shipping method at the given row (0 = first).
  // Returns the method description text so the test can log it.
  // ----------------------------------------------------------
  async selectShippingMethod(index = 0) {
    // After saving a new shipping address Magento shows a loading overlay
    // while recalculating shipping rates — wait for it to clear first.
    await this.page.locator('.modals-overlay').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(300);

    const radio = this.shippingMethodRadios.nth(index);
    await radio.waitFor({ state: 'visible', timeout: 10000 });
    // Use dispatchEvent to bypass any lingering overlay covering the radio
    await radio.dispatchEvent('click');
    await this.page.waitForTimeout(800);

    // Log the row text (carrier + method + price) for debugging
    const row  = this.shippingMethodRows.nth(index);
    const text = await row.textContent().catch(() => '');
    const desc = text.trim().replace(/\s+/g, ' ').substring(0, 100);
    console.log(`CheckoutPage.selectShippingMethod — selected [${index}]: ${desc}`);
    return desc;
  }


  // ----------------------------------------------------------
  // openDiscountSection()
  // ----------------------
  // Expands the discount code input if it is currently collapsed.
  // Some Magento themes hide it behind a toggle heading.
  // ----------------------------------------------------------
  async openDiscountSection() {
    // If the input is already visible, nothing to do
    const visible = await this.promoCodeInput.isVisible().catch(() => false);
    if (visible) {
      console.log('CheckoutPage.openDiscountSection — already open');
      return;
    }

    const hasToggle = await this.discountToggle.count().catch(() => 0);
    console.log(`CheckoutPage.openDiscountSection — toggle elements found: ${hasToggle}`);
    if (hasToggle > 0) {
      await this.discountToggle.click().catch(() => {});
      // Wait up to 3 s for the input to become visible after the toggle animation
      await this.promoCodeInput.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    }
    console.log('CheckoutPage.openDiscountSection — section expanded');
  }


  // ----------------------------------------------------------
  // applyPromoCode(code)
  // ---------------------
  // Expands the discount section, types the promo code, and
  // clicks "Apply Discount".  Waits for the AJAX update.
  //
  // Returns true if a success indicator (discount row or success
  // message) appeared after applying.
  // ----------------------------------------------------------
  async applyPromoCode(code) {
    await this.openDiscountSection();

    // If the discount input is still not visible (section may not exist on this step),
    // bail out gracefully — caller treats false as "promo not applied"
    const inputVisible = await this.promoCodeInput.isVisible().catch(() => false);
    if (!inputVisible) {
      console.log('CheckoutPage.applyPromoCode — discount input not visible, skipping');
      return false;
    }

    await this.promoCodeInput.click({ clickCount: 3 });
    await this.promoCodeInput.fill(code);

    const applyVisible = await this.applyPromoBtn.isVisible().catch(() => false);
    if (!applyVisible) {
      console.log('CheckoutPage.applyPromoCode — apply button not visible, skipping');
      return false;
    }

    // Clear any leftover modal overlay first, then fall back to a
    // dispatched click if a leftover overlay still blocks a normal click
    // (mirrors the retry pattern used in saveNewAddress()).
    await this.page.locator('.modals-overlay').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.applyPromoBtn.click({ timeout: 8000 }).catch(async () => {
      console.log('CheckoutPage.applyPromoCode — normal click blocked, using dispatchEvent');
      await this.applyPromoBtn.dispatchEvent('click');
    });

    await this.page.waitForTimeout(3000); // wait for AJAX recalculation

    // Check for a success message or the discount price appearing
    const applied = await this.page
      .locator('.message-success, .opc-block-summary .discount')
      .first()
      .isVisible()
      .catch(() => false);

    console.log(`CheckoutPage.applyPromoCode — "${code}" → applied = ${applied}`);
    return applied;
  }


  // ----------------------------------------------------------
  // getOrderSummary()
  // ------------------
  // Reads all totals from the order summary sidebar.
  // Returns an object with subtotal, shipping, tax, discount,
  // total, and the number of line items.
  //
  // NOTE: Some totals may be 'N/A' if not yet calculated
  // (e.g. shipping cost appears only after method is selected).
  // ----------------------------------------------------------
  async getOrderSummary() {
    const read = async (loc) => {
      const text = await loc.textContent().catch(() => null);
      return text ? text.trim() : 'N/A';
    };

    const summary = {
      itemCount : await this.summaryItems.count().catch(() => 0),
      subtotal  : await read(this.summarySubtotal),
      shipping  : await read(this.summaryShipping),
      tax       : await read(this.summaryTax),
      discount  : await read(this.summaryDiscount),
      total     : await read(this.summaryGrandTotal),
    };

    console.log('CheckoutPage.getOrderSummary →', summary);
    return summary;
  }


  // ----------------------------------------------------------
  // clickNext()
  // ------------
  // Clicks the "Next" button at the bottom of the shipping step
  // to advance to the payment step.
  // ----------------------------------------------------------
  async clickNext() {
    // Wait for any open Magento modal to fully close before clicking Next
    await this.page.locator('.modal-popup._show').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.nextBtn.waitFor({ state: 'visible', timeout: 15000 });
    // Use dispatchEvent to bypass any overlay still intercepting pointer events
    try {
      await this.nextBtn.click({ timeout: 5000 });
    } catch {
      console.log('CheckoutPage.clickNext — regular click blocked, using dispatchEvent');
      await this.nextBtn.dispatchEvent('click');
    }
    await this.page.waitForTimeout(2000);
    console.log('CheckoutPage.clickNext — navigated to payment step');
  }


  // ----------------------------------------------------------
  // getPaymentMethods()
  // --------------------
  // Returns an array of { value, label } objects for every
  // visible payment method radio button.
  // ----------------------------------------------------------
  async getPaymentMethods() {
    // Payment methods load via AJAX — wait for at least one
    await this.paymentMethodRadios
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => {});

    const count = await this.paymentMethodRadios.count().catch(() => 0);
    const methods = [];

    for (let i = 0; i < count; i++) {
      const value = await this.paymentMethodRadios.nth(i).getAttribute('value').catch(() => '');
      const label = await this.page
        .locator('.payment-method-title label')
        .nth(i)
        .textContent()
        .catch(() => '');
      methods.push({ value, label: label.trim() });
    }

    console.log('CheckoutPage.getPaymentMethods →', methods);
    return methods;
  }


  // ----------------------------------------------------------
  // selectPaymentMethod(searchTerm)
  // --------------------------------
  // Selects the payment method whose value or label contains
  // searchTerm (case-insensitive).  Falls back to the first
  // method if no match is found.
  //
  // Returns the selected method object { value, label }.
  // ----------------------------------------------------------
  async selectPaymentMethod(searchTerm) {
    const methods = await this.getPaymentMethods();
    const term    = searchTerm.toLowerCase();

    let idx = methods.findIndex(
      m => m.value.toLowerCase().includes(term) || m.label.toLowerCase().includes(term)
    );

    if (idx === -1) {
      console.log(`CheckoutPage.selectPaymentMethod — "${searchTerm}" not found, using first`);
      idx = 0;
    }

    const radio = this.paymentMethodRadios.nth(idx);
    // Magento hides the radio when there is only one payment method —
    // use dispatchEvent to select it without a visibility requirement.
    try {
      await radio.click({ timeout: 5000 });
    } catch {
      console.log('CheckoutPage.selectPaymentMethod — radio hidden, using dispatchEvent');
      await radio.dispatchEvent('click');
    }
    await this.page.waitForTimeout(1500);

    console.log(`CheckoutPage.selectPaymentMethod — selected [${idx}]: ${methods[idx]?.label}`);
    return methods[idx];
  }


  // ----------------------------------------------------------
  // isBillingSameAsShipping()
  // --------------------------
  // Returns true if the "Billing same as shipping" checkbox
  // is currently checked, false if unchecked, null if not found.
  // ----------------------------------------------------------
  async isBillingSameAsShipping() {
    try {
      return await this.billingSameCheckbox.isChecked();
    } catch {
      return null;
    }
  }


  // ----------------------------------------------------------
  // getBillingAddressText()
  // ------------------------
  // Returns the full text of the currently shown billing address.
  // ----------------------------------------------------------
  async getBillingAddressText() {
    const text = await this.billingAddressDetails.textContent().catch(() => '');
    return text.trim().replace(/\s+/g, ' ');
  }


  // ----------------------------------------------------------
  // openBillingAddressForm()
  // -------------------------
  // Unchecks "same as shipping" (if checked) and opens the
  // billing address edit form so you can change it.
  // ----------------------------------------------------------
  async openBillingAddressForm() {
    const sameChecked = await this.isBillingSameAsShipping();
    if (sameChecked) {
      await this.billingSameCheckbox.uncheck();
      await this.page.waitForTimeout(1500);
      console.log('CheckoutPage.openBillingAddressForm — unchecked same-as-shipping');
    }

    // Click the edit button if present
    const editBtn = this.page.locator(
      '.payment-method._active .billing-address-details a.action, ' +
      '.payment-method._active button.action-edit-address'
    ).first();

    if (await editBtn.count() > 0) {
      await editBtn.click().catch(() => {});
      await this.page.waitForTimeout(1000);
    }

    console.log('CheckoutPage.openBillingAddressForm — billing form visible');
  }


  // ----------------------------------------------------------
  // fillBillingAddressForm(data)
  // -----------------------------
  // Fills the billing address form that appears inside the
  // active payment method section.
  // Accepts the same data object as fillNewAddressForm().
  // Clicks "Update" to save the changes.
  // ----------------------------------------------------------
  async fillBillingAddressForm(data) {
    // The billing-address-form wrapper — try fieldset first, fall back to the
    // wrapper itself (fieldset is not always present in custom themes).
    const formWrapper = this.page.locator(
      '.payment-method._active .billing-address-form, .billing-address-form'
    ).first();

    const wrapperCount = await formWrapper.count().catch(() => 0);
    if (wrapperCount === 0) {
      console.log('CheckoutPage.fillBillingAddressForm — billing form not found, skipping');
      return;
    }

    // If Magento shows a "Select Billing Address" dropdown (saved address picker),
    // select "New Address" so the editable fields appear.
    const addrDropdown = formWrapper.locator(
      'select[name*="billing_address_id"], select.select-billing-address'
    ).first();
    if (await addrDropdown.count() > 0) {
      const opts = await addrDropdown.locator('option').all();
      for (const opt of opts) {
        const val = await opt.getAttribute('value').catch(() => '');
        const txt = (await opt.textContent().catch(() => '')).toLowerCase();
        if (val === '' || val === '0' || txt.includes('new')) {
          await addrDropdown.selectOption(val).catch(() => {});
          break;
        }
      }
      await this.page.waitForTimeout(1000);
    }

    // Resolve final scope: prefer fieldset, fall back to wrapper
    const fieldset = formWrapper.locator('fieldset').first();
    const scope = (await fieldset.count().catch(() => 0)) > 0 ? fieldset : formWrapper;

    // fill() uses name*= (contains) so it matches Magento's billing field
    // naming convention: billingAddressngenius[firstname], etc.
    // count() check prevents the 5 s-per-operation wait when a field is absent.
    const fill = async (nameFragment, value) => {
      const el = scope.locator(
        `input[name*="${nameFragment}"], select[name*="${nameFragment}"]`
      ).first();
      if ((await el.count().catch(() => 0)) === 0) return;
      const tag = await el.evaluate(e => e.tagName, { timeout: 5000 }).catch(() => 'INPUT');
      if (tag === 'SELECT') {
        await el.selectOption(value, { timeout: 5000 }).catch(() => {});
      } else {
        await el.click({ clickCount: 3, timeout: 5000 }).catch(() => {});
        await el.fill(String(value), { timeout: 5000 }).catch(() => {});
      }
    };

    if (data.firstName) await fill('firstname',  data.firstName);
    if (data.lastName)  await fill('lastname',   data.lastName);
    if (data.phone)     await fill('telephone',  data.phone);
    if (data.street)    await fill('street',     data.street);

    if (data.city) {
      // City can be a custom dropdown (wrapper ends in ".city") or a plain input.
      const citySelect = scope.locator(
        'div[name$=".city"] select, select[name*="city"]'
      ).first();
      if ((await citySelect.count().catch(() => 0)) > 0) {
        await citySelect
          .selectOption({ label: data.city })
          .catch(() => citySelect.selectOption({ index: 1 }).catch(() => {}));
      } else {
        await fill('city', data.city);
      }
    }

    if (data.country) {
      await fill('country_id', data.country);
      // Wait for the region dropdown to reload after the country changes
      await this.page.waitForTimeout(2000);
    }

    if (data.region) {
      const regSel = scope.locator('select[name*="region_id"]').first();
      if ((await regSel.count().catch(() => 0)) > 0) {
        await regSel
          .selectOption({ label: data.region })
          .catch(() => regSel.selectOption(data.region).catch(() => {}));
      } else {
        await fill('region', data.region);
      }
    }

    if (data.postcode) await fill('postcode', data.postcode);

    // Give Knockout a moment to re-evaluate bindings after all fields are filled
    await this.page.waitForTimeout(1000);

    // Click "Update" to save
    const updateBtn = this.page.locator(
      '.payment-method._active button.action.action-update, button.action.action-update'
    ).first();

    if ((await updateBtn.count().catch(() => 0)) > 0) {
      await updateBtn.scrollIntoViewIfNeeded().catch(() => {});
      await this.page.waitForTimeout(500);
      await updateBtn.click({ timeout: 15000 }).catch(async (e) => {
        console.log('CheckoutPage.fillBillingAddressForm — update blocked, forcing:', e.message.split('\n')[0]);
        await updateBtn.click({ force: true });
      });
      await this.page.waitForTimeout(2000);
    } else {
      console.log('CheckoutPage.fillBillingAddressForm — no Update button found, form may auto-save');
    }

    console.log('CheckoutPage.fillBillingAddressForm — billing address saved');
  }


  // ----------------------------------------------------------
  // clickPlaceOrder()
  // ------------------
  // Clicks the final "Place Order" button.
  // After this call, wait for the redirect to the payment
  // gateway (N-Genius) or the success page.
  // ----------------------------------------------------------
  async clickPlaceOrder() {
    await this.placeOrderBtn.waitFor({ state: 'visible', timeout: 20000 });
    await this.placeOrderBtn.click();
    console.log('CheckoutPage.clickPlaceOrder — Place Order clicked, waiting for redirect...');
  }


  // ----------------------------------------------------------
  // getSuccessOrderNumber()
  // ------------------------
  // Reads the order number from the checkout success page.
  // Magento renders it as: "Your order # is: <strong>000123</strong>"
  //
  // Returns the order number string, or null if not found.
  // ----------------------------------------------------------
  async getSuccessOrderNumber() {
    // Try the structured locator first
    const text = await this.orderNumberEl.textContent().catch(() => null);
    if (text && text.trim()) {
      return text.trim();
    }

    // Fallback: scan the full page body for "order # NNNNNN"
    const bodyText = await this.page.textContent('body').catch(() => '');
    const match = bodyText.match(/[Oo]rder\s*#?\s*:?\s*(\d{5,})/);
    return match ? match[1] : null;
  }


  // ----------------------------------------------------------
  // _fillField(locator, value)    [private helper]
  // --------------------------------------------------
  // Selects all text in an input and replaces it with value.
  // Using triple-click select-all is more reliable than just
  // calling .fill() on inputs that may have pre-filled content.
  // ----------------------------------------------------------
  async _fillField(locator, value) {
    try {
      // Use 'attached' (not 'visible') so hidden/off-screen fields still fill.
      // scrollIntoViewIfNeeded() makes it reachable before clicking.
      await locator.waitFor({ state: 'attached', timeout: 10000 });
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.fill(String(value));
    } catch (e) {
      console.log('CheckoutPage._fillField — warning:', e.message.split('\n')[0]);
    }
  }
}

// ============================================================
// Export so test files can import:
//   const { CheckoutPage } = require('../pages/CheckoutPage');
// ============================================================
module.exports = { CheckoutPage };
