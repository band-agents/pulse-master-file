/**
 * Analytics query engine.
 *
 * Group, aggregate, filter and sort — everything the explorer and the saved
 * dashboards run through. It works entirely in memory over a `Snapshot`,
 * which is the right trade for a hospital's operational volumes and makes
 * cross-filtering instant: clicking a bar re-runs every tile on the page
 * without a network round trip.
 *
 * Two behaviours worth knowing, because they change what the numbers mean:
 *
 *   Nulls are excluded, not zeroed. A case with no recorded turnover is
 *   absent from the average rather than pulling it toward zero. `count`
 *   is the exception — it counts rows, so it always includes them.
 *
 *   Percentiles use nearest-rank on the sorted values. With the row counts
 *   a hospital produces, interpolation implies a precision the data does
 *   not have.
 */

import type { Dataset, Field } from "./datasets";
import { getField } from "./datasets";

export type AggKind =
  | "count" | "distinct" | "sum" | "avg" | "median" | "min" | "max" | "p90";

export const AGGREGATIONS: { id: AggKind; en: string; ar: string; needsMeasure: boolean }[] = [
  { id: "count",    en: "Count",          ar: "العدد",           needsMeasure: false },
  { id: "distinct", en: "Distinct count", ar: "العدد المميز",    needsMeasure: true },
  { id: "sum",      en: "Sum",            ar: "المجموع",         needsMeasure: true },
  { id: "avg",      en: "Average",        ar: "المتوسط",         needsMeasure: true },
  { id: "median",   en: "Median",         ar: "الوسيط",          needsMeasure: true },
  { id: "p90",      en: "90th percentile",ar: "المئين ٩٠",       needsMeasure: true },
  { id: "min",      en: "Minimum",        ar: "الأدنى",          needsMeasure: true },
  { id: "max",      en: "Maximum",        ar: "الأعلى",          needsMeasure: true },
];

/** The sentinel measure id meaning "count rows", so a query always has one. */
export const COUNT_MEASURE = "__count";

export interface FilterClause {
  field: string;
  /** Selected dimension values. An empty list means the filter is inactive. */
  values: string[];
  /** `exclude` inverts the clause — useful for "everything except routine". */
  exclude?: boolean;
}

export interface QuerySpec {
  datasetId: string;
  /** Primary grouping. Omit for a single aggregate figure. */
  dimension?: string;
  /** Secondary grouping, drawn as stacked segments or multiple lines. */
  splitBy?: string;
  measure: string;
  agg: AggKind;
  filters?: FilterClause[];
  sort?: "value_desc" | "value_asc" | "label_asc";
  /** Categories to keep; the remainder is folded into an "Other" bucket. */
  limit?: number;
}

export interface QueryCell {
  category: string;
  series: string;
  value: number;
  /** Rows behind the cell, so a click can drill through to the records. */
  rows: Record<string, unknown>[];
}

export interface QueryResult {
  cells: QueryCell[];
  categories: string[];
  series: string[];
  /** The aggregate over every matching row, ignoring grouping. */
  total: number;
  /** Rows that passed the filters — the drill-through population. */
  matched: Record<string, unknown>[];
  unit?: string;
  lowerIsBetter?: boolean;
}

const UNGROUPED = "All";

// ─── Aggregation ──────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  // Nearest-rank: the smallest value at or above the p-th position.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export function aggregate(values: number[], agg: AggKind, rowCount: number): number {
  if (agg === "count") return rowCount;
  if (values.length === 0) return 0;
  switch (agg) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    case "median": {
      const s = [...values].sort((a, b) => a - b);
      return percentile(s, 50);
    }
    case "p90": {
      const s = [...values].sort((a, b) => a - b);
      return percentile(s, 90);
    }
    default: return values.length;
  }
}

/** Distinct count needs the raw values, not the numeric projection. */
function distinctCount(rows: Record<string, unknown>[], field: Field | undefined): number {
  if (!field) return rows.length;
  const seen = new Set<string>();
  for (const r of rows) {
    const v = field.get(r);
    if (v !== null && v !== undefined) seen.add(String(v));
  }
  return seen.size;
}

// ─── Filtering ────────────────────────────────────────────

export function applyFilters(
  rows: Record<string, unknown>[],
  dataset: Dataset,
  filters: FilterClause[] | undefined,
): Record<string, unknown>[] {
  if (!filters || filters.length === 0) return rows;
  const active = filters.filter((f) => f.values.length > 0);
  if (active.length === 0) return rows;

  return rows.filter((row) =>
    active.every((clause) => {
      const field = getField(dataset, clause.field);
      if (!field) return true;
      const v = field.get(row);
      const hit = v !== null && clause.values.includes(String(v));
      return clause.exclude ? !hit : hit;
    }),
  );
}

/** Every distinct value of a dimension, for populating a slicer. */
export function distinctValues(
  rows: Record<string, unknown>[],
  field: Field,
  limit = 200,
): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = field.get(r);
    if (v === null || v === undefined) continue;
    const k = String(v);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([k]) => k);
}

// ─── The query ────────────────────────────────────────────

