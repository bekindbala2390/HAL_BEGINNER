// ============================================================
// pages/HomePage.js
//
// What is this file?
// -------------------
// This is the Page Object for the HAL UAE Homepage.
//
// A Page Object is a JavaScript class that represents one
// page of your website. It contains:
//   1. Locators  - how to FIND elements on the page
//   2. Actions   - what to DO with those elements
//
// By grouping locators + actions in one file, your test files
// stay clean and readable. If the website changes (e.g., a
// button moves), you only update THIS file, not every test.
//
// This class EXTENDS BasePage, meaning it inherits all
// the shared methods like navigate(), waitForPageLoad(), etc.
// ============================================================

// Import BasePage so we can extend it
const { BasePage } = require('./BasePage');

class HomePage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ------------------
  // Called when you create: const homePage = new HomePage(page)
  //
  // We FIRST call super(page) which runs BasePage's constructor
  // and stores 'page' as 'this.page'.
  //
  // Then we define LOCATORS — these tell Playwright HOW to
  // find specific elements on the homepage.
  //
  // We define them here (not inside each method) so that:
  //   - They are defined once and reused everywhere
  //   - If an element changes, we update it in one place
  // ----------------------------------------------------------
  constructor(page) {

    // Always call super() first when extending a class.
    // This sets up this.page from BasePage.
    super(page);

    // --------------------------------------------------------
    // LOCATORS
    // ---------
    // A locator is Playwright's way to find an element.
    // We use page.locator('css-selector') here because the
    // HAL website uses custom HTML/CSS that doesn't always
    // have standard ARIA roles or labels.
    //
    // How to find a CSS selector?
    //   1. Open the website in Chrome
    //   2. Right-click the element > Inspect
    //   3. Look at the HTML and note the class or ID
    // --------------------------------------------------------

    // The main navigation bar at the top of the page
    this.navigationBar = page.locator('header');

    // The HAL logo in the top-left corner of the page
    this.logo = page.locator('header .logo, header img[alt*="HAL"], a.logo, .nav-logo');

    // The site search icon/button (magnifying glass)
    this.searchIcon = page.locator('button.action.search, .action-search, [data-action="toggle-search"]');

    // The shopping cart icon in the top-right
    this.cartIcon = page.locator('a.showcart, .minicart-wrapper a');

    // The main hero/banner section at the top of the homepage
    this.heroBanner = page.locator('.hero-banner, .slick-slider, .owl-carousel, section.hero, .banner-container');

    // The main footer at the bottom of the page
    this.footer = page.locator('footer');

    // Newsletter subscription email input (if present on homepage)
    this.newsletterEmailInput = page.locator('input#newsletter, input[name="email"][type="email"]');

    // Newsletter subscribe button
    this.newsletterSubscribeButton = page.locator('button.action.subscribe, #newsletter-validate-detail button');

    // --------------------------------------------------------
    // SECTION / BANNER LINK LOCATORS
    // --------------------------------
    // The homepage has promotional banners and category tiles
    // built with Magento PageBuilder. Each banner has a
    // clickable link that redirects to another page.
    //
    // .first() means: pick only the FIRST matching element.
    // We use first() to avoid errors when multiple exist.
    // --------------------------------------------------------

    // "Buy Now" link inside the "Home Daily Meal" promotional section.
    // This section lives in the homepage body (below the hero) and has
    // a real href pointing to /all-products/food-beverage.html.
    // The hero slider itself only has /#  dot-nav links, so we use this instead.
    this.firstBannerLink = page.locator('.home-daily-meal a').first();

    // "About Us" link in the secondary navigation bar (md-top-menu-items).
    // This is a genuinely visible link — no hover or dropdown needed.
    // We use this instead of category tiles (which use href="#") or
    // nav dropdown links (which are display:none until hovered).
    this.firstCategoryLink = page.locator('a[href*="/about-us"]').first();

    // --------------------------------------------------------
    // PRODUCT CARD LOCATORS
    // ----------------------
    // Homepage product sections (e.g. "New Arrivals", "Featured")
    // show product cards. Each card has:
    //   - A title link  → goes to the Product Detail Page (PDP)
    //   - An "Add to Cart" button → adds the item to the cart
    //   - An image link → also goes to the PDP
    // --------------------------------------------------------

    // All product item containers on the homepage
    // We use this to count how many products are shown
    this.productItems = page.locator('.product-item');

    // "Add to Cart" button on the first visible product card
    // In Magento 2, the button has class "action tocart"
    this.firstAddToCartButton = page.locator(
      '//div[@aria-label="2 / 10"]//button[@title="Add to Cart"]//span[contains(text(),"Add to Cart")]'
    ).first();

    // Product title link on the first product card
    // Clicking this goes to the Product Detail Page (PDP)
    this.firstProductTitleLink = page.locator(
      '//div[@aria-label="1 / 10"]//a[@class="product-item-link"][normalize-space()="HAL Dove Beauty Cream Bar Admin"]'
    ).first();

    // Any Magento message rendered after an action (Add to Cart, etc.)
    // Magento renders messages via Knockout.js with data-ui-id like:
    //   "message-success" (item added successfully)
    //   "message-notice"  (item needs options selected first)
    //   "message-error"   (something went wrong)
    // The [data-ui-id^="message-"] selector matches ALL of these types.
    this.successMessage = page.locator('//div[@data-bind=\'html: $parent.prepareMessageForHtml(message.text)\']');

    // Cart item counter badge (the number on the cart icon)
    // e.g. shows "1" after adding one product
    this.cartCounter = page.locator(
      '.counter.qty .counter-number, .minicart-wrapper .counter-number'
    );
  }

  // ----------------------------------------------------------
  // goto()
  // -------
  // Opens the homepage in the browser.
  // '/' means: go to the root / homepage of baseURL.
  //
  // We use 'await' because going to a page is an async
  // operation — it takes time for the browser to load.
  // ----------------------------------------------------------
  async goto() {
    await this.navigate('/'); // Uses navigate() from BasePage
  }

  // ----------------------------------------------------------
  // isNavigationBarVisible()
  // -------------------------
  // Checks if the navigation bar is visible on the page.
  // Returns true if visible, false if not.
  //
  // isVisible() is a Playwright method that checks visibility
  // WITHOUT throwing an error if the element doesn't exist.
  // ----------------------------------------------------------
  async isNavigationBarVisible() {
    return await this.navigationBar.isVisible();
  }

  // ----------------------------------------------------------
  // isLogoVisible()
  // ----------------
  // Checks if the HAL logo is visible on the page.
  // ----------------------------------------------------------
  async isLogoVisible() {
    return await this.logo.isVisible();
  }

  // ----------------------------------------------------------
  // isFooterVisible()
  // ------------------
  // Checks if the footer is visible at the bottom of the page.
  // ----------------------------------------------------------
  async isFooterVisible() {
    return await this.footer.isVisible();
  }

  // ----------------------------------------------------------
  // clickSearchIcon()
  // ------------------
  // Clicks the search icon to open the search bar.
  // ----------------------------------------------------------
  async clickSearchIcon() {
    await this.searchIcon.click();
  }

  // ----------------------------------------------------------
  // clickCartIcon()
  // ----------------
  // Clicks the cart icon to open the mini cart/sidebar.
  // ----------------------------------------------------------
  async clickCartIcon() {
    await this.cartIcon.click();
  }

  // ----------------------------------------------------------
  // clickFirstBannerLink()
  // -----------------------
  // Clicks the first promotional banner link on the homepage.
  //
  // waitFor({ state: 'visible' }) pauses until the element
  // appears on screen before trying to click it.
  // This prevents errors if the banner loads with a delay.
  // ----------------------------------------------------------
  async clickFirstBannerLink() {
    // Wait until the banner link is visible on screen
    await this.firstBannerLink.waitFor({ state: 'visible' });

    // Click the link — the browser will navigate to a new page
    await this.firstBannerLink.click();

    // Wait for the new page to fully load
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // clickFirstCategoryLink()
  // -------------------------
  // Clicks the first category tile/section on the homepage.
  // This should take the user to a category listing page
  // (e.g., all products in "Electronics" or "Clothing").
  // ----------------------------------------------------------
  async clickFirstCategoryLink() {
    // Wait until the About Us link exists in the DOM
    await this.firstCategoryLink.waitFor({ state: 'attached' });

    // locator.evaluate() runs code INSIDE the browser tab, not in Playwright.
    // el.click() called inside the browser is a "trusted" event — the browser
    // actually follows the <a> tag's href and navigates.
    //
    // We can't use locator.click() here because the site's CSS positions this
    // nav link outside Playwright's viewport rect (even though it is visible).
    // locator.evaluate avoids all of Playwright's positioning checks.
    await this.firstCategoryLink.evaluate(el => el.click());

    // After the trusted click, wait for the browser to land on the About Us page.
    // waitForURL() pauses until the current URL matches this pattern.
    await this.page.waitForURL(/about-us/);

    // Wait for the About Us page HTML to be ready
    await this.waitForPageLoad();
  }

  // ----------------------------------------------------------
  // getProductCount()
  // ------------------
  // Returns how many product cards are currently visible
  // on the homepage.
  //
  // .count() is a Playwright method that counts matching elements.
  // It does NOT throw an error if 0 are found — it just returns 0.
  // ----------------------------------------------------------
  async getProductCount() {
    return await this.productItems.count();
  }

  // ----------------------------------------------------------
  // clickFirstAddToCart()
  // ----------------------
  // Clicks the "Add to Cart" button on the first product card
  // shown on the homepage.
  //
  // NOTE: If the product is configurable (has sizes or colors),
  // Magento may redirect to the PDP instead of showing a
  // success message. Simple products will show the green bar.
  // ----------------------------------------------------------
  async clickFirstAddToCart() {
    // Magento's "Add to Cart" button works through Knockout.js event bindings
    // that are set up AFTER all page scripts have loaded.
    // If we click too early (e.g. right after domcontentloaded), the binding
    // isn't active yet and nothing happens — no AJAX, no message.
    //
    // waitForLoadState('load') waits until all scripts have finished loading,
    // ensuring the KO cart handler is ready to receive the click.
    await this.page.waitForLoadState('load');

    // Wait for the button to appear before clicking
    await this.firstAddToCartButton.waitFor({ state: 'visible' });

    // Click the "Add to Cart" button
    await this.firstAddToCartButton.click();
  }

  // ----------------------------------------------------------
  // isSuccessMessageVisible()
  // --------------------------
  // Checks whether Magento's green "Added to cart" success
  // message appears after clicking Add to Cart.
  //
  // We use try/catch here because:
  //   - waitFor() THROWS an error if the element never appears
  //   - We catch that error and return false instead
  //   - This way the test can make a clean assertion
  // ----------------------------------------------------------
  async isSuccessMessageVisible() {
    try {
      // Wait up to 5 seconds for the response message to appear.
      // If the product is configurable (needs size/color selection),
      // Magento redirects to the PDP instead — no message will appear.
      // The test handles both cases, so 5 seconds is enough to detect
      // a genuine message without waiting too long for one that won't come.
      await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });

      // If we reach this line, the message appeared — return true
      return true;
    } catch (error) {
      // The message never appeared within 6 seconds — return false
      return false;
    }
  }

  // ----------------------------------------------------------
  // getFirstProductHref()
  // ----------------------
  // Reads the href attribute from the first product's title link.
  // The href is the URL the product title links to (the PDP URL).
  //
  // We call this BEFORE clicking, so we can compare:
  //   "where were we SUPPOSED to go?" vs "where did we land?"
  //
  // getAttribute('href') returns the value of the href="..."
  // attribute from the HTML element.
  // ----------------------------------------------------------
  async getFirstProductHref() {
    return await this.firstProductTitleLink.getAttribute('href');
  }

  // ----------------------------------------------------------
  // clickFirstProductTitle()
  // -------------------------
  // Clicks the product title link on the first product card.
  // This navigates to the Product Detail Page (PDP) for
  // that specific product.
  //
  // PDP = the page that shows details about ONE product,
  // e.g. images, description, price, and the main Add to Cart.
  // ----------------------------------------------------------
  async clickFirstProductTitle() {
    // Wait for the product title link to be visible
    await this.firstProductTitleLink.waitFor({ state: 'visible' });

    // Click the product title — browser navigates to PDP
    await this.firstProductTitleLink.click();

    // Wait for the PDP to fully load
    await this.waitForPageLoad();
  }

}

// Export so test files can import this class
module.exports = { HomePage };
