import { describe, it, expect } from "vitest";
import { lineNet, calcTotal, calcBreakdown, calcGrand, type MoneyLine } from "./money";

const line = (over: Partial<MoneyLine> = {}): MoneyLine => ({ qty: 2, unitPrice: 500, ...over });

describe("lineNet", () => {
  it("returns gross when no discount", () => {
    expect(lineNet(line())).toBe(1000);
  });

  it("applies percent discount", () => {
    expect(lineNet(line({ discount: 10 }))).toBe(900); // pct is the default type
    expect(lineNet(line({ discount: 10, discountType: "pct" }))).toBe(900);
  });

  it("caps percent discount at 100%", () => {
    expect(lineNet(line({ discount: 150, discountType: "pct" }))).toBe(0);
  });

  it("applies fixed discount", () => {
    expect(lineNet(line({ discount: 250, discountType: "fixed" }))).toBe(750);
  });

  it("floors fixed discount at zero — never a negative line", () => {
    expect(lineNet(line({ discount: 5000, discountType: "fixed" }))).toBe(0);
  });

  it("ignores zero and negative discounts", () => {
    expect(lineNet(line({ discount: 0 }))).toBe(1000);
    expect(lineNet(line({ discount: -50, discountType: "fixed" }))).toBe(1000);
  });

  it("handles zero qty and zero price", () => {
    expect(lineNet(line({ qty: 0 }))).toBe(0);
    expect(lineNet(line({ unitPrice: 0 }))).toBe(0);
  });

  it("handles fractional quantities (e.g. meters of fabric)", () => {
    expect(lineNet({ qty: 2.5, unitPrice: 100 })).toBe(250);
  });
});

describe("calcTotal", () => {
  it("sums line nets across mixed discounts", () => {
    expect(calcTotal([
      line(),                                        // 1000
      line({ discount: 10 }),                        // 900
      line({ discount: 250, discountType: "fixed" }), // 750
    ])).toBe(2650);
  });

  it("returns 0 for an empty list", () => {
    expect(calcTotal([])).toBe(0);
  });
});

describe("calcBreakdown", () => {
  it("computes the full pipeline: subtotal → order discount → tax → grand", () => {
    const b = calcBreakdown({
      items: [line(), line()],   // subtotal 2000
      order_discount: 10,        // pct → 200
      order_discount_type: "pct",
      tax_rate: 14,              // Egyptian VAT on 1800 → 252
    });
    expect(b.subtotal).toBe(2000);
    expect(b.orderDisc).toBe(200);
    expect(b.taxable).toBe(1800);
    expect(b.tax).toBeCloseTo(252);
    expect(b.grand).toBeCloseTo(2052);
  });

  it("applies fixed order discount and caps it at the subtotal", () => {
    const b = calcBreakdown({
      items: [line()],           // 1000
      order_discount: 5000,
      order_discount_type: "fixed",
    });
    expect(b.orderDisc).toBe(1000);
    expect(b.taxable).toBe(0);
    expect(b.grand).toBe(0);     // never negative
  });

  it("caps percent order discount at 100%", () => {
    const b = calcBreakdown({ items: [line()], order_discount: 120, order_discount_type: "pct" });
    expect(b.orderDisc).toBe(1000);
    expect(b.grand).toBe(0);
  });

  it("taxes AFTER discount, not before", () => {
    const b = calcBreakdown({
      items: [line()],           // 1000
      order_discount: 500,
      order_discount_type: "fixed",
      tax_rate: 14,
    });
    expect(b.tax).toBeCloseTo(70); // 14% of 500, not of 1000
    expect(b.grand).toBeCloseTo(570);
  });

  it("treats missing fields as zero", () => {
    const b = calcBreakdown({});
    expect(b).toEqual({ subtotal: 0, orderDisc: 0, taxable: 0, tax: 0, grand: 0 });
  });

  it("line discounts and order discount compound correctly", () => {
    const b = calcBreakdown({
      items: [line({ discount: 10 })], // 900 after line discount
      order_discount: 10,              // 90 off
      order_discount_type: "pct",
      tax_rate: 10,
    });
    expect(b.subtotal).toBe(900);
    expect(b.orderDisc).toBeCloseTo(90);
    expect(b.grand).toBeCloseTo(891);  // 810 * 1.1
  });
});

describe("calcGrand", () => {
  it("matches breakdown.grand", () => {
    const m = { items: [line()], order_discount: 10, order_discount_type: "pct" as const, tax_rate: 14 };
    expect(calcGrand(m)).toBe(calcBreakdown(m).grand);
  });
});
