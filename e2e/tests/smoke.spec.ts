import { test, expect } from "@playwright/test";

// Critical path smoke tests - run on every PR (@smoke) and after deployments
const API_BASE_URL = process.env["E2E_API_URL"] || "http://localhost:3000";

test("@smoke homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/MHC Portal/);
});

test("@smoke health check returns 200", async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/health`);
  expect(response.status()).toBe(200);
});

test("@smoke login page accessible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test("@smoke API responds correctly", async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/health`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.checks.api.status).toBe("ok");
});

test("@smoke database connection working", async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/health`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(["ok", "slow"]).toContain(body.checks.database.status);
});

test("@smoke admin login and dashboard loads", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("admin@folkcare.example");
  await page.locator('input[type="password"]').fill("Admin123!");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: /Administrator Dashboard/i })
  ).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0);
});

test("@smoke coordinator login and dashboard loads", async ({ page }) => {
  test.fixme(true, "needs non-admin seed users: E2E-3 wdvf3acxhp");

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("coordinator@e2e-test.com");
  await page.locator('input[type="password"]').fill("Admin123!");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/analytics\/coordinator/, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: /Coordinator Dashboard/i })
  ).toBeVisible();
});

test("@smoke caregiver login and dashboard loads", async ({ page }) => {
  test.fixme(true, "needs non-admin seed users: E2E-3 wdvf3acxhp");

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("caregiver@e2e-test.com");
  await page.locator('input[type="password"]').fill("Admin123!");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/caregiver\/dashboard/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: /Welcome,/i })).toBeVisible();
});

test("@smoke family login and dashboard loads", async ({ page }) => {
  test.fixme(true, "needs non-admin seed users: E2E-3 wdvf3acxhp");

  await page.goto("/login");
  await page.locator('input[type="email"]').fill("family@e2e-test.com");
  await page.locator('input[type="password"]').fill("Admin123!");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/family-portal/, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: /Welcome, Family Member/i })
  ).toBeVisible();
});
