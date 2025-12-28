const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== Test 1: Load home page ===');
  await page.goto('https://autobiography-web.pages.dev', { waitUntil: 'networkidle' });
  console.log('URL:', page.url());
  await page.waitForTimeout(2000);

  console.log('\n=== Test 2: Click "Get Started Free" ===');
  const getStartedBtn = page.locator('a:has-text("Get Started Free")').first();
  await getStartedBtn.click();
  await page.waitForTimeout(3000);
  console.log('URL after click:', page.url());

  // Take screenshot
  await page.screenshot({ path: '/Users/caseymanos/projects/dale/autobio/screenshot-auth.png', fullPage: true });
  console.log('Screenshot saved to screenshot-auth.png');

  // Check if we're on auth page
  if (page.url().includes('/auth')) {
    console.log('\n=== Test 3: Sign up form visible ===');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    console.log('Email input exists:', await emailInput.count() > 0);
    console.log('Password input exists:', await passwordInput.count() > 0);
    console.log('Submit button exists:', await submitBtn.count() > 0);

    console.log('\n=== Test 4: Complete signup ===');
    const testEmail = `test-${Date.now()}@example.com`;
    await emailInput.fill(testEmail);
    await passwordInput.fill('testpass123');
    await submitBtn.click();

    // Wait for navigation or error
    await page.waitForTimeout(5000);
    console.log('URL after signup:', page.url());

    await page.screenshot({ path: '/Users/caseymanos/projects/dale/autobio/screenshot-after-signup.png', fullPage: true });
    console.log('Screenshot saved to screenshot-after-signup.png');

    // Check if we made it to dashboard
    if (page.url().includes('/dashboard')) {
      console.log('\n✅ SUCCESS: Reached dashboard after signup!');

      // Check for dashboard content
      const dashboardContent = await page.locator('body').textContent();
      console.log('Dashboard shows:', dashboardContent?.substring(0, 200));
    } else {
      console.log('\n❌ ISSUE: Did not reach dashboard');
      const bodyText = await page.locator('body').textContent();
      console.log('Current page shows:', bodyText?.substring(0, 500));
    }
  } else {
    console.log('\n❌ ISSUE: Did not navigate to auth page');
    console.log('Current URL:', page.url());
  }

  await browser.close();
})();
