/**
 * H3 validation tests — the DoD in test form: negative quantities,
 * malformed prices, and empty required fields must be unsaveable,
 * enforced at the adapter for BOTH demo and live code paths.
 */
import { describe, it, expect } from "vitest";
import {
  moneyLineSchema, quotationMetaSchema, salesOrderMetaSchema,
  posTransactionSchema, stockMovementMetaSchema, validateMoneyWrite, describeIssues,
} from "./money-schemas";
import { getDataSource } from "../data-source";
import { isValidationError } from "../errors";

describe("money line", () => {
  it("accepts a normal line", () => {
    expect(moneyLineSchema.safeParse({ qty: 2, unitPrice: 1500, product: "Desk" }).success).toBe(true);
  });
  it("rejects zero and negative quantities", () => {
    expect(moneyLineSchema.safeParse({ qty: 0, unitPrice: 100 }).success).toBe(false);
    expect(moneyLineSchema.safeParse({ qty: -3, unitPrice: 100 }).success).toBe(false);
  });
  it("rejects negative and non-finite prices (parseFloat('') → NaN)", () => {
    expect(moneyLineSchema.safeParse({ qty: 1, unitPrice: -50 }).success).toBe(false);
    expect(moneyLineSchema.safeParse({ qty: 1, unitPrice: NaN }).success).toBe(false);
    expect(moneyLineSchema.safeParse({ qty: 1, unitPrice: Infinity }).success).toBe(false);
  });
  it("rejects percent line discounts over 100 but allows fixed ones", () => {
    expect(moneyLineSchema.safeParse({ qty: 1, unitPrice: 100, discount: 150, discountType: "pct" }).success).toBe(false);
    expect(moneyLineSchema.safeParse({ qty: 1, unitPrice: 100, discount: 150, discountType: "fixed" }).success).toBe(true);
  });
});

describe("quotation metadata", () => {
  const valid = { quotation_number: "QT-001", items: [{ qty: 1, unitPrice: 100 }], tax_rate: 14, order_discount: 10, order_discount_type: "pct" as const };
  it("accepts a valid quotation", () => {
    expect(quotationMetaSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects an empty quotation number", () => {
    expect(quotationMetaSchema.safeParse({ ...valid, quotation_number: "  " }).success).toBe(false);
  });
  it("rejects a percent order discount over 100", () => {
    expect(quotationMetaSchema.safeParse({ ...valid, order_discount: 150 }).success).toBe(false);
  });
  it("rejects tax over 100%", () => {
    expect(quotationMetaSchema.safeParse({ ...valid, tax_rate: 250 }).success).toBe(false);
  });
  it("rejects negative costs", () => {
    expect(quotationMetaSchema.safeParse({ ...valid, labor_cost: -200 }).success).toBe(false);
  });
});

describe("sales order metadata", () => {
  it("rejects zero-amount payments", () => {
    const r = salesOrderMetaSchema.safeParse({ so_number: "SO-1", payments: [{ id: "p1", amount: 0 }] });
    expect(r.success).toBe(false);
  });
  it("accepts a valid order", () => {
    const r = salesOrderMetaSchema.safeParse({ so_number: "SO-1", items: [{ qty: 2, unitPrice: 900 }], payments: [{ id: "p1", amount: 500 }], tax_rate: 14 });
    expect(r.success).toBe(true);
  });
});

describe("POS transaction", () => {
  const base = { transaction_number: "TXN-1", subtotal: 100, total: 114, tax_rate: 14, payment_method: "cash" as const };
  it("rejects cash received under the total (incl. Number('') === 0)", () => {
    expect(posTransactionSchema.safeParse({ ...base, payment_details: { cash_received: 0 } }).success).toBe(false);
    expect(posTransactionSchema.safeParse({ ...base, payment_details: { cash_received: 100 } }).success).toBe(false);
  });
  it("accepts cash covering the total", () => {
    expect(posTransactionSchema.safeParse({ ...base, payment_details: { cash_received: 120, change: 6 } }).success).toBe(true);
  });
  it("rejects split payments that do not cover the total", () => {
    expect(posTransactionSchema.safeParse({ ...base, payment_method: "split", payment_details: { cash: 50, card: 50 } }).success).toBe(false);
  });
});

describe("adapter enforcement (demo mode, same guard as live)", () => {
  const ds = getDataSource();
  it("refuses to create a quotation with a negative price", async () => {
    await expect(ds.work_items.create("demo", {
      title_en: "Bad quote", type: "quotation", status: "draft",
      metadata: { quotation_number: "QT-X", items: [{ qty: 1, unitPrice: -100 }] },
    } as never)).rejects.toSatisfy(isValidationError);
  });
  it("refuses a zero-quantity stock movement", async () => {
    await expect(ds.work_items.create("demo", {
      title_en: "Bad move", type: "stock_movement", status: "done",
      metadata: { move_qty: 0, move_type: "stock_in" },
    } as never)).rejects.toSatisfy(isValidationError);
  });
  it("still allows valid writes", async () => {
    const created = await ds.work_items.create("demo", {
      title_en: "Good quote", type: "quotation", status: "draft",
      metadata: { quotation_number: "QT-OK", items: [{ qty: 1, unitPrice: 100 }] },
    } as never);
    expect(created).toBeTruthy();
  });
  it("does not validate tables without money schemas", async () => {
    const created = await ds.people.create("demo", { name_en: "Test Person" } as never);
    expect(created).toBeTruthy();
  });
});

describe("validateMoneyWrite + describeIssues", () => {
  it("returns readable issues for banners", () => {
    const issues = validateMoneyWrite("procurement_orders", {
      type: "quotation",
      metadata: { quotation_number: "", items: [{ qty: -1, unitPrice: 10 }] },
    });
    expect(issues).not.toBeNull();
    const text = describeIssues(issues!, false);
    expect(text).toContain("Item 1");
  });
  it("skips work_items updates without a type (form-validated instead)", () => {
    expect(validateMoneyWrite("procurement_orders", { metadata: { anything: true } })).toBeNull();
  });
});
