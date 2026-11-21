import { test, expect } from "@playwright/test";

test.describe("Settings Team Members Header Overflow (wdvf3adaue)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Team Members header fits on one row without overflow and Account/Preferences tabs do not regress", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@folkcare.example");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    await page.goto("/settings/team");

    const heading = page.getByRole("heading", { name: "Team Members" });
    const statusFilter = page.locator("#team-status-filter");
    const inviteButton = page.getByRole("button", { name: /Invite Member/i });

    await expect(heading).toBeVisible();
    await expect(statusFilter).toBeVisible();
    await expect(inviteButton).toBeVisible();

    // Locate the Team Members card container (nearest ancestor with card padding/border)
    const card = heading.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
    await expect(card).toBeVisible();

    const [cardBox, headingBox, selectBox, buttonBox] = await Promise.all([
      card.boundingBox(),
      heading.boundingBox(),
      statusFilter.boundingBox(),
      inviteButton.boundingBox(),
    ]);

    expect(cardBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();

    // Title should not wrap onto multiple lines at desktop width
    const lineHeight = await heading.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const parsed = parseFloat(style.lineHeight);
      return Number.isNaN(parsed) ? parseFloat(style.fontSize) * 1.5 : parsed;
    });
    expect(headingBox!.height).toBeLessThanOrEqual(lineHeight * 1.35);

    // All three elements sit on the same horizontal row in left-to-right order
    expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(selectBox!.x + 1);
    expect(selectBox!.x + selectBox!.width).toBeLessThanOrEqual(buttonBox!.x + 1);

    const headingCenterY = headingBox!.y + headingBox!.height / 2;
    const selectCenterY = selectBox!.y + selectBox!.height / 2;
    const buttonCenterY = buttonBox!.y + buttonBox!.height / 2;
    expect(Math.abs(selectCenterY - buttonCenterY)).toBeLessThanOrEqual(8);
    expect(Math.abs(headingCenterY - buttonCenterY)).toBeLessThanOrEqual(24);

    // No horizontal overflow or clipping of filter or Invite Member button
    const cardRight = cardBox!.x + cardBox!.width;
    expect(selectBox!.x + selectBox!.width).toBeLessThanOrEqual(cardRight);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(cardRight);

    const cardOverflow = await card.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(cardOverflow.scrollWidth).toBeLessThanOrEqual(cardOverflow.clientWidth);

    // Verify no regression on Account and Preferences tabs
    await page.getByRole("tab", { name: /Account/i }).click();
    const accountHeading = page.getByRole("heading", { name: "Change Password" });
    await expect(accountHeading).toBeVisible();
    const accountCard = accountHeading.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
    const accountOverflow = await accountCard.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(accountOverflow.scrollWidth).toBeLessThanOrEqual(accountOverflow.clientWidth);

    await page.getByRole("tab", { name: /Preferences/i }).click();
    const prefsHeading = page.getByRole("heading", { name: "Preferences" });
    await expect(prefsHeading).toBeVisible();
    const prefsCard = prefsHeading.locator("xpath=ancestor::div[contains(@class, 'rounded-lg')][1]");
    const prefsOverflow = await prefsCard.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(prefsOverflow.scrollWidth).toBeLessThanOrEqual(prefsOverflow.clientWidth);
  });
});
