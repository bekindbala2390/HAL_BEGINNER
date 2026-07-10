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
      // If count drops BELOW the baseline (Mailinator deleted old emails),
      // lower the baseline so we don't gate forever.
      if (resendBaseCount !== null && count < resendBaseCount) {
        console.log(`MailinatorPage.waitForOTPEmail — inbox shrank (${count} < ${resendBaseCount}), lowering baseline`);
        resendBaseCount = count;
      }
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
    const otpRow    = await this._findOTPRow();
    const targetRow = otpRow || this.firstEmailRow;

    try {
      await targetRow.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      console.log('MailinatorPage.getOTPFromLatestEmail — no email row visible');
      return null;
    }

    const rowText = await targetRow.textContent().catch(() => '');
    console.log('MailinatorPage.getOTPFromLatestEmail — row text:', rowText.trim().substring(0, 120));

    // ── Strategy 1: Mailinator public API ───────────────────────
    // The Mailinator web UI detects automated browsers and shows
    // "Account blocked" instead of the email content.  The JSON API
    // bypasses that entirely — it returns the raw message body and
    // needs no authentication for public mailinator.com inboxes.
    //
    // Row IDs are: "row_<inbox>-<msgId>" or "<inbox>-<timestamp>-<msgId>"
    // We try to extract the message ID from the DOM row, then call:
    //   GET /api/v2/domains/mailinator.com/inboxes/<inbox>/messages/<msgId>
    const rowId = await targetRow.getAttribute('id').catch(() => null);
    console.log('MailinatorPage.getOTPFromLatestEmail — row id:', rowId);

    if (rowId) {
      // Row ID format: "row_<inbox>-<timestamp>-<msgId>"
      // The message ID is the last '-' separated segment.
      const msgId = rowId.split('-').pop();
      console.log('MailinatorPage.getOTPFromLatestEmail — extracted msgId:', msgId);

      // ── Strategy 1a: Mailinator API with token ───────────────────
      // A free Mailinator account provides an API token that allows reading
      // public inbox messages.  Store it in .env as MAILINATOR_TOKEN.
      // Get yours at: https://www.mailinator.com → Account → API Token
      const apiToken = process.env.MAILINATOR_TOKEN;
      if (apiToken) {
        try {
          const apiUrl =
            `https://www.mailinator.com/api/v2/domains/mailinator.com` +
            `/inboxes/${encodeURIComponent(this.inboxName)}/messages/${encodeURIComponent(msgId)}`;
          const resp = await this.page.request.get(apiUrl, {
            headers: { 'Authorization': apiToken },
            timeout: 10000,
          });

          if (resp.ok()) {
            const data = await resp.json();
            const parts = data?.data?.parts || [];
            for (const part of parts) {
              const body = part?.body || '';
              const m = body.match(/\b(\d{6})\b/);
              if (m) {
                console.log('MailinatorPage.getOTPFromLatestEmail — OTP from API:', m[1]);
                return m[1];
              }
            }
            const subject = data?.data?.subject || '';
            const sm = subject.match(/\b(\d{6})\b/);
            if (sm) {
              console.log('MailinatorPage.getOTPFromLatestEmail — OTP from subject:', sm[1]);
              return sm[1];
            }
            console.log('MailinatorPage.getOTPFromLatestEmail — API ok but no OTP found');
          } else {
            console.log('MailinatorPage.getOTPFromLatestEmail — API returned', resp.status());
          }
        } catch (e) {
          console.log('MailinatorPage.getOTPFromLatestEmail — API error:', e.message.split('\n')[0]);
        }
      } else {
        console.log('MailinatorPage.getOTPFromLatestEmail — MAILINATOR_TOKEN not set, skipping API');
      }

      // ── Strategy 1b: Navigate directly to the message URL ───────
      // Navigating to the URL with the msgid query param avoids the
      // click-triggered "Account blocked" restriction.
      try {
        const directUrl =
          `https://www.mailinator.com/v4/public/inboxes.jsp` +
          `?to=${encodeURIComponent(this.inboxName)}&msgid=${encodeURIComponent(msgId)}`;
        console.log('MailinatorPage.getOTPFromLatestEmail — navigating to direct message URL:', directUrl);
        await this.page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await this.page.waitForTimeout(3000);

        // Try to read the iframe at this URL
        const iframe = this.page.locator('iframe#html_msg_body');
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await iframe.waitFor({ state: 'attached', timeout: 6000 });
            const frame = iframe.contentFrame();
            const text  = await frame.locator('body').innerText({ timeout: 5000 });
            if (text && /\d{4,}/.test(text)) {
              const m = text.match(/\b(\d{6})\b/);
              if (m) {
                console.log('MailinatorPage.getOTPFromLatestEmail — OTP from direct URL iframe:', m[1]);
                return m[1];
              }
            }
          } catch { /* ignore, try next */ }
          if (attempt < 3) await this.page.waitForTimeout(2000).catch(() => {});
        }

        // Also try reading from the page body (excluding nav items)
        const pageText = await this.page.evaluate(() => {
          const main = document.querySelector('#msgpane, .msg-body, [class*="message"], main');
          return main ? main.innerText : '';
        }).catch(() => '');
        if (pageText && /\d{4,}/.test(pageText)) {
          const m = pageText.match(/\b(\d{6})\b/);
          if (m) {
            console.log('MailinatorPage.getOTPFromLatestEmail — OTP from direct URL page:', m[1]);
            return m[1];
          }
        }
        console.log('MailinatorPage.getOTPFromLatestEmail — direct URL gave no OTP');

        // Navigate back to inbox for the iframe fallback below
        await this.page.goto(this.inboxUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await this.page.waitForTimeout(2000);
      } catch (e) {
        console.log('MailinatorPage.getOTPFromLatestEmail — direct URL error:', e.message.split('\n')[0]);
      }
    }

    // ── Strategy 2: Read from the email body iframe ──────────────
    // Click the email row to open the message panel, then read the iframe.
    console.log('MailinatorPage.getOTPFromLatestEmail — falling back to iframe approach');
    const subjectLink = targetRow.locator('td a').first();
    const hasLink = await subjectLink.count().catch(() => 0);
    if (hasLink > 0) {
      await subjectLink.click().catch(() => {});
    } else {
      await this.firstEmailRow.click().catch(() => {});
    }

    await this.page.waitForTimeout(3000).catch(() => {});

    let bodyText = '';

    const iframeLocator = this.page.locator('iframe#html_msg_body');
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        await iframeLocator.waitFor({ state: 'attached', timeout: 8000 });
        const frameLocator = iframeLocator.contentFrame();
        const text = await frameLocator.locator('body').innerText({ timeout: 6000 });

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

    // ── Strategy 3: page body text ───────────────────────────────
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
    const match = bodyText.match(/\b(\d{6})\b/);
    if (match) {
      console.log('MailinatorPage.getOTPFromLatestEmail — OTP:', match[1]);
      return match[1];
    }

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
