/**
 * Code Generation System
 *
 * Customizable sequential numbering for every entity type in the ERP.
 * Users configure prefix, separator, digit count, optional suffix, an
 * optional year token, and a starting number per entity — so codes like
 * `QA12345` (no separator) or `FASH23400` (custom start) are both possible.
 *
 * Config stored in localStorage (demo) or Supabase settings table (live).
 */

// ─── Entity Types ────────────────────────────────────────
// Covers ALL modules that mint human-facing reference codes.

export type EntityType =
  // Sales & quoting
  | "quotation"
  | "sales_order"
  | "invoice"
  | "payment"
  | "pos_transaction"
  // Catalog & production
  | "product"
  | "production_order"
  | "work_order"
  | "design_brief"
  | "qc_inspection"
  | "batch"
  // Inventory & assets
  | "fabric"
  | "material"
  | "asset"
  | "stock_transfer"
  | "stock_movement"
  // Purchasing & suppliers
  | "purchase_order"
  | "supplier"
  // Operations
  | "delivery"
  | "site_visit"
  // People & parties
  | "customer"
  | "contact"
  | "employee"
  | "branch"
  // Finance & HR docs
  | "expense"
  | "payroll_run"
  // Loyalty
  | "loyalty_member";

export type YearToken = "none" | "yy" | "yyyy";

export interface CodeConfig {
  prefix: string;
  separator: string;
  digits: number;
  /** Optional trailing text appended after the number, e.g. "-EG". */
  suffix?: string;
  /** Insert the current year between prefix and number. */
  yearToken?: YearToken;
  /** First number to mint (e.g. 23400 so the first code is FASH23400). */
  start?: number;
}

export interface CodeSettings {
  entities: Record<EntityType, CodeConfig>;
}

// ─── Defaults ────────────────────────────────────────────

const D = (
  prefix: string,
  opts: Partial<Omit<CodeConfig, "prefix">> = {},
): CodeConfig => ({
  prefix,
  separator: opts.separator ?? "-",
  digits: opts.digits ?? 5,
  suffix: opts.suffix,
  yearToken: opts.yearToken ?? "none",
  start: opts.start,
});

export const DEFAULT_CODE_SETTINGS: CodeSettings = {
  entities: {
    // Sales & quoting
    quotation:        D("QT"),
    sales_order:      D("SO"),
    invoice:          D("INV"),
    payment:          D("PMT"),
    pos_transaction:  D("TXN"),
    // Catalog & production
    product:          D("PRD"),
    production_order: D("PO"),
    work_order:       D("WO"),
    design_brief:     D("DB"),
    qc_inspection:    D("QC"),
    batch:            D("BAT", { digits: 4 }),
    // Inventory & assets
    fabric:           D("FAB"),
    material:         D("MAT"),
    asset:            D("AST"),
    stock_transfer:   D("TRF"),
    stock_movement:   D("MOV"),
    // Purchasing & suppliers
    purchase_order:   D("PUR"),
    supplier:         D("SUP", { digits: 4 }),
    // Operations
    delivery:         D("DLV"),
    site_visit:       D("SV"),
    // People & parties
    customer:         D("CUS", { digits: 4 }),
    contact:          D("CON", { digits: 4 }),
    employee:         D("E",   { digits: 4 }),
    branch:           D("BR",  { digits: 3 }),
    // Finance & HR docs
    expense:          D("EXP"),
    payroll_run:      D("PAY", { yearToken: "yyyy", digits: 3 }),
    // Loyalty
    loyalty_member:   D("LM",  { digits: 6 }),
  },
};

export const ENTITY_LABELS: Record<EntityType, { en: string; ar: string }> = {
  quotation:        { en: "Quotation",         ar: "عرض سعر" },
  sales_order:      { en: "Sales Order",       ar: "طلب بيع" },
  invoice:          { en: "Invoice",           ar: "فاتورة" },
  payment:          { en: "Payment",           ar: "دفعة" },
  pos_transaction:  { en: "POS Transaction",   ar: "معاملة بيع" },
  product:          { en: "Product",           ar: "منتج" },
  production_order: { en: "Production Order",   ar: "أمر إنتاج" },
  work_order:       { en: "Work Order",        ar: "أمر تشغيل" },
  design_brief:     { en: "Design Brief",      ar: "بريف تصميم" },
  qc_inspection:    { en: "QC Inspection",     ar: "فحص جودة" },
  batch:            { en: "Batch / Lot",       ar: "دفعة إنتاج" },
  fabric:           { en: "Fabric",            ar: "قماش" },
  material:         { en: "Material",          ar: "مادة" },
  asset:            { en: "Asset",             ar: "أصل" },
  stock_transfer:   { en: "Stock Transfer",    ar: "تحويل مخزون" },
  stock_movement:   { en: "Stock Movement",    ar: "حركة مخزون" },
  purchase_order:   { en: "Purchase Order",    ar: "أمر شراء" },
  supplier:         { en: "Supplier",          ar: "مورّد" },
  delivery:         { en: "Delivery",          ar: "تسليم" },
  site_visit:       { en: "Site Visit",        ar: "زيارة ميدانية" },
  customer:         { en: "Customer",          ar: "عميل" },
  contact:          { en: "Contact",           ar: "جهة اتصال" },
  employee:         { en: "Employee",          ar: "موظف" },
  branch:           { en: "Branch",            ar: "فرع" },
  expense:          { en: "Expense",           ar: "مصروف" },
  payroll_run:      { en: "Payroll Run",       ar: "دورة رواتب" },
  loyalty_member:   { en: "Loyalty Member",    ar: "عضو ولاء" },
};

