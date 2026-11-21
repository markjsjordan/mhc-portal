import { test, expect } from '@playwright/test';

const MOCK_CLIENT_ID = 'e2e-client-mobile-1';
const MOCK_CAREGIVER_ID = 'e2e-caregiver-mobile-1';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@folkcare.example');
  await page.fill('input[type="password"]', 'Admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
    timeout: 15000,
  });
}

test.describe('Mobile Detail Header Layout (wdvf3adau8)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Client detail page (/clients/:id) stacks Back button, name+status badge, and action buttons on 375px mobile viewport', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.route(`**/api/clients/${MOCK_CLIENT_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_CLIENT_ID,
          clientNumber: 'CL-2026-0042',
          firstName: 'Eleanor',
          middleName: 'Margaret',
          lastName: 'Vandenberg-Montgomery',
          dateOfBirth: '1945-04-12T00:00:00.000Z',
          gender: 'FEMALE',
          status: 'ACTIVE',
          email: 'eleanor@example.com',
          primaryPhone: {
            number: '5125550199',
            type: 'MOBILE',
            canReceiveSMS: true,
          },
          primaryAddress: {
            line1: '100 Congress Ave',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
          },
          emergencyContacts: [],
          createdAt: '2026-01-10T00:00:00.000Z',
          intakeDate: '2026-01-15T00:00:00.000Z',
        }),
      });
    });

    await page.route(`**/api/clients/${MOCK_CLIENT_ID}/portal-access`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'NONE',
          email: 'eleanor@example.com',
          portalSelfAccessAllowed: false,
        }),
      });
    });

    await page.route(`**/api/clients/${MOCK_CLIENT_ID}/**`, async (route) => {
      if (route.request().url().includes('/portal-access')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/clients/${MOCK_CLIENT_ID}`);

    const backBtn = page.getByRole('button', { name: /back/i });
    const heading = page.getByRole('heading', { level: 1 });
    const statusBadge = page.getByText('Active', { exact: true }).first();
    const editBtn = page.getByRole('button', { name: /^edit$/i });
    const deleteBtn = page.getByRole('button', { name: /^delete$/i });

    await expect(backBtn).toBeVisible();
    await expect(heading).toBeVisible();
    await expect(statusBadge).toBeVisible();
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    const backBox = await backBtn.boundingBox();
    const nameBox = await heading.boundingBox();
    const badgeBox = await statusBadge.boundingBox();
    const editBox = await editBtn.boundingBox();
    const deleteBox = await deleteBtn.boundingBox();

    expect(backBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(editBox).not.toBeNull();
    expect(deleteBox).not.toBeNull();

    // Row 1: Back button on its own dedicated row above the name
    expect(backBox!.y + backBox!.height).toBeLessThanOrEqual(nameBox!.y + 2);

    // Row 3: Edit and Delete grouped together on their own row below name and status badge
    expect(editBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 2);
    expect(editBox!.y).toBeGreaterThanOrEqual(badgeBox!.y + badgeBox!.height - 2);
    expect(Math.abs(editBox!.y - deleteBox!.y)).toBeLessThanOrEqual(4);

    // Minimum 44px tap target height
    expect(backBox!.height).toBeGreaterThanOrEqual(44);
    expect(editBox!.height).toBeGreaterThanOrEqual(44);
    expect(deleteBox!.height).toBeGreaterThanOrEqual(44);

    // No horizontal overflow on 375px viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    for (const box of [backBox!, nameBox!, badgeBox!, editBox!, deleteBox!]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });

  test('Caregiver detail page (/caregivers/:id) stacks Back button, name+pill status badge, and action buttons on 375px mobile viewport', async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.route(`**/api/caregivers/${MOCK_CAREGIVER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_CAREGIVER_ID,
          employeeNumber: 'EMP-2026-0088',
          firstName: 'Gabriella',
          middleName: 'Rose',
          lastName: 'Hernandez-Castellanos',
          email: 'gabriella@example.com',
          status: 'PENDING_ONBOARDING',
          role: 'CAREGIVER',
          employmentType: 'FULL_TIME',
          employmentStatus: 'PENDING_ONBOARDING',
          hireDate: '2026-02-01T00:00:00.000Z',
          dateOfBirth: '1991-08-19T00:00:00.000Z',
          primaryPhone: {
            number: '5125550144',
            type: 'MOBILE',
          },
          primaryAddress: {
            line1: '200 Congress Ave',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
          },
          complianceStatus: 'PENDING_VERIFICATION',
          primaryBranchId: 'branch-1',
          branchIds: ['branch-1'],
          credentials: [],
          training: [],
          emergencyContacts: [],
          version: 1,
        }),
      });
    });

    await page.route(`**/api/caregivers/${MOCK_CAREGIVER_ID}/**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'NONE', email: 'gabriella@example.com' }),
      });
    });

    await page.goto(`/caregivers/${MOCK_CAREGIVER_ID}`);

    const backBtn = page.getByRole('button', { name: /back/i });
    const heading = page.getByRole('heading', { level: 1 });
    const statusBadge = page.getByText('Pending Onboarding', { exact: true });
    const editBtn = page.getByRole('button', { name: /edit/i });
    const deleteBtn = page.getByRole('button', { name: /delete/i });

    await expect(backBtn).toBeVisible();
    await expect(heading).toBeVisible();
    await expect(statusBadge).toBeVisible();
    await expect(page.getByText('PENDING_ONBOARDING', { exact: true })).toHaveCount(0);
    await expect(editBtn).toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // Pill badge styling
    const badgeClass = await statusBadge.getAttribute('class');
    expect(badgeClass).toContain('rounded-full');

    const backBox = await backBtn.boundingBox();
    const nameBox = await heading.boundingBox();
    const badgeBox = await statusBadge.boundingBox();
    const editBox = await editBtn.boundingBox();
    const deleteBox = await deleteBtn.boundingBox();

    expect(backBox).not.toBeNull();
    expect(nameBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    expect(editBox).not.toBeNull();
    expect(deleteBox).not.toBeNull();

    // Row 1: Back button on its own dedicated row above the name
    expect(backBox!.y + backBox!.height).toBeLessThanOrEqual(nameBox!.y + 2);

    // Status badge does not overlap the name bounding box
    const overlapsName =
      badgeBox!.x < nameBox!.x + nameBox!.width &&
      badgeBox!.x + badgeBox!.width > nameBox!.x &&
      badgeBox!.y < nameBox!.y + nameBox!.height &&
      badgeBox!.y + badgeBox!.height > nameBox!.y;
    expect(overlapsName).toBe(false);

    // Action buttons grouped together below the name+status block
    expect(editBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 2);
    expect(editBox!.y).toBeGreaterThanOrEqual(badgeBox!.y + badgeBox!.height - 2);
    expect(Math.abs(editBox!.y - deleteBox!.y)).toBeLessThanOrEqual(4);

    // Minimum 44px tap target height
    expect(backBox!.height).toBeGreaterThanOrEqual(44);
    expect(editBox!.height).toBeGreaterThanOrEqual(44);
    expect(deleteBox!.height).toBeGreaterThanOrEqual(44);

    // No horizontal overflow on 375px viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);

    for (const box of [backBox!, nameBox!, badgeBox!, editBox!, deleteBox!]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });
});