export function runQuery(
  dataset: Dataset,
  allRows: Record<string, unknown>[],
  spec: QuerySpec,
): QueryResult {
  const matched = applyFilters(allRows, dataset, spec.filters);

  const measureField = spec.measure === COUNT_MEASURE ? undefined : getField(dataset, spec.measure);
  const dimField = spec.dimension ? getField(dataset, spec.dimension) : undefined;
  const splitField = spec.splitBy ? getField(dataset, spec.splitBy) : undefined;

  const valuesOf = (rows: Record<string, unknown>[]): number[] => {
    if (!measureField) return [];
    const out: number[] = [];
    for (const r of rows) {
      const v = measureField.get(r);
      // Nulls are absent from the population, not zero in it.
      if (typeof v === "number" && Number.isFinite(v)) out.push(v);
    }
    return out;
  };

  const compute = (rows: Record<string, unknown>[]): number =>
    spec.agg === "distinct"
      ? distinctCount(rows, measureField)
      : aggregate(valuesOf(rows), spec.agg, rows.length);

  const total = compute(matched);

  // Ungrouped: a single figure, which is what a KPI tile wants.
  if (!dimField) {
    return {
      cells: [{ category: UNGROUPED, series: UNGROUPED, value: total, rows: matched }],
      categories: [UNGROUPED],
      series: [UNGROUPED],
      total, matched,
      unit: measureField?.unit,
      lowerIsBetter: measureField?.lowerIsBetter,
    };
  }

  // Bucket rows by (category, series).
  const buckets = new Map<string, Map<string, Record<string, unknown>[]>>();
  for (const row of matched) {
    const c = dimField.get(row);
    if (c === null || c === undefined) continue;
    const cKey = String(c);
    const sKey = splitField ? String(splitField.get(row) ?? "—") : UNGROUPED;
    let inner = buckets.get(cKey);
    if (!inner) { inner = new Map(); buckets.set(cKey, inner); }
    inner.set(sKey, [...(inner.get(sKey) ?? []), row]);
  }

  let cells: QueryCell[] = [];
  for (const [category, inner] of buckets) {
    for (const [series, rows] of inner) {
      cells.push({ category, series, value: compute(rows), rows });
    }
  }

  // Order categories by their combined value, so the chart leads with what matters.
  const categoryTotal = new Map<string, number>();
  for (const cell of cells) {
    categoryTotal.set(cell.category, (categoryTotal.get(cell.category) ?? 0) + cell.value);
  }

  const sortMode = spec.sort ?? "value_desc";
  let categories = [...categoryTotal.keys()].sort((a, b) => {
    if (sortMode === "label_asc") return a.localeCompare(b);
    const av = categoryTotal.get(a) ?? 0, bv = categoryTotal.get(b) ?? 0;
    return sortMode === "value_asc" ? av - bv : bv - av;
  });

  // Fold the tail into "Other" rather than truncating it away — a chart that
  // silently drops categories misstates the total it appears to show.
  if (spec.limit && categories.length > spec.limit) {
    const keep = new Set(categories.slice(0, spec.limit));
    const tail = cells.filter((c) => !keep.has(c.category));
    const kept = cells.filter((c) => keep.has(c.category));
    if (tail.length > 0) {
      const bySeries = new Map<string, Record<string, unknown>[]>();
      for (const c of tail) bySeries.set(c.series, [...(bySeries.get(c.series) ?? []), ...c.rows]);
      for (const [series, rows] of bySeries) {
        kept.push({ category: "Other", series, value: compute(rows), rows });
      }
    }
    cells = kept;
    categories = [...categories.slice(0, spec.limit), ...(tail.length > 0 ? ["Other"] : [])];
  }

  const seriesOrder = splitField
    ? [...new Set(cells.map((c) => c.series))].sort((a, b) => a.localeCompare(b))
    : [UNGROUPED];

  return {
    cells, categories, series: seriesOrder, total, matched,
    unit: measureField?.unit,
    lowerIsBetter: measureField?.lowerIsBetter,
  };
}

/** Value for one cell, or 0 — the shape charts want to read. */
export function cellValue(result: QueryResult, category: string, series: string): number {
  return result.cells.find((c) => c.category === category && c.series === series)?.value ?? 0;
}

/** Totals per category, in the result's category order. */
export function categoryTotals(result: QueryResult): number[] {
  return result.categories.map((cat) =>
    result.cells.filter((c) => c.category === cat).reduce((s, c) => s + c.value, 0));
}

// ─── Presentation ─────────────────────────────────────────

/** Compact number formatting — dashboards run out of width before precision. */
export function formatValue(value: number, unit?: string, agg?: AggKind): string {
  const isMoney = unit === "SAR";
  const decimals = agg === "avg" || agg === "median" ? 1 : 0;

  let n: string;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) n = `${(value / 1_000_000).toFixed(1)}M`;
  else if (abs >= 10_000) n = `${(value / 1_000).toFixed(0)}k`;
  else if (abs >= 1_000 && isMoney) n = `${(value / 1_000).toFixed(1)}k`;
  else n = value.toFixed(Number.isInteger(value) ? 0 : decimals);

  if (!unit) return n;
  if (isMoney) return `${n} SAR`;
  if (unit === "min" || unit === "h" || unit === "d" || unit === "ms") return `${n}${unit}`;
  return `${n} ${unit}`;
}

/** Chart series colour, cycling the eight-token palette. */
export function seriesColor(index: number): string {
  return `hsl(var(--chart-${(index % 8) + 1}))`;
}
