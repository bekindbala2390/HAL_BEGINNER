// ============================================================
// pages/AuthPage.js
//
// What is this file?
// -------------------
// Page Object for the HAL UAE Authentication flow.
//
// HAL UAE uses Auth0 (hal-uae.eu.auth0.com) for login.
// The login flow works like this:
//
//   Step 1: Visit the HAL UAE login page
//           → Magento's Auth0 module redirects the browser to Auth0
//
//   Step 2: On Auth0, enter an email address and click "Continue"
//           → Auth0 sends a 6-digit One-Time Password (OTP) to that email
//           → The browser shows the OTP entry page
//           → We SAVE that page URL (it contains an auth state token)
//
//   Step 3: (Handled by MailinatorPage) Navigate to mailinator.com
//           in the SAME browser tab to read the OTP from the inbox
//
//   Step 4: Navigate BACK to the saved Auth0 OTP URL
//           → Auth0 recognises the session from cookies (same browser context)
//           → Enter the OTP and submit
//           → Auth0 redirects back to mcstaging2.hal-uae.com
//           → The Magento session is created; user is logged in
//
// WHY SAVE THE OTP URL INSTEAD OF USING TWO BROWSER TABS?
//   Using two separate browser.newPage() calls creates two isolated contexts.
//   Playwright can close those extra contexts unexpectedly during long hooks.
//   Using a SINGLE page and saving/restoring the Auth0 URL is more reliable:
//   Auth0 cookies survive navigation to another site in the same context,
//   so the OTP state is still valid when we come back.
// ============================================================

const { BasePage } = require('./BasePage');

class AuthPage extends BasePage {

  // ----------------------------------------------------------
  // constructor(page)
  // ----------------------------------------------------------
  constructor(page) {
    super(page);

    // ============================================================
    // AUTH0 LOCATORS
    // ============================================================

    // Email input on the Auth0 "Enter your email" step.
    // Auth0 Universal Login labels the email field with id="username".
    this.emailInput = page.locator('#username, input[name="username"]').first();

    // "Continue" button on the Auth0 email-entry step.
    this.continueButton = page.locator('button[type="submit"]').first();

    // OTP input shown after Auth0 sends the email.
    // Auth0 passwordless mode uses a single text input for the 6-digit code.
    this.otpInput = page.locator(
      'input[name="code"], ' +
      'input[autocomplete="one-time-code"], ' +
      'input[inputmode="numeric"]'
    ).first();

    // Submit button after typing the OTP (reuses the same selector as Continue)
    this.otpSubmitButton = page.locator('button[type="submit"]').first();

    // ============================================================
    // STATE
    // ============================================================

    // Stores the Auth0 OTP challenge page URL after enterEmailAndSubmit().
    // We navigate BACK to this URL after reading OTP from mailinator.
    this.otpPageUrl = null;

    // ============================================================
    // LOGGED-IN INDICATORS (on mcstaging2.hal-uae.com)
    // ============================================================

    // Magento 2 adds "logged-in" CSS class to <body> for authenticated customers.
    this.loggedInIndicator = page.locator(
      'body.logged-in, ' +
      '.header.content .customer-name, ' +
      'a[href*="customer/account/logout"]'
    ).first();
  }


  // ----------------------------------------------------------
  // navigateToLogin()
  // ------------------
  // Starts the Auth0 login flow by visiting the HAL UAE customer
  // account login page.  The Magento Auth0 module redirects
  // the browser to hal-uae.eu.auth0.com automatically.
  // ----------------------------------------------------------
  async navigateToLogin() {
    console.log('AuthPage.navigateToLogin — visiting HAL UAE login page');
    await this.page.goto('https://mcstaging2.hal-uae.com/customer/account/login/');
    await this.page.waitForLoadState('domcontentloaded');

    const currentUrl = this.page.url();
    console.log('AuthPage.navigateToLogin — landed on:', currentUrl);

    // If the redirect didn't happen automatically (some theme configs show
    // a Magento login page first), look for and click an Auth0 SSO button
    if (!currentUrl.includes('auth0.com')) {
      console.log('AuthPage.navigateToLogin — not on Auth0 yet, looking for SSO button');

      const ssoButton = this.page.locator(
        'a[href*="auth0"], a[href*="social"], .action.login.primary, button.btn-social'
      ).first();

      try {
        await ssoButton.waitFor({ state: 'visible', timeout: 6000 });
        await ssoButton.click();
        await this.page.waitForURL('**/auth0.com/**', { timeout: 15000 });
      } catch {
        console.log('AuthPage.navigateToLogin — SSO button not found; continuing');
      }
    }
  }


