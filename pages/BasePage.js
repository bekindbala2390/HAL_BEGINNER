// ============================================================
// pages/BasePage.js
//
// What is a BasePage?
// -------------------
// When you automate multiple pages of a website, they often
// share common actions: go to a URL, wait for the page to load,
// take a screenshot, etc.
//
// Instead of writing the same code in every page file, we put
// those shared actions here in ONE place called BasePage.
//
// All other page files (HomePage, LoginPage, etc.) will
// "extend" (inherit from) this BasePage, so they automatically
// get all these shared methods for free.
// ============================================================

class BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // -----------------
  // This is called automatically when you create a new page
  // object, e.g.:  const homePage = new HomePage(page)
  //
  // The 'page' parameter is the Playwright browser page object.
  // We store it as 'this.page' so all methods in this class
  // (and child classes) can use it.
  // ----------------------------------------------------------
  constructor(page) {
    this.page = page; // Store the Playwright page for later use
  }

  // ----------------------------------------------------------
  // navigate(path)
  // ---------------
  // Opens a URL in the browser.
  //
  // The path is added to the baseURL from playwright.config.js
  // Example: navigate('/') opens https://mcstaging2.hal-uae.com/
  // Example: navigate('/about') opens the /about page
  // ----------------------------------------------------------
  async navigate(path) {
    await this.page.goto(path);
  }

  // ----------------------------------------------------------
  // waitForPageLoad()
  // ------------------
  // Waits until the page has finished loading completely.
  // 'networkidle' means: wait until there are no more network
  // requests for at least 500ms (the page is "quiet").
  //
  // Use this after navigation when the page has lots of images
  // or data that loads in the background.
  // ----------------------------------------------------------
  async waitForPageLoad() {
    // 'domcontentloaded' fires as soon as HTML is parsed and the DOM is ready.
    // We use this instead of 'load' or 'networkidle' because some pages
    // (category pages, PDPs on the staging server) have hanging resources
    // that prevent the 'load' event from ever firing within the test timeout.
    // The elements we test (nav, footer, products, URLs) are all present in
    // the initial HTML, so 'domcontentloaded' is sufficient for our checks.
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ----------------------------------------------------------
  // getPageTitle()
  // ---------------
  // Returns the title of the current page (the text shown
  // in the browser tab).
  //
  // Example: "HAL | Home" or "HAL | Products"
  // ----------------------------------------------------------
  async getPageTitle() {
    return await this.page.title();
  }

  // ----------------------------------------------------------
  // takeScreenshot(fileName)
  // -------------------------
  // Takes a screenshot of the entire page and saves it as a
  // .png file inside the 'screenshots' folder.
  //
  // fullPage: true means it captures the ENTIRE page,
  // not just the visible part.
  //
  // Example: takeScreenshot('homepage') saves 'homepage.png'
  // ----------------------------------------------------------
  async takeScreenshot(fileName) {
    await this.page.screenshot({
      path: `screenshots/${fileName}.png`,
      fullPage: true,
    });
  }

}

// ----------------------------------------------------------
// module.exports
// ---------------
// This line makes the BasePage class available so other files
// can import it using:  const { BasePage } = require('./BasePage')
// ----------------------------------------------------------
module.exports = { BasePage };
