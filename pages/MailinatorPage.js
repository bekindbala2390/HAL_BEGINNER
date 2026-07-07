// ============================================================
// pages/MailinatorPage.js
//
// What is this file?
// -------------------
// Page Object for reading OTP emails from mailinator.com public inbox.
//
// SERVICE: MAILINATOR.COM
//   - Free public inboxes, no registration needed
//   - Inbox URL: https://www.mailinator.com/v4/public/inboxes.jsp?to=<inbox-name>
//   - Inbox name is everything before the @ in the email address
//   - e.g. for sprint@mailinator.com → inbox name is "sprint"
//   - After clicking an email, the body loads inside an iframe (#html_msg_body)
//
// HOW THIS PAGE OBJECT WORKS:
//   1. openInbox(email)         → navigate browser to the mailinator inbox page
//   2. waitForOTPEmail()        → reload until an email row appears in the table
//   3. getOTPFromLatestEmail()  → click the email, read body from iframe, extract 6-digit OTP
//
// SINGLE-PAGE NOTE:
//   The browser tab navigates away from Auth0 to mailinator.com.
//   Auth0's session cookies (scoped to auth0.com) are preserved.
//   After reading the OTP, the test calls auth.navigateBackToOTPPage()
//   to return to the saved Auth0 URL.
// ============================================================

class MailinatorPage {

  // ----------------------------------------------------------
  // constructor(page)
  // ----------------------------------------------------------
  constructor(page) {
    this.page              = page;
    this.inboxName         = null;
    this.inboxUrl          = null;
    this.initialEmailCount = 0; // snapshot taken in openInbox() before Auth0 sends the OTP

    // Mailinator renders the inbox with Angular (ng-repeat).
    // Each email row is a <tr> with ng-repeat="email in emails" and
    // an id of "row_<inboxname>-<timestamp>-<msgid>".
    // The header row is in a separate table and does NOT have ng-repeat.
    // This selector targets ONLY actual email data rows, never the header.
    this.emailRows     = page.locator('tr[ng-repeat="email in emails"]');
    this.firstEmailRow = page.locator('tr[ng-repeat="email in emails"]').first();
  }


