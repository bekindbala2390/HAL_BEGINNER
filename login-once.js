// login-once.js
//
// ONE-TIME SETUP SCRIPT — run this whenever auth-state.json expires.
//
// What it does (fully automated, no manual steps):
//   1. Opens Mailinator inbox for kp.abhinand.seller@mailinator.com
//   2. Navigates to HAL UAE login → Auth0
//   3. Enters the login email and clicks Continue
//   4. Auth0 sends a 6-digit OTP to the Mailinator inbox
//   5. Reads the OTP from Mailinator automatically
//   6. Submits the OTP to Auth0 → logs in to HAL UAE
//   7. Saves the browser session (cookies) to auth-state.json
//
// After this runs, all tests reuse the saved session and skip the OTP flow.
//
// WHY MAILINATOR?
//   Mailinator is a public email service — no login required.
//   The inbox is accessible to anyone who knows the address.
//   This avoids the Gmail authentication problems that blocked automation.
//
// HOW TO RUN:
//   node login-once.js
//
// HOW LONG IS THE SESSION VALID?
//   The HAL UAE staging server expires sessions after ~60 minutes.
//   Re-run this script (or just run the tests — they auto-login) when
//   tests start failing with "login failed" or "session expired".

const { chromium } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const { AuthPage }       = require('./pages/AuthPage');
const { MailinatorPage } = require('./pages/MailinatorPage');

const AUTH_STATE_FILE = path.join(__dirname, 'auth-state.json');

// The Mailinator inbox that receives the Auth0 OTP email
const LOGIN_EMAIL = 'kp.abhinand.seller@mailinator.com';

(async () => {
  console.log('');
  console.log('=== HAL UAE — Automated Login Setup ===');
  console.log('Login email:', LOGIN_EMAIL);
  console.log('');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext();
  const page    = await context.newPage();

  const auth      = new AuthPage(page);
  const mailinator = new MailinatorPage(page);


  // ── STEP 1: Open Mailinator inbox (snapshot existing emails) ────
  // We open the inbox BEFORE triggering Auth0 so that openInbox()
  // captures the current email count as a baseline.  waitForOTPEmail()
  // uses this baseline to detect only the NEW email from Auth0.
  console.log('[1/4] Opening Mailinator inbox...');
  await mailinator.openInbox(LOGIN_EMAIL);
  console.log('      Inbox ready.');
  console.log('');


  // ── STEP 2: Navigate to Auth0 and request an OTP ───────────────
  console.log('[2/4] Navigating to HAL UAE login → requesting OTP from Auth0...');
  await auth.navigateToLogin();
  await auth.enterEmailAndSubmit(LOGIN_EMAIL);
  console.log('      OTP email sent to:', LOGIN_EMAIL);
  console.log('');


  // ── STEP 3: Wait for OTP email and extract the code ─────────────
  console.log('[3/4] Waiting for OTP email on Mailinator (up to 90 seconds)...');
  const emailFound = await mailinator.waitForOTPEmail(90000);

  if (!emailFound) {
    console.log('ERROR: OTP email did not arrive within 90 seconds.');
    console.log('       Check that Auth0 is sending to:', LOGIN_EMAIL);
    await browser.close();
    process.exit(1);
  }

  const otp = await mailinator.getOTPFromLatestEmail();

  if (!otp) {
    console.log('ERROR: Found an email but could not extract the 6-digit OTP from it.');
    await browser.close();
    process.exit(1);
  }

  console.log('      OTP extracted:', otp);
  console.log('');


  // ── STEP 4: Return to Auth0 and submit the OTP ─────────────────
  console.log('[4/4] Submitting OTP to Auth0 and completing login...');
  await auth.navigateBackToOTPPage();
  await auth.enterOTPAndSubmit(otp);
  console.log('      Login complete! URL:', page.url());
  console.log('');


  // ── SAVE AUTH STATE ─────────────────────────────────────────────
  // context.storageState() writes all cookies to a JSON file.
  // Tests load this file so they start already logged in to HAL UAE.
  let saveError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await context.storageState({ path: AUTH_STATE_FILE });
      saveError = null;
      break;
    } catch (e) {
      saveError = e;
      console.log(`storageState attempt ${attempt} failed — retrying in 2s...`);
      await page.waitForTimeout(2000).catch(() => {});
    }
  }

  if (saveError) {
    console.log('ERROR: Could not save auth state after 3 attempts:', saveError.message.split('\n')[0]);
    await browser.close();
    process.exit(1);
  }

  console.log('✓ Auth state saved to:', AUTH_STATE_FILE);
  console.log('');
  console.log('You can now run your tests:');
  console.log('  npx playwright test tests/checkout.spec.js --headed --project=chromium');
  console.log('');
  console.log('NOTE: The HAL UAE staging session expires after ~60 minutes.');
  console.log('      Run tests promptly, or re-run this script if they fail with a login error.');
  console.log('');

  await browser.close();
})();
