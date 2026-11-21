import { test, expect } from "@playwright/test";
import { STORAGE_STATE_PATHS } from "../fixtures/auth.fixture.js";
import { E2E_PERSONAS, E2E_UUIDS } from "../fixtures/test-data.js";
import { createCarePlan, createTask } from "../fixtures/factories.js";

test.use({ storageState: STORAGE_STATE_PATHS.admin });

// QA/GATE-2 regression coverage for FC-AUDIT-CAREPLANS.
// Each test creates its own isolated care plan / task via e2e/fixtures/factories.ts
// using the seeded E2E personas and fails loudly on setup errors.

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string
) {
  const logoutButton = page.getByRole("button", { name: /logout/i });
  if (await logoutButton.count()) {
    await logoutButton.click();
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 15000 }).catch(() => {});
  }
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

test.describe("FC-AUDIT-CAREPLANS GATE-2 regression", () => {
  test("care plan detail Edit link navigates to EditCarePlanPage (not 404)", async ({ page, request }) => {
    const carePlan = await createCarePlan(request, { clientId: E2E_UUIDS.CLIENT_001 });

    await loginAsAdmin(page);
    await page.goto(`/care-plans/${carePlan.id}`);
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    const editLink = page.getByRole("link", { name: /edit/i }).first();
    await editLink.click();

    await page.waitForURL(new RegExp(`/care-plans/${carePlan.id}/edit$`), { timeout: 10000 });
    await expect(page.getByText(/not found/i)).toHaveCount(0);
  });

  test("caregiver tasks page renders", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/caregiver/tasks");
    await expect(page.getByText(/not found/i)).toHaveCount(0);
    await expect(page.locator("body")).toBeVisible();
  });

  test("signature capture unblocks Complete Task submission", async ({ page, request }) => {
    const carePlan = await createCarePlan(request, { clientId: E2E_UUIDS.CLIENT_001 });
    const task = await createTask(request, {
      carePlanId: carePlan.id,
      clientId: carePlan.clientId,
      assignedCaregiverId: E2E_UUIDS.CAREGIVER_001,
      name: `E2E Signature Task ${Date.now()}`,
      description: "E2E-created task requiring a signature to complete",
      instructions: "Complete this task to verify signature-gated submission",
      requiredSignature: true,
      requiredNote: false,
    });

    // Switch sessions: log in as the seeded caregiver persona the task is assigned to.
    await login(page, E2E_PERSONAS.caregiver.email, E2E_PERSONAS.caregiver.password);

    await page.goto(`/tasks/${task.id}`);
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    const openModalButton = page.getByRole("button", { name: /complete task/i });
    await expect(openModalButton).toBeVisible();
    await openModalButton.click();

    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible();
    const completeButton = modal.getByRole("button", { name: /complete task/i });
    await expect(completeButton).toBeDisabled();

    // Draw a stroke on the signature canvas using pointer events.
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Signature canvas has no bounding box");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 80, { steps: 10 });
    await page.mouse.move(box.x + 200, box.y + 40, { steps: 10 });
    await page.mouse.up();

    const saveSignatureButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveSignatureButton).toBeEnabled();
    await saveSignatureButton.click();

    await expect(completeButton).toBeEnabled();
    await completeButton.click();

    await expect(modal).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(/failed to complete task/i)).toHaveCount(0);
  });

  test("list view (CaregiverTasksPage) gates signature-required Complete Task button", async ({ page, request }) => {
    const carePlan = await createCarePlan(request, { clientId: E2E_UUIDS.CLIENT_001 });
    const taskName = `E2E List-View Signature Task ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await createTask(request, {
      carePlanId: carePlan.id,
      clientId: carePlan.clientId,
      assignedCaregiverId: E2E_UUIDS.CAREGIVER_001,
      name: taskName,
      description: "E2E-created task requiring a signature, completed via the list view",
      instructions: "Complete this task from /caregiver/tasks to verify list-view signature gating",
      requiredSignature: true,
      requiredNote: false,
    });

    await login(page, E2E_PERSONAS.caregiver.email, E2E_PERSONAS.caregiver.password);

    await page.goto("/caregiver/tasks");
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    const taskCard = page
      .locator("div", { hasText: taskName })
      .filter({
        has: page.getByRole("button", { name: /complete task/i }),
      })
      .last();
    const completeTaskButton = taskCard.getByRole("button", { name: /complete task/i });
    await expect(completeTaskButton).toBeVisible();
    await completeTaskButton.click();

    const modal = page.locator(".fixed.inset-0");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByText(/signature required/i)).toBeVisible();

    const modalCompleteButton = modal.getByRole("button", { name: /complete task/i });
    await expect(modalCompleteButton).toBeDisabled();

    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Signature canvas has no bounding box");

    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 80, { steps: 10 });
    await page.mouse.move(box.x + 200, box.y + 40, { steps: 10 });
    await page.mouse.up();

    const saveSignatureButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveSignatureButton).toBeEnabled();
    await saveSignatureButton.click();

    await expect(modalCompleteButton).toBeEnabled();
    await modalCompleteButton.click();

    await expect(modal).toHaveCount(0, { timeout: 10000 });
    await expect(page.getByText(/failed to complete task/i)).toHaveCount(0);
  });

  test("create a care plan from template end-to-end", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/care-plans/from-template");
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    // Templates are code-defined (CARE_PLAN_TEMPLATES), so at least one
    // template card must always render.
    const useTemplateButton = page.getByRole("button", { name: /^use template$/i }).first();
    await expect(useTemplateButton).toBeVisible();
    await useTemplateButton.click();

    const useThisTemplateButton = page.getByRole("button", { name: /use this template/i });
    await expect(useThisTemplateButton).toBeVisible();
    await useThisTemplateButton.click();

    await page.waitForURL(/\/care-plans\/from-template\/.+/, { timeout: 10000 });
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    await page.getByPlaceholder("Enter client ID").fill(E2E_UUIDS.CLIENT_001);
    await page.getByPlaceholder("Enter care plan name").fill(
      `E2E From-Template Plan ${Date.now()}`
    );

    const createButton = page.getByRole("button", { name: /create care plan/i });
    await expect(createButton).toBeEnabled();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/api/care-plans/from-template") && res.request().method() === "POST"
      ),
      createButton.click(),
    ]);

    expect(response.status()).toBe(201);

    await expect(page.getByText(/failed to create care plan/i)).toHaveCount(0, { timeout: 10000 });
    await page.waitForURL((url) => !url.pathname.includes("/from-template"), { timeout: 10000 });
  });
});
