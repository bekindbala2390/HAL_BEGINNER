// ============================================================
// pages/GmailPage.js
//
// What is this file?
// -------------------
// Page Object for reading OTP emails from a real Gmail inbox.
//
// WHY DO WE NEED THIS?
//   If a real Gmail account is used for login and Auth0 sends the OTP
//   to that Gmail inbox, this file navigates the browser TO Gmail,
//   finds the email, and reads the 6-digit code from it.
//   NOTE: The cart tests now use sprint@mailinator.com instead.
//   This file is kept in case a Gmail-based login is needed in future.
//
// HOW IT WORKS (step by step):
//   1. openGmail(email)        → navigate to mail.google.com
//                                 (handles login if needed)
//   2. waitForOTPEmail()       → poll the inbox until the Auth0
//                                 email appears
//   3. getOTPFromLatestEmail() → click the email, read the body,
//                                 and extract the 6-digit code
//
// CREDENTIALS:
//   Gmail password must be set via environment variable before running:
//     PowerShell: $env:GMAIL_PASSWORD = "your-password"
//
// MOCK OTP (skip Gmail entirely — fastest for re-runs):
//   PowerShell: $env:MOCK_OTP = "123456"
//   Then run:   npx playwright test tests/cart.spec.js --headed
//   Use this after you've retrieved an OTP once.
//   (Auth0 OTPs expire after ~5 minutes — re-request if needed.)
//
// SINGLE-PAGE NOTE:
//   The browser tab navigates AWAY from Auth0 to Gmail.
//   Auth0 session cookies (scoped to auth0.com) are preserved.
//   After reading the OTP, the test calls auth.navigateBackToOTPPage()
//   to return to Auth0 — exactly like the Mailnesia flow.
// ============================================================

class GmailPage {

  // ----------------------------------------------------------
  // constructor(page)
  // ----------------------------------------------------------
  constructor(page) {
    this.page = page;

    // The Gmail inbox URL we navigate to
    this.GMAIL_INBOX_URL = 'https://mail.google.com/mail/u/0/#inbox';

    // ========================================================
    // LOCATORS FOR GOOGLE SIGN-IN PAGE
    // ========================================================
    // When Gmail is not logged in, Google shows a sign-in page.
    // These locators target the email + password fields.

    // The email input on Google's "Sign in" step.
    // NOTE: Google's real field is id="identifierId" name="identifier"
    // type="text" (NOT type="email") — it also ships a hidden decoy
    // input[type="email"] some accounts get, so we target the stable id
    // first and use the :visible filter on any fallback to skip decoys.
    this.googleEmailInput = page.locator('#identifierId, input[type="email"]:visible').first();

    // The "Next" button after entering email (moves to password step)
    this.googleNextButton = page.locator('#identifierNext, button:has-text("Next")').first();

    // The password input on Google's "Enter your password" step.
    // Google also ships a hidden decoy input[name="hiddenPassword"] earlier
    // in the DOM — :visible filters it out so .first() grabs the real field.
    this.googlePasswordInput = page.locator('input[type="password"]:visible').first();

    // The "Next" button after entering password
    this.googlePasswordNext = page.locator('#passwordNext, button:has-text("Next")').first();


    // ========================================================
    // LOCATORS FOR GMAIL INBOX
    // ========================================================

    // The Gmail search box — where you type to filter emails
    // Gmail uses aria-label "Search mail" for accessibility
    this.searchInput = page.locator(
      'input[aria-label="Search mail"], input[name="q"]'
    ).first();

    // Each email row in the inbox list.
    // Gmail marks email list items with role="row" and class="zA".
    // .zA appears on BOTH read and unread emails in the inbox table.
    this.emailRows = page.locator('tr.zA');

    // The first (latest/top) email row in the inbox
    this.firstEmailRow = page.locator('tr.zA').first();
  }


