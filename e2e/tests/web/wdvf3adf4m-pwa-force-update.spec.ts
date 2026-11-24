import { test, expect } from "@playwright/test";
import { STORAGE_STATE_PATHS } from "../../fixtures/auth.fixture.js";

test.describe("wdvf3adf4m: PWA Force-Update Link + Version Display", () => {
  test.describe("Authenticated admin view", () => {
    test.use({
      storageState: STORAGE_STATE_PATHS.admin,
    });

    test("admin dashboard shows Force Update Link and footer displays app version", async ({
      page,
    }) => {
      await page.goto("/admin");
      await page.waitForURL(/\/(admin|dashboard)/, { timeout: 15000 });

      const section = page.getByTestId("force-update-link-section");
      await expect(section).toBeVisible({ timeout: 15000 });
      await expect(section).toContainText("Force Update Link");

      const urlInput = page.getByTestId("force-update-url-input");
      await expect(urlInput).toBeVisible();
      const urlValue = await urlInput.inputValue();
      expect(urlValue).toMatch(/\/force-update$/);

      const copyBtn = page.getByTestId("copy-force-update-link-btn");
      await expect(copyBtn).toBeVisible();

      const footer = page.getByTestId("app-version-footer");
      await expect(footer).toBeVisible();
      const versionEl = page.getByTestId("app-version-text");
      await expect(versionEl).toBeVisible();
      await expect(versionEl).toHaveText(/^v\d+\.\d+\.\d+/);
    });
  });

  test("public /force-update route clears caches and redirects without authentication", async ({
    page,
  }) => {
    await page.goto("/login");

    // Seed a dummy Cache Storage entry on this origin
    await page.evaluate(async () => {
      if (typeof caches !== "undefined") {
        const cache = await caches.open("wdvf3adf4m-stale-cache");
        await cache.put(
          new Request("/stale-test-asset"),
          new Response("stale"),
        );
      }
    });

    // Navigate directly to the public /force-update route
    await page.goto("/force-update");

    // Should redirect away from /force-update (to /?updated=... -> /login when unauthenticated)
    await page.waitForURL((url) => !url.pathname.startsWith("/force-update"), {
      timeout: 15000,
    });

    // Verify the stale cache was cleared
    const remainingCaches = await page.evaluate(async () => {
      if (typeof caches === "undefined") return [];
      return caches.keys();
    });
    expect(remainingCaches).not.toContain("wdvf3adf4m-stale-cache");
  });
});
