/**
 * Visual library.
 *
 * Every chart in Al-Madinah is one of these, drawn as inline SVG against the
 * theme's chart tokens. No charting dependency: the shapes needed are simple,
 * the token palette has to be honoured exactly in both themes, and a library
 * that re-themes itself on upgrade is a liability on a clinical dashboard.
 *
 * Conventions all visuals share:
 *   - Colour never carries meaning on its own. Every series is labelled.
 *   - Bars and columns start at zero. Truncated axes misrepresent change.
 *   - Clicking a mark cross-filters the page rather than opening a tooltip
 *     nobody can reach on a touchscreen.
 *   - Wide visuals scroll inside their own container, never the page.
 */

import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { serif, cardCls, type Tone, TONE_PILL } from "@/platform/ui";
import { formatValue, seriesColor, categoryTotals, type QueryResult, type AggKind } from "./query";

export type VisualKind =
  | "kpi" | "column" | "bar" | "line" | "area" | "donut" | "stacked" | "table" | "heatmap";

export const VISUALS: { id: VisualKind; en: string; ar: string }[] = [
  { id: "kpi",     en: "Single figure",  ar: "رقم مفرد" },
  { id: "column",  en: "Column chart",   ar: "أعمدة" },
  { id: "bar",     en: "Bar chart",      ar: "أشرطة" },
  { id: "line",    en: "Line chart",     ar: "خط بياني" },
  { id: "area",    en: "Area chart",     ar: "مساحة" },
  { id: "stacked", en: "Stacked column", ar: "أعمدة مركبة" },
  { id: "donut",   en: "Donut",          ar: "دائري" },
  { id: "heatmap", en: "Heat map",       ar: "خريطة حرارية" },
  { id: "table",   en: "Table",          ar: "جدول" },
];

export interface VisualProps {
  result: QueryResult;
  agg?: AggKind;
  /** Clicking a mark filters everything else on the page by that value. */
  onSelect?: (category: string, series?: string) => void;
  /** Currently cross-filtered category, dimmed out of the others. */
  selected?: string | null;
  height?: number;
}

// ─── Shared pieces ────────────────────────────────────────

function Legend({ series }: { series: string[] }) {
  if (series.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pt-2">
      {series.map((s, i) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: seriesColor(i) }} aria-hidden />
          {s}
        </span>
      ))}
    </div>
  );
}

function NoData() {
  const { lang } = useLanguage();
  return (
    <div className="h-full min-h-[140px] grid place-items-center text-caption text-muted-foreground">
      {lang === "ar" ? "لا توجد بيانات لهذا الاختيار" : "No data for this selection"}
    </div>
  );
}

