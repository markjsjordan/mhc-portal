import { test, expect } from '@playwright/test';

test.describe('Client intake wizard per-step Save button (wdvf3adau9)', () => {
  test('validates required fields, creates PENDING_INTAKE draft on first Save, and updates on subsequent Save', async ({
    page,
  }) => {
    // Log in as the seeded E2E admin user
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@folkcare.example');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    // Intercept client write calls because admin@folkcare.example is a read-only demo email
    const capturedRequests: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
    await page.route('**/api/clients**', async (route) => {
      const req = route.request();
      const method = req.method();
      if (method === 'POST') {
        const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        capturedRequests.push({ method, url: req.url(), body });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'e2e-draft-client-1',
              ...body,
              status: 'PENDING_INTAKE',
            },
          }),
        });
        return;
      }
      if (method === 'PATCH' || method === 'PUT') {
        const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        capturedRequests.push({ method, url: req.url(), body });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'e2e-draft-client-1',
              ...body,
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/clients/intake');
    await expect(
      page.getByRole('heading', { name: 'Demographics & Contact Information' })
    ).toBeVisible();

    const saveBtn = page.getByRole('button', { name: /Save/i });
    await expect(saveBtn).toBeVisible();

    // 1. Clicking Save without required fields shows validation error and does not POST
    await saveBtn.click();
    await expect(page.getByText('First name is required to save.')).toBeVisible();
    expect(capturedRequests).toHaveLength(0);

    // 2. Fill Step 1 required fields
    const uniqueSuffix = Date.now().toString().slice(-6);
    await page.locator('#first-name').fill(`DraftFirst${uniqueSuffix}`);
    await page.locator('#last-name').fill(`DraftLast${uniqueSuffix}`);
    await page.locator('#date-of-birth').fill('1980-05-15');
    await page.locator('#address-line1').fill('123 Main St');
    await page.locator('#address-city').fill('Austin');
    await page.locator('#address-state').click();
    await page.getByRole('option', { name: /Texas \(TX\)/i }).click();
    await page.locator('#address-postal').fill('78701');

    // 3. First Save -> POST /api/clients creates PENDING_INTAKE draft, stays on Step 1
    await saveBtn.click();
    await expect(page.getByText('Progress saved').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Demographics & Contact Information' })
    ).toBeVisible();

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]?.method).toBe('POST');
    expect(capturedRequests[0]?.body['status']).toBe('PENDING_INTAKE');
    expect(capturedRequests[0]?.body['firstName']).toBe(`DraftFirst${uniqueSuffix}`);

    // 4. Advance to Step 2 and press Save -> updates existing record (PATCH/PUT), stays on Step 2
    await page.getByRole('button', { name: /Next →/i }).click();
    await expect(page.getByRole('heading', { name: 'Care Assessment' })).toBeVisible();

    await page.getByRole('button', { name: /Save/i }).click();
    await expect.poll(() => capturedRequests.length).toBe(2);
    expect(['PATCH', 'PUT']).toContain(capturedRequests[1]?.method);
    expect(capturedRequests[1]?.url).toContain('/api/clients/e2e-draft-client-1');

    await expect(page.getByText('Progress saved').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Care Assessment' })).toBeVisible();
  });
});