  // ----------------------------------------------------------
  // openGmail(emailAddress)
  // ------------------------
  // Navigates the browser to mail.google.com.
  //
  // THREE possible situations after navigating:
  //   A) Already logged in  → inbox appears immediately (best case:
  //      auth-state.json included Google cookies from login-once.js)
  //   B) "Choose an account" screen → click the account tile and land
  //      on the inbox without a password prompt
  //   C) Full sign-in form → fill email + password via signIn()
  //
  // Requires: GMAIL_PASSWORD env var if situation C occurs.
  // Tip: run  node login-once.js  once to capture Google cookies
  //      in auth-state.json so situation A is always hit instead.
  // ----------------------------------------------------------
  async openGmail(emailAddress) {
    console.log('GmailPage.openGmail — navigating to Gmail');

    // Navigate to Gmail — Google will either show the inbox or redirect
    // to accounts.google.com for sign-in / account selection.
    await this.page.goto('https://mail.google.com/');
    await this.page.waitForLoadState('domcontentloaded');

    const currentUrl = this.page.url();
    console.log('GmailPage.openGmail — landed on:', currentUrl);

    // ── SITUATION A: Already in the Gmail inbox ──────────────────
    // Gmail inbox URLs always contain "/mail/" after the domain.
    // e.g. https://mail.google.com/mail/u/0/#inbox
    if (currentUrl.includes('mail.google.com/mail')) {
      console.log('GmailPage.openGmail — already in Gmail inbox (cookies were valid)');

    // ── SITUATION B / C: Google sign-in / account picker ─────────
    } else if (currentUrl.includes('accounts.google.com')) {

      // Try the "Choose an account" tile first.
      // When a previous session cookie exists but needs reconfirmation,
      // Google shows a list of accounts rather than the full sign-in form.
      // Clicking the tile goes straight to Gmail (no password needed).
      //
      // Google renders account tiles with a data-email or data-identifier
      // attribute equal to the account's email address.
      const accountTile = this.page.locator(
        `[data-email="${emailAddress}"], ` +
        `[data-identifier="${emailAddress}"], ` +
        `li:has-text("${emailAddress}") a`
      ).first();

      const hasTile = await accountTile.isVisible({ timeout: 4000 }).catch(() => false);

      if (hasTile) {
        // ── SITUATION B: Account picker ─────────────────────────
        console.log('GmailPage.openGmail — "Choose an account" screen detected, clicking tile');
        await accountTile.click();

        // After the tile click Google may go straight to Gmail,
        // OR show the password page if the session fully expired.
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(2000);

        const urlAfterTile = this.page.url();
        console.log('GmailPage.openGmail — URL after tile click:', urlAfterTile);

        if (urlAfterTile.includes('accounts.google.com')) {
          // Password is still required — fall through to signIn()
          console.log('GmailPage.openGmail — password required after tile click');
          await this.signIn(emailAddress);
        } else {
          console.log('GmailPage.openGmail — navigated to Gmail after tile click');
        }

      } else {
        // ── SITUATION C: Full sign-in form ───────────────────────
        console.log('GmailPage.openGmail — sign-in form detected, calling signIn()');
        await this.signIn(emailAddress);
      }

    } else {
      // Unexpected URL (could be a Google splash or redirect in progress).
      // Wait briefly and re-check before giving up.
      console.log('GmailPage.openGmail — unexpected URL:', currentUrl, '— waiting 3s and re-checking');
      await this.page.waitForTimeout(3000);
      const retryUrl = this.page.url();
      if (retryUrl.includes('mail.google.com/mail')) {
        console.log('GmailPage.openGmail — now on Gmail inbox after wait');
      } else if (retryUrl.includes('accounts.google.com')) {
        await this.signIn(emailAddress);
      } else {
        console.log('GmailPage.openGmail — still on unexpected URL:', retryUrl);
      }
    }

    // Let the inbox fully render its email row list before any polling starts
    await this.page.waitForTimeout(2000);
    console.log('GmailPage.openGmail — Gmail is ready, URL:', this.page.url());
  }


