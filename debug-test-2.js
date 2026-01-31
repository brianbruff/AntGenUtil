const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture all socket events
  const socketEvents = [];
  page.on('console', msg => {
    const text = msg.text();
    socketEvents.push({ type: 'console', text });
    console.log('[Browser Console]', text);
  });

  page.on('pageerror', error => {
    console.error('[Browser Error]', error.message);
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  console.log('\n--- Initial Page Content ---');
  const bodyText = await page.textContent('body');
  console.log(bodyText.substring(0, 500));
  
  console.log('\n--- Checking for devices ---');
  const deviceCards = await page.locator('.device-card').count();
  console.log(`Device cards found: ${deviceCards}`);
  
  if (deviceCards > 0) {
    console.log('\n--- Device Card Content ---');
    const firstCard = page.locator('.device-card').first();
    console.log(await firstCard.textContent());
    
    console.log('\n--- Checking connect button ---');
    const connectBtn = firstCard.locator('.btn-connect');
    if (await connectBtn.isVisible()) {
      console.log('Connect button found, clicking...');
      
      // Clear previous events
      socketEvents.length = 0;
      
      await connectBtn.click();
      
      console.log('\n--- Waiting for connection events (10 seconds) ---');
      await page.waitForTimeout(10000);
      
      console.log('\n--- Socket Events during connection ---');
      socketEvents.forEach((evt, idx) => {
        console.log(`  [${idx}] ${evt.type}: ${evt.text}`);
      });
      
      console.log('\n--- After connection attempt ---');
      console.log('Device card content:');
      console.log(await firstCard.textContent());
      
      console.log('\n--- Checking for antennas ---');
      const antennaItems = await page.locator('.antenna-item').count();
      console.log(`Antenna items found: ${antennaItems}`);
      
      if (antennaItems > 0) {
        console.log('\n--- Antenna items ---');
        for (let i = 0; i < antennaItems; i++) {
          const item = page.locator('.antenna-item').nth(i);
          console.log(await item.textContent());
        }
      } else {
        console.log('No antenna items found');
      }
      
      console.log('\n--- Checking for error messages ---');
      const errorDiv = await page.locator('.error').count();
      console.log(`Error divs found: ${errorDiv}`);
      if (errorDiv > 0) {
        const errorText = await page.locator('.error').first().textContent();
        console.log('Error:', errorText);
      }
    } else {
      console.log('Connect button not found - device may already be connected');
    }
  }
  
  console.log('\n--- Taking screenshot ---');
  await page.screenshot({ path: 'debug-screenshot-2.png', fullPage: true });
  console.log('Screenshot saved to debug-screenshot-2.png');
  
  await browser.close();
  console.log('\nBrowser closed.');
})();
