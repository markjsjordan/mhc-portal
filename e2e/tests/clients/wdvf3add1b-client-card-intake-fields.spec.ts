import { test, expect } from '@playwright/test';

test.describe('Client card displays all intake fields (wdvf3add1b)', () => {
  test('renders physician, insurance/authorization, assessment, care plan, schedule, and consents on client detail view', async ({
    page,
  }) => {
    // Log in as the seeded E2E admin user
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@folkcare.example');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

    const clientId = 'e2e-intake-client-wdvf3add1b';

    // Intercept client detail GET with a fully populated intake client record
    await page.route(`**/api/clients/${clientId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: clientId,
              organizationId: 'org-e2e',
              branchId: 'branch-e2e',
              clientNumber: 'CL-E2E-101',
              firstName: 'Eleanor',
              lastName: 'Vance',
              dateOfBirth: '1948-04-12',
              email: 'eleanor.vance@example.invalid',
              primaryPhone: {
                number: '5125550101',
                type: 'MOBILE',
                canReceiveSMS: true,
              },
              primaryAddress: {
                type: 'HOME',
                line1: '742 Evergreen Terrace',
                city: 'Austin',
                state: 'TX',
                postalCode: '78701',
                country: 'US',
              },
              emergencyContacts: [
                {
                  id: 'ec-1',
                  name: 'Arthur Vance',
                  relationship: 'Son',
                  phone: { number: '5125550102', type: 'MOBILE', canReceiveSMS: false },
                  isPrimary: true,
                  canMakeHealthcareDecisions: true,
                },
              ],
              status: 'ACTIVE',
              primaryPhysician: {
                name: 'Dr. Gregory House',
                phone: { number: '5125550199', type: 'WORK' },
              },
              insurance: [
                {
                  id: 'ins-1',
                  type: 'MEDICAID',
                  payerName: 'Texas Medicaid',
                  policyNumber: 'POL-987654',
                  groupNumber: 'GRP-1234',
                  isPrimary: true,
                },
              ],
              authorizationInfo: {
                number: 'AUTH-2026-88',
                approvedHours: 24,
                validFrom: '2026-01-01',
                validTo: '2026-12-31',
              },
              assessmentData: {
                adls: {
                  bathing: 'assistance',
                  dressing: 'independent',
                },
                iadls: {
                  mealPrep: 'assistance',
                  transportation: 'dependent',
                },
                mobility: 'walker',
                cognitive: 'mild',
                conditions: ['Hypertension'],
                medications: [{ name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' }],
                allergies: ['Penicillin'],
                dietaryNeeds: 'Low sodium diabetic diet',
              },
              carePlanSummary: {
                serviceTypes: ['Personal Care'],
                visitFrequency: '3x per week',
                visitDuration: '2 hours',
                preferredTimes: ['Morning'],
                tasks: ['Bathing Assistance'],
                goals: 'Maintain independence at home safely',
              },
              visitSchedule: {
                scheduleStartDate: '2026-02-01',
                visitSchedule: [{ dayOfWeek: 1, time: '09:00', duration: 2 }],
              },
              consents: {
                careAgreement: true,
                hipaa: true,
                financialResponsibility: true,
                evv: true,
                signature: 'Eleanor Vance',
                signedDate: '2026-01-15',
              },
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/clients/${clientId}`);

    // Verify Physician card
    const physicianCard = page.getByTestId('client-physician-card');
    await expect(physicianCard).toBeVisible();
    await expect(physicianCard).toContainText('Dr. Gregory House');

    // Verify Insurance & Authorization card
    const insuranceCard = page.getByTestId('client-insurance-authorization-card');
    await expect(insuranceCard).toBeVisible();
    await expect(insuranceCard).toContainText('POL-987654');
    await expect(insuranceCard).toContainText('GRP-1234');
    await expect(insuranceCard).toContainText('AUTH-2026-88');
    await expect(insuranceCard).toContainText('24 hrs');

    // Verify Care Assessment card
    const assessmentCard = page.getByTestId('client-assessment-card');
    await expect(assessmentCard).toBeVisible();
    await expect(assessmentCard).toContainText('Walker');
    await expect(assessmentCard).toContainText('Mild Impairment');
    await expect(assessmentCard).toContainText('Hypertension');
    await expect(assessmentCard).toContainText('Metformin');
    await expect(assessmentCard).toContainText('Penicillin');
    await expect(assessmentCard).toContainText('Low sodium diabetic diet');

    // Verify Care Plan Summary card
    const carePlanCard = page.getByTestId('client-care-plan-card');
    await expect(carePlanCard).toBeVisible();
    await expect(carePlanCard).toContainText('Personal Care');
    await expect(carePlanCard).toContainText('3x per week');
    await expect(carePlanCard).toContainText('2 hours');
    await expect(carePlanCard).toContainText('Bathing Assistance');
    await expect(carePlanCard).toContainText('Maintain independence at home safely');

    // Verify Initial Visit Schedule card
    const scheduleCard = page.getByTestId('client-visit-schedule-card');
    await expect(scheduleCard).toBeVisible();
    await expect(scheduleCard).toContainText('Monday');
    await expect(scheduleCard).toContainText('09:00');

    // Verify Consents & Signatures card
    const consentsCard = page.getByTestId('client-consents-card');
    await expect(consentsCard).toBeVisible();
    await expect(consentsCard).toContainText('Eleanor Vance');
  });
});