// ─── Counter Storage ─────────────────────────────────────

const STORAGE_KEY = "bumblebee_code_counters";
const SETTINGS_KEY = "bumblebee_code_settings";

function loadCounters(): Record<EntityType, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {} as Record<EntityType, number>;
}

function saveCounters(counters: Record<EntityType, number>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
}

// ─── Settings Storage ────────────────────────────────────

export function loadCodeSettings(): CodeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CodeSettings>;
      // Merge so newly added entity types always have a default.
      return {
        entities: { ...DEFAULT_CODE_SETTINGS.entities, ...(parsed.entities ?? {}) },
      };
    }
  } catch { /* ignore */ }
  return { entities: { ...DEFAULT_CODE_SETTINGS.entities } };
}

export function saveCodeSettings(settings: CodeSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Code Formatting ─────────────────────────────────────

function padNumber(n: number, digits: number): string {
  return String(n).padStart(digits, "0");
}

function yearPart(token: YearToken | undefined): string {
  if (token === "yy") return String(new Date().getFullYear()).slice(-2);
  if (token === "yyyy") return String(new Date().getFullYear());
  return "";
}

/**
 * Pure formatter: assemble a code for an explicit number.
 * Shape: PREFIX [sep YEAR] sep NUMBER [SUFFIX]
 */
export function formatCode(cfg: CodeConfig, n: number): string {
  const sep = cfg.separator ?? "";
  const yr = yearPart(cfg.yearToken);
  const head = yr ? `${cfg.prefix}${sep}${yr}` : cfg.prefix;
  return `${head}${sep}${padNumber(n, cfg.digits)}${cfg.suffix ?? ""}`;
}

/** Human-readable description of a format, e.g. "QT-00001". */
export function describeFormat(cfg: CodeConfig): string {
  return formatCode(cfg, cfg.start ?? 1);
}

function resolveConfig(entityType: EntityType, settings?: CodeSettings): CodeConfig {
  return (settings ?? loadCodeSettings()).entities[entityType]
    ?? DEFAULT_CODE_SETTINGS.entities[entityType];
}

function firstNumber(cfg: CodeConfig): number {
  return cfg.start && cfg.start > 0 ? cfg.start : 1;
}

// ─── Code Generation ─────────────────────────────────────

export function generateCode(entityType: EntityType, settings?: CodeSettings): string {
  const cfg = resolveConfig(entityType, settings);
  const counters = loadCounters();
  const seen = counters[entityType];
  const next = seen === undefined ? firstNumber(cfg) : seen + 1;
  counters[entityType] = next;
  saveCounters(counters);
  return formatCode(cfg, next);
}

export function previewCode(entityType: EntityType, settings: CodeSettings, sampleNumber?: number): string {
  const cfg = resolveConfig(entityType, settings);
  return formatCode(cfg, sampleNumber ?? firstNumber(cfg));
}

/**
 * Peek at the next code without incrementing the counter.
 * Useful for showing in UI before saving.
 */
export function peekNextCode(entityType: EntityType, settings?: CodeSettings): string {
  const cfg = resolveConfig(entityType, settings);
  const counters = loadCounters();
  const seen = counters[entityType];
  const next = seen === undefined ? firstNumber(cfg) : seen + 1;
  return formatCode(cfg, next);
}

/**
 * Reset counters (for demo/testing purposes).
 */
export function resetCounters(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Set a specific counter value (for importing data with existing codes).
 */
export function setCounter(entityType: EntityType, value: number): void {
  const counters = loadCounters();
  counters[entityType] = value;
  saveCounters(counters);
}

/**
 * Extract the numeric portion from an existing code.
 */
export function extractCodeNumber(code: string): number | null {
  const match = code.match(/(\d+)(?:\D*)$/);
  return match ? parseInt(match[1], 10) : null;
}
