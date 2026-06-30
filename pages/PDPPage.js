// ============================================================
// pages/PDPPage.js
//
// What is this file?
// -------------------
// This is the Page Object for the HAL UAE Product Detail Page (PDP).
//
// The PDP is the single-product page that shows:
//   - A large Fotorama image gallery (main image + thumbnails)
//   - Product title, price, SKU, and stock status
//   - Quantity input and "Add to Cart" button
//   - MOQ (Minimum Order Quantity) badge — sets the minimum qty allowed
//   - Swatch option groups for CONFIGURABLE products (e.g. colour + size)
//   - Three bottom tabs: Details, More Information, Reviews
//   - Social / product share links
//
// URL pattern example:
//   https://mcstaging2.hal-uae.com/some-category/product-name.html
//
// This class EXTENDS BasePage, so it automatically inherits:
//   navigate(), waitForPageLoad(), getPageTitle(), takeScreenshot()
//
// Contents:
//   1. LOCATORS   — CSS selectors for every PDP element
//   2. NAVIGATION — goto(url)
//   3. CORE INFO  — title, price, SKU, stock, add-to-cart button
//   4. GALLERY    — main image, thumbnails, fullscreen, arrow nav
//   5. SWATCHES   — configurable product variant groups and selection
//   6. MOQ & QTY  — read MOQ badge, get/set qty input
//   7. ADD TO CART — click button, wait for toast, MOQ-aware helper
//   8. TABS       — Details, More Information, Reviews
//   9. SHARE      — click share button, detect popup/navigation
//  10. CART       — cart counter badge text
// ============================================================

// Import BasePage so PDPPage can inherit its shared methods
const { BasePage } = require('./BasePage');