  // ----------------------------------------------------------
  // enterEmailAndSubmit(email)
  // ---------------------------
  // Types the test email into the Auth0 email field and clicks
  // "Continue" to request the OTP.
  //
  // IMPORTANT: After this method, we save the URL of the OTP
  // challenge page (this.otpPageUrl).  You MUST call
  // navigateBackToOTPPage() before enterOTPAndSubmit() if you
  // navigate away from Auth0 in between (e.g. to mailinator).
  // ----------------------------------------------------------
  async enterEmailAndSubmit(email) {
    await this.emailInput.waitFor({ state: 'visible', timeout: 20000 });

    console.log('AuthPage.enterEmailAndSubmit — entering email:', email);
    await this.emailInput.fill(email);
    await this.continueButton.click();

    // Give Auth0 time to process and show the OTP entry form
    await this.page.waitForTimeout(3000);

    // Save the OTP challenge page URL.
    // This URL contains Auth0's state parameter, e.g.:
    //   /u/login/passwordless-email-challenge?state=hKFo2S...
    // We navigate back here after reading the OTP from mailinator.
    this.otpPageUrl = this.page.url();
    console.log('AuthPage.enterEmailAndSubmit — OTP challenge URL saved:', this.otpPageUrl);
  }


  // ----------------------------------------------------------
  // navigateBackToOTPPage()
  // ------------------------
  // Returns the browser to the Auth0 OTP entry form.
  //
  // Call this AFTER reading the OTP from mailinator (which
  // navigates the page away from Auth0), and BEFORE calling
  // enterOTPAndSubmit().
  //
  // WHY THIS WORKS:
  //   Auth0 stores the login session in auth0.com cookies.
  //   Navigating away to mailinator.com does NOT delete these
  //   cookies (they are scoped to auth0.com).  When we navigate
  //   back to the saved Auth0 URL, the cookies are sent and
  //   Auth0 recognises the ongoing passwordless session.
  // ----------------------------------------------------------
  async navigateBackToOTPPage() {
    if (!this.otpPageUrl) {
      throw new Error('AuthPage.navigateBackToOTPPage: OTP URL not saved. Call enterEmailAndSubmit() first.');
    }

    console.log('AuthPage.navigateBackToOTPPage — returning to:', this.otpPageUrl);
    await this.page.goto(this.otpPageUrl);
    await this.page.waitForLoadState('domcontentloaded');

    // Confirm we are back on the OTP entry page
    console.log('AuthPage.navigateBackToOTPPage — current URL:', this.page.url());
  }


  // ----------------------------------------------------------
  // enterOTPAndSubmit(otp)
  // -----------------------
  // Types the 6-digit OTP and submits.
  // After success, Auth0 redirects back to mcstaging2.hal-uae.com.
  //
  // NOTE: The browser must be on the Auth0 OTP page when this
  // is called.  If you navigated away (to mailinator), call
  // navigateBackToOTPPage() first.
  // ----------------------------------------------------------
  async enterOTPAndSubmit(otp) {
    await this.otpInput.waitFor({ state: 'visible', timeout: 15000 });

    console.log('AuthPage.enterOTPAndSubmit — entering OTP:', otp);
    await this.otpInput.fill(otp);
    await this.otpSubmitButton.click();

    // Wait for Auth0 to validate and redirect back to HAL UAE
    await this.page.waitForURL('**/mcstaging2.hal-uae.com/**', { timeout: 45000 });
    console.log('AuthPage.enterOTPAndSubmit — redirected to:', this.page.url());
  }


  // ----------------------------------------------------------
  // isLoggedIn()
  // -------------
  // Returns true if the user is currently logged in on HAL UAE.
  // ----------------------------------------------------------
  async isLoggedIn() {
    const url = this.page.url();
    if (!url.includes('mcstaging2.hal-uae.com')) {
      console.log('AuthPage.isLoggedIn — not on HAL UAE, URL:', url);
      return false;
    }

    try {
      await this.loggedInIndicator.waitFor({ state: 'attached', timeout: 8000 });
      console.log('AuthPage.isLoggedIn — logged-in indicator found');
      return true;
    } catch {
      console.log('AuthPage.isLoggedIn — no logged-in indicator found');
      return false;
    }
  }
}

module.exports = { AuthPage };
