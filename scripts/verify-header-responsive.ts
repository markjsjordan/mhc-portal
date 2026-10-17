import { chromium } from 'playwright';
import * as fs from 'fs';

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Pre-seed auth state for Admin
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => {
    const authState = {
      state: {
        user: {
          id: 'admin-123',
          email: 'admin@folkcare.example',
          name: 'Jane Admin',
          roles: ['ADMIN'],
          permissions: ['*'],
          organizationId: 'org-test',
        },
        token: 'test-token',
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem('auth-storage', JSON.stringify(authState));
  });

  // Reload to apply authenticated layout with Header
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForLoadState('networkidle');

  const widths = [320, 375, 390, 430, 1280];
  const results: any[] = [];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(500);

    const bellBtn = page.locator('button[aria-label="Notifications"]');
    const avatarBtn = page.locator('button[aria-label="User profile"]');
    const hamburgerBtn = page.locator('button[aria-label="Open navigation menu"]');

    await bellBtn.waitFor({ state: 'visible' });
    await avatarBtn.waitFor({ state: 'visible' });

    const bellBox = await bellBtn.boundingBox();
    const avatarBox = await avatarBtn.boundingBox();

    if (!bellBox || !avatarBox) {
      throw new Error(`Could not get bounding box for bell or avatar at ${width}px`);
    }

    // Logo locator (icon mark or full logo)
    let logoLocator;
    if (width < 360) {
      logoLocator = page.locator('[data-testid="header-logo-icon"]');
    } else {
      logoLocator = page.locator('[data-testid="header-logo-full"]');
    }
    await logoLocator.waitFor({ state: 'visible' });
    const logoBox = await logoLocator.boundingBox();

    if (!logoBox) {
      throw new Error(`Could not get logo bounding box at ${width}px`);
    }

    // Check tap targets
    const bellTargetOk = bellBox.width >= 44 && bellBox.height >= 44;
    const avatarTargetOk = avatarBox.width >= 44 && avatarBox.height >= 44;
    
    let hamburgerTargetOk = true;
    let hamburgerBox = null;
    if (width < 1024) {
      hamburgerBox = await hamburgerBtn.boundingBox();
      hamburgerTargetOk = !!hamburgerBox && hamburgerBox.width >= 44 && hamburgerBox.height >= 44;
    }

    // Check overlap: logo right edge must be <= bell left edge (with positive margin)
    const logoRight = logoBox.x + logoBox.width;
    const bellLeft = bellBox.x;
    const gap = bellLeft - logoRight;
    const noOverlap = gap > 0;

    const screenshotPath = `/tmp/header-verify-${width}.png`;
    await page.screenshot({ path: screenshotPath, clip: { x: 0, y: 0, width, height: 70 } });

    results.push({
      width,
      logoBox,
      bellBox,
      avatarBox,
      hamburgerBox,
      gapBetweenLogoAndBell: gap,
      noOverlap,
      bellTargetOk,
      avatarTargetOk,
      hamburgerTargetOk,
      screenshotPath,
    });
  }

  await browser.close();

  console.log('--- VERIFICATION RESULTS ---');
  let allPassed = true;
  for (const r of results) {
    console.log(`\nViewport Width: ${r.width}px`);
    console.log(`  Logo: x=${r.logoBox.x.toFixed(1)}, width=${r.logoBox.width.toFixed(1)}, right=${(r.logoBox.x + r.logoBox.width).toFixed(1)}`);
    console.log(`  Bell: x=${r.bellBox.x.toFixed(1)}, width=${r.bellBox.width.toFixed(1)} (tap target: ${r.bellBox.width.toFixed(0)}x${r.bellBox.height.toFixed(0)}px)`);
    console.log(`  Avatar tap target: ${r.avatarBox.width.toFixed(0)}x${r.avatarBox.height.toFixed(0)}px`);
    if (r.hamburgerBox) {
      console.log(`  Hamburger tap target: ${r.hamburgerBox.width.toFixed(0)}x${r.hamburgerBox.height.toFixed(0)}px`);
    }
    console.log(`  Clearance gap between Logo and Bell: ${r.gapBetweenLogoAndBell.toFixed(1)}px`);
    console.log(`  No Overlap: ${r.noOverlap ? 'PASS' : 'FAIL'}`);
    console.log(`  Tap Targets >= 44px: ${r.bellTargetOk && r.avatarTargetOk && r.hamburgerTargetOk ? 'PASS' : 'FAIL'}`);
    console.log(`  Screenshot saved: ${r.screenshotPath}`);

    if (!r.noOverlap || !r.bellTargetOk || !r.avatarTargetOk || !r.hamburgerTargetOk) {
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error('\nFAILED: One or more checks failed!');
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All widths (320px, 375px, 390px, 430px, 1280px) passed all requirements!');
  }
}

verify().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
