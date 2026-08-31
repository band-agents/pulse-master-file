/**
 * H2 pagination tests — run against the demo adapter (vitest has no Vite
 * env vars, so getDataSource() returns demo mode), which mirrors the
 * Supabase listPaged semantics: filters → eq/contains, search → OR ilike,
 * orderBy + range slicing, exact totals.
 */
import { describe, it, expect } from "vitest";
import { getDataSource } from "@/platform/data/repository";

const ds = getDataSource();
const WID = "demo";

describe("demo mode is active for these tests", () => {
  it("uses the demo adapter", () => {
    expect(ds.mode).toBe("demo");
  });
});

describe("listPaged", () => {
  it("returns page-shaped results with an exact total", async () => {
    const all = await ds.work_items.list(WID);
    const page = await ds.work_items.listPaged(WID, { page: 0, pageSize: 10 });
    expect(page.rows.length).toBeLessThanOrEqual(10);
    expect(page.total).toBe(all.length);
    expect(page.page).toBe(0);
    expect(page.pageSize).toBe(10);
  });

  it("slices consecutive pages without overlap or gaps", async () => {
    const p0 = await ds.work_items.listPaged(WID, { page: 0, pageSize: 5 });
    const p1 = await ds.work_items.listPaged(WID, { page: 1, pageSize: 5 });
    const ids0 = new Set(p0.rows.map((r) => r.id));
    for (const r of p1.rows) expect(ids0.has(r.id)).toBe(false);
    const together = await ds.work_items.listPaged(WID, { page: 0, pageSize: 10 });
    expect(together.rows.map((r) => r.id)).toEqual([...p0.rows, ...p1.rows].map((r) => r.id));
  });

  it("filters by equality and reports the filtered total", async () => {
    const page = await ds.work_items.listPaged(WID, { filters: { type: "stock_movement" }, pageSize: 500 });
    expect(page.rows.length).toBeGreaterThan(0);
    for (const r of page.rows) expect(r.type).toBe("stock_movement");
    const all = await ds.work_items.list(WID);
    expect(page.total).toBe(all.filter((r) => r.type === "stock_movement").length);
  });

  it("sorts by created_at descending by default", async () => {
    const page = await ds.work_items.listPaged(WID, { pageSize: 50 });
    const dates = page.rows.map((r) => r.created_at ?? "");
    const sorted = [...dates].sort((a, b) => String(b).localeCompare(String(a)));
    expect(dates).toEqual(sorted);
  });

  it("searches case-insensitively across plain and jsonb columns", async () => {
    const seed = await ds.work_items.listPaged(WID, { filters: { type: "sales_order" }, pageSize: 1 });
    expect(seed.rows.length).toBe(1);
    const target = seed.rows[0] as { title_en?: string; metadata?: { so_number?: string } };

    if (target.title_en) {
      const byTitle = await ds.work_items.listPaged(WID, {
        search: { columns: ["title_en"], term: target.title_en.slice(0, 6).toUpperCase() },
        pageSize: 500,
      });
      expect(byTitle.rows.length).toBeGreaterThan(0);
    }
    if (target.metadata?.so_number) {
      const byNumber = await ds.work_items.listPaged(WID, {
        search: { columns: ["metadata->>so_number"], term: target.metadata.so_number },
        pageSize: 500,
      });
      expect(byNumber.rows.some((r) => (r.metadata as { so_number?: string })?.so_number === target.metadata!.so_number)).toBe(true);
    }
  });

  it("returns an empty page (not an error) past the end", async () => {
    const page = await ds.work_items.listPaged(WID, { page: 9999, pageSize: 100 });
    expect(page.rows).toEqual([]);
    expect(page.total).toBeGreaterThan(0);
  });

  it("clamps pageSize to 500", async () => {
    const page = await ds.work_items.listPaged(WID, { pageSize: 99999 });
    expect(page.pageSize).toBe(500);
  });
});