  // ----------------------------------------------------------
  // openInbox(emailAddress)
  // ------------------------
  // Navigates the browser to the mailinator.com public inbox page.
  //
  // emailAddress — full address, e.g. sprint@mailinator.com
  // ----------------------------------------------------------
  async openInbox(emailAddress) {
    this.inboxName = emailAddress.split('@')[0];   // "sprint" from "sprint@mailinator.com"
    this.inboxUrl  = `https://www.mailinator.com/v4/public/inboxes.jsp?to=${this.inboxName}`;

    console.log('MailinatorPage.openInbox — navigating to:', this.inboxUrl);
    await this.page.goto(this.inboxUrl);
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});

    // Wait for Angular to render any existing email rows, then snapshot the count.
    // waitForOTPEmail() will wait until count EXCEEDS this baseline, so it
    // ignores emails that were already in the inbox before Auth0 sent the OTP.
    await this.page.waitForSelector(
      'tr[ng-repeat="email in emails"]',
      { state: 'visible', timeout: 5000 }
    ).catch(() => {});
    this.initialEmailCount = await this.emailRows.count().catch(() => 0);

    console.log(
      `MailinatorPage.openInbox — page loaded, existing emails: ${this.initialEmailCount}, URL: ${this.page.url()}`
    );
  }


  // ----------------------------------------------------------
  // _isOTPKeyword(text)
  // --------------------
  // Returns true if the row text contains any Auth0 / OTP keyword.
  // ----------------------------------------------------------
  _isOTPKeyword(text) {
    return (
      text.includes('auth0') ||
      text.includes('hal') ||
      text.includes('verification') ||
      text.includes('sign in') ||
      text.includes('your code') ||
      text.includes('otp')
    );
  }


  // ----------------------------------------------------------
  // _findOTPRow()
  // --------------
  // Scans all visible email rows and returns the best match for
  // the Auth0 OTP email using a 3-tier priority:
  //
  //   Tier 1 — "just now" row that also matches an OTP keyword
  //             (freshly delivered OTP email — highest confidence)
  //   Tier 2 — any "just now" row
  //             (most recently arrived email, very likely the OTP)
  //   Tier 3 — any row matching an OTP keyword
  //             (older email in the inbox — last resort)
  //
  // Mailinator shows the time column as "just now" for emails
  // that arrived in the last minute, so Tier 1/2 reliably
  // identifies the email triggered by the current test run.
  //
  // Returns the row Locator if found, null otherwise.
  // ----------------------------------------------------------
  async _findOTPRow() {
    const count = await this.emailRows.count().catch(() => 0);

    let tier2Row = null; // "just now" row without OTP keyword
    let tier3Row = null; // OTP keyword row without "just now"

    for (let i = 0; i < count; i++) {
      const row  = this.emailRows.nth(i);
      const text = (await row.textContent().catch(() => '')).toLowerCase();

      const isJustNow  = text.includes('just now');
      const isOTPEmail = this._isOTPKeyword(text);

      if (isJustNow && isOTPEmail) {
        // Tier 1 — best match: fresh AND looks like an OTP email
        console.log(`MailinatorPage._findOTPRow — Tier 1 match (just now + keyword) row ${i}: ${text.trim().substring(0, 80)}`);
        return row;
      }

      if (isJustNow && tier2Row === null) {
        // Tier 2 — fresh email, no keyword match yet
        console.log(`MailinatorPage._findOTPRow — Tier 2 candidate (just now) row ${i}: ${text.trim().substring(0, 80)}`);
        tier2Row = row;
      }

      if (isOTPEmail && tier3Row === null) {
        // Tier 3 — keyword match but not "just now"
        console.log(`MailinatorPage._findOTPRow — Tier 3 candidate (keyword only) row ${i}: ${text.trim().substring(0, 80)}`);
        tier3Row = row;
      }
    }

    if (tier2Row) {
      console.log('MailinatorPage._findOTPRow — using Tier 2 match (just now, no keyword)');
      return tier2Row;
    }
    if (tier3Row) {
      console.log('MailinatorPage._findOTPRow — using Tier 3 match (keyword, not just now)');
      return tier3Row;
    }

    return null;
  }


  // ----------------------------------------------------------
  // waitForOTPEmail(maxWaitMs, resendFn)
  // --------------------------------------
  // Reloads the mailinator inbox page until an Auth0 OTP email arrives.
  // Ignores unrelated emails (spam, newsletters) that land in the shared inbox.
  //
  // If the OTP does not arrive within resendAfterMs (default 20s), and a
  // resendFn callback is provided, it navigates back to Auth0, clicks Resend,
  // waits 20 seconds, then returns to Mailinator and keeps polling.
  // This repeats until the OTP arrives or maxWaitMs is exhausted.
  //
  // resendFn — async function that clicks the Auth0 Resend button (optional)
  // Returns true when the OTP email is present, false on timeout.
  // ----------------------------------------------------------
  async waitForOTPEmail(maxWaitMs = 300000, resendFn = null) {
    const pollEveryMs   = 5000;   // check inbox every 5 seconds
    const resendAfterMs = 75000;  // click Resend only if no email after 75 seconds
    const resendWaitMs  = 30000;  // wait 30 seconds after clicking Resend
    const maxResends    = 1;      // never resend more than once — each resend
                                  // generates a NEW OTP that invalidates the old
                                  // one; multiple resends cause OTP mismatch

    const deadline      = Date.now() + maxWaitMs;
    let   lastResendAt  = Date.now();
    let   resendCount   = 0;
    let   attempt       = 0;
    // After a resend, only accept emails that arrived AFTER it.
    // We track the inbox count at resend time so we can ignore
    // delayed emails from a previous (now-invalid) resend.
    let   resendBaseCount = null;

    console.log(`MailinatorPage.waitForOTPEmail — checking mailinator, up to ${maxWaitMs / 1000}s (resend once if no email after ${resendAfterMs / 1000}s)`);

    while (Date.now() < deadline) {
      attempt++;
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      console.log(`MailinatorPage.waitForOTPEmail — attempt ${attempt} (${remaining}s left)`);

      // ── Reload the inbox ────────────────────────────────────────
      try {
        await this.page.goto(this.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      } catch {
        await this.page.waitForTimeout(1000).catch(() => {});
      }

      // Wait for Angular to render email rows
      await this.page.waitForSelector(
        'tr[ng-repeat="email in emails"]',
        { state: 'visible', timeout: 5000 }
      ).catch(() => {});

      const count = await this.emailRows.count().catch(() => 0);
      console.log(`MailinatorPage.waitForOTPEmail — inbox has ${count} row(s)`);

      // After a resend, only check for OTP once a NEW email arrives
      // (count exceeds the count we had when we triggered the resend).
      // This prevents us from reading a delayed email from an earlier,
      // now-invalidated resend and entering a stale OTP on Auth0.
      const postResendGate = resendBaseCount !== null && count <= resendBaseCount;
      if (postResendGate) {
        console.log(`MailinatorPage.waitForOTPEmail — waiting for new email after resend (have ${count}, need >${resendBaseCount})`);
      } else {
        const otpRow = await this._findOTPRow();
        if (otpRow) {
          console.log('MailinatorPage.waitForOTPEmail — OTP email found, opening it now');
          return true;
        }
      }

      // ── Resend once if email hasn't arrived within resendAfterMs ─
      if (resendFn && resendCount < maxResends && (Date.now() - lastResendAt) >= resendAfterMs) {
        resendBaseCount = count; // snapshot count before the new OTP is sent
        resendCount++;
        console.log(`MailinatorPage.waitForOTPEmail — no OTP yet, triggering resend #${resendCount} (base count: ${resendBaseCount})`);
        await resendFn();
        lastResendAt = Date.now();

        console.log(`MailinatorPage.waitForOTPEmail — waiting ${resendWaitMs / 1000}s after resend...`);
        await this.page.waitForTimeout(resendWaitMs).catch(() => {});
        continue;
      }

      // Normal inter-poll wait
      if (Date.now() < deadline) {
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
  // Clicks the latest email in the inbox and extracts the 6-digit OTP.
  //
  // Mailinator shows emails in an Angular table. Clicking a row loads
  // the email body in an iframe with id="html_msg_body" on the right side.
  //
  // Returns the OTP string (e.g. "482917") or null if not found.
  // ----------------------------------------------------------
  async getOTPFromLatestEmail() {
    // If we navigated away from mailinator, go back first
    if (!this.page.url().includes('mailinator.com')) {
      console.log('MailinatorPage.getOTPFromLatestEmail — not on mailinator, re-navigating');
      try {
        await this.page.goto(this.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await this.page.waitForTimeout(2000).catch(() => {});
      } catch { /* ignore */ }
    }

    // Find the Auth0 OTP email specifically — don't just click the newest row,
    // because unrelated emails may have arrived after we started watching.
    const otpRow   = await this._findOTPRow();
    const targetRow = otpRow || this.firstEmailRow; // fallback keeps old behaviour

    try {
      await targetRow.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      console.log('MailinatorPage.getOTPFromLatestEmail — no email row visible');
      return null;
    }

    const rowText = await targetRow.textContent().catch(() => '');
    console.log('MailinatorPage.getOTPFromLatestEmail — row text:', rowText.trim().substring(0, 120));

    // Click the subject link (<a>) inside the row — more reliable than clicking
    // the <tr> itself because Angular listens on the anchor, not the row.
    console.log('MailinatorPage.getOTPFromLatestEmail — clicking email subject link');
    const subjectLink = targetRow.locator('td a').first();
    const hasLink = await subjectLink.count().catch(() => 0);
    if (hasLink > 0) {
      await subjectLink.click().catch(() => {});
    } else {
      // Fallback: click the row directly if no <a> found
      await this.firstEmailRow.click().catch(() => {});
    }

    // Give the Angular viewer and iframe initial time to start loading
    await this.page.waitForTimeout(3000).catch(() => {});

    let bodyText = '';

    // ── Strategy 1: Read from the email body iframe ──────────────
    // Mailinator renders the email inside an iframe with id="html_msg_body".
    // The iframe may take a few seconds to load its content — so we
    // retry up to 4 times (every 3 s) before giving up.
    const iframeLocator = this.page.locator('iframe#html_msg_body');
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await iframeLocator.waitFor({ state: 'attached', timeout: 8000 });
        const frameLocator = iframeLocator.contentFrame();
        const text = await frameLocator.locator('body').innerText({ timeout: 6000 });

        // Accept only if the text actually contains digits (i.e. the email body loaded)
        if (text && /\d{4,}/.test(text)) {
          bodyText = text;
          console.log(`MailinatorPage.getOTPFromLatestEmail — iframe read OK (attempt ${attempt}), preview:`,
            bodyText.substring(0, 200).replace(/\s+/g, ' ')
          );
          break;
        }

        console.log(`MailinatorPage.getOTPFromLatestEmail — iframe empty on attempt ${attempt}, retrying...`);
      } catch {
        console.log(`MailinatorPage.getOTPFromLatestEmail — iframe not ready on attempt ${attempt}`);
      }

      if (attempt < 4) await this.page.waitForTimeout(3000).catch(() => {});
    }

    // ── Strategy 2: Fallback — read from the full page body ──────
    if (!bodyText) {
      console.log('MailinatorPage.getOTPFromLatestEmail — iframe gave no digits, falling back to page text');
      bodyText = await this.page.evaluate(
        () => document.body.innerText || document.body.textContent || ''
      );
      console.log('MailinatorPage.getOTPFromLatestEmail — body preview:',
        bodyText.substring(0, 300).replace(/\s+/g, ' ')
      );
    }

    // ── Extract the 6-digit OTP ───────────────────────────────────
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
