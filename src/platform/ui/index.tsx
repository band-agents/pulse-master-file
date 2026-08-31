/**
 * Clinical page primitives.
 *
 * Every module screen in Al-Madinah is built from these. They exist because the
 * system this was branched from had each page reinvent its own table, filter
 * bar and status pill — thirty near-identical implementations that drifted
 * apart on spacing, empty states and RTL handling. One set of primitives, one
 * place to fix a problem.
 *
 * Conventions these enforce, so pages do not have to remember them:
 *   - Page frame: max 1440px, 6/8 gutter, 6 vertical rhythm.
 *   - Headings use the display face; body text never does.
 *   - Wide content scrolls inside its own container, never the page body.
 *   - Every list has a real empty state, and it says what to do next.
 */

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Link } from "wouter";
import { Search, X, Inbox, Loader2, ChevronRight, ArrowUpDown } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { getDataSource, type DataSource } from "@/platform/data/repository";
import { subscribe as subscribeToStore } from "@/platform/data/store";

// ─── Shared class strings ─────────────────────────────────

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-primary text-primary-foreground text-body font-medium px-4 hover:opacity-90 transition-opacity disabled:opacity-40";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 h-9 rounded-xl border border-border/60 bg-background text-body font-medium px-4 hover:bg-muted/50 transition-colors disabled:opacity-40";
export const inputCls =
  "w-full h-9 px-3 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20";
export const labelCls = "text-micro text-muted-foreground font-medium mb-1 block";
export const cardCls = "rounded-2xl border border-border/40 bg-card shadow-sm";
export const serif = { fontFamily: "var(--app-font-display)" } as const;

// ─── Tone system ──────────────────────────────────────────
// One vocabulary for "how bad is this", used by pills, tiles and rails.
// Tones are semantic, never colour names, so a theme change is one edit.

/**
 * `data` is the analytics accent. It is deliberately outside the severity
 * scale: a figure on a dashboard must never be mistaken for a clinical
 * status, so nothing that measures the hospital borrows the colour of
 * something that is wrong with it.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "critical" | "brand" | "data";

export const TONE_PILL: Record<Tone, string> = {
  neutral:  "bg-muted text-muted-foreground",
  info:     "bg-info/12 text-info",
  success:  "bg-success/12 text-success",
  warning:  "bg-warning/15 text-warning",
  critical: "bg-destructive/12 text-destructive",
  brand:    "bg-brand-wash text-brand-ink",
  data:     "bg-data-wash text-data",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral:  "bg-muted-foreground/50",
  info:     "bg-info",
  success:  "bg-success",
  warning:  "bg-warning",
  critical: "bg-destructive",
  brand:    "bg-primary",
  data:     "bg-data",
};

export const TONE_BAR: Record<Tone, string> = {
  neutral:  "bg-muted-foreground/30",
  info:     "bg-info",
  success:  "bg-success",
  warning:  "bg-warning",
  critical: "bg-destructive",
  brand:    "bg-primary",
  data:     "bg-data",
};

// ─── Status maps ──────────────────────────────────────────

/** A status value's label in both languages, plus how alarming it is. */
export type StatusDef = { en: string; ar: string; tone: Tone };
export type StatusMap = Record<string, StatusDef>;

/** Look a status up, falling back to the raw value rather than rendering blank. */
export function statusDef(map: StatusMap, value: string | null | undefined): StatusDef {
  if (!value) return { en: "—", ar: "—", tone: "neutral" };
  return map[value] ?? { en: value.replace(/_/g, " "), ar: value.replace(/_/g, " "), tone: "neutral" };
}

// ─── Page frame ───────────────────────────────────────────

export function Page({ children }: { children: ReactNode }) {
  return <div className="min-h-full px-6 md:px-8 py-6 max-w-[1440px] mx-auto space-y-6">{children}</div>;
}

