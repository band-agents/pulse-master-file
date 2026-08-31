/**
 * Money math — pure functions shared by Quotations, Sales Orders,
 * and exports. No React, no Supabase: everything here is unit-tested
 * (see money.test.ts) and must stay side-effect free.
 *
 * Pipeline: line gross → line discount → subtotal → order discount
 * → taxable → tax → grand total.
 */

/** Minimal shape of a priced line item (structural — QuotItem etc. satisfy it). */
export interface MoneyLine {
  qty: number;
  unitPrice: number;
  discount?: number;
  discountType?: "pct" | "fixed";
}

/** Minimal shape of a document carrying order-level discount + tax. */
export interface MoneyDoc {
  items?: MoneyLine[];
  order_discount?: number;
  order_discount_type?: "pct" | "fixed";
  tax_rate?: number;
}

export interface MoneyBreakdown {
  subtotal: number;
  orderDisc: number;
  taxable: number;
  tax: number;
  grand: number;
}

/** Net amount for a single line after its own discount.
 *  Fixed discounts floor at 0; percent discounts cap at 100%. */
export function lineNet(i: MoneyLine): number {
  const gross = i.qty * i.unitPrice;
  if (!i.discount || i.discount <= 0) return gross;
  return i.discountType === "fixed"
    ? Math.max(0, gross - i.discount)
    : gross * (1 - Math.min(i.discount, 100) / 100);
}

/** Subtotal after line discounts. */
export function calcTotal(items: MoneyLine[]): number {
  return items.reduce((s, i) => s + lineNet(i), 0);
}

/** Full breakdown: subtotal → order discount → tax → grand total.
 *  Fixed order discounts cap at the subtotal; percent caps at 100%. */
export function calcBreakdown(m: MoneyDoc): MoneyBreakdown {
  const subtotal = calcTotal(m.items || []);
  const od = m.order_discount || 0;
  const orderDisc = od <= 0
    ? 0
    : m.order_discount_type === "fixed"
      ? Math.min(od, subtotal)
      : subtotal * (Math.min(od, 100) / 100);
  const taxable = subtotal - orderDisc;
  const tax = taxable * ((m.tax_rate || 0) / 100);
  return { subtotal, orderDisc, taxable, tax, grand: taxable + tax };
}

/** Grand total for a document (used by lists + exports). */
export function calcGrand(m: MoneyDoc): number {
  return calcBreakdown(m).grand;
}
