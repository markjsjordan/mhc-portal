import { test, expect } from "@playwright/test";

test.describe("wdvf3adf4m: PWA Force-Update Link + Version Display", () => {
  test("admin dashboard shows Force Update Link and footer displays app version", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("admin@folkcare.example");
    await page.locator('input[type="password"]').fill("Admin123!");
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/admin/, { timeout: 15000 });

    const section = page.getByTestId("force-update-link-section");
    await expect(section).toBeVisible();
    await expect(section).toContainText("Force Update Link");

    const urlEl = page.getByTestId("force-update-url");
    await expect(urlEl).toBeVisible();
    await expect(urlEl).toContainText("/force-update");

    const copyBtn = page.getByTestId("copy-force-update-link");
    await expect(copyBtn).toBeVisible();

    const footer = page.getByTestId("app-footer");
    await expect(footer).toBeVisible();
    const versionEl = page.getByTestId("app-version");
    await expect(versionEl).toBeVisible();
    await expect(versionEl).toHaveText(/^v\d+\.\d+\.\d+/);
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

    // Should redirect away from /force-update (to /?_updated=... -> /login when unauthenticated)
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
