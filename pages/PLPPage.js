// ============================================================
// pages/PLPPage.js
//
// What is this file?
// -------------------
// This is the Page Object for the HAL UAE "All Products" PLP
// (Product Listing Page) — the grid page that shows ALL products
// with filters, a sort dropdown, and pagination.
//
// URL: https://mcstaging2.hal-uae.com/all-products.html
//
// This class EXTENDS BasePage, so it inherits:
//   navigate(), waitForPageLoad(), getPageTitle(), takeScreenshot()
//
// Contents:
//   1. LOCATORS   — how to find elements on the PLP and PDP
//   2. NAVIGATION — goto(), navigateFromHome()
//   3. GRID       — getProductCount()
//   4. PAGINATION — goToPageNumber(), goToNextPage(), goToFirstPage()
//   5. FILTER     — applyFirstAvailableFilter()
//   6. SORT       — changeSortBy(), getSortByValue()
//   7. CART       — addProductAtIndex(), getCartCounterText()
//   8. PDP        — openProductAtIndex(), addToCartFromPDP()
// ============================================================

const { BasePage } = require('./BasePage');

class PLPPage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ------------------
  // Called when you do:  const plp = new PLPPage(page)
  //
  // super(page) runs BasePage's constructor which stores
  // 'page' as 'this.page' for use in all methods below.
  // ----------------------------------------------------------
  constructor(page) {
    super(page);

    // --------------------------------------------------------
    // PLP URL
    // --------
    // The "All Products" category page URL on HAL UAE.
    // Adjust this path if it differs on your staging server.
    // --------------------------------------------------------
    this.PLP_URL = '/all-products.html';

    // --------------------------------------------------------
    // PRODUCT GRID LOCATORS
    // ----------------------
    // Each product on the PLP is a .product-item card containing:
    //   - a.product-item-link  → click to open the PDP
    //   - button.tocart        → "Add to Cart" (or redirects for configurable)
    // --------------------------------------------------------

    // All product cards on the current PLP page
    this.productItems = page.locator('.product-item');

    // Clickable product name links — one per card
    this.productNameLinks = page.locator('a.product-item-link');

    // "Add to Cart" buttons across the whole grid
    this.addToCartButtons = page.locator('button.tocart');

    // --------------------------------------------------------
    // PAGINATION LOCATORS
    // --------------------
    // When total products exceed one page, Magento renders:
    //   « 1  2  3  4  5 … »
    // URL changes to ?p=2, ?p=3 etc. for each page.
    // --------------------------------------------------------

    // The entire pagination wrapper — used by hasPagination()
    this.paginationBar = page.locator('.pages');

    // "›" Next page arrow link
    this.nextPageButton = page.locator('a.action.next');

    // Numbered page links — excludes the current page (shown as <strong>)
    this.pageNumberLinks = page.locator('.pages-items .item a.page');

    // --------------------------------------------------------
    // FILTER SIDEBAR LOCATORS
    // ------------------------
    // The left column shows "Layered Navigation" filters.
    // Each filter section has:
    //   - A tab (title) — click to expand/collapse
    //   - Option links inside the expanded panel
    //
    // Uses getByRole('tab') because some filter tabs have implicit
    // ARIA roles that CSS [role="tab"] cannot match.
    // --------------------------------------------------------

    // Clickable filter option links inside expanded panels
    this.allFilterLinks = page.locator('.filter-options-content .item a');

    // First filter section tab (expand/collapse)
    this.firstFilterTitle = page.locator('main').getByRole('tab').first();

    // --------------------------------------------------------
    // SORT LOCATOR
    // -------------
    // The "Sort By" <select> dropdown above the product grid.
    // Magento 2 always gives this the id="sorter".
    // Common values: 'position' | 'name' | 'price'
    // --------------------------------------------------------
    this.sortBySelect = page.locator('select#sorter');

    // --------------------------------------------------------
    // CART / TOAST LOCATORS
    // ----------------------
    // After clicking "Add to Cart" on a simple product:
    //   1. A green success toast appears
    //   2. The cart counter badge in the header updates
    //
    // Configurable products redirect to the PDP instead of toast.
    // --------------------------------------------------------

    // Green "Added to cart" toast notification
    this.successMessage = page.locator('.message-success, .message.success');

    // Cart counter badge — hidden when empty, shows "1", "2" etc.
    this.cartCounter = page.locator(
      '.counter.qty .counter-number, .minicart-wrapper .counter-number'
    );

    // --------------------------------------------------------
    // PDP (PRODUCT DETAIL PAGE) LOCATORS
    // ------------------------------------
    // Used after clicking a product name to navigate to the PDP.
    //
    // PDP = the page showing ONE product with full details,
    // large images, description, price, and the main cart button.
    // --------------------------------------------------------

    // Product name heading: <h1 class="page-title"><span class="base">…</span></h1>
    this.pdpProductTitle = page.locator('h1.page-title span.base, h1.page-title');

    // "Add to Cart" button on the PDP
    // Simple products: submits immediately.
    // Configurable products: need swatch options selected first.
    this.pdpAddToCartButton = page.locator(
      'button#product-addtocart-button, button.action.tocart.primary'
    );

    // Swatch attribute groups on a configurable PDP (colour, size, etc.)
    // Each group holds multiple .swatch-option buttons
    this.pdpSwatchGroups = page.locator('.swatch-opt .swatch-attribute');

    // --------------------------------------------------------
    // NAV LINK LOCATOR (for navigateFromHome())
    // ------------------------------------------
    // The top navigation bar contains category links.
    // The "All Products" link has an href containing "all-products".
    // --------------------------------------------------------
    this.allProductsNavLink = page.locator(
      '.nav-sections a[href*="all-products"], nav a[href*="all-products"]'
    ).first();
  }


  // ===========================================================
  // 2. NAVIGATION METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // goto()
  // -------
  // Opens the All Products PLP directly by URL.
  // This is the fastest and most reliable way to reach the PLP.
  // ----------------------------------------------------------
  async goto() {
    await this.navigate(this.PLP_URL);
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // navigateFromHome()
  // -------------------
  // Simulates a real user journey: starts on the homepage and
  // clicks the "All Products" link in the top navigation bar.
  //
  // Steps:
  //   1. Open the homepage
  //   2. Find the "All Products" nav link
  //   3. Click it (using evaluate to bypass viewport checks)
  //   4. Wait for the PLP to load
  //
  // Why evaluate(el => el.click()) instead of locator.click()?
  //   Some nav links on this theme are positioned outside
  //   Playwright's visible viewport rect, causing locator.click()
  //   to throw an error. Running el.click() directly inside the
  //   browser bypasses Playwright's position-checking entirely.
  // ----------------------------------------------------------
  async navigateFromHome() {
    // Step 1: Go to the homepage
    await this.navigate('/');
    await this.waitForPageLoad();

    // Step 2: Wait for the "All Products" nav link to exist in the DOM
    await this.allProductsNavLink.waitFor({ state: 'attached' });

    // Step 3: Click the link via browser-side JavaScript
    await this.allProductsNavLink.evaluate(el => el.click());

    // Step 4: Wait until the URL changes to the PLP
    await this.page.waitForURL(/all-products/, { timeout: 15000 });
    await this.waitForPageLoad();
  }


  // ===========================================================
  // 3. PRODUCT GRID METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // getProductCount()
  // ------------------
  // Returns the number of product cards on the CURRENT page.
  //
  // Returns 0 if no products are found — does NOT throw.
  // ----------------------------------------------------------
  async getProductCount() {
    return await this.productItems.count();
  }


  // ===========================================================
  // 4. PAGINATION METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // hasPagination()
  // ----------------
  // Returns true if the pagination bar (.pages) is visible.
  // Pagination only appears when results span more than one page.
  // ----------------------------------------------------------
  async hasPagination() {
    return await this.paginationBar.isVisible();
  }

  // ----------------------------------------------------------
  // goToPageNumber(pageNumber)
  // ---------------------------
  // Navigates directly to a specific page number via URL.
  //
  // Example: goToPageNumber(3) loads all-products.html?p=3
  // This is more reliable than clicking a pager link because
  // the HAL UAE custom theme does not use aria-label on its
  // pagination anchors, so CSS attribute selectors fail.
  // ----------------------------------------------------------
  async goToPageNumber(pageNumber) {
    await this.navigate(this.PLP_URL + '?p=' + pageNumber);
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // goToNextPage()
  // ---------------
  // Clicks the "›" (Next) arrow in the pagination bar.
  // The URL gains &p=<N+1> after this click.
  // ----------------------------------------------------------
  async goToNextPage() {
    await this.nextPageButton.waitFor({ state: 'visible' });
    await this.nextPageButton.click();
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // goToFirstPage()
  // ----------------
  // Navigates back to page 1 by calling goto(), which uses the
  // base PLP URL with no page parameter.
  // ----------------------------------------------------------
  async goToFirstPage() {
    await this.goto();
  }


  // ===========================================================
  // 5. FILTER METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // applyFirstAvailableFilter()
  // ----------------------------
  // Clicks the first filter option link in the left sidebar.
  //
  // On this site, filter panels are often pre-expanded by default.
  // We check for visible links first. If none are visible (panels
  // are collapsed), we click the first filter tab to expand it,
  // then click the first link inside.
  // ----------------------------------------------------------
  async applyFirstAvailableFilter() {
    const firstLink = this.allFilterLinks.first();

    // Try to find a pre-expanded, already-visible filter link
    let isLinkVisible = false;
    try {
      await firstLink.waitFor({ state: 'visible', timeout: 10000 });
      isLinkVisible = true;
    } catch {
      isLinkVisible = false;
    }

    if (!isLinkVisible) {
      // Panels are collapsed — expand the first filter section
      await this.firstFilterTitle.waitFor({ state: 'visible', timeout: 10000 });
      await this.firstFilterTitle.click();

      // Wait for the filter links to appear in the now-expanded panel
      await firstLink.waitFor({ state: 'visible' });
    }

    // Click the first filter link to apply it
    await firstLink.click();

    // Wait for the product grid to reload with filtered results
    await this.waitForPageLoad();
  }


  // ===========================================================
  // 6. SORT METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // changeSortBy(sortValue)
  // ------------------------
  // Selects an option from the "Sort By" dropdown.
  //
  // Magento 2 PLP sort values:
  //   'position' — default category order
  //   'name'     — alphabetical A–Z
  //   'price'    — lowest to highest
  //
  // The page reloads in the new order after selecting.
  // ----------------------------------------------------------
  async changeSortBy(sortValue) {
    await this.sortBySelect.waitFor({ state: 'visible' });
    await this.sortBySelect.selectOption(sortValue);
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // getSortByValue()
  // -----------------
  // Returns the currently selected value in the Sort By dropdown.
  // e.g. returns 'name' when "Product Name" is selected.
  // ----------------------------------------------------------
  async getSortByValue() {
    return await this.sortBySelect.inputValue();
  }


  // ===========================================================
  // 7. ADD TO CART METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // _waitForCartLoaderGone()   (internal helper)
  // ------------------------------------------------------
  // Waits for Magento's Knockout.js cart loading spinner to
  // disappear before we interact with any "Add to Cart" button.
  //
  // After DOMContentLoaded, Magento fires AJAX "section loads"
  // (cart, customer data). While this is happening, the cart
  // icon shows img[alt="Loading..."]. Clicking Add to Cart
  // before this finishes does nothing because the Knockout event
  // binding is not yet attached.
  //
  // state:'hidden' covers: not in DOM, display:none, visibility:hidden
  // ----------------------------------------------------------
  async _waitForCartLoaderGone() {
    await this.page.waitForSelector('img[alt="Loading..."]', {
      state: 'hidden',
      timeout: 15000,
    }).catch(() => {});
    // .catch() means: if the spinner never appeared, that is fine
  }

  // ----------------------------------------------------------
  // addProductAtIndex(index)
  // -------------------------
  // Clicks "Add to Cart" on the product card at a given 0-based
  // position in the current page's product grid.
  //
  // Grid position mapping (assuming 4 columns per row):
  //   Row 1 → indices 0, 1, 2, 3
  //   Row 2 → indices 4, 5, 6, 7
  //   Row 3 → indices 8, 9, 10, 11
  //
  // IMPORTANT — two possible outcomes after clicking:
  //   A) Simple product   → success toast + cart counter increases
  //   B) Configurable     → page redirects to PDP (pick options first)
  //
  // "Variants Available" products show a configure popup (neither A nor B).
  // We scan forward from `index` (up to 3 cards, staying in the same row)
  // to prefer a non-popup product.
  //
  // Returns the URL BEFORE clicking so the test can detect
  // whether a redirect happened (urlBefore !== page.url()).
  // ----------------------------------------------------------
  async addProductAtIndex(index) {
    // Wait for all page scripts to load.
    // Knockout cart bindings are attached only after the 'load' event.
    await this.page.waitForLoadState('load');

    // Wait for Magento's section-load AJAX spinner to disappear
    await this._waitForCartLoaderGone();

    // Scan from `index` forward (up to 3 more cards, covering one full row)
    // to find a product that is NOT a "Variants Available" popup type.
    // Clicking a "Variants Available" card opens a configure modal — which
    // is neither a success toast nor a URL redirect, so both outcome checks
    // in the test would fail. Skipping such cards avoids that third state.
    let targetIndex = index;
    for (let i = index; i < index + 4; i++) {
      const card = this.productItems.nth(i);
      if ((await card.count()) === 0) break;
      const isVariant = (await card.getByText('Variants Available').count()) > 0;
      if (!isVariant) {
        targetIndex = i;
        break;
      }
    }

    // Locate the "Add to Cart" button inside the chosen product card
    const button = this.productItems.nth(targetIndex).locator('button.tocart');

    // Wait for that button to be visible
    await button.waitFor({ state: 'visible' });

    // Save the current URL — we compare it after clicking to detect redirects
    const urlBefore = this.page.url();

    // Click the button
    await button.click();

    return urlBefore;
  }

  // ----------------------------------------------------------
  // getProductNames(limit)
  // -----------------------
  // Returns an array of product name strings (up to `limit` items)
  // from the current PLP page.
  //
  // Used after applying a sort to verify the grid order changed
  // correctly (e.g. confirm names are alphabetical after sort-by-name).
  // ----------------------------------------------------------
  async getProductNames(limit = 5) {
    const count = await this.productNameLinks.count();
    const total = Math.min(count, limit);
    const names = [];
    for (let i = 0; i < total; i++) {
      const name = await this.productNameLinks.nth(i).textContent();
      names.push(name.trim());
    }
    return names;
  }

  // ----------------------------------------------------------
  // isSuccessMessageVisible()
  // --------------------------
  // Returns true if the green "Added to cart" toast appears
  // within 15 seconds of clicking Add to Cart.
  //
  // Returns false if:
  //   - No toast appeared (likely a configurable product redirect)
  //   - The toast never showed within the timeout
  // ----------------------------------------------------------
  async isSuccessMessageVisible() {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // getCartCounterText()
  // ---------------------
  // Returns the text currently shown in the cart badge, e.g. "3".
  //
  // When the cart is empty Magento HIDES the badge entirely.
  // In that case this method returns the string '0'.
  //
  // The badge updates via AJAX, so we wait up to 8 seconds for it.
  // ----------------------------------------------------------
  async getCartCounterText() {
    try {
      await this.cartCounter.waitFor({ state: 'visible', timeout: 8000 });
      return (await this.cartCounter.textContent()).trim();
    } catch {
      // Badge is hidden → cart is empty
      return '0';
    }
  }


  // ===========================================================
  // 8. PDP METHODS
  // ===========================================================

  // ----------------------------------------------------------
  // openProductAtIndex(index)
  // --------------------------
  // Clicks the product NAME LINK at a given 0-based index to
  // open that product's Product Detail Page (PDP).
  //
  // Returns the product name text (read BEFORE clicking) so the
  // test can verify that the correct PDP was opened.
  // ----------------------------------------------------------
  async openProductAtIndex(index) {
    const link = this.productNameLinks.nth(index);

    // Wait for the product name link to be visible
    await link.waitFor({ state: 'visible' });

    // Read the name BEFORE navigating (we'll assert it on the PDP)
    const productName = (await link.textContent()).trim();

    // Click the name link — browser navigates to the PDP
    await link.click();

    // Wait for the PDP to fully load
    await this.waitForPageLoad();

    return productName;
  }

  // ----------------------------------------------------------
  // _selectFirstSwatchOptionsOnPDP()   (internal helper)
  // -------------------------------------------------------
  // On a configurable PDP, the "Add to Cart" button is disabled
  // until every required option (colour, size, etc.) is chosen.
  //
  // This helper auto-selects the FIRST available option in every
  // swatch attribute group on the page.
  //
  // For simple products it does nothing (no swatch groups exist).
  // ----------------------------------------------------------
  async _selectFirstSwatchOptionsOnPDP() {
    // Count how many swatch attribute groups exist (e.g. Colour, Size)
    const groupCount = await this.pdpSwatchGroups.count();

    for (let i = 0; i < groupCount; i++) {
      // Get the first clickable swatch inside this group
      const firstOption = this.pdpSwatchGroups.nth(i)
        .locator('.swatch-option')
        .first();

      // Only click if the swatch is actually visible
      const isVisible = await firstOption.isVisible().catch(() => false);
      if (isVisible) {
        await firstOption.click();
      }
    }
  }

  // ----------------------------------------------------------
  // addToCartFromPDP()
  // -------------------
  // Adds the currently open PDP product to the cart.
  //
  // Steps:
  //   1. Wait for Knockout page scripts to finish loading
  //   2. Auto-select any required swatch options (configurable product)
  //   3. Click the main "Add to Cart" button on the PDP
  //
  // Returns true if the success toast appeared, false otherwise.
  // ----------------------------------------------------------
  async addToCartFromPDP() {
    // Knockout's cart binding requires the full 'load' event
    await this.page.waitForLoadState('load');

    // Auto-select swatch options if this is a configurable product
    await this._selectFirstSwatchOptionsOnPDP();

    // Wait for the Add to Cart button to be visible and clickable
    await this.pdpAddToCartButton.waitFor({ state: 'visible' });

    // Click the main PDP "Add to Cart" button
    await this.pdpAddToCartButton.click();

    // Return whether the success toast appeared
    return await this.isSuccessMessageVisible();
  }

  // ----------------------------------------------------------
  // getPDPProductTitle()
  // ---------------------
  // Returns the product title (the h1 text) on the PDP.
  // Used to verify that the correct product page was opened.
  // ----------------------------------------------------------
  async getPDPProductTitle() {
    await this.pdpProductTitle.first().waitFor({ state: 'visible' });
    return (await this.pdpProductTitle.first().textContent()).trim();
  }

}

// Export so test files can import this class with:
//   const { PLPPage } = require('../pages/PLPPage');
module.exports = { PLPPage };
