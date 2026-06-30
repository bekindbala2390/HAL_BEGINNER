// ============================================================
// pages/MailinatorPage.js
//
// What is this file?
// -------------------
// Page Object for reading OTP emails from mailnesia.com public inbox.
//
// SERVICE: MAILNESIA.COM
//   - Free public inboxes, no registration needed
//   - Inbox URL: https://mailnesia.com/mailbox/<inbox-name>
//   - Inbox name is everything before the @ in the email address
//   - Plain HTML table — no iframes, no complex JS framework
//   - Auth0/SendGrid delivers here (mailinator.com is on their blocklist)
//
// HOW THIS PAGE OBJECT WORKS:
//   1. openInbox(email)         → navigate browser to the mailnesia inbox page
//   2. waitForOTPEmail()        → reload until an email row appears in the table
//   3. getOTPFromLatestEmail()  → click the email, read body, extract 6-digit OTP
//
// SINGLE-PAGE NOTE:
//   The browser tab navigates away from Auth0 to mailnesia.com.
//   Auth0's session cookies (scoped to auth0.com) are preserved.
//   After reading the OTP, the test calls auth.navigateBackToOTPPage()
//   to return to the saved Auth0 URL.
// ============================================================

class MailinatorPage {

  // ----------------------------------------------------------
  // constructor(page)
  // ----------------------------------------------------------
  constructor(page) {
    this.page      = page;
    this.inboxName = null;
    this.inboxUrl  = null;

    // Mailnesia renders a simple HTML table — body rows have td children.
    this.emailRows    = page.locator('table tbody tr');
    this.firstEmailRow = page.locator('table tbody tr').first();
  }


  // ----------------------------------------------------------
  // openInbox(emailAddress)
  // ------------------------
  // Navigates the browser to the mailnesia.com public inbox page.
  //
  // emailAddress — full address, e.g. sprint@mailnesia.com
  // ----------------------------------------------------------
  async openInbox(emailAddress) {
    this.inboxName = emailAddress.split('@')[0];
    this.inboxUrl  = `https://mailnesia.com/mailbox/${this.inboxName}`;

    console.log('MailinatorPage.openInbox — navigating to:', this.inboxUrl);
    await this.page.goto(this.inboxUrl);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    console.log('MailinatorPage.openInbox — page loaded, URL:', this.page.url());
  }


  // ----------------------------------------------------------
  // waitForOTPEmail(maxWaitMs)
  // ---------------------------
  // Reloads the mailnesia inbox page until an email row appears.
  //
  // Returns true when an email is present, false on timeout.
  // ----------------------------------------------------------
  async waitForOTPEmail(maxWaitMs = 90000) {
    const pollEveryMs = 5000;
    const maxAttempts = Math.ceil(maxWaitMs / pollEveryMs);

    console.log(`MailinatorPage.waitForOTPEmail — checking mailnesia, up to ${maxWaitMs / 1000}s`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`MailinatorPage.waitForOTPEmail — attempt ${attempt}/${maxAttempts}`);

      try {
        await this.page.goto(this.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch {
        await this.page.waitForTimeout(1000).catch(() => {});
      }

      const count = await this.emailRows.count().catch(() => 0);
      console.log(`MailinatorPage.waitForOTPEmail — inbox has ${count} row(s)`);

      if (count > 0) return true;

      if (attempt < maxAttempts) {
        await this.page.waitForTimeout(pollEveryMs).catch(() => {});
      }
    }

    await this.page.screenshot({
      path: 'test-results/mailinator-debug-empty.png',
      fullPage: true
    }).catch(() => {});

    console.log('MailinatorPage.waitForOTPEmail — timed out (screenshot saved)');
    return false;
  }


  // ----------------------------------------------------------
  // getOTPFromLatestEmail()
  // ------------------------
  // Opens the latest email and extracts the 6-digit OTP from its body.
  //
  // Mailnesia shows a plain HTML table. Clicking the first row navigates
  // to a full-page email view (no iframe needed). We read document.body
  // directly for the 6-digit code.
  //
  // Returns the OTP string (e.g. "482917") or null if not found.
  // ----------------------------------------------------------
  async getOTPFromLatestEmail() {
    try {
      await this.firstEmailRow.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      console.log('MailinatorPage.getOTPFromLatestEmail — no email row visible');
      return null;
    }

    const rowText = await this.firstEmailRow.textContent().catch(() => '');
    console.log('MailinatorPage.getOTPFromLatestEmail — row text:', rowText.trim().substring(0, 120));

    // ── Strategy 1: follow the direct link in the email row ─────────
    const emailLink = this.firstEmailRow.locator('a').first();
    const href = await emailLink.getAttribute('href').catch(() => null);
    console.log('MailinatorPage.getOTPFromLatestEmail — email link href:', href);

    if (href) {
      const emailUrl = href.startsWith('http') ? href : `https://mailnesia.com${href}`;
      console.log('MailinatorPage.getOTPFromLatestEmail — navigating to full email page:', emailUrl);
      await this.page.goto(emailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } else {
      // ── Strategy 2: click the row and wait for content to load ───
      console.log('MailinatorPage.getOTPFromLatestEmail — no href found, clicking row');
      await this.firstEmailRow.click();

      await this.page.waitForFunction(
        () => !(document.body.innerText || '').includes('LOADING'),
        { timeout: 15000 }
      ).catch(() => {});

      await this.page.waitForTimeout(1000);
    }

    // Read the full page text
    const bodyText = await this.page.evaluate(
      () => document.body.innerText || document.body.textContent || ''
    );
    console.log('MailinatorPage.getOTPFromLatestEmail — body preview:',
      bodyText.substring(0, 300).replace(/\s+/g, ' ')
    );

    // Primary: standalone 6-digit number
    const match = bodyText.match(/\b(\d{6})\b/);
    if (match) {
      console.log('MailinatorPage.getOTPFromLatestEmail — OTP:', match[1]);
      return match[1];
    }

    // Fallback: digit sequence after a keyword
    const labeled = bodyText.match(/(?:code|otp|verification|pin)[^\d]*?(\d{4,8})/i);
    if (labeled) {
      console.log('MailinatorPage.getOTPFromLatestEmail — OTP (labeled):', labeled[1]);
      return labeled[1];
    }

    console.log('MailinatorPage.getOTPFromLatestEmail — no OTP pattern found');
    return null;
  }
}

module.exports = { MailinatorPage };
