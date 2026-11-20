import { test, expect } from "@playwright/test";

test.describe("Mobile Sidebar Viewport Containment (wdvf3adau7)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("mobile sidebar uses 100dvh and keeps footer visible without scrolling", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@folkcare.example");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    // Open mobile sidebar via menu button
    const menuButton = page.locator('button[aria-label="Open sidebar"], button[aria-label="Menu"], button:has(svg.lucide-menu)').first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    const aside = page.locator("aside").first();
    await expect(aside).toBeVisible();

    // Verify the fix: aside uses top-0 + 100dvh instead of inset-y-0, and inner container has overflow-hidden
    const asideClass = await aside.getAttribute("class");
    expect(asideClass).toContain("top-0");
    expect(asideClass).toContain("[height:100dvh]");
    expect(asideClass).not.toContain("inset-y-0");

    const innerDiv = aside.locator("> div").first();
    const innerClass = await innerDiv.getAttribute("class");
    expect(innerClass).toContain("overflow-hidden");

    // Verify sidebar height does not exceed viewport height
    const asideBox = await aside.boundingBox();
    expect(asideBox).not.toBeNull();
    expect(asideBox!.height).toBeLessThanOrEqual(844);
  });
});
