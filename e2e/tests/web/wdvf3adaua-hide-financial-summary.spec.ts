import { test, expect } from "@playwright/test";

test.describe("Admin Dashboard Financial Summary Hidden (wdvf3adaua)", () => {
  test("hides Financial Summary panel via display:none while keeping Quick Actions visible", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@folkcare.example");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Administrator Dashboard", level: 1 })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Quick Actions", level: 2 })
    ).toBeVisible();

    // Financial Summary heading must still be attached in the DOM (reversible display:none) and hidden
    const financialSummaryHeading = page.locator("h2", {
      hasText: "Financial Summary",
    });
    await expect(financialSummaryHeading).toBeAttached();
    await expect(financialSummaryHeading).toBeHidden();

    // All four financial KPI card labels must be hidden
    for (const label of [
      "Outstanding A/R",
      "Total Billed",
      "Collected",
      "Avg Reimbursement",
    ]) {
      await expect(page.getByText(label, { exact: true })).toBeHidden();
    }

    // Sibling Quick Actions panel and its action items must remain visible
    for (const action of [
      "Run Reports",
      "Bulk Import / Export",
      "System Activity",
    ]) {
      await expect(page.getByText(action, { exact: true })).toBeVisible();
    }
  });
});