  // ----------------------------------------------------------
  // signIn(emailAddress)
  // ----------------------
  // Handles the Google account sign-in flow (full email + password).
  //
  // Steps:
  //   1. Fill email address → click "Next"
  //   2. Verify password field appeared (Google may show 2FA / challenge)
  //   3. Fill password (from GMAIL_PASSWORD env var) → click "Next"
  //   4. Wait for Gmail inbox to load
  //
  // IMPORTANT — GMAIL_PASSWORD must be set before calling this:
  //   PowerShell: $env:GMAIL_PASSWORD = "your-password"
  //   .env file:  GMAIL_PASSWORD=your-password
  //
  // If your Gmail account uses 2-Factor Authentication you MUST use
  // a Google App Password (not your normal password).
  // Generate one at: Google Account → Security → 2-Step → App passwords
  //
  // BEST PRACTICE: Run  node login-once.js  once and log into Gmail
  // manually in the browser window.  This saves Google session cookies
  // to auth-state.json so this signIn() method is never called again.
  // ----------------------------------------------------------
  async signIn(emailAddress) {

    // ── STEP 0: Check that the password env var is set ────────────
    // Without it we cannot automate Google login at all.
    const password = process.env.GMAIL_PASSWORD;
    if (!password) {
      throw new Error(
        'GmailPage.signIn: GMAIL_PASSWORD environment variable is not set.\n' +
        '\n' +
        'QUICKEST FIX: Run  node login-once.js  to log in manually once.\n' +
        '  → That script saves Google cookies to auth-state.json.\n' +
        '  → After that, tests find Gmail already logged in and skip this step.\n' +
        '\n' +
        'ALTERNATIVE: Set the password in PowerShell before running tests:\n' +
        '  $env:GMAIL_PASSWORD = "your-google-app-password"\n' +
        '  (For 2FA accounts use a Google App Password, NOT your normal password.)'
      );
    }

    // ── STEP 1: Enter the Gmail email address ─────────────────────
    console.log('GmailPage.signIn — entering email:', emailAddress);
    await this.googleEmailInput.waitFor({ state: 'visible', timeout: 15000 });
    await this.googleEmailInput.fill(emailAddress);
    await this.googleNextButton.click();

    // Wait for Google to transition to the next screen
    await this.page.waitForTimeout(3000);

    // ── STEP 2: Verify the password field appeared ────────────────
    // Google sometimes shows a security challenge or 2FA screen instead
    // of the password field.  Detect this early and give a clear error.
    const passwordVisible = await this.googlePasswordInput.isVisible({ timeout: 8000 }).catch(() => false);

    if (!passwordVisible) {
      // Grab a snippet of the page to help diagnose the exact screen
      const pageSnip = await this.page.textContent('body').catch(() => '');
      console.log('GmailPage.signIn — password field NOT visible. Page snippet:',
        pageSnip.replace(/\s+/g, ' ').substring(0, 300));

      throw new Error(
        'GmailPage.signIn: Google did not show the password field after entering the email.\n' +
        'Google may be showing a 2FA challenge, a reCAPTCHA, or a "Verify it\'s you" screen.\n' +
        '\n' +
        'SOLUTION: Run  node login-once.js  and complete the Gmail login manually in Step 2.\n' +
        '  → This saves the Google session to auth-state.json.\n' +
        '  → Tests will then find Gmail already open and never reach this code.'
      );
    }

    // ── STEP 3: Enter the password ────────────────────────────────
    console.log('GmailPage.signIn — entering password from GMAIL_PASSWORD env var');
    await this.googlePasswordInput.fill(password);
    await this.googlePasswordNext.click();

    // ── STEP 4: Wait for Gmail inbox to load ─────────────────────
    // After clicking Next, Google validates and redirects to Gmail inbox.
    console.log('GmailPage.signIn — waiting for Gmail inbox...');
    await this.page.waitForURL('https://mail.google.com/**', { timeout: 30000 });
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(3000);

    console.log('GmailPage.signIn — signed in! URL:', this.page.url());
  }


  // ----------------------------------------------------------
  // waitForOTPEmail(maxWaitMs)
  // ---------------------------
  // Waits for the Auth0 OTP email to arrive in the Gmail inbox.
  //
  // Strategy:
  //   - Searches Gmail for recent emails related to "verification" or "sign in"
  //   - Polls every 5 seconds until an email row appears
  //   - Returns true when found, false on timeout
  //
  // maxWaitMs — how long to wait in total (default: 90 seconds)
  // ----------------------------------------------------------
  async waitForOTPEmail(maxWaitMs = 90000) {
    // How often to check the inbox (poll every 5 seconds)
    const pollEveryMs = 5000;

    // How many times we will check before giving up
    const maxAttempts = Math.ceil(maxWaitMs / pollEveryMs);

    console.log(`GmailPage.waitForOTPEmail — checking inbox, up to ${maxWaitMs / 1000}s`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`GmailPage.waitForOTPEmail — attempt ${attempt}/${maxAttempts}`);

      // ── SEARCH GMAIL ──────────────────────────────────────────────
      // Use Gmail's search to filter for Auth0 / OTP emails.
      // Gmail search operators:
      //   newer_than:1h → emails received in the last 1 hour
      //   OR             → search for either condition
      try {
        await this.searchInput.waitFor({ state: 'visible', timeout: 5000 });
        await this.searchInput.click();
        await this.searchInput.fill('');

        // Search terms that match Auth0 OTP emails
        const searchQuery = 'newer_than:1h subject:verification OR subject:"sign in" OR from:auth0';
        await this.searchInput.type(searchQuery, { delay: 30 });
        await this.page.keyboard.press('Enter');

        // Wait for search results to load
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(2000);

      } catch {
        // If the search box is not reachable, refresh inbox and try again
        console.log('GmailPage.waitForOTPEmail — search unavailable, refreshing inbox');
        await this.page.goto(this.GMAIL_INBOX_URL);
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(2000);
      }

      // ── CHECK FOR EMAILS ──────────────────────────────────────────
      // Count how many email rows (tr.zA) are visible in the results
      const count = await this.emailRows.count().catch(() => 0);
      console.log(`GmailPage.waitForOTPEmail — rows visible: ${count}`);

      if (count > 0) {
        // At least one email is present → good to proceed
        console.log('GmailPage.waitForOTPEmail — OTP email found!');
        return true;
      }

      // No email yet — wait before next attempt
      if (attempt < maxAttempts) {
        await this.page.waitForTimeout(pollEveryMs);
      }
    }

