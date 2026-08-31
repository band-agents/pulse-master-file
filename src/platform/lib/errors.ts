/**
 * Loud errors (Hardening H1).
 *
 * Every data-layer failure becomes a typed DataError that is:
 *   1. reported to Sentry with context (table, op, workspace) at the throw site,
 *   2. surfaced to the user as a toast — either by the page's own catch block,
 *      or by the global unhandledrejection handler installed below.
 *
 * Nothing fails silently anymore: the old adapter swallowed errors with
 * console.error and returned []/null, which pages rendered as "empty".
 */
import { toast } from "sonner";
import { reportError } from "./sentry";

export type DataOp = "list" | "get" | "create" | "update" | "remove";

export class DataError extends Error {
  readonly table: string;
  readonly op: DataOp;
  readonly workspaceId?: string;
  readonly cause?: unknown;

  constructor(op: DataOp, table: string, detail: string, opts?: { workspaceId?: string; cause?: unknown }) {
    super(`${op} on "${table}" failed: ${detail}`);
    this.name = "DataError";
    this.op = op;
    this.table = table;
    this.workspaceId = opts?.workspaceId;
    this.cause = opts?.cause;
  }
}

/** Duck-typed on purpose: survives bundling/chunk duplication of the class. */
export function isDataError(e: unknown): e is DataError {
  return e instanceof DataError
    || (typeof e === "object" && e !== null && ["DataError", "ValidationError"].includes((e as Error).name));
}

/**
 * A write rejected by the money schemas (H3) before touching the store.
 * Forms catch this to render inline field errors; anything uncaught still
 * surfaces through the same global toast path as DataError.
 */
export class ValidationError extends DataError {
  readonly issues: Array<{ path: string; message: string }>;

  constructor(op: DataOp, table: string, issues: Array<{ path: string; message: string }>, workspaceId?: string) {
    super(op, table, `validation failed: ${issues.map((i) => `${i.path || "value"} ${i.message}`).join("; ")}`, { workspaceId });
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export function isValidationError(e: unknown): e is ValidationError {
  return e instanceof ValidationError
    || (typeof e === "object" && e !== null && (e as Error).name === "ValidationError");
}

const OP_LABEL: Record<DataOp, { en: string; ar: string }> = {
  list:   { en: "Couldn't load data",     ar: "تعذر تحميل البيانات" },
  get:    { en: "Couldn't load the item", ar: "تعذر تحميل العنصر" },
  create: { en: "Couldn't save",          ar: "تعذر الحفظ" },
  update: { en: "Couldn't save changes",  ar: "تعذر حفظ التعديلات" },
  remove: { en: "Couldn't delete",        ar: "تعذر الحذف" },
};

function isArabic(): boolean {
  return typeof document !== "undefined" && document.documentElement.dir === "rtl";
}

/** User-facing toast for a data failure. Safe to call from anywhere. */
export function toastDataError(e: DataError) {
  const ar = isArabic();
  if (isValidationError(e)) {
    const first = e.issues[0];
    toast.error(ar ? "راجع البيانات المدخلة" : "Check the form", {
      description: first ? `${first.path ? first.path + ": " : ""}${first.message}` : undefined,
      duration: 6000,
    });
    return;
  }
  const label = OP_LABEL[e.op] ?? OP_LABEL.update;
  toast.error(ar ? label.ar : label.en, {
    description: ar
      ? "حدث خطأ في الاتصال. حاول مرة أخرى — لم يتم حفظ شيء بصمت."
      : `${e.table.replace(/_/g, " ")} — the request failed. Nothing was silently saved; please retry.`,
    duration: 6000,
  });
}

/**
 * Last-resort surface: pages without their own catch block used to turn
 * failures into blank screens. Now any uncaught DataError becomes a toast,
 * and any other uncaught rejection is at least reported to Sentry.
 * Call once at app boot (main.tsx).
 */
export function installGlobalErrorSurface() {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (isDataError(reason)) {
      event.preventDefault(); // already reported to Sentry at the throw site
      toastDataError(reason);
      return;
    }
    // Unknown rejection: report, don't toast (avoids noise from benign
    // third-party rejections); the console still shows it for debugging.
    reportError(reason, { source: "unhandledrejection" });
  });
}
