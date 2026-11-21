import { test, expect } from "@playwright/test";

test.describe("Create Recurring Schedule modal Select dropdowns (wdvf3add0f)", () => {
  test("Client, Caregiver, Service Type, and Frequency selects open, accept selection, and submit", async ({
    page,
  }) => {
    const consoleWarnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        consoleWarnings.push(msg.text());
      }
    });

    // Ensure deterministic client and caregiver options if the test DB has none
    await page.route("**/api/clients*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      if (response.ok()) {
        const json = (await response.json()) as {
          items?: unknown[];
          data?: { items?: unknown[] };
        };
        const items = json.items ?? json.data?.items ?? [];
        if (items.length >= 2) {
          await route.fulfill({ response });
          return;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "11111111-1111-4111-8111-111111111101",
              firstName: "John",
              lastName: "Doe",
              status: "ACTIVE",
              primaryAddress: { state: "FL" },
            },
            {
              id: "11111111-1111-4111-8111-111111111102",
              firstName: "Jane",
              lastName: "Roe",
              status: "ACTIVE",
              primaryAddress: { state: "TX" },
            },
          ],
          total: 2,
        }),
      });
    });

    await page.route("**/api/caregivers*", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      if (response.ok()) {
        const json = (await response.json()) as {
          items?: unknown[];
          caregivers?: unknown[];
          data?: unknown[];
        };
        const items = json.items ?? json.caregivers ?? json.data ?? [];
        if (Array.isArray(items) && items.length >= 1) {
          await route.fulfill({ response });
          return;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "22222222-2222-4222-8222-222222222201",
              firstName: "Alice",
              lastName: "Walker",
              role: "RN",
              status: "ACTIVE",
            },
            {
              id: "22222222-2222-4222-8222-222222222202",
              firstName: "Bob",
              lastName: "Smith",
              role: "HHA",
              status: "ACTIVE",
            },
          ],
          total: 2,
        }),
      });
    });

    let submittedPayload: Record<string, unknown> | null = null;
    await page.route("**/api/visits/patterns", async (route) => {
      if (route.request().method() === "POST") {
        submittedPayload = route.request().postDataJSON() as Record<
          string,
          unknown
        >;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ generatedVisitsCount: 4 }),
        });
        return;
      }
      await route.continue();
    });

    // Log in as seeded admin
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@folkcare.example");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    // Navigate to Schedule Builder
    await page.goto("/scheduling/builder");
    const recurringBtn = page.getByRole("button", {
      name: /\+ Recurring Schedule/i,
    });
    await expect(recurringBtn).toBeVisible({ timeout: 15000 });
    await recurringBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 1. Client dropdown — click without force so z-index occlusion fails Playwright actionability
    const clientTrigger = page.locator("#recurring-client");
    await clientTrigger.click();
    const clientOptions = page.getByRole("option");
    await expect(clientOptions.first()).toBeVisible();
    const targetClientOption =
      (await clientOptions.count()) > 1
        ? clientOptions.nth(1)
        : clientOptions.first();
    const selectedClientName = (await targetClientOption.innerText()).trim();
    await targetClientOption.click();
    await expect(clientTrigger).toContainText(selectedClientName);

    // 2. Caregiver dropdown
    const caregiverTrigger = page.locator("#recurring-caregiver");
    await caregiverTrigger.click();
    const caregiverOptions = page.getByRole("option");
    await expect(caregiverOptions.first()).toBeVisible();
    const targetCaregiverOption =
      (await caregiverOptions.count()) > 1
        ? caregiverOptions.nth(1)
        : caregiverOptions.first();
    const selectedCaregiverName = (
      await targetCaregiverOption.innerText()
    ).trim();
    await targetCaregiverOption.click();
    await expect(caregiverTrigger).toContainText(selectedCaregiverName);

    // 3. Service Type dropdown
    const serviceTypeTrigger = page.locator("#recurring-service-type");
    await serviceTypeTrigger.click();
    const skilledNursingOption = page.getByRole("option", {
      name: "Skilled Nursing",
    });
    await expect(skilledNursingOption).toBeVisible();
    await skilledNursingOption.click();
    await expect(serviceTypeTrigger).toContainText("Skilled Nursing");

    // 4. Frequency dropdown
    const frequencyTrigger = page.locator("#recurring-frequency");
    await frequencyTrigger.click();
    const biweeklyOption = page.getByRole("option", { name: "Bi-weekly" });
    await expect(biweeklyOption).toBeVisible();
    await biweeklyOption.click();
    await expect(frequencyTrigger).toContainText("Bi-weekly");

    // Submit the form and verify payload
    await page
      .getByRole("button", { name: /Generate Recurring Visits/i })
      .click();

    await expect.poll(() => submittedPayload).not.toBeNull();
    expect(submittedPayload?.["serviceTypeId"]).toBe(
      "00000000-0000-4000-8000-00000005ec03"
    );
    expect(submittedPayload?.["frequency"]).toBe("BIWEEKLY");
    expect(submittedPayload?.["clientId"]).toBeTruthy();

    // Assert zero controlled/uncontrolled console warnings
    const controlledWarnings = consoleWarnings.filter((msg) =>
      /controlled|uncontrolled/i.test(msg)
    );
    expect(controlledWarnings).toEqual([]);
  });
});
