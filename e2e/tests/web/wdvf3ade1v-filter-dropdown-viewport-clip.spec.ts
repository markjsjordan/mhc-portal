import { test, expect } from "@playwright/test";
import { STORAGE_STATE_PATHS } from "../../fixtures/auth.fixture.js";

test.describe("FilterDropdown Viewport Containment (wdvf3ade1v)", () => {
  test.describe("Mobile viewport (375px)", () => {
    test.use({
      viewport: { width: 375, height: 667 },
      storageState: STORAGE_STATE_PATHS.admin,
    });

    test("renders FilterDropdown panel fully within 375px viewport without clipping off-screen", async ({
      page,
    }) => {
      await page.goto("/clients");
      await page.waitForURL(/\/clients/, { timeout: 15000 });

      const filterButton = page
        .getByRole("button", { name: /filters/i })
        .first();
      await expect(filterButton).toBeVisible({ timeout: 15000 });
      await filterButton.click();

      const applyButton = page.getByRole("button", { name: "Apply" });
      await expect(applyButton).toBeVisible();

      const panel = applyButton.locator("xpath=ancestor::div[contains(@class, 'absolute')]").first();
      await expect(panel).toBeVisible();

      const panelClass = await panel.getAttribute("class");
      expect(panelClass).toContain("left-0");
      expect(panelClass).toContain("sm:left-auto");
      expect(panelClass).toContain("sm:right-0");
      expect(panelClass).toContain("max-w-[calc(100vw-2rem)]");

      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    });
  });

  test.describe("Desktop viewport (1024px)", () => {
    test.use({
      viewport: { width: 1024, height: 768 },
      storageState: STORAGE_STATE_PATHS.admin,
    });

    test("renders FilterDropdown panel right-aligned within 1024px viewport", async ({
      page,
    }) => {
      await page.goto("/clients");
      await page.waitForURL(/\/clients/, { timeout: 15000 });

      const filterButton = page
        .getByRole("button", { name: /filters/i })
        .first();
      await expect(filterButton).toBeVisible({ timeout: 15000 });
      await filterButton.click();

      const applyButton = page.getByRole("button", { name: "Apply" });
      await expect(applyButton).toBeVisible();

      const panel = applyButton.locator("xpath=ancestor::div[contains(@class, 'absolute')]").first();
      await expect(panel).toBeVisible();

      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
    });
  });
});
