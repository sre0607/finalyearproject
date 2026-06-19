const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const findChrome = () => {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\ASUS\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

(async () => {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('Could not find Google Chrome or Microsoft Edge installed at standard locations.');
    process.exit(1);
  }
  console.log(`Using system browser at: ${chromePath}`);

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Listen for console events
  page.on('console', msg => {
    console.log('PAGE LOG:', msg.text());
  });
  
  // Listen for page errors
  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  console.log('Navigating to http://127.0.0.1:8080/index.html...');
  try {
    await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'networkidle0', timeout: 10000 });
  } catch (err) {
    console.log('Navigation warning/error (waiting for networkidle0 timed out, continuing anyway):', err.message);
  }

  console.log('Page loaded. Waiting for 3 seconds for dynamic loaders and fetches to settle...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const screenshotPath = path.join(__dirname, 'homepage_screenshot.png');
  console.log(`Taking screenshot and saving to ${screenshotPath}...`);
  await page.screenshot({ path: screenshotPath });

  console.log('Checking for loaded items...');
  
  const categoryCount = await page.$$eval('.category-card', cards => cards.length);
  console.log(`Found ${categoryCount} category cards.`);

  const productCount = await page.$$eval('.product-card', cards => cards.length);
  console.log(`Found ${productCount} product cards.`);

  // Check if loader is hidden
  const loaderDisplay = await page.$eval('#global-loader', el => el.style.display).catch(() => 'NOT_FOUND');
  const loaderOpacity = await page.$eval('#global-loader', el => el.style.opacity).catch(() => 'NOT_FOUND');
  console.log(`Loader element state: display = ${loaderDisplay}, opacity = ${loaderOpacity}`);

  // Fetch some text contents from page to verify
  const brandName = await page.$eval('.logo, .admin-logo', el => el.textContent).catch(() => 'N/A');
  console.log(`Logo/Brand text found on page: ${brandName}`);

  // Print any errors or success status
  if (productCount > 0 && categoryCount > 0) {
    console.log('\n======================================================');
    console.log('TEST PASSED: Homepage loaded categories and products successfully!');
    console.log('======================================================');
  } else {
    console.log('\n======================================================');
    console.log('TEST FAILED: No categories or products found on the frontend!');
    console.log('======================================================');
  }

  await browser.close();
})();
