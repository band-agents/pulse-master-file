/**
 * Money-form validation (Hardening H3).
 *
 * Zod schemas for every write that carries money. Enforced in TWO places:
 *   1. The data adapter (data-source.ts) — the backstop; bad money data
 *      can never reach the database (or the demo store) regardless of
 *      which form or future code path produced it.
 *   2. The forms themselves — same schemas, friendlier inline messages.
 *
 * All object schemas use .passthrough(): documents carry many extra
 * fields (dimensions, names, flags) that validation must not strip.
 */
import { z } from "zod";

// ── Primitives ─────────────────────────────────────────────

/** A money amount: finite, ≥ 0. Rejects NaN/Infinity from parseFloat(""). */
export const money = z.number({ invalid_type_error: "must be a number" }).finite().min(0);
/** A strictly positive quantity (0 items or 0 qty is never a valid line). */
export const quantity = z.number().finite().gt(0, "quantity must be greater than 0");
/** A percentage 0–100. */
export const percent = z.number().finite().min(0).max(100, "cannot exceed 100%");

// ── Shared line item (quotations, sales orders) ────────────

export const moneyLineSchema = z.object({
  qty: quantity,
  unitPrice: money,
  discount: z.number().finite().min(0).optional(),
  discountType: z.enum(["pct", "fixed"]).optional(),
}).passthrough().superRefine((line, ctx) => {
  if (line.discount && line.discountType !== "fixed" && line.discount > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discount"], message: "percent discount cannot exceed 100%" });
  }
});

const orderDiscountFields = {
  order_discount: z.number().finite().min(0).nullish(),
  order_discount_type: z.enum(["pct", "fixed"]).nullish(),
  tax_rate: percent.nullish(),
};

/** pct order discounts must be ≤ 100 (fixed ones are capped at subtotal by money.ts). */
function refineOrderDiscount(doc: { order_discount?: number | null; order_discount_type?: string | null }, ctx: z.RefinementCtx) {
  if (doc.order_discount && doc.order_discount_type !== "fixed" && doc.order_discount > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["order_discount"], message: "percent discount cannot exceed 100%" });
  }
}

// ── Quotations (work_items type=quotation → metadata) ──────

export const quotationMetaSchema = z.object({
  quotation_number: z.string().trim().min(1, "quotation number is required"),
  items: z.array(moneyLineSchema).optional(),
  material_cost: money.nullish(),
  labor_cost: money.nullish(),
  accessories_cost: money.nullish(),
  transport_cost: money.nullish(),
  installation_cost: money.nullish(),
  ...orderDiscountFields,
}).passthrough().superRefine(refineOrderDiscount);

// ── Sales orders (work_items type=sales_order → metadata) ──

export const salesOrderMetaSchema = z.object({
  so_number: z.string().trim().min(1, "order number is required"),
  items: z.array(moneyLineSchema).optional(),
  payments: z.array(z.object({
    amount: z.number().finite().gt(0, "payment amount must be greater than 0"),
  }).passthrough()).optional(),
  total_amount: money.nullish(),
  total_paid: money.nullish(),
  ...orderDiscountFields,
}).passthrough().superRefine(refineOrderDiscount);

// ── Stock movements (work_items type=stock_movement → metadata) ──

export const stockMovementMetaSchema = z.object({
  move_qty: quantity,
}).passthrough();

// ── POS ────────────────────────────────────────────────────

export const posTransactionSchema = z.object({
  transaction_number: z.string().trim().min(1),
  subtotal: money,
  discount_amount: money.nullish(),
  discount_percent: percent.nullish(),
  tax_amount: money.nullish(),
  tax_rate: percent.nullish(),
  total: money,
  payment_method: z.enum(["cash", "card", "mobile_wallet", "split"]),
  payment_details: z.record(z.unknown()).nullish(),
}).passthrough().superRefine((txn, ctx) => {
  const details = (txn.payment_details ?? {}) as Record<string, unknown>;
  if (txn.payment_method === "cash") {
    const received = Number(details.cash_received);
    if (!Number.isFinite(received) || received < txn.total) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payment_details", "cash_received"], message: "cash received must cover the total" });
    }
  }
  if (txn.payment_method === "split") {
    const cash = Number(details.cash) || 0;
    const card = Number(details.card) || 0;
    if (cash < 0 || card < 0 || cash + card < txn.total) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["payment_details"], message: "split amounts must cover the total" });
    }
  }
});

export const posTransactionItemSchema = z.object({
  quantity,
  unit_price: money,
  discount_percent: percent.nullish(),
  total: money,
}).passthrough();

// ── Cost entries ───────────────────────────────────────────

export const costEntrySchema = z.object({
  quantity: quantity.nullish(),
  unit_cost: money,
  total_cost: money,
}).passthrough();

// ── Write-time registry (used by the data adapter) ─────────

type AnySchema = z.ZodTypeAny;

/** Table-level schemas: validate the whole payload. */
const TABLE_SCHEMAS: Record<string, AnySchema> = {
  pos_transactions: posTransactionSchema,
  pos_transaction_items: posTransactionItemSchema,
  cost_entries: costEntrySchema,
};

/** work_items metadata schemas, keyed by the row's `type`. */
const WORK_ITEM_META_SCHEMAS: Record<string, AnySchema> = {
  quotation: quotationMetaSchema,
  sales_order: salesOrderMetaSchema,
  stock_movement: stockMovementMetaSchema,
};

export interface MoneyIssue { path: string; message: string }

/** Human-readable one-liner for form banners, e.g. "Item 2 qty: must be > 0".
 *  (Messages stay English until the H6 Arabic sweep.) */
export function describeIssues(issues: MoneyIssue[], ar: boolean): string {
  return issues.slice(0, 3).map((i) => {
    const item = i.path.match(/^(items|payments)\.(\d+)\.?(.*)$/);
    const label = item
      ? `${ar ? (item[1] === "payments" ? "دفعة" : "صنف") : item[1] === "payments" ? "Payment" : "Item"} ${Number(item[2]) + 1}${item[3] ? " " + item[3] : ""}`
      : i.path || "";
    return `${label ? label + ": " : ""}${i.message}`;
  }).join(" · ");
}

/**
 * Validate a payload about to be written. Returns null when valid (or when
 * no schema applies), otherwise the list of issues.
 *
 * work_items are validated by type on create; metadata-only updates that
 * don't carry `type` are skipped here — the forms validate those.
 */
export function validateMoneyWrite(table: string, payload: Record<string, unknown>): MoneyIssue[] | null {
  let result: z.SafeParseReturnType<unknown, unknown> | null = null;

  if (table === "procurement_orders") {
    const type = payload.type as string | undefined;
    const schema = type ? WORK_ITEM_META_SCHEMAS[type] : undefined;
    if (schema && payload.metadata != null) result = schema.safeParse(payload.metadata);
  } else {
    const schema = TABLE_SCHEMAS[table];
    if (schema) result = schema.safeParse(payload);
  }

  if (!result || result.success) return null;
  return result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
