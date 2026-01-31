const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
    console.log('[Browser Console]', msg.text());
  });

  page.on('pageerror', error => {
    console.error('[Browser Error]', error.message);
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  console.log('\n--- Page Content ---');
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
      await connectBtn.click();
      
      console.log('\n--- Waiting for connection (5 seconds) ---');
      await page.waitForTimeout(5000);
      
      console.log('\n--- After connection attempt ---');
      console.log('Device card content:');
      console.log(await firstCard.textContent());
      
      console.log('\n--- Checking for antennas ---');
      const antennaItems = await page.locator('.antenna-item').count();
      console.log(`Antenna items found: ${antennaItems}`);
      
      if (antennaItems > 0) {
        console.log('\n--- First antenna item ---');
        const firstAntenna = page.locator('.antenna-item').first();
        console.log(await firstAntenna.textContent());
      }
    } else {
      console.log('Connect button not found - device may already be connected');
    }
  } else {
    console.log('No device cards found - checking for "no devices" message');
    const noDevices = await page.locator('.no-devices').isVisible();
    console.log(`"No devices" message visible: ${noDevices}`);
    if (noDevices) {
      console.log(await page.locator('.no-devices').textContent());
    }
  }
  
  console.log('\n--- Taking screenshot ---');
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
  console.log('Screenshot saved to debug-screenshot.png');
  
  console.log('\n--- Console Logs Summary ---');
  logs.forEach(log => console.log(log));
  
  await browser.close();
  console.log('\nBrowser closed. Check debug-screenshot.png for visual debugging.');
})();