class PDPPage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ------------------
  // Runs when you write:  const pdp = new PDPPage(page)
  //
  // super(page) calls BasePage's constructor, which stores the
  // Playwright page object as this.page for all methods below.
  // ----------------------------------------------------------
  constructor(page) {
    super(page); // Inherit BasePage's this.page

    // ============================================================
    // SECTION 1: CORE PRODUCT INFO LOCATORS
    // ============================================================

    // Product name heading.
    // Magento 2 always wraps the name in:  <h1 class="page-title"><span class="base">…</span></h1>
    // The span.base is more specific; the h1 itself is the fallback.
    this.productTitle = page.locator('h1.page-title span.base, h1.page-title');

    // Displayed price (e.g. "AED 49.00").
    // Lives inside .product-info-price on the right side of the PDP layout.
    // Configurable products may show multiple prices — we read the first one.
    this.productPrice = page.locator('.product-info-price .price');

    // SKU (Stock Keeping Unit) value, e.g. "HAL-DOVE-100G".
    // Three fallback selectors: Magento default class, common alternative,
    // and the microdata itemprop used by some custom themes.
    this.productSku = page.locator(
      '.product.attribute.sku .value, .sku .value, [itemprop="sku"]'
    );

    // Stock status text: either "In Stock" or "Out of Stock".
    // The span inside .stock.available or .stock.unavailable holds the text.
    this.stockStatus = page.locator(
      '.stock.available span, .stock.unavailable span'
    );

    // ============================================================
    // SECTION 2: ADD TO CART LOCATORS
    // ============================================================

    // The main "Add to Cart" button on the PDP.
    // id="product-addtocart-button" is the Magento 2 standard.
    // .first() prevents a strict-mode violation on pages where both the ID
    // button and a .action.tocart duplicate exist in the DOM at the same time.
    this.addToCartButton = page.locator(
      'button#product-addtocart-button, .product-info-main .action.tocart'
    ).first();

    // Quantity input (how many units to add).
    // id="qty" is the Magento 2 standard across all themes.
    this.qtyInput = page.locator('input#qty');

    // Green success toast message that appears after a successful add.
    // Both class names are used by different Magento / theme versions.
    this.successMessage = page.locator('.message-success, .message.success');

    // ============================================================
    // SECTION 3: GALLERY LOCATORS — Fotorama (Magento 2 default)
    // ============================================================
    //
    // How Fotorama is structured on a Magento 2 PDP:
    //
    //   .fotorama                       ← Gallery root (gets class 'fotorama--fullscreen' when in FS mode)
    //   └── .fotorama__stage            ← The large main-image area
    //       └── .fotorama__img          ← The <img> tag currently displayed
    //   └── .fotorama__nav--thumbs      ← Thumbnail strip beneath the stage
    //       └── .fotorama__nav__frame--thumb  ← One thumbnail per image
    //   └── .fotorama__fullscreen-icon  ← Fullscreen toggle (visible on hover)
    //   └── .fotorama__arr--next        ← Next-image arrow "›"
    //   └── .fotorama__arr--prev        ← Previous-image arrow "‹"

    // The large main-image area — hover here to reveal the fullscreen icon
    this.galleryStage = page.locator('.fotorama__stage');

    // The <img> element currently shown in the main stage
    this.galleryMainImage = page.locator('.fotorama__stage .fotorama__img');

    // Thumbnail nav frames — one per product image
    this.galleryThumbnails = page.locator('.fotorama__nav__frame--thumb');

    // Fullscreen toggle icon (top-right of stage, visible only on hover)
    // Clicking once enters fullscreen; clicking again exits it
    this.fullscreenIcon = page.locator('.fotorama__fullscreen-icon');

    // The gallery root in fullscreen mode.
    // Fotorama adds the class 'fotorama--fullscreen' to the gallery root
    // when fullscreen is active. We detect fullscreen by checking this element.
    this.fullscreenGallery = page.locator('.fotorama--fullscreen');

    // "›" arrow — advance to the next image in the gallery
    this.nextImageArrow = page.locator('.fotorama__arr--next');

    // "‹" arrow — go back to the previous image
    this.prevImageArrow = page.locator('.fotorama__arr--prev');

    // ============================================================
    // SECTION 4: SWATCH LOCATORS (configurable products only)
    // ============================================================
    //
    // Configurable products (e.g. a product available in multiple colours
    // and sizes) show one "swatch attribute group" per option type.
    //
    // Example for HAL UAE:
    //   Group 0: "Pack & Container Color"  → red, blue, green buttons
    //   Group 1: "Pack Size"               → 100g, 250g, 500g buttons
    //
    // Structure in the DOM:
    //   .swatch-opt                    ← wrapper for all swatch groups
    //   └── .swatch-attribute          ← ONE group (e.g. Pack & Container Color)
    //       ├── .swatch-attribute-label   ← the group heading text
    //       └── .swatch-option            ← individual selectable option
    //           (class 'selected' is added to the chosen option)
    //           (class 'disabled' marks out-of-stock combinations)

    // All swatch attribute groups on this PDP (count = 0 for simple products)
    this.swatchGroups = page.locator('.swatch-opt .swatch-attribute');

    // ============================================================
    // SECTION 5: PRODUCT TAB LOCATORS
    // ============================================================
    //
    // At the bottom of every Magento 2 PDP there are tabs:
    //   Details          → product short/long description
    //   More Information → extra attributes (weight, dimensions, etc.)
    //   Reviews          → customer reviews + "Write a Review" form
    //
    // In the Magento 2 Blank/Luma theme, these are rendered as a
    // collapsible accordion. Each tab section has:
    //   - A clickable trigger element (the <a> link) inside a [data-role="collapsible"]
    //   - A content panel div with a unique id (e.g. id="description")
    //
    // We use multiple selector fallbacks because different theme versions
    // assign different IDs and class names to these tab triggers.

    // "Details" tab trigger link (reveals the product description)
    this.detailsTabLink = page.locator(
      'a[href="#description"], ' +          // Standard Magento 2 Blank theme
      '#tab-label-description-title, ' +    // Luma theme variant
      '#tab-label-description'              // Alternative id format
    ).first();

    // "More Information" tab trigger link (reveals additional attributes)
    this.moreInfoTabLink = page.locator(
      'a[href="#additional"], ' +
      '#tab-label-additional-title, ' +
      '#tab-label-additional'
    ).first();

    // "Reviews" tab trigger link (reveals customer reviews)
    this.reviewsTabLink = page.locator(
      'a[href="#reviews"], ' +
      '#tab-label-reviews-summary-title, ' +
      '#tab-label-reviews-summary'
    ).first();

    // Content panels — each is visible when its tab is active/expanded
    this.detailsPanel  = page.locator('#description');   // Details content
    this.moreInfoPanel = page.locator('#additional');     // More Info content
    this.reviewsPanel  = page.locator('#reviews');        // Reviews content

    // ============================================================
    // SECTION 6: SOCIAL SHARE LOCATORS
    // ============================================================
    //
    // Magento 2 renders social/share links in .product-social-links.
    // Default Luma theme shows: "Add to Wishlist", "Add to Compare",
    // and an "Email" (Email a Friend) link.
    //
    // HAL UAE may include additional custom share buttons (e.g. WhatsApp,
    // copy-to-clipboard, etc.). We target the section broadly and use
    // .first() to click whichever link appears first.

    // The social links wrapper element
    this.socialLinksSection = page.locator('.product-social-links');

    // The first share-type link in the section.
    // Priority order: explicit mailto link → mailto action → mailto href → any link
    this.shareButton = page.locator(
      '.product-social-links a.mailto.link, ' +
      '.product-social-links .action.mailto, ' +
      '.product-social-links a[href*="mailto"], ' +
      '.product-social-links a[title*="Email" i], ' +
      '.product-social-links a'
    ).first();

    // Any modal/overlay that appears after clicking the share button.
    // Magento's modal system uses .modal-popup._show or .modals-overlay
    // for dialogs. Some themes use Fancybox (.fancybox-opened).
    this.shareModal = page.locator(
      '.modal-popup._show, ' +
      '.modal-popup.modal-slide._show, ' +
      '.fancybox-opened, ' +
      '.modals-overlay, ' +
      '[role="dialog"]'
    );

    // ============================================================
    // SECTION 7: CART COUNTER LOCATOR
    // ============================================================

    // Badge in the page header showing total item count ("1", "3", etc.)
    // This element is HIDDEN when the cart is empty; visible with a count
    // when at least one item has been added.
    this.cartCounter = page.locator(
      '.counter.qty .counter-number, .minicart-wrapper .counter-number'
    );
  }


  // ============================================================
  // 2. NAVIGATION METHODS
  // ============================================================

  // ----------------------------------------------------------
  // goto(url)
  // ----------
  // Navigates the browser to any full PDP URL.
  //
  // Why a full URL here instead of a path?
  //   PDPs don't have a single fixed path like the PLP does.
  //   Callers discover the URL by scraping the PLP and pass it in.
  //
  // Uses 'domcontentloaded' (not 'load') because the staging server
  // has slow background resources that would block the 'load' event.
  // Product title, price, and gallery images are all in the initial HTML.
  // ----------------------------------------------------------
  async goto(url) {
    // Open the given URL in the browser tab
    await this.page.goto(url);

    // Wait for the DOM to be parsed and all initial elements to be accessible
    await this.waitForPageLoad(); // uses 'domcontentloaded' from BasePage
  }


  // ============================================================
  // 3. CORE PRODUCT INFO METHODS
  // ============================================================

  // ----------------------------------------------------------
  // getProductTitle()
  // ------------------
  // Returns the product name string from the h1 heading.
  //
  // Example return: "HAL Dove Beauty Cream Bar 100g"
  // ----------------------------------------------------------
  async getProductTitle() {
    // Wait up to 10 s — the h1 is always in the server-rendered HTML
    await this.productTitle.first().waitFor({ state: 'visible', timeout: 10000 });

    // Read and strip surrounding whitespace
    return (await this.productTitle.first().textContent()).trim();
  }

  // ----------------------------------------------------------
  // getProductPrice()
  // ------------------
  // Returns the first displayed price string (e.g. "AED 49.00").
  //
  // For configurable products before a variant is selected, Magento
  // may show a "From AED X" price — this method returns that first price.
  // ----------------------------------------------------------
  async getProductPrice() {
    // Price rendering is part of the initial HTML on most Magento setups
    await this.productPrice.first().waitFor({ state: 'visible', timeout: 10000 });

    return (await this.productPrice.first().textContent()).trim();
  }

  // ----------------------------------------------------------
  // getProductSku()
  // ----------------
  // Returns the SKU string if it is displayed, e.g. "HAL-12345-100G".
  // Returns null if the SKU is hidden or absent on this PDP.
  // ----------------------------------------------------------
  async getProductSku() {
    try {
      await this.productSku.first().waitFor({ state: 'visible', timeout: 5000 });
      return (await this.productSku.first().textContent()).trim();
    } catch {
      // SKU not found — some themes or products hide it, non-fatal
      return null;
    }
  }

  // ----------------------------------------------------------
  // isAddToCartButtonVisible()
  // ---------------------------
  // Returns true if the "Add to Cart" button exists and is visible.
  //
  // Out-of-stock products replace the button with a "Notify Me" form,
  // so this check also confirms the product is purchasable.
  // ----------------------------------------------------------
  async isAddToCartButtonVisible() {
    try {
      await this.addToCartButton.waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // isStockStatusVisible()
  // -----------------------
  // Returns true if any stock status indicator is shown on the PDP.
  // ----------------------------------------------------------
  async isStockStatusVisible() {
    try {
      await this.stockStatus.first().waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }


  // ============================================================
  // 4. GALLERY METHODS
  // ============================================================

  // ----------------------------------------------------------
  // isMainImageVisible()
  // ---------------------
  // Returns true if the Fotorama main stage image has loaded and
  // is visible on screen.
  //
  // Fotorama initialises asynchronously after DOM ready, so we
  // wait up to 10 seconds for the first <img> to appear.
  // ----------------------------------------------------------
  async isMainImageVisible() {
    try {
      await this.galleryMainImage.first().waitFor({ state: 'visible', timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // getThumbnailCount()
  // --------------------
  // Returns the number of thumbnail frames in the gallery nav strip.
  //
  // A value of 0 means the product has only one image (no strip shown).
  // A value > 1 means multiple images can be scrolled through.
  // ----------------------------------------------------------
  async getThumbnailCount() {
    try {
      // Thumbnails appear after Fotorama fully initialises
      await this.galleryThumbnails.first().waitFor({ state: 'visible', timeout: 5000 });
      return await this.galleryThumbnails.count();
    } catch {
      // No thumbnails visible — single-image product
      return 0;
    }
  }

  // ----------------------------------------------------------
  // openFullscreenGallery()
  // ------------------------
  // Enters fullscreen mode for the Fotorama image gallery.
  //
  // HOW FOTORAMA FULLSCREEN WORKS:
  //   1. Hover over the main stage — Fotorama shows the fullscreen icon
  //   2. Click the icon — Fotorama applies class 'fotorama--fullscreen'
  //      to the gallery root, which fills the entire viewport
  //
  // After calling this method, call isFullscreenGalleryOpen() to verify.
  // ----------------------------------------------------------
  async openFullscreenGallery() {
    // Step 1: Wait for the full 'load' event so Fotorama's JS has run and
    // registered its hover listeners. Without this, hovering the stage does
    // nothing because Fotorama initialises after 'load', not 'domcontentloaded'.
    await this.page.waitForLoadState('load');

    // Step 2: Ensure the gallery stage exists and is ready
    await this.galleryStage.waitFor({ state: 'visible', timeout: 10000 });

    // Step 3: Call Fotorama's JS API directly via jQuery (available on all Magento pages).
    // The fullscreen icon is CSS-hidden and Playwright cannot click it reliably in
    // headless mode — requestFullScreen() is the authoritative way to trigger it.
    await this.page.evaluate(() => {
      var api = window.jQuery && window.jQuery('.fotorama').data('fotorama');
      if (api) api.requestFullScreen();
    });

    // Step 4: Wait for Fotorama to apply the fullscreen CSS class
    await this.fullscreenGallery.waitFor({ state: 'visible', timeout: 5000 });
  }

  // ----------------------------------------------------------
  // isFullscreenGalleryOpen()
  // --------------------------
  // Returns true if the gallery is currently in fullscreen mode.
  //
  // Fotorama signals this by adding 'fotorama--fullscreen' class
  // to the gallery root element when fullscreen is active.
  // ----------------------------------------------------------
  async isFullscreenGalleryOpen() {
    try {
      await this.fullscreenGallery.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // navigateToNextImage()
  // ----------------------
  // Clicks the "›" arrow to advance to the next gallery image.
  // Works in both normal view and fullscreen mode.
  //
  // Returns true if the arrow was found and clicked.
  // Returns false if no next arrow exists (single-image product).
  // ----------------------------------------------------------
  async navigateToNextImage() {
    try {
      // Arrow is only present when there are multiple images
      await this.nextImageArrow.waitFor({ state: 'visible', timeout: 5000 });
      await this.nextImageArrow.click();

      // Wait for Fotorama's slide transition animation to finish
      await this.page.waitForTimeout(600);
      return true;
    } catch {
      console.log('Next arrow not found — product may have only one image');
      return false;
    }
  }

  // ----------------------------------------------------------
  // navigateToPreviousImage()
  // --------------------------
  // Clicks the "‹" arrow to go back to the previous gallery image.
  //
  // Returns true if clicked, false if no arrow found.
  // ----------------------------------------------------------
  async navigateToPreviousImage() {
    try {
      await this.prevImageArrow.waitFor({ state: 'visible', timeout: 5000 });
      await this.prevImageArrow.click();

      // Wait for Fotorama's slide transition animation
      await this.page.waitForTimeout(600);
      return true;
    } catch {
      console.log('Previous arrow not found');
      return false;
    }
  }

  // ----------------------------------------------------------
  // closeFullscreenGallery()
  // -------------------------
  // Exits fullscreen mode by pressing the Escape key.
  //
  // WHY ESCAPE?
  //   Fotorama listens for the Escape keydown event and exits
  //   fullscreen when it fires. Pressing Escape is the most
  //   reliable way to close it — more reliable than clicking
  //   the toggle icon again (which can be obscured by the image).
  //
  // After this call, the gallery returns to its normal embedded state.
  // ----------------------------------------------------------
  async closeFullscreenGallery() {
    // Fire the Escape key — Fotorama handles this natively
    await this.page.keyboard.press('Escape');

    // Brief wait for Fotorama to remove the fullscreen class and reflow
    await this.page.waitForTimeout(600);
  }


  // ============================================================
  // 5. SWATCH METHODS (configurable products)
  // ============================================================

  // ----------------------------------------------------------
  // getSwatchGroupCount()
  // ----------------------
  // Returns the number of swatch attribute groups on this PDP.
  //
  // Return values:
  //   0 → simple product (no colour/size options needed)
  //   1 → configurable with one option type (e.g. only Size)
  //   2 → configurable with two option types (e.g. Color + Size)
  // ----------------------------------------------------------
  async getSwatchGroupCount() {
    try {
      // Wait briefly — swatches render as part of the initial HTML
      await this.swatchGroups.first().waitFor({ state: 'visible', timeout: 4000 });
      return await this.swatchGroups.count();
    } catch {
      // No swatch groups found — this is a simple product
      return 0;
    }
  }

  // ----------------------------------------------------------
  // getSwatchGroupLabels()
  // -----------------------
  // Returns an array of the label text for each swatch attribute group.
  //
  // Example: ['Pack & Container Color', 'Pack Size']
  // Returns [] for simple products (no swatch groups).
  // ----------------------------------------------------------
  async getSwatchGroupLabels() {
    const count = await this.getSwatchGroupCount();
    if (count === 0) return []; // No groups — nothing to collect

    const labels = [];
    for (let i = 0; i < count; i++) {
      // The label heading is in .swatch-attribute-label inside each group
      const labelEl = this.swatchGroups.nth(i).locator('.swatch-attribute-label');

      // Use .catch('') so a missing label doesn't throw — just becomes empty string
      const text = await labelEl.textContent().catch(() => '');
      labels.push(text.trim());
    }
    return labels;
  }

  // ----------------------------------------------------------
  // selectSwatchOption(groupIndex, optionIndex)
  // --------------------------------------------
  // Clicks a swatch option button at the given position.
  //
  // groupIndex  → which attribute group (0 = first group)
  // optionIndex → which option within that group (0 = first option)
  //
  // Only considers non-disabled options (disabled = out-of-stock variant).
  // Waits 500 ms after clicking for Magento to update price and MOQ.
  // ----------------------------------------------------------
  async selectSwatchOption(groupIndex, optionIndex) {
    // Target the swatch attribute group at groupIndex
    const group = this.swatchGroups.nth(groupIndex);

    // Get all selectable (non-disabled) option buttons within this group
    const availableOptions = group.locator('.swatch-option:not(.disabled)');

    // Wait for options to be visible before clicking
    await availableOptions.first().waitFor({ state: 'visible', timeout: 5000 });

    // Click the option at the given index
    await availableOptions.nth(optionIndex).click();

    // Magento re-calculates price/availability after each swatch selection —
    // wait briefly to let that update complete before the next interaction
    await this.page.waitForTimeout(500);
  }

  // ----------------------------------------------------------
  // isSwatchOptionSelected(groupIndex, optionIndex)
  // ------------------------------------------------
  // Returns true if the swatch button at the given position is selected.
  //
  // Uses the same NON-DISABLED option pool as selectSwatchOption so
  // indices always refer to the same element. After a color is chosen,
  // some Pack Size options become disabled — checking index 0 of all
  // options would land on a different button than the one we clicked.
  // ----------------------------------------------------------
  async isSwatchOptionSelected(groupIndex, optionIndex) {
    const group = this.swatchGroups.nth(groupIndex);

    // Same non-disabled pool that selectSwatchOption uses — keeps indices consistent
    const option = group.locator('.swatch-option:not(.disabled)').nth(optionIndex);

    // Read the full class attribute string
    const classes = await option.getAttribute('class').catch(() => '');

    // The 'selected' class is added to the active swatch by Magento's JS
    return classes.includes('selected');
  }

  // ----------------------------------------------------------
  // selectAllFirstSwatchOptions()
  // ------------------------------
  // Auto-selects the FIRST available option in EVERY swatch group.
  //
  // Use this when you want to make a configurable product "ready
  // to add to cart" without knowing the specific option names.
  //
  // On simple products (no swatches), this method does nothing.
  // ----------------------------------------------------------
  async selectAllFirstSwatchOptions() {
    const count = await this.getSwatchGroupCount();

    for (let i = 0; i < count; i++) {
      const group = this.swatchGroups.nth(i);

      // Find the first non-disabled swatch option in this group.
      // After selecting group 0 (color), Magento re-renders group 1 (size) —
      // wait up to 5 s for the first non-disabled option to actually be visible
      // rather than doing an instant isVisible() that can race the DOM update.
      const firstOption = group.locator('.swatch-option:not(.disabled)').first();
      try {
        await firstOption.waitFor({ state: 'visible', timeout: 5000 });
      } catch {
        console.log(`selectAllFirstSwatchOptions: group ${i} first option not visible — skipping`);
        continue;
      }

      await firstOption.click();

      // Wait for Magento's Knockout.js to finish re-rendering after each click.
      // 1500 ms covers price update + next group's option availability refresh.
      await this.page.waitForTimeout(1500);
    }
  }


  // ============================================================
  // 6. MOQ AND QUANTITY METHODS
  // ============================================================

  // ----------------------------------------------------------
  // getMOQ()
  // ---------
  // Reads the Minimum Order Quantity (MOQ) from the badge on the PDP.
  //
  // The HAL UAE site shows a badge like:  "MOQ (5 Unit)" or "MOQ (4 Pack)" or "MOQ (10 Piece)"
  // This method finds that text anywhere on the page, extracts
  // the number, and returns it as an integer.
  //
  // Returns 1 if:
  //   - No MOQ badge is found (no minimum enforced)
  //   - The badge text cannot be parsed
  //
  // Always call this BEFORE clicking Add to Cart and set the qty
  // input to the returned value to satisfy the minimum requirement.
  // ----------------------------------------------------------
  async getMOQ() {
    // Match MOQ badges regardless of unit word: "MOQ (4 Unit)", "MOQ (4 Pack)", "MOQ (10 Piece)", etc.
    // The product page shows "Quantity: MOQ (4 Pack)" — the word after the number varies by product.
    const moqEl = this.page.getByText(/MOQ \(\d+/i).first();
    try {
      await moqEl.waitFor({ state: 'visible', timeout: 5000 });
      const text = await moqEl.textContent();

      // Extract the FIRST integer from the text (the MOQ number)
      // e.g. "MOQ (5 Unit)" → match[0] = "5" → parseInt = 5
      const match = text.match(/\d+/);
      return match ? parseInt(match[0], 10) : 1;
    } catch {
      // Badge not found — no minimum order quantity for this product
      return 1;
    }
  }

  // ----------------------------------------------------------
  // getQuantity()
  // --------------
  // Reads the current value from the qty input field.
  //
  // Returns the number (e.g. 1, 5, 10).
  // Returns 1 if the input is not found on the page.
  // ----------------------------------------------------------
  async getQuantity() {
    try {
      await this.qtyInput.waitFor({ state: 'visible', timeout: 5000 });

      // inputValue() reads the actual <input> value, not visible text
      const val = await this.qtyInput.inputValue();
      return parseInt(val, 10) || 1; // fallback to 1 if parse fails
    } catch {
      return 1; // Qty input not present — default 1
    }
  }

  // ----------------------------------------------------------
  // setQuantity(qty)
  // -----------------
  // Clears the qty input field and types the given quantity.
  //
  // fill() is Playwright's way to:
  //   1. Focus the field
  //   2. Select all existing text
  //   3. Type the new value
  //
  // Always call this before clickAddToCart() when MOQ > 1.
  // ----------------------------------------------------------
  async setQuantity(qty) {
    // Wait for the qty input to be interactive
    await this.qtyInput.waitFor({ state: 'visible', timeout: 5000 });

    // Clear and set the new quantity
    await this.qtyInput.fill(String(qty));
  }


  // ============================================================
  // 7. ADD TO CART METHODS
  // ============================================================

  // ----------------------------------------------------------
  // clickAddToCart()
  // -----------------
  // Clicks the PDP "Add to Cart" button.
  //
  // CRITICAL: We MUST wait for the full 'load' event before clicking.
  //
  // WHY?
  //   Magento 2 uses Knockout.js to bind the Add to Cart form.
  //   The Knockout bindings are applied AFTER 'load' fires.
  //   Clicking before 'load' = the button exists in the DOM but
  //   the click handler is not yet attached → click does nothing.
  //
  // For configurable products: select all swatch options FIRST,
  // then call this method. The button is disabled until all options
  // are chosen.
  // ----------------------------------------------------------
  async clickAddToCart() {
    // Wait for Knockout bindings to be attached (requires full 'load' event)
    await this.page.waitForLoadState('load');

    // Wait for the button to be visible
    await this.addToCartButton.waitFor({ state: 'visible', timeout: 10000 });

    // For configurable products Magento keeps the button disabled until ALL
    // swatch options are selected. Wait for the disabled attribute to clear
    // before clicking; otherwise the click silently does nothing.
    await this.page.waitForFunction(() => {
      const btn = document.querySelector('button#product-addtocart-button');
      return btn && !btn.disabled;
    }, { timeout: 10000 });

    // Click the button to submit the add-to-cart form
    await this.addToCartButton.click();
  }

  // ----------------------------------------------------------
  // isSuccessMessageVisible()
  // --------------------------
  // Returns true if the green "Added to cart" toast appears within
  // 15 seconds of clicking Add to Cart.
  //
  // Returns false if the toast never shows — this can happen when:
  //   - A required swatch option was not selected
  //   - The product has a custom error condition
  //   - The AJAX call timed out on the slow staging server
  //
  // 15-second timeout accounts for the HAL UAE staging server AJAX delay.
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
  // addToCartWithMOQ()
  // -------------------
  // Full "safe" add-to-cart sequence that handles MOQ automatically:
  //
  //   Step 1: Read the MOQ badge (defaults to 1 if not found)
  //   Step 2: Set the qty input to that MOQ value
  //   Step 3: Click "Add to Cart"
  //   Step 4: Wait for success toast
  //   Step 5: Return { success, qty }
  //
  // This is the recommended way to add from a PDP when you don't
  // know the MOQ ahead of time — it prevents "Insufficient Qty" errors.
  //
  // Returns:
  //   { success: true,  qty: 5 }  → toast appeared, 5 items were added
  //   { success: false, qty: 1 }  → no toast, qty was 1 (no MOQ badge)
  // ----------------------------------------------------------
  async addToCartWithMOQ() {
    // Read the MOQ badge (or default to 1)
    const moq = await this.getMOQ();
    console.log('MOQ detected:', moq);

    // If MOQ is greater than 1, update the qty input field
    if (moq > 1) {
      try {
        await this.setQuantity(moq);
        console.log('Qty input set to MOQ:', moq);
      } catch {
        // If qty input is not accessible, proceed and hope the default is ok
        console.log('Could not set qty input — proceeding with current value');
      }
    }

    // Click the Add to Cart button (waits for 'load' internally)
    await this.clickAddToCart();

    // Check if the success toast appeared
    const success = await this.isSuccessMessageVisible();
    return { success, qty: moq };
  }


  // ============================================================
  // 8. CONTENT TAB METHODS
  // ============================================================

  // ----------------------------------------------------------
  // clickDetailsTab()
  // ------------------
  // Clicks the "Details" tab at the bottom of the PDP.
  //
  // In Magento 2, the "Details" tab reveals the product's
  // short description and/or long description content.
  //
  // If the tab is already expanded (default state), clicking it
  // again collapses it. After clicking, call isDetailsPanelVisible().
  // ----------------------------------------------------------
  async clickDetailsTab() {
    // Wait for the tab trigger link to appear in the DOM
    await this.detailsTabLink.waitFor({ state: 'visible', timeout: 10000 });

    // Click the tab trigger
    await this.detailsTabLink.click();

    // Wait for the accordion animation (Magento animates the open/close)
    await this.page.waitForTimeout(500);
  }

  // ----------------------------------------------------------
  // clickMoreInfoTab()
  // -------------------
  // Clicks the "More Information" tab.
  //
  // This tab reveals additional product attributes stored in Magento's
  // EAV (Entity-Attribute-Value) system — things like weight,
  // dimensions, material, country of origin, etc.
  // ----------------------------------------------------------
  async clickMoreInfoTab() {
    await this.moreInfoTabLink.waitFor({ state: 'visible', timeout: 10000 });
    await this.moreInfoTabLink.click();
    await this.page.waitForTimeout(500);
  }

  // ----------------------------------------------------------
  // clickReviewsTab()
  // ------------------
  // Clicks the "Reviews" tab.
  //
  // This tab reveals customer reviews (if any exist for this product)
  // and the "Write a Review" form. For guest users, the form is still
  // visible (reviews may be submitted without logging in on some stores).
  // ----------------------------------------------------------
  async clickReviewsTab() {
    await this.reviewsTabLink.waitFor({ state: 'visible', timeout: 10000 });
    await this.reviewsTabLink.click();
    await this.page.waitForTimeout(500);
  }

  // ----------------------------------------------------------
  // isDetailsPanelVisible()
  // ------------------------
  // Returns true if the Details content panel (#description) is
  // currently visible (tab is expanded/active).
  // ----------------------------------------------------------
  async isDetailsPanelVisible() {
    try {
      await this.detailsPanel.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // isMoreInfoPanelVisible()
  // -------------------------
  // Returns true if the More Information content panel (#additional)
  // is currently visible.
  // ----------------------------------------------------------
  async isMoreInfoPanelVisible() {
    try {
      await this.moreInfoPanel.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // isReviewsPanelVisible()
  // ------------------------
  // Returns true if the Reviews content panel (#reviews) is visible.
  // Note: the panel may be empty (no reviews yet) but still visible.
  // ----------------------------------------------------------
  async isReviewsPanelVisible() {
    try {
      await this.reviewsPanel.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }


  // ============================================================
  // 9. SOCIAL SHARE METHODS
  // ============================================================

  // ----------------------------------------------------------
  // isSocialLinksSectionVisible()
  // ------------------------------
  // Returns true if the .product-social-links area exists and is visible.
  // Some products or custom themes may omit this section entirely.
  // ----------------------------------------------------------
  async isSocialLinksSectionVisible() {
    try {
      await this.socialLinksSection.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  // ----------------------------------------------------------
  // clickShareButton()
  // -------------------
  // Clicks the first link in the .product-social-links area.
  //
  // On a Magento 2 Luma store this is typically the "Email a Friend"
  // link. On HAL UAE it may be a custom share popup button.
  //
  // For GUEST USERS: Magento may either:
  //   (a) Open a login modal (not logged in) — we detect this
  //   (b) Open the email-friend modal form — we detect this
  //   (c) Redirect to a share page — we detect the URL change
  //
  // Returns true if the button was found and clicked, false if not.
  // ----------------------------------------------------------
  async clickShareButton() {
    try {
      await this.shareButton.waitFor({ state: 'visible', timeout: 5000 });
      await this.shareButton.click();

      // Wait briefly for any popup/modal to animate into view
      await this.page.waitForTimeout(1000);
      return true;
    } catch {
      console.log('Share button not found in .product-social-links');
      return false;
    }
  }

  // ----------------------------------------------------------
  // isSharePopupVisible()
  // ----------------------
  // Returns true if a popup, modal, or share-page appeared after
  // clicking the share button.
  //
  // Checks two scenarios:
  //   A) A Magento modal overlay is visible in the DOM
  //   B) The URL changed to a share/email/login page
  //      (acceptable for guest users being redirected to login)
  // ----------------------------------------------------------
  async isSharePopupVisible() {
    try {
      // Scenario A: A modal/dialog element appeared on the same page
      await this.shareModal.waitFor({ state: 'visible', timeout: 5000 });
      console.log('Share modal detected in DOM');
      return true;
    } catch {
      // Scenario B: Check if the URL changed (navigated to share/email page)
      const currentUrl = this.page.url();
      const isShareOrLoginPage = /send(friend|email)|share|email|customer\/account\/login/i.test(currentUrl);

      if (isShareOrLoginPage) {
        console.log('Share action navigated to URL:', currentUrl);
        return true;
      }

      return false;
    }
  }


  // ============================================================
  // 10. CART COUNTER METHODS
  // ============================================================

  // ----------------------------------------------------------
  // getCartCounterText()
  // ---------------------
  // Returns the text shown in the cart badge in the header.
  //
  // When items are in the cart the badge shows the total count.
  // When the cart is empty Magento HIDES the badge completely.
  //
  // Returns:
  //   "3"  → cart has 3 items
  //   "0"  → cart is empty (badge is hidden)
  //
  // The cart badge updates via AJAX after Add to Cart — we wait
  // up to 8 seconds for the badge to appear and show the new count.
  // ----------------------------------------------------------
  async getCartCounterText() {
    try {
      await this.cartCounter.waitFor({ state: 'visible', timeout: 8000 });
      return (await this.cartCounter.textContent()).trim();
    } catch {
      // Badge is hidden — cart is empty
      return '0';
    }
  }
}

// Export so the test file can import:
//   const { PDPPage } = require('../pages/PDPPage');
module.exports = { PDPPage };