    // We waited the full timeout without finding an email
    console.log('GmailPage.waitForOTPEmail — timed out, no email arrived');
    return false;
  }


  // ----------------------------------------------------------
  // getOTPFromLatestEmail()
  // ------------------------
  // Opens the most recent email and extracts the 6-digit OTP.
  //
  // Steps:
  //   1. Click the first email row in the inbox/search results
  //   2. Wait for the email body to render
  //   3. Read all text on the page
  //   4. Use a regex to find the 6-digit number (the OTP)
  //
  // Returns the OTP string (e.g. "482917") or null if not found.
  // ----------------------------------------------------------
  async getOTPFromLatestEmail() {

    // ── STEP 1: Click the first email ────────────────────────────
    try {
      await this.firstEmailRow.waitFor({ state: 'visible', timeout: 8000 });
      await this.firstEmailRow.scrollIntoViewIfNeeded().catch(() => {});
      await this.page.waitForTimeout(500);

      // Normal click first; fall back to JS click if the row is intercepted
      await this.firstEmailRow.click({ timeout: 8000 }).catch(async (e1) => {
        console.log('GmailPage.getOTPFromLatestEmail — normal click failed:', e1.message.split('\n')[0]);
        await this.firstEmailRow.dispatchEvent('click');
      });

      // Give Gmail time to load the email body (it loads via AJAX)
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2500);

    } catch (e) {
      console.log('GmailPage.getOTPFromLatestEmail — could not click the email row:', e.message.split('\n')[0]);
      return null;
    }

    // ── STEP 2: Read the email body text ──────────────────────────
    // Gmail renders the email in a div inside the page.
    // We read the ENTIRE page text using document.body.innerText
    // because Gmail's email structure can be complex/nested.
    const bodyText = await this.page.evaluate(
      () => document.body.innerText || document.body.textContent || ''
    );

    // Show the first 300 characters for debug inspection
    console.log('GmailPage.getOTPFromLatestEmail — email body preview:',
      bodyText.substring(0, 300).replace(/\s+/g, ' ')
    );

    // ── STEP 3: Extract the 6-digit OTP ──────────────────────────
    // Primary pattern: look for any standalone 6-digit number.
    // \b means "word boundary" — so it won't match digits inside longer numbers.
    const match = bodyText.match(/\b(\d{6})\b/);
    if (match) {
      console.log('GmailPage.getOTPFromLatestEmail — OTP found:', match[1]);
      return match[1];
    }

    // Fallback: look for a number after keywords like "code:", "OTP:", "PIN:"
    // This handles email formats like "Your verification code is: 123456"
    const labeled = bodyText.match(/(?:code|otp|verification|pin)[^\d]*?(\d{4,8})/i);
    if (labeled) {
      console.log('GmailPage.getOTPFromLatestEmail — OTP (labeled):', labeled[1]);
      return labeled[1];
    }

    // Could not find any OTP pattern in the email
    console.log('GmailPage.getOTPFromLatestEmail — no 6-digit OTP found in email body');
    return null;
  }

}

// ============================================================
// Export so test files can import:
//   const { GmailPage } = require('../pages/GmailPage');
// ============================================================
module.exports = { GmailPage };
