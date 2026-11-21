import { test, expect } from "@playwright/test";
import { STORAGE_STATE_PATHS } from "../fixtures/auth.fixture.js";
import { E2E_UUIDS } from "../fixtures/test-data.js";
import { createBillableItem, createInvoice, getAuthedHeaders, sendInvoice } from "../fixtures/factories.js";

test.use({ storageState: STORAGE_STATE_PATHS.admin });

// FC-AUDIT-BILLING-PAYROLL-EVV WU-7: Billing invoice lifecycle E2E coverage.
//
// Each test creates its own isolated invoice/data via e2e/fixtures/factories.ts
// so parallel workers never collide and missing data fails loudly instead of
// silently skipping.

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
}

/** Authenticated fetch executed in-page, reusing the app's own stored token. */
async function apiGet(page: import("@playwright/test").Page, url: string) {
  return page.evaluate(async (u) => {
    const raw = localStorage.getItem("auth-storage");
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const res = await fetch(u, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await res.json() : null;
    return {
      status: res.status,
      body,
      contentType,
      byteLength: contentType.includes("pdf")
        ? (await (await fetch(u, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).arrayBuffer()).byteLength
        : undefined,
    };
  }, url);
}

test.describe("FC-AUDIT-BILLING-PAYROLL-EVV: billing invoice lifecycle", () => {
  test("create invoice via /billing/new form redirects to /billing/:id", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/billing/new");
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const payerName = `E2E UI Payer ${Date.now()}`;
    const billableItemId = await createBillableItem({
      payerId: E2E_UUIDS.CLIENT_001,
      payerType: "PRIVATE_PAY",
      payerName,
      serviceDate: today,
    });

    await page.getByTestId("invoice-payer-id").fill(E2E_UUIDS.CLIENT_001);
    await page.getByTestId("invoice-payer-type").click();
    await page.getByRole("option", { name: /private pay/i }).click();
    await page.getByTestId("invoice-payer-name").fill(payerName);
    await page.getByTestId("invoice-date").fill(today);
    await page.getByTestId("invoice-due-date").fill(dueDate);
    await page.getByTestId("invoice-period-start").fill(today);
    await page.getByTestId("invoice-period-end").fill(today);
    await page.getByTestId("invoice-billable-item-ids").fill(billableItemId);

    await page.getByTestId("invoice-submit").click();

    await page.waitForURL(/\/billing\/[0-9a-f-]+$/, { timeout: 10000 });
    await expect(page.getByText(/not found/i)).toHaveCount(0);
  });

  test("Send Invoice transitions a DRAFT invoice to SENT", async ({ page, request }) => {
    const draftInvoice = await createInvoice(request);

    await loginAsAdmin(page);
    await page.goto(`/billing/${draftInvoice.id}`);
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    await page.getByRole("button", { name: /send invoice/i }).click();

    // Verify server-side status transition, not just UI state.
    const headers = getAuthedHeaders("admin");
    await expect
      .poll(
        async () => {
          const check = await request.get(`/api/billing/invoices/${draftInvoice.id}`, { headers });
          const body = await check.json().catch(() => null);
          return body?.status;
        },
        { timeout: 10000 }
      )
      .toBe("SENT");
  });

  test("Download PDF returns a PDF blob response", async ({ page, request }) => {
    const invoice = await createInvoice(request);

    await loginAsAdmin(page);
    await page.goto(`/billing/${invoice.id}`);
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    // Assert the underlying PDF endpoint directly rather than relying on
    // window.showSaveFilePicker (File System Access API), which headless
    // Chromium under Playwright does not support — the UI button's download
    // mutation calls this same endpoint (useDownloadInvoicePdf in this codebase).
    const pdfRes = await request.get(`/api/billing/invoices/${invoice.id}/pdf`, {
      headers: getAuthedHeaders("admin"),
    });
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"] ?? "").toContain("pdf");
    expect((await pdfRes.body()).byteLength).toBeGreaterThan(0);
  });

  test("Void transitions an invoice to VOIDED where status allows", async ({ page, request }) => {
    const invoice = await createInvoice(request);
    await sendInvoice(request, invoice.id);

    await loginAsAdmin(page);
    await page.goto(`/billing/${invoice.id}`);
    await expect(page.getByText(/not found/i)).toHaveCount(0);

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: /^void$/i }).click();

    const headers = getAuthedHeaders("admin");
    await expect
      .poll(
        async () => {
          const check = await request.get(`/api/billing/invoices/${invoice.id}`, { headers });
          const body = await check.json().catch(() => null);
          return body?.status;
        },
        { timeout: 10000 }
      )
      .toBe("VOIDED");
  });
});
