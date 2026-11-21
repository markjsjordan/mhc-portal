import { test, expect } from "@playwright/test";

test.describe("Team Settings Caregiver Role Dropdown (wdvf3adczm)", () => {
  test("includes Caregiver option in both Invite Team Member and Edit Team Member role dropdowns", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@folkcare.example");
    await page.fill('input[type="password"]', "Admin123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(admin|dashboard|clients|scheduling)/, {
      timeout: 15000,
    });

    await page.goto("/settings");

    // Open the Team tab
    const teamTab = page.getByRole("tab", { name: /Team/i });
    await expect(teamTab).toBeVisible({ timeout: 15000 });
    await teamTab.click();

    // 1. Verify Invite Team Member modal role dropdown includes CAREGIVER
    const inviteButton = page.getByRole("button", { name: /Invite Member/i });
    await expect(inviteButton).toBeVisible({ timeout: 15000 });
    await inviteButton.click();

    await expect(
      page.getByRole("heading", { name: "Invite Team Member" })
    ).toBeVisible();

    const inviteRoleSelect = page.locator('select[name="role"]');
    await expect(inviteRoleSelect).toBeVisible();

    const inviteOptions = await inviteRoleSelect.locator("option").evaluateAll((opts) =>
      opts.map((o) => ({
        value: (o as HTMLOptionElement).value,
        label: o.textContent?.trim() ?? "",
      }))
    );

    const inviteCaregiverIdx = inviteOptions.findIndex((o) => o.value === "CAREGIVER");
    const inviteCoordinatorIdx = inviteOptions.findIndex((o) => o.value === "COORDINATOR");
    const inviteSchedulerIdx = inviteOptions.findIndex((o) => o.value === "SCHEDULER");

    expect(inviteCaregiverIdx).toBeGreaterThan(-1);
    expect(inviteOptions[inviteCaregiverIdx]?.label).toBe("Caregiver");
    expect(inviteCaregiverIdx).toBeGreaterThan(inviteCoordinatorIdx);
    expect(inviteCaregiverIdx).toBeLessThan(inviteSchedulerIdx);

    await inviteRoleSelect.selectOption("CAREGIVER");
    await expect(inviteRoleSelect).toHaveValue("CAREGIVER");

    // Close Invite modal
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Invite Team Member" })
    ).toBeHidden();

    // 2. Verify Edit Team Member modal role dropdown includes CAREGIVER
    const editButton = page.getByRole("button", { name: /^Edit /i }).first();
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    const editDialog = page.getByRole("dialog", { name: "Edit Team Member" });
    await expect(editDialog).toBeVisible();

    const editRoleSelect = editDialog.locator('select[name="role"]');
    await expect(editRoleSelect).toBeVisible();

    const editOptions = await editRoleSelect.locator("option").evaluateAll((opts) =>
      opts.map((o) => ({
        value: (o as HTMLOptionElement).value,
        label: o.textContent?.trim() ?? "",
      }))
    );

    const editCaregiverIdx = editOptions.findIndex((o) => o.value === "CAREGIVER");
    const editCoordinatorIdx = editOptions.findIndex((o) => o.value === "COORDINATOR");
    const editSchedulerIdx = editOptions.findIndex((o) => o.value === "SCHEDULER");

    expect(editCaregiverIdx).toBeGreaterThan(-1);
    expect(editOptions[editCaregiverIdx]?.label).toBe("Caregiver");
    expect(editCaregiverIdx).toBeGreaterThan(editCoordinatorIdx);
    expect(editCaregiverIdx).toBeLessThan(editSchedulerIdx);

    await editRoleSelect.selectOption("CAREGIVER");
    await expect(editRoleSelect).toHaveValue("CAREGIVER");
  });
});