/** A rounded "nice" upper bound, so gridlines land on readable numbers. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

// ─── KPI ──────────────────────────────────────────────────

export function KpiVisual({ result, agg, tone = "brand" }: VisualProps & { tone?: Tone }) {
  return (
    <div className="h-full flex flex-col justify-center px-1 py-3">
      <div className="text-display font-semibold text-foreground tabular-nums leading-none" style={serif}>
        {formatValue(result.total, result.unit, agg)}
      </div>
      <div className="text-caption text-muted-foreground mt-1.5 tabular-nums">
        {result.matched.length.toLocaleString()} rows
      </div>
      <span className={`mt-2 self-start px-2 py-0.5 rounded-lg text-micro font-medium ${TONE_PILL[tone]}`}>
        {agg ?? "count"}
      </span>
    </div>
  );
}

// ─── Column / bar ─────────────────────────────────────────

export function ColumnVisual({ result, agg, onSelect, selected, height = 220, horizontal = false }: VisualProps & { horizontal?: boolean }) {
  const totals = categoryTotals(result);
  const max = niceMax(Math.max(...totals, 0));
  if (result.categories.length === 0) return <NoData />;

  if (horizontal) {
    return (
      <div className="space-y-1.5 py-1">
        {result.categories.map((cat, i) => {
          const v = totals[i];
          const dim = selected && selected !== cat;
          return (
            <button
              key={cat} type="button"
              onClick={() => onSelect?.(cat)}
              className={`w-full flex items-center gap-3 group ${dim ? "opacity-35" : ""} transition-opacity`}
            >
              <span className="text-caption text-muted-foreground w-28 truncate text-start shrink-0">{cat}</span>
              <span className="flex-1 h-5 rounded-md bg-muted/60 overflow-hidden relative">
                <span
                  className="absolute inset-y-0 start-0 rounded-md transition-all duration-500 group-hover:opacity-85"
                  style={{ width: `${max > 0 ? (v / max) * 100 : 0}%`, background: seriesColor(0) }}
                />
              </span>
              <span className="text-caption font-semibold text-foreground tabular-nums w-16 text-end shrink-0">
                {formatValue(v, result.unit, agg)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const barW = 100 / Math.max(result.categories.length, 1);
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[280px]" style={{ height }}>
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-[calc(100%-28px)]" role="img">
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <line key={g} x1="0" x2="100" y1={60 - g * 60} y2={60 - g * 60}
                stroke="hsl(var(--border))" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
            ))}
            {result.categories.map((cat, i) => {
              const v = totals[i];
              const h = max > 0 ? (v / max) * 58 : 0;
              const dim = selected && selected !== cat;
              return (
                <rect
                  key={cat}
                  x={i * barW + barW * 0.18} y={60 - h}
                  width={barW * 0.64} height={Math.max(h, v > 0 ? 0.6 : 0)}
                  rx="0.8"
                  fill={seriesColor(0)}
                  opacity={dim ? 0.3 : 1}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onClick={() => onSelect?.(cat)}
                >
                  <title>{`${cat}: ${formatValue(v, result.unit, agg)}`}</title>
                </rect>
              );
            })}
          </svg>
          <div className="flex h-7">
            {result.categories.map((cat) => (
              <div key={cat} className="text-micro text-muted-foreground text-center truncate px-0.5 pt-1"
                style={{ width: `${barW}%` }} title={cat}>
                {cat}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-micro text-muted-foreground tabular-nums px-1">
        <span>0</span>
        <span>{formatValue(max, result.unit, agg)}</span>
      </div>
    </div>
  );
}

// ─── Stacked column ───────────────────────────────────────

export function StackedVisual({ result, agg, onSelect, selected, height = 220 }: VisualProps) {
  if (result.categories.length === 0) return <NoData />;
  const totals = categoryTotals(result);
  const max = niceMax(Math.max(...totals, 0));
  const barW = 100 / Math.max(result.categories.length, 1);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[280px]" style={{ height }}>
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-[calc(100%-28px)]" role="img">
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <line key={g} x1="0" x2="100" y1={60 - g * 60} y2={60 - g * 60}
                stroke="hsl(var(--border))" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
            ))}
            {result.categories.map((cat, ci) => {
              const dim = selected && selected !== cat;
              let acc = 0;
              return result.series.map((s, si) => {
                const v = result.cells.find((c) => c.category === cat && c.series === s)?.value ?? 0;
                const h = max > 0 ? (v / max) * 58 : 0;
                const y = 60 - acc - h;
                acc += h;
                if (v === 0) return null;
                return (
                  <rect
                    key={`${cat}-${s}`}
                    x={ci * barW + barW * 0.18} y={y}
                    width={barW * 0.64} height={Math.max(h, 0.4)} rx="0.5"
                    fill={seriesColor(si)} opacity={dim ? 0.3 : 1}
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() => onSelect?.(cat, s)}
                  >
                    <title>{`${cat} · ${s}: ${formatValue(v, result.unit, agg)}`}</title>
                  </rect>
                );
              });
            })}
          </svg>
          <div className="flex h-7">
            {result.categories.map((cat) => (
              <div key={cat} className="text-micro text-muted-foreground text-center truncate px-0.5 pt-1"
                style={{ width: `${barW}%` }} title={cat}>{cat}</div>
            ))}
          </div>
        </div>
      </div>
      <Legend series={result.series} />
    </div>
  );
}

// ─── Line / area ──────────────────────────────────────────

export function LineVisual({ result, agg, height = 220, area = false }: VisualProps & { area?: boolean }) {
  if (result.categories.length === 0) return <NoData />;
  // Trends read left-to-right in category order, which for a date dimension
  // means chronological — so line charts sort by label, not by value.
  const cats = [...result.categories].sort((a, b) => a.localeCompare(b));
  const max = niceMax(Math.max(
    ...result.series.map((s) => Math.max(...cats.map((c) =>
      result.cells.find((x) => x.category === c && x.series === s)?.value ?? 0))), 0));

  const x = (i: number) => (cats.length === 1 ? 50 : (i / (cats.length - 1)) * 100);
  const y = (v: number) => 58 - (max > 0 ? (v / max) * 56 : 0);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[280px]" style={{ height }}>
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="w-full h-[calc(100%-28px)]" role="img">
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <line key={g} x1="0" x2="100" y1={60 - g * 58} y2={60 - g * 58}
                stroke="hsl(var(--border))" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
            ))}
            {result.series.map((s, si) => {
              const pts = cats.map((c, i) => {
                const v = result.cells.find((x) => x.category === c && x.series === s)?.value ?? 0;
                return `${x(i)},${y(v)}`;
              });
              return (
                <g key={s}>
                  {area && (
                    <polygon
                      points={`0,58 ${pts.join(" ")} 100,58`}
                      fill={seriesColor(si)} opacity={0.16}
                    />
                  )}
                  <polyline
                    points={pts.join(" ")} fill="none"
                    stroke={seriesColor(si)} strokeWidth="1.6"
                    strokeLinejoin="round" strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {cats.map((c, i) => {
                    const v = result.cells.find((xx) => xx.category === c && xx.series === s)?.value ?? 0;
                    return (
                      <circle key={c} cx={x(i)} cy={y(v)} r="1.2" fill={seriesColor(si)}>
                        <title>{`${c}${result.series.length > 1 ? ` · ${s}` : ""}: ${formatValue(v, result.unit, agg)}`}</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })}
          </svg>
          <div className="flex h-7">
            {cats.map((cat) => (
              <div key={cat} className="text-micro text-muted-foreground text-center truncate px-0.5 pt-1"
                style={{ width: `${100 / cats.length}%` }} title={cat}>{cat.slice(5)}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-micro text-muted-foreground tabular-nums px-1">
        <span>0</span><span>{formatValue(max, result.unit, agg)}</span>
      </div>
      <Legend series={result.series} />
    </div>
  );
}

// ─── Donut ────────────────────────────────────────────────

export function DonutVisual({ result, agg, onSelect, selected, height = 220 }: VisualProps) {
  const totals = categoryTotals(result);
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum === 0) return <NoData />;

  const R = 15.9155; // circumference 100, so dash offsets are percentages
  let offset = 0;
  const arcs = result.categories.map((cat, i) => {
    const pct = (totals[i] / sum) * 100;
    const arc = { cat, pct, offset, color: seriesColor(i) };
    offset += pct;
    return arc;
  });

  return (
    <div className="flex items-center gap-5" style={{ minHeight: height }}>
      <svg viewBox="0 0 42 42" className="w-[132px] h-[132px] shrink-0 -rotate-90" role="img">
        <circle cx="21" cy="21" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        {arcs.map((a) => (
          <circle
            key={a.cat} cx="21" cy="21" r={R} fill="none"
            stroke={a.color} strokeWidth="5"
            strokeDasharray={`${a.pct} ${100 - a.pct}`}
            strokeDashoffset={-a.offset}
            opacity={selected && selected !== a.cat ? 0.3 : 1}
            className="cursor-pointer transition-opacity"
            onClick={() => onSelect?.(a.cat)}
          >
            <title>{`${a.cat}: ${a.pct.toFixed(1)}%`}</title>
          </circle>
        ))}
      </svg>
      <ul className="flex-1 min-w-0 space-y-1">
        {arcs.slice(0, 7).map((a, i) => (
          <li key={a.cat}>
            <button
              type="button" onClick={() => onSelect?.(a.cat)}
              className={`w-full flex items-center gap-2 text-start ${selected && selected !== a.cat ? "opacity-40" : ""}`}
            >
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.color }} aria-hidden />
              <span className="text-caption text-foreground truncate flex-1">{a.cat}</span>
              <span className="text-caption text-muted-foreground tabular-nums shrink-0">
                {formatValue(totals[i], result.unit, agg)}
              </span>
              <span className="text-micro text-muted-foreground tabular-nums w-9 text-end shrink-0">
                {a.pct.toFixed(0)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Heat map ─────────────────────────────────────────────

export function HeatmapVisual({ result, agg, onSelect }: VisualProps) {
  if (result.categories.length === 0 || result.series.length === 0) return <NoData />;
  const max = Math.max(...result.cells.map((c) => c.value), 0);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5">
        <thead>
          <tr>
            <th className="text-micro text-muted-foreground font-medium text-start pe-2 sticky start-0 bg-card" />
            {result.categories.map((c) => (
              <th key={c} className="text-micro text-muted-foreground font-medium px-1 pb-1 max-w-[80px] truncate" title={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.series.map((s) => (
            <tr key={s}>
              <td className="text-micro text-muted-foreground pe-2 whitespace-nowrap sticky start-0 bg-card max-w-[120px] truncate" title={s}>
                {s}
              </td>
              {result.categories.map((c) => {
                const v = result.cells.find((x) => x.category === c && x.series === s)?.value ?? 0;
                const intensity = max > 0 ? v / max : 0;
                return (
                  <td key={c} className="p-0">
                    <button
                      type="button"
                      onClick={() => onSelect?.(c, s)}
                      title={`${s} · ${c}: ${formatValue(v, result.unit, agg)}`}
                      className="w-full h-8 min-w-[52px] rounded-md text-micro tabular-nums transition-transform hover:scale-105"
                      style={{
                        // A single hue ramped by opacity: intensity must read as
                        // one scale, not as different categories.
                        background: `color-mix(in oklab, hsl(var(--chart-1)) ${Math.round(intensity * 100)}%, hsl(var(--muted)))`,
                        color: intensity > 0.55 ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {v > 0 ? formatValue(v, undefined, agg) : ""}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────

export function TableVisual({ result, agg }: VisualProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const totals = categoryTotals(result);
  const sum = totals.reduce((a, b) => a + b, 0);
  const rows = useMemo(
    () => result.categories.map((c, i) => ({ category: c, value: totals[i] })),
    [result.categories, totals],
  );

  if (rows.length === 0) return <NoData />;

  return (
    <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
      <table className="w-full text-body">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border/40">
            <th className="text-start text-caption font-medium text-muted-foreground py-2 px-1">
              {ar ? "الفئة" : "Category"}
            </th>
            <th className="text-end text-caption font-medium text-muted-foreground py-2 px-1">
              {ar ? "القيمة" : "Value"}
            </th>
            <th className="text-end text-caption font-medium text-muted-foreground py-2 px-1 w-16">
              {ar ? "النسبة" : "Share"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="border-b border-border/20 last:border-0">
              <td className="py-1.5 px-1 text-foreground truncate max-w-[220px]">{r.category}</td>
              <td className="py-1.5 px-1 text-end font-semibold text-foreground tabular-nums">
                {formatValue(r.value, result.unit, agg)}
              </td>
              <td className="py-1.5 px-1 text-end text-muted-foreground tabular-nums">
                {sum > 0 ? `${((r.value / sum) * 100).toFixed(0)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────

export function Visual({ kind, ...props }: VisualProps & { kind: VisualKind }) {
  switch (kind) {
    case "kpi":     return <KpiVisual {...props} />;
    case "bar":     return <ColumnVisual {...props} horizontal />;
    case "column":  return <ColumnVisual {...props} />;
    case "stacked": return <StackedVisual {...props} />;
    case "line":    return <LineVisual {...props} />;
    case "area":    return <LineVisual {...props} area />;
    case "donut":   return <DonutVisual {...props} />;
    case "heatmap": return <HeatmapVisual {...props} />;
    case "table":   return <TableVisual {...props} />;
    default:        return <ColumnVisual {...props} />;
  }
}

/** A framed visual with a title — the unit dashboards are built from. */
export function VisualCard({
  title, subtitle, actions, children, className = "",
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${cardCls} flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0">
          <h3 className="text-body-lg font-semibold text-foreground truncate" style={serif}>{title}</h3>
          {subtitle && <p className="text-micro text-muted-foreground truncate mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0 flex items-center gap-1">{actions}</div>}
      </div>
      <div className="px-4 pb-4 flex-1 min-h-0">{children}</div>
    </section>
  );
}

/** Small sparkline for KPI rows — trend without the axis furniture. */
export function Sparkline({ values, tone = "brand" }: { values: number[]; tone?: Tone }) {
  const [w, h] = [64, 18];
  if (values.length < 2) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) =>
    `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 2) - 1}`).join(" ");
  const stroke = tone === "critical" ? "hsl(var(--destructive))"
    : tone === "warning" ? "hsl(var(--warning))"
    : tone === "success" ? "hsl(var(--success))"
    : "hsl(var(--primary))";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

