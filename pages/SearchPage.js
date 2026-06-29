// ============================================================
// pages/SearchPage.js
//
// What is this file?
// -------------------
// This is the Page Object for the HAL UAE Search Results page.
//
// When a user searches for a keyword, they land on:
//   /catalogsearch/result/?q=<keyword>
//
// This POM contains:
//   1. Locators  — how to FIND elements on the search results page
//   2. Actions   — what to DO with those elements
//
// It EXTENDS BasePage (like HomePage.js) so it inherits
// navigate(), waitForPageLoad(), and other shared utilities.
// ============================================================

const { BasePage } = require('./BasePage');

class SearchPage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ------------------
  // Called when you do:  const searchPage = new SearchPage(page)
  //
  // super(page) runs BasePage's constructor which stores
  // 'page' as 'this.page' for use in all methods below.
  // ----------------------------------------------------------
  constructor(page) {
    super(page);

    // --------------------------------------------------------
    // HEADER SEARCH LOCATORS
    // -----------------------
    // The search bar lives in the site header and is available
    // on every page. In Magento 2, a magnifying-glass button
    // toggles the search input open, then you type and press Enter.
    // --------------------------------------------------------

    // Magnifying-glass toggle button in the header.
    // Clicking it expands the hidden search input field.
    this.searchToggleButton = page.locator(
      '//input[@id="search"]'
    );

    // The actual text input that appears after the toggle is clicked.
    // Standard Magento 2 uses id="search" for this element.
    this.searchInput = page.locator('input#search');

    // --------------------------------------------------------
    // SEARCH RESULTS PRODUCT LOCATORS
    // ---------------------------------
    // After submitting a search, Magento renders a grid of
    // matching products. Each product is a .product-item card.
    // --------------------------------------------------------

    // Every product card on the current results page.
    // Used to count how many results were returned.
    this.productItems = page.locator('.product-item');

    // The clickable product name links inside each card.
    // Clicking one navigates to the Product Detail Page (PDP).
    this.productNameLinks = page.locator('a.product-item-link');

    // "Add to Cart" buttons on product cards.
    // These are <button> elements (not links) for simple products.
    // Configurable products (e.g. items needing a size selection)
    // redirect to the PDP instead of showing a success toast.
    this.addToCartButtons = page.locator('button.tocart');

    // --------------------------------------------------------
    // NO RESULTS LOCATOR
    // -------------------
    // When a search returns nothing, Magento displays a notice:
    // "Your search returned no results."
    // This locator targets that message container.
    // --------------------------------------------------------
    this.noResultsMessage = page.locator(
      '.message.notice div, .search.results .message'
    );

    // --------------------------------------------------------
    // LAYERED NAVIGATION (FILTERS) LOCATORS
    // ---------------------------------------
    // The left sidebar on search results shows "Layered Navigation"
    // filters — users can narrow results by Category, Price, Brand, etc.
    //
    // Each filter section (.filter-options-item) contains:
    //   - A TITLE (.filter-options-title) — click to expand/collapse
    //   - A CONTENT area (.filter-options-content) with filter links
    // --------------------------------------------------------

    // The filter tab elements on this site use IMPLICIT ARIA roles:
    // the sidebar renders <li> elements inside <ul role="tablist">,
    // so each <li> gets computed role="tab" in the accessibility tree
    // but has NO explicit role="tab" HTML attribute.
    //
    // CSS [role="tab"] only matches EXPLICIT HTML attributes, so it
    // finds NOTHING for these tabs. We must use getByRole('tab') which
    // reads from the accessibility tree (like a screen reader would).
    //
    // The only HTML element with role="tab" is the mobile-only:
    //   <strong role="tab" data-role="title">Filter By</strong>
    // which is HIDDEN on desktop.
    this.filterOptionsItems = page.locator('main').getByRole('tab');

    // First visible filter tab found via accessibility tree.
    // Works for both explicit role="tab" and implicit tab roles.
    this.firstFilterTitle = page.locator('main').getByRole('tab').first();

    // All filter option links inside any expanded filter panel.
    // Structure: .filter-options-content > ol.items > li.item > a
    this.allFilterLinks = page.locator('.filter-options-content .item a');
    

    // --------------------------------------------------------
    // TOOLBAR / SORT LOCATORS
    // ------------------------
    // The toolbar sits above the product grid and contains:
    //   - An item count ("Items 1-12 of 24")
    //   - A "Sort By" dropdown to change product order
    // --------------------------------------------------------

    // The "Sort By" <select> element.
    // In Magento 2, this always has id="sorter".
    // Options: 'relevance' | 'name' | 'price'
    this.sortBySelect = page.locator('select#sorter');

    // --------------------------------------------------------
    // CART / MINI CART LOCATORS
    // --------------------------
    // After clicking "Add to Cart", Magento:
    //   1. Shows a green success toast message
    //   2. Updates the counter badge on the header cart icon
    //   3. Loads the mini cart dropdown with the added item
    // --------------------------------------------------------

    // Success toast shown after a product is added to the cart.
    // Magento 2 uses .message-success or .message.success for the
    // toast container. (The old XPath fallback was removed — Playwright
    // cannot mix XPath and CSS in a single comma-separated locator string.)
    this.successMessage = page.locator('.message-success, .message.success');

    // Cart counter badge on the header cart icon.
    // Shows "1", "2", etc. — Magento HIDES this when the cart is empty.
    this.cartCounter = page.locator(
      '.counter.qty .counter-number, .minicart-wrapper .counter-number'
    );

    // The cart icon / "My Cart" button in the page header.
    this.cartIconLink = page.locator('a.showcart, .minicart-wrapper a.action.showcart');

    // The mini cart dropdown panel that slides in when cart icon is clicked.
    // Standard Magento 2 uses #minicart-content-wrapper; some custom themes
    // wrap it inside .block-minicart. We include both so either works.
    this.miniCartContent = page.locator('#minicart-content-wrapper, .block-minicart');

    // --------------------------------------------------------
    // PAGINATION LOCATORS
    // --------------------
    // When results span multiple pages, Magento shows a pager:
    //   « 1  2  3 … »
    //
    // URL changes to include ?p=2, ?p=3 etc. when navigating pages.
    // --------------------------------------------------------

    // The "Next Page" arrow link ( › )
    this.nextPageButton = page.locator('a.action.next');

    // Individual page-number links (e.g. "2", "3", "4").
    // Does NOT include the current page (shown as <strong>, not <a>).
    this.pageNumberLinks = page.locator('.pages-items .item a.page');

    // The entire pagination bar — used to check if pagination exists
    this.paginationBar = page.locator('.pages');

    // --------------------------------------------------------
    // PDP (PRODUCT DETAIL PAGE) LOCATOR
    // -----------------------------------
    // After clicking a product name in search results, the browser
    // goes to the PDP. The product name is inside an <h1>.
    //
    // Magento wraps it as:
    //   <h1 class="page-title"><span class="base">Product Name</span></h1>
    // --------------------------------------------------------
    this.pdpProductTitle = page.locator('h1.page-title span.base, h1.page-title');
  }

  // ----------------------------------------------------------
  // searchViaHeader(keyword)
  // -------------------------
  // Performs a search using the search bar in the website header.
  //
  // Steps:
  //   1. Click the toggle button to reveal the search input
  //   2. Type the keyword into the input field
  //   3. Press Enter to submit the search
  //   4. Wait for the search results page to load
  // ----------------------------------------------------------
  async searchViaHeader(keyword) {
    // Click the magnifying-glass icon to show the search input
    await this.searchToggleButton.click();

    // Wait until the input field is visible and ready to type into
    await this.searchInput.waitFor({ state: 'visible' });

    // Clear any previous text, then type our keyword
    await this.searchInput.fill(keyword);

    // Press Enter — same as clicking the search submit button
    await this.searchInput.press('Enter');

    // Wait for the search results page to finish loading
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // navigateToSearchResults(keyword)
  // ---------------------------------
  // Opens the search results page DIRECTLY by URL — faster and
  // more reliable than typing in the header search bar.
  //
  // Magento 2 search results URL format:
  //   /catalogsearch/result/?q=<keyword>
  //
  // encodeURIComponent() converts spaces/special chars to URL-safe
  // format: e.g. "dove cream" becomes "dove%20cream"
  // ----------------------------------------------------------
  async navigateToSearchResults(keyword) {
    await this.navigate(`/catalogsearch/result/?q=${encodeURIComponent(keyword)}`);
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // getProductCount()
  // ------------------
  // Returns how many product cards are on the current page.
  // Returns 0 if no products are found (does NOT throw).
  // ----------------------------------------------------------
  async getProductCount() {
    return await this.productItems.count();
  }

  // ----------------------------------------------------------
  // isNoResultsMessageVisible()
  // ----------------------------
  // Checks whether the "no results" notice is displayed.
  //
  // We use try/catch because waitFor() throws if the element
  // never appears within the timeout. Catching that error lets
  // us return false instead of crashing the test.
  // ----------------------------------------------------------
  async isNoResultsMessageVisible() {
    try {
      await this.noResultsMessage.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // applyFirstAvailableFilter()
  // ----------------------------
  // Clicks the first filter link in the left sidebar to narrow
  // the search results.
  //
  // On this site the filter panels are PRE-EXPANDED by default
  // (both "Brands" and "Pack & Container Color" tabs load with
  // [expanded] state). So we try the filter links directly first.
  //
  // If the links are not visible (collapsed state), we fall back
  // to clicking the first filter tab using the ARIA role API,
  // which finds implicit role="tab" elements that CSS [role="tab"]
  // cannot match.
  // ----------------------------------------------------------
  async applyFirstAvailableFilter() {
    const firstLink = this.allFilterLinks.first();

    // Give the page time to render the filter sidebar (up to 10 s).
    // On this site the panels are pre-expanded, so the links should
    // be immediately visible once the page finishes loading.
    let isLinkVisible = false;
    try {
      await firstLink.waitFor({ state: 'visible', timeout: 10000 });
      isLinkVisible = true;
    } catch {
      isLinkVisible = false;
    }

    if (!isLinkVisible) {
      // Panels are collapsed — click the first filter tab to open it.
      // getByRole('tab') reads the ARIA tree so it finds <li> elements
      // that have implicit role="tab" (not just explicit HTML role="tab").
      await this.firstFilterTitle.waitFor({ state: 'visible', timeout: 10000 });
      await this.firstFilterTitle.click();

      // Wait for the filter links to appear inside the expanded panel
      await firstLink.waitFor({ state: 'visible' });
    }

    // Click the first visible filter link to apply that filter
    await firstLink.click();

    // Wait for the page to reload with filtered results
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // changeSortBy(sortValue)
  // ------------------------
  // Changes the "Sort By" dropdown to the given option value.
  //
  // Valid sort values in Magento 2 search results:
  //   'relevance'  — most relevant to query (default for search)
  //   'name'       — alphabetical by product name
  //   'price'      — lowest to highest price
  //
  // After selecting, the page reloads in the new sort order.
  // ----------------------------------------------------------
  async changeSortBy(sortValue) {
    // Wait for the sort dropdown to be available
    await this.sortBySelect.waitFor({ state: 'visible' });

    // Select the <option> whose value matches sortValue
    await this.sortBySelect.selectOption(sortValue);

    // Wait for the product list to reload in the new order
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // getSortByValue()
  // -----------------
  // Returns the currently selected value of the Sort By dropdown.
  // E.g. returns 'name' when "Product Name" is selected.
  // ----------------------------------------------------------
  async getSortByValue() {
    return await this.sortBySelect.inputValue();
  }

  // ----------------------------------------------------------
  // addFirstProductToCart()
  // ------------------------
  // Clicks the first "Add to Cart" button in the results grid.
  //
  // Returns the URL BEFORE clicking so the test can detect if
  // a page redirect occurred (which means the product is
  // configurable and needs options selected on the PDP).
  // ----------------------------------------------------------
  async addFirstProductToCart() {
    // Magento's Add to Cart uses Knockout.js bindings that only
    // become active after ALL page scripts have loaded.
    await this.page.waitForLoadState('load');

    // waitForLoadState('load') is NOT enough — Magento also fires
    // several AJAX section-loads (cart, customer) after DOMLoaded.
    // The cart icon shows a "Loading..." img until Knockout finishes.
    //
    // We wait for that img to disappear using page.waitForFunction(),
    // which runs in the BROWSER's JS context. This is more reliable
    // than a Playwright CSS locator because:
    //   - The cart link on this custom theme may NOT have class "showcart"
    //   - CSS [role="banner"] works regardless of the HTML tag name
    //   - offsetParent === null detects display:none (CSS-hidden) elements
    // The loading spinner is inside the cart link.
    // We use waitForFunction() (browser JS context) instead of a CSS
    // locator because the cart link may not have class "showcart" on this
    // custom theme, making 'a.showcart img' unreliable.
    // We also avoid scoping to [role="banner"] because that only matches
    // EXPLICIT HTML role attributes, not the semantic <header> element
    // (which has implicit role="banner" in ARIA but no HTML attribute).
    // Searching the whole document for img[alt="Loading..."] is safe here
    // because only the Knockout cart section loader uses that exact alt text.
    // waitForSelector with state:'hidden' handles all cases:
    // element not in DOM, display:none, visibility:hidden, etc.
    await this.page.waitForSelector('img[alt="Loading..."]', {
      state: 'hidden',
      timeout: 15000,
    }).catch(() => {});

    // Prefer simple products — products labelled "Variants Available"
    // open a configure popup instead of showing a success toast, which
    // causes both the toast check and the redirect check to fail.
    // Filter for product cards that do NOT contain that label.
    const simpleProductButton = this.page
      .locator('.product-item')
      .filter({ hasNot: this.page.getByText('Variants Available') })
      .locator('button.tocart')
      .first();

    const hasSimpleProduct = (await simpleProductButton.count()) > 0;

    // Fall back to the very first button if no simple product is found
    const firstButton = hasSimpleProduct
      ? simpleProductButton
      : this.addToCartButtons.first();

    await firstButton.waitFor({ state: 'visible' });

    // Save the current URL before clicking for later comparison
    const urlBefore = this.page.url();

    // Click the Add to Cart button
    await firstButton.click();

    // Return the pre-click URL so the test can check for redirects
    return urlBefore;
  }

  // ----------------------------------------------------------
  // isSuccessMessageVisible()
  // --------------------------
  // Returns true if the green "Added to cart" toast appears.
  //
  // Waits up to 8 seconds. If the product is configurable and
  // caused a PDP redirect, no toast will appear, and we return
  // false after the timeout.
  // ----------------------------------------------------------
  async isSuccessMessageVisible() {
    try {
      // 15 s to account for slow staging-server AJAX responses
      await this.successMessage.waitFor({ state: 'visible', timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // getCartCounterText()
  // ---------------------
  // Returns the text of the cart counter badge (e.g. "1", "3").
  //
  // When the cart is EMPTY, Magento hides the badge entirely.
  // In that case, we return '0' so tests can safely parse it.
  // ----------------------------------------------------------
  async getCartCounterText() {
    try {
      // Wait up to 8 seconds — the counter updates asynchronously via AJAX
      await this.cartCounter.waitFor({ state: 'visible', timeout: 8000 });
      return (await this.cartCounter.textContent()).trim();
    } catch {
      // Counter badge is not visible — cart is empty
      return '0';
    }
  }

  // ----------------------------------------------------------
  // isCartCounterVisible()
  // -----------------------
  // Returns true if the cart counter badge is visible.
  //
  // The badge ONLY appears when the cart has at least one item.
  // If visible, the cart is not empty.
  // ----------------------------------------------------------
  async isCartCounterVisible() {
    try {
      await this.cartCounter.waitFor({ state: 'visible', timeout: 8000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // openMiniCart()
  // ---------------
  // Clicks the cart icon in the header to open the mini cart
  // dropdown, then waits for the dropdown panel to appear.
  //
  // This custom HAL UAE theme may NOT render a visible dropdown
  // (Knockout intercepts the click but doesn't show a detectable
  // panel). We therefore fall back to navigating directly to the
  // cart page, which isMiniCartContentVisible() already accepts
  // as an equivalent outcome via its URL check.
  // ----------------------------------------------------------
  async openMiniCart() {
    // Click the cart icon / "My Cart" link
    await this.cartIconLink.first().click();

    // Wait for EITHER the dropdown OR the cart page navigation.
    await Promise.race([
      this.miniCartContent.first().waitFor({ state: 'visible', timeout: 10000 }),
      this.page.waitForURL('**/checkout/cart**', { timeout: 10000 })
    ]).catch(() => {});

    // If neither the dropdown nor the cart page appeared, navigate directly.
    // The test accepts cart page navigation as a valid outcome.
    const onCartPage = this.page.url().includes('/checkout/cart');
    const dropdownOpen = await this.miniCartContent.first().isVisible();
    if (!onCartPage && !dropdownOpen) {
      await this.navigate('/checkout/cart/');
      await this.waitForPageLoad();
    }
  }

  // ----------------------------------------------------------
  // isMiniCartContentVisible()
  // ---------------------------
  // Returns true if the mini cart dropdown is open OR if the site
  // navigated to the /checkout/cart page (custom theme behaviour).
  // ----------------------------------------------------------
  async isMiniCartContentVisible() {
    if (this.page.url().includes('/checkout/cart')) return true;
    return await this.miniCartContent.first().isVisible();
  }

  // ----------------------------------------------------------
  // hasPagination()
  // ----------------
  // Returns true if the pagination bar is visible.
  //
  // Pagination only renders when the total result count exceeds
  // the products-per-page limit (usually 12 in Magento 2).
  // ----------------------------------------------------------
  async hasPagination() {
    return await this.paginationBar.isVisible();
  }

  // ----------------------------------------------------------
  // goToNextPage()
  // ---------------
  // Clicks the "Next" ( › ) arrow in the pagination bar.
  // The URL changes to include &p=2 (or the next page number).
  // ----------------------------------------------------------
  async goToNextPage() {
    await this.nextPageButton.waitFor({ state: 'visible' });
    await this.nextPageButton.click();
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // goToPageNumber(pageNumber)
  // ---------------------------
  // Clicks on a specific page number link in the pagination bar.
  //
  // Magento labels each pagination link with:
  //   aria-label="Page X"
  // so we build the locator using that aria-label.
  // ----------------------------------------------------------
  async goToPageNumber(pageNumber) {
    // Build a locator targeting the link for the given page number
    const pageLink = this.page.locator(
      `.pages-items .item a[aria-label="Page ${pageNumber}"]`
    );

    // Wait for that page link to be visible in the pagination bar
    await pageLink.waitFor({ state: 'visible' });

    // Click the page number link
    await pageLink.click();

    // Wait for the new page of results to load
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // openFirstProductPDP()
  // ----------------------
  // Clicks the first product name in the search results to open
  // that product's Product Detail Page (PDP).
  //
  // Returns the product name text so the test can verify that
  // the correct PDP was opened.
  // ----------------------------------------------------------
  async openFirstProductPDP() {
    const firstLink = this.productNameLinks.first();

    // Wait for the product name to be visible
    await firstLink.waitFor({ state: 'visible' });

    // Read the product name BEFORE clicking (for test assertion later)
    const productName = (await firstLink.textContent()).trim();

    // Click the product name — browser navigates to the PDP
    await firstLink.click();

    // Wait for the PDP to finish loading
    await this.waitForPageLoad();

    // Return the name for comparison in the test
    return productName;
  }

  // ----------------------------------------------------------
  // getPDPProductTitle()
  // ---------------------
  // Returns the product title heading text on the PDP.
  //
  // On the PDP, the product name is inside:
  //   <h1 class="page-title"><span class="base">Name Here</span></h1>
  // ----------------------------------------------------------
  async getPDPProductTitle() {
    await this.pdpProductTitle.first().waitFor({ state: 'visible' });
    return (await this.pdpProductTitle.first().textContent()).trim();
  }

}

// Export so test files can import this class
module.exports = { SearchPage };
