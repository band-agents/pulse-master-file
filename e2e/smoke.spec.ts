import { test, expect } from "@playwright/test";

/**
 * Phase 0 smoke test — the canary for the whole app:
 * boot in demo mode → open Quotations → create a quotation → see it in the list.
 * If this fails, something load-bearing broke (routing, auth gate, data
 * adapter, or the quotation money path).
 */

const ONBOARDING = {
  completed: true,
  businessType: "furniture",
  companySize: "11-50",
  painPoints: [],
  enabled_modules: [
    "sales", "production", "inventory", "purchasing",
    "finance", "analytics", "hr", "delivery", "quality",
  ],
  currency: "EGP",
  defaultLanguage: "en",
  companyName: "Smoke Test Co",
  language: "en",
};

test.beforeEach(async ({ page }) => {
  // Demo mode auto-authenticates; the only gate is the onboarding flag.
  await page.addInitScript((data) => {
    localStorage.setItem("thoth_onboarding", JSON.stringify(data));
  }, ONBOARDING);
});

test("app boots into the shell", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/quotations");
  await expect(page.getByRole("button", { name: /New Quotation/i }).first()).toBeVisible({ timeout: 15_000 });

  expect(errors, `Uncaught page errors: ${errors.join(" | ")}`).toEqual([]);
});

test("create a quotation and see it in the list", async ({ page }) => {
  await page.goto("/quotations");
  await page.getByRole("button", { name: /New Quotation/i }).first().click();

  const modal = page.locator("div.fixed", { hasText: "New Quotation" });
  await expect(modal).toBeVisible();

  const project = `Smoke Project ${Date.now()}`;
  await modal.getByPlaceholder(/Executive Office Fit-out/i).fill(project);
  await modal.getByPlaceholder(/Product name/i).first().fill("Smoke Test Desk");

  // Qty defaults to 1; set a unit price so the quotation carries money.
  const priceInput = modal.locator('input[type="number"][min="0"]').first();
  await priceInput.fill("1500");

  await modal.getByRole("button", { name: /Create Quotation/i }).click();
  await expect(modal).toBeHidden({ timeout: 10_000 });

  // The new quotation appears in the list (demo mode keeps optimistic state).
  await expect(page.getByText(project).first()).toBeVisible({ timeout: 10_000 });
});

test("H1: an uncaught data failure surfaces as a toast, not silence", async ({ page }) => {
  await page.goto("/quotations");
  await expect(page.getByRole("button", { name: /New Quotation/i }).first()).toBeVisible({ timeout: 15_000 });

  // Simulate what a failed Supabase write now does: the adapter throws a
  // DataError that nothing catches. The global unhandledrejection surface
  // must turn it into a visible toast (isDataError duck-types on name).
  await page.evaluate(() => {
    const err = Object.assign(new Error('create on "work_items" failed: network down'), {
      name: "DataError",
      op: "create",
      table: "work_items",
    });
    Promise.reject(err);
  });

  await expect(page.getByText(/Couldn't save/i).first()).toBeVisible({ timeout: 5_000 });
});

test("H2: Inventory backed by 100k stock movements stays fast and paged", async ({ page }) => {
  // The load-test seed makes demo mode back work_items with 100,000
  // synthetic stock movements (see loadTestRows in data-source.ts).
  await page.addInitScript(() => localStorage.setItem("thoth_loadtest", "100000"));

  const t0 = Date.now();
  await page.goto("/inventory");
  const movementsTab = page.getByRole("button", { name: /Movements \(100,0/ });
  // The tab label carries the exact server-side count — proving the page
  // knows about all 100k rows without having fetched them.
  await expect(movementsTab).toBeVisible({ timeout: 15_000 });
  const pageLoadMs = Date.now() - t0;

  const t1 = Date.now();
  await movementsTab.click();
  await expect(page.getByTestId("movements-list")).toBeVisible();
  const tabRenderMs = Date.now() - t1;

  // DoD: the movements view over 100k rows renders in under a second.
  expect(tabRenderMs, `movements tab took ${tabRenderMs}ms`).toBeLessThan(1_000);
  console.log(`[H2] /inventory load: ${pageLoadMs}ms · movements tab render: ${tabRenderMs}ms`);

  // Pager proves windowing: page 1 shows 50 rows of 100k+, and flipping
  // pages moves the window.
  await expect(page.getByText(/1–50 of 100,0/)).toBeVisible();
  await page.getByRole("button", { name: /Next page/i }).click();
  await expect(page.getByText(/51–100 of 100,0/)).toBeVisible({ timeout: 5_000 });
});

test("H3: money validation blocks an impossible discount", async ({ page }) => {
  await page.goto("/quotations");
  await page.getByRole("button", { name: /New Quotation/i }).first().click();

  const modal = page.locator("div.fixed", { hasText: "New Quotation" });
  await expect(modal).toBeVisible();

  const project = `Invalid Discount ${Date.now()}`;
  await modal.getByPlaceholder(/Executive Office Fit-out/i).fill(project);
  await modal.getByPlaceholder(/Product name/i).first().fill("Overdiscounted Desk");
  await modal.locator('input[type="number"][min="0"]').first().fill("1000");

  // 150% discount passes the input's native min=0 — only the zod layer
  // (form + adapter backstop) can reject it.
  await modal.getByTestId("order-discount").fill("150");
  await modal.getByRole("button", { name: /Create Quotation/i }).click();

  // Inline error, modal stays open, nothing saved.
  await expect(modal.getByText(/cannot exceed 100/i)).toBeVisible({ timeout: 5_000 });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: /Cancel/i }).click();
  await expect(page.getByText(project)).toHaveCount(0);
});