export function PageHeader({
  title, titleAr, subtitle, subtitleAr, actions, meta,
}: {
  title: string; titleAr: string;
  subtitle?: string; subtitleAr?: string;
  actions?: ReactNode;
  /** Small stat chips shown under the title — counts, breaches, totals. */
  meta?: { label: string; labelAr: string; value: string; tone?: Tone }[];
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {ar ? titleAr : title}
        </h1>
        {(subtitle || subtitleAr) && (
          <p className="text-body text-muted-foreground mt-1 max-w-[70ch]">
            {ar ? subtitleAr : subtitle}
          </p>
        )}
        {meta && meta.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
            {meta.map((m) => (
              <span key={m.label} className="inline-flex items-center gap-1.5 text-caption">
                <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[m.tone ?? "neutral"]}`} aria-hidden />
                <span className="text-muted-foreground">{ar ? m.labelAr : m.label}</span>
                <span className="font-semibold text-foreground tabular-nums">{m.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

// ─── Status pill ──────────────────────────────────────────

export function Pill({
  tone = "neutral", children, icon: Icon, className = "",
}: { tone?: Tone; children: ReactNode; icon?: React.ElementType; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-micro font-medium whitespace-nowrap ${TONE_PILL[tone]} ${className}`}>
      {Icon && <Icon size={11} strokeWidth={2.2} />}
      {children}
    </span>
  );
}

export function StatusPill({ map, value, icon }: { map: StatusMap; value: string | null | undefined; icon?: React.ElementType }) {
  const { lang } = useLanguage();
  const def = statusDef(map, value);
  return <Pill tone={def.tone} icon={icon}>{lang === "ar" ? def.ar : def.en}</Pill>;
}

// ─── Stat tiles ───────────────────────────────────────────

export function StatTile({
  label, labelAr, value, sub, subAr, tone = "neutral", icon: Icon, href,
}: {
  label: string; labelAr: string;
  value: string | number;
  sub?: string; subAr?: string;
  tone?: Tone;
  icon?: React.ElementType;
  href?: string;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const body = (
    <div className={`${cardCls} p-4 h-full flex flex-col gap-2 ${href ? "hover:border-border transition-colors" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground truncate">{ar ? labelAr : label}</span>
        {Icon && (
          <span className={`w-6 h-6 rounded-lg grid place-items-center ${TONE_PILL[tone]}`}>
            <Icon size={13} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="text-heading font-semibold text-foreground tabular-nums leading-none" style={serif}>
        {value}
      </div>
      {(sub || subAr) && <div className="text-micro text-muted-foreground">{ar ? subAr : sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const map = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" };
  return <div className={`grid grid-cols-2 sm:grid-cols-3 ${map[cols]} gap-3`}>{children}</div>;
}

// ─── Section ──────────────────────────────────────────────

export function Section({
  title, titleAr, description, descriptionAr, actions, children, className = "",
}: {
  title?: string; titleAr?: string;
  description?: string; descriptionAr?: string;
  actions?: ReactNode; children: ReactNode; className?: string;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return (
    <section className={`${cardCls} ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/40">
          <div className="min-w-0">
            {title && <h2 className="text-title font-semibold text-foreground" style={serif}>{ar ? titleAr : title}</h2>}
            {description && <p className="text-caption text-muted-foreground mt-0.5 max-w-[70ch]">{ar ? descriptionAr : description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Empty & loading states ───────────────────────────────

export function EmptyState({
  title, titleAr, hint, hintAr, icon: Icon = Inbox, action,
}: {
  title: string; titleAr: string;
  hint?: string; hintAr?: string;
  icon?: React.ElementType;
  action?: ReactNode;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return (
    <div className="py-14 px-6 flex flex-col items-center text-center gap-3">
      <span className="w-11 h-11 rounded-2xl bg-muted grid place-items-center text-muted-foreground">
        <Icon size={19} strokeWidth={1.6} />
      </span>
      <div>
        <p className="text-body-lg font-medium text-foreground" style={serif}>{ar ? titleAr : title}</p>
        {hint && <p className="text-caption text-muted-foreground mt-1 max-w-[46ch]">{ar ? hintAr : hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function LoadingRow({ label = "Loading", labelAr = "جاري التحميل" }: { label?: string; labelAr?: string }) {
  const { lang } = useLanguage();
  return (
    <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground text-body">
      <Loader2 size={15} className="animate-spin" />
      {lang === "ar" ? labelAr : label}
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────

export type FilterOption = { value: string; en: string; ar: string };

export function FilterBar({
  search, onSearch, searchPlaceholder = "Search", searchPlaceholderAr = "بحث",
  filters = [], children,
}: {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  searchPlaceholderAr?: string;
  filters?: {
    key: string;
    value: string;
    onChange: (v: string) => void;
    options: FilterOption[];
    allLabel?: string;
    allLabelAr?: string;
  }[];
  children?: ReactNode;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border/40">
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={ar ? searchPlaceholderAr : searchPlaceholder}
          className={`${inputCls} ps-9 pe-8`}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch("")}
            aria-label={ar ? "مسح البحث" : "Clear search"}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {filters.map((f) => (
        <select
          key={f.key}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20"
        >
          <option value="">{ar ? (f.allLabelAr ?? "الكل") : (f.allLabel ?? "All")}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
          ))}
        </select>
      ))}
      {children}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────

export type Column<T> = {
  key: string;
  header: string;
  headerAr: string;
  /** Cell content. Return a node, not a string, when it needs a pill. */
  cell: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
  /** Hide below the given breakpoint so narrow screens stay readable. */
  hideBelow?: "sm" | "md" | "lg";
  align?: "start" | "end";
};

const HIDE_CLASS = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

export function DataTable<T extends { id: string }>({
  rows, columns, onRowClick, rowHref, empty, loading, initialSort, dense,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  empty?: ReactNode;
  loading?: boolean;
  initialSort?: { key: string; ascending: boolean };
  dense?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [sort, setSort] = useState(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    // Copy before sorting: the array belongs to the caller's state.
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a), bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
      return sort.ascending ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  if (loading) return <LoadingRow />;
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" titleAr="لا يوجد شيء بعد" />}</>;

  const pad = dense ? "px-4 py-2" : "px-4 py-3";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body border-collapse">
        <thead>
          <tr className="border-b border-border/40">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${pad} text-caption font-medium text-muted-foreground whitespace-nowrap
                  ${c.align === "end" ? "text-end" : "text-start"}
                  ${c.hideBelow ? HIDE_CLASS[c.hideBelow] : ""} ${c.className ?? ""}`}
              >
                {c.sortValue ? (
                  <button
                    type="button"
                    onClick={() => setSort((s) =>
                      s?.key === c.key ? { key: c.key, ascending: !s.ascending } : { key: c.key, ascending: true })}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {ar ? c.headerAr : c.header}
                    <ArrowUpDown size={11} className={sort?.key === c.key ? "text-brand-ink" : "opacity-40"} />
                  </button>
                ) : (ar ? c.headerAr : c.header)}
              </th>
            ))}
            {rowHref && <th scope="col" className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const interactive = Boolean(onRowClick || rowHref);
            return (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-border/25 last:border-0 ${interactive ? "hover:bg-muted/40 cursor-pointer transition-colors" : ""}`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${pad} align-middle
                      ${c.align === "end" ? "text-end" : "text-start"}
                      ${c.hideBelow ? HIDE_CLASS[c.hideBelow] : ""} ${c.className ?? ""}`}
                  >
                    {rowHref && c.key === columns[0].key ? (
                      <Link href={rowHref(row)} className="block">{c.cell(row)}</Link>
                    ) : c.cell(row)}
                  </td>
                ))}
                {rowHref && (
                  <td className="px-2">
                    <ChevronRight size={14} className="text-muted-foreground/50 rtl:rotate-180" />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────

export function Drawer({
  open, onClose, title, titleAr, subtitle, children, footer, width = 520,
}: {
  open: boolean; onClose: () => void;
  title: string; titleAr: string;
  subtitle?: ReactNode;
  children: ReactNode; footer?: ReactNode;
  width?: number;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end rtl:justify-start" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className="relative h-full bg-background border-s border-border/60 shadow-2xl flex flex-col w-full"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/40 shrink-0">
          <div className="min-w-0">
            <h2 className="text-title font-semibold truncate" style={serif}>{ar ? titleAr : title}</h2>
            {subtitle && <div className="text-caption text-muted-foreground mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button" onClick={onClose}
            aria-label={ar ? "إغلاق" : "Close"}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground shrink-0"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border/40 shrink-0 flex items-center justify-end gap-2">{footer}</div>}
      </aside>
    </div>
  );
}

/** Label / value pair, the unit most detail panels are built from. */
export function Field({ label, labelAr, children, full }: { label: string; labelAr: string; children: ReactNode; full?: boolean }) {
  const { lang } = useLanguage();
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className={labelCls}>{lang === "ar" ? labelAr : label}</div>
      <div className="text-body text-foreground">{children ?? "—"}</div>
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>;
}

// ─── Data loading ─────────────────────────────────────────

type TableKey = {
  [K in keyof DataSource]: DataSource[K] extends { list: unknown } ? K : never
}[keyof DataSource];

/**
 * Load one collection for the current workspace.
 *
 * Demo mode has no workspace id, so it passes "demo" rather than waiting for
 * one that never arrives — the previous code gated on `workspace?.id` and
 * left every demo page permanently empty.
 */
export function useCollection<K extends TableKey>(
  table: K,
  deps: unknown[] = [],
): { rows: Awaited<ReturnType<DataSource[K]["list"]>>; loading: boolean; error: Error | null; reload: () => void } {
  const { workspace } = useAuth();
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const wsId = workspace?.id ?? "demo";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const ds = getDataSource();
    (ds[table] as { list: (w: string) => Promise<unknown[]> })
      .list(wsId)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, wsId, nonce, ...deps]);

  // Local writes refresh every open collection, so a form that saves a row
  // updates the list behind it without the caller wiring anything up.
  useEffect(() => subscribeToStore(() => setNonce((n) => n + 1)), []);

  return {
    rows: rows as Awaited<ReturnType<DataSource[K]["list"]>>,
    loading,
    error,
    reload: () => setNonce((n) => n + 1),
  };
}

// ─── Formatting ───────────────────────────────────────────

/** Short clock time, e.g. "14:05". Null-safe so callers stay terse. */
export function fmtTime(iso: string | null | undefined, ar = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(ar ? "ar-SA" : "en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string | null | undefined, ar = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(ar ? "ar-SA" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined, ar = false): string {
  if (!iso) return "—";
  return `${fmtDate(iso, ar)} · ${fmtTime(iso, ar)}`;
}

/** "3 min", "4 h", "2 d" — how long ago, in the coarsest useful unit. */
export function fmtAgo(iso: string | null | undefined, ar = false): string {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return ar ? "الآن" : "now";
  if (mins < 60) return ar ? `${mins} د` : `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 48) return ar ? `${h} س` : `${h} h`;
  return ar ? `${Math.floor(h / 24)} ي` : `${Math.floor(h / 24)} d`;
}

/** Minutes as "1h 45m", for waits and durations. */
export function fmtDuration(minutes: number | null | undefined, ar = false): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return ar ? `${minutes} د` : `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return ar ? `${h} س ${m} د` : `${h}h ${m}m`;
}

export function fmtMoney(amount: number | null | undefined, currency = "SAR", ar = false): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(ar ? "ar-SA" : "en-SA", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(amount);
}

/** Minutes elapsed since a timestamp — the basis of every wait calculation. */
export function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

/** Case-insensitive substring match across several fields. */
export function matches(term: string, ...fields: (string | null | undefined)[]): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return fields.some((f) => f?.toLowerCase().includes(t));
}

// ─── Small display pieces ─────────────────────────────────

/** Patient identity as it appears in every list: name over MRN. */
export function PatientCell({ name, mrn, href }: { name: string; mrn?: string | null; href?: string }) {
  const body = (
    <div className="min-w-0">
      <div className="text-body font-medium text-foreground truncate">{name}</div>
      {mrn && <div className="text-micro text-muted-foreground tabular-nums">{mrn}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:text-brand-ink transition-colors">{body}</Link> : body;
}

/** A labelled horizontal meter, for occupancy and utilisation. */
export function Meter({ value, max, tone = "brand", label }: { value: number; max: number; tone?: Tone; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${TONE_BAR[tone]} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-micro text-muted-foreground tabular-nums w-9 text-end">{label ?? `${pct}%`}</span>
    </div>
  );
}

/** Inline "n of m" counter used in section headers. */
export function Count({ n, of }: { n: number; of?: number }) {
  return (
    <span className="text-caption text-muted-foreground tabular-nums">
      {of === undefined ? n : `${n} / ${of}`}
    </span>
  );
}
