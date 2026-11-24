import { test, expect } from "@playwright/test";
import { STORAGE_STATE_PATHS } from "../../fixtures/auth.fixture.js";

test.describe("PWA Force-Update Link & Version Display (wdvf3adf4n)", () => {
  test.describe("Authenticated admin view", () => {
    test.use({
      storageState: STORAGE_STATE_PATHS.admin,
    });

    test("displays Force Update Link section on admin dashboard and version in footer", async ({
      page,
    }) => {
      await page.goto("/admin");
      await page.waitForURL(/\/(admin|dashboard)/, { timeout: 15000 });

      // 1. Force Update Link section is visible with deterministic /force-update URL
      const section = page.getByTestId("force-update-link-section");
      await expect(section).toBeVisible({ timeout: 15000 });

      const urlInput = page.getByTestId("force-update-url-input");
      await expect(urlInput).toBeVisible();
      const urlValue = await urlInput.inputValue();
      expect(urlValue).toMatch(/\/force-update$/);

      const copyBtn = page.getByTestId("copy-force-update-link-btn");
      await expect(copyBtn).toBeVisible();

      // 2. App version badge is displayed in the footer
      const footer = page.getByTestId("app-version-footer");
      await expect(footer).toBeVisible();
      await expect(page.getByTestId("app-version-text")).toHaveText(/^v\S+/);
    });
  });

  test.describe("Public /force-update route", () => {
    test("unauthenticated visit to /force-update clears caches and redirects cleanly", async ({
      page,
    }) => {
      // Seed a dummy cache entry before navigating to /force-update
      await page.goto("/login");
      await page.evaluate(async () => {
        if ("caches" in window) {
          const cache = await caches.open("test-stale-cache-wdvf3adf4n");
          await cache.put(
            new Request("/dummy-stale-asset"),
            new Response("stale"),
          );
        }
      });

      await page.goto("/force-update");

      // Should redirect away from /force-update to / (and then /login when unauthenticated)
      await page.waitForURL(/\/(login|\?updated=)/, { timeout: 15000 });

      const remainingCaches = await page.evaluate(async () => {
        if (!("caches" in window)) return [];
        return caches.keys();
      });
      expect(remainingCaches).not.toContain("test-stale-cache-wdvf3adf4n");
    });
  });
});
