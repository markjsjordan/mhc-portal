import { test, expect } from '@playwright/test';

test.describe('Client Intake Visit Frequency & Duration Free-Text (wdvf3add19)', () => {
  test('renders visit frequency and duration as free-text inputs and preserves values to Review step', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@folkcare.example');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    await page.goto('/clients/new/intake');
    await expect(page.locator('#first-name')).toBeVisible({ timeout: 15000 });

    // Fill required Step 1 fields
    await page.fill('#first-name', 'Jane');
    await page.fill('#last-name', 'Doe');
    await page.fill('#date-of-birth', '1980-05-15');
    await page.fill('#address-line1', '123 Main Street');
    await page.fill('#address-city', 'Austin');
    await page.click('#address-state');
    // Wait for shadcn Select dropdown portal to open before clicking option
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByRole('option', { name: /Texas|TX/i }).first().click();
    await page.fill('#address-postal', '78701');

    // Step 1 -> Step 2 -> Step 3 (Care Plan Creation)
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Care Assessment')).toBeVisible();
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Care Plan Creation')).toBeVisible();

    // Assert #visit-frequency and #visit-duration are text <input> elements (not combobox/select)
    const freqInput = page.locator('#visit-frequency');
    const durInput = page.locator('#visit-duration');
    await expect(freqInput).toBeVisible();
    await expect(durInput).toBeVisible();

    const freqTag = await freqInput.evaluate((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      role: el.getAttribute('role'),
    }));
    const durTag = await durInput.evaluate((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      role: el.getAttribute('role'),
    }));

    expect(freqTag.tag).toBe('INPUT');
    expect(freqTag.type).toBe('text');
    expect(freqTag.role).not.toBe('combobox');
    expect(durTag.tag).toBe('INPUT');
    expect(durTag.type).toBe('text');
    expect(durTag.role).not.toBe('combobox');

    // Enter free-text values
    await freqInput.fill('3x per week');
    await durInput.fill('45-60 min');
    await expect(freqInput).toHaveValue('3x per week');
    await expect(durInput).toHaveValue('45-60 min');

    // Advance Step 3 -> Step 4 -> Step 5 -> Step 6 -> Step 7 (Review & Submit)
    for (let i = 0; i < 4; i += 1) {
      await page.getByRole('button', { name: /Next/i }).click();
    }

    await expect(page.getByText('Review & Submit')).toBeVisible();
    await expect(page.getByText('3x per week')).toBeVisible();
    await expect(page.getByText('45-60 min')).toBeVisible();
  });
});
