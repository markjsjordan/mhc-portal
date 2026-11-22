import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from '../../fixtures/auth.fixture.js';

test.use({ storageState: STORAGE_STATE_PATHS.admin });

test.describe('Weekly schedule backups (wdvf3add1c)', () => {
  test('admin can open Schedule Backups modal, capture a weekly snapshot, and export CSV/PDF', async ({
    page,
  }) => {
    await page.goto('/scheduling/calendar');

    // Open Schedule Backups modal from CalendarView toolbar
    const backupsBtn = page.getByTestId('calendar-schedule-backups-btn');
    await expect(backupsBtn).toBeVisible({ timeout: 15000 });
    await backupsBtn.click();

    const modal = page.getByTestId('schedule-backups-modal');
    await expect(modal).toBeVisible();

    // Capture an on-demand weekly snapshot with a unique label
    const uniqueLabel = `E2E Outage Backup ${Date.now()}`;
    await page.getByTestId('snapshot-label-input').fill(uniqueLabel);

    const createResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/schedule-snapshots') &&
        res.request().method() === 'POST'
    );
    await page.getByTestId('create-snapshot-btn').click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    // Verify the new snapshot row renders in the list
    const snapshotRow = page
      .getByTestId('snapshot-row')
      .filter({ hasText: uniqueLabel })
      .first();
    await expect(snapshotRow).toBeVisible();

    // Verify CSV export endpoint returns 200 text/csv
    const csvResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/export?format=csv') && res.request().method() === 'GET'
    );
    await snapshotRow.getByTestId('export-snapshot-csv-btn').click();
    const csvResponse = await csvResponsePromise;
    expect(csvResponse.status()).toBe(200);
    expect(csvResponse.headers()['content-type'] ?? '').toContain('text/csv');

    // Verify Printable PDF/HTML export button is present
    await expect(snapshotRow.getByTestId('export-snapshot-pdf-btn')).toBeVisible();
  });
});
