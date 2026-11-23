import { test, expect } from '@playwright/test';

const TARGET_LABELS = [
  'Home Care Visit',
  'Med Check',
  'Nurse Visit',
  'Care Management',
  'Concierge Visit',
];

const DEPRECATED_LABELS = [
  'Respite Care',
  'Emergency Response',
  'Discharge Visit',
  'Make-up Visit',
  'Ongoing Support',
];

test.describe('wdvf3adf55: Visit Type Restriction & Enumeration Consolidation', () => {
  test('Create Visit modal displays exactly the 5 canonical visit types and hides deprecated types', async ({ page }) => {
    // Log in as seeded E2E admin
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@folkcare.example');
    await page.getByLabel(/password/i).fill('Admin123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Navigate to Schedule Builder / Visits page
    await page.goto('/scheduling/builder');
    await page.waitForLoadState('networkidle');

    // Open New Visit / Create Visit modal
    const newVisitBtn = page.getByRole('button', { name: /new visit|create visit|add visit|schedule visit/i }).first();
    await expect(newVisitBtn).toBeVisible({ timeout: 15000 });
    await newVisitBtn.click();

    // Check VisitTypeSelector radio options or Select options
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Open the Visit Type select dropdown inside the dialog
    const visitTypeTrigger = dialog.locator('#appointment-visit-type');
    await expect(visitTypeTrigger).toBeVisible({ timeout: 10000 });
    await visitTypeTrigger.click();

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const options = listbox.getByRole('option');
    await expect(options).toHaveCount(5);

    for (const label of TARGET_LABELS) {
      await expect(listbox.getByRole('option', { name: label, exact: true })).toBeVisible();
    }

    for (const deprecated of DEPRECATED_LABELS) {
      await expect(listbox.getByRole('option', { name: deprecated, exact: true })).toHaveCount(0);
    }
  });
});
