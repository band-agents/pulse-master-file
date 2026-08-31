/**
 * Data Explorer — مستكشف البيانات
 *
 * Ask the hospital a question without writing a query. Choose a dataset,
 * pick something to group by and something to measure, and the answer is
 * drawn immediately; slicers narrow the population, clicking a mark
 * cross-filters, and the rows behind any figure are one click away.
 *
 * The drill-through is the point. A dashboard that shows a number nobody can
 * open is a number nobody can act on, so every visual here can be unfolded
 * into the records that produced it and exported as it stands.
 */

import { useState, useMemo, useCallback } from "react";
import {
  BarChart3, Table2, Download, Filter, X, ChevronDown, Layers,
  Sigma, Rows3, Save, RotateCcw, Database,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, EmptyState, LoadingRow, Pill,
  btnPrimary, btnGhost, labelCls, serif, cardCls, inputCls,
} from "@/platform/ui";
import { useSnapshot } from "@/platform/data/snapshot";
import {
  DATASETS, getDataset, getField, dimensionsOf, measuresOf, datesOf,
} from "@/platform/analytics/datasets";
import {
  runQuery, distinctValues, formatValue, AGGREGATIONS, COUNT_MEASURE,
  type AggKind, type FilterClause, type QuerySpec,
} from "@/platform/analytics/query";
import { Visual, VisualCard, VISUALS, type VisualKind } from "@/platform/analytics/visuals";
import { saveTile } from "@/platform/analytics/dashboards";
import { BRAND, exportName } from "@/platform/lib/brand";

export default function Explorer() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { snapshot, loading } = useSnapshot();

  const [datasetId, setDatasetId] = useState(DATASETS[0].id);
  const dataset = getDataset(datasetId)!;

  const [dimension, setDimension] = useState<string>(dataset.defaults.dimension);
  const [splitBy, setSplitBy] = useState<string>("");
  const [measure, setMeasure] = useState<string>(dataset.defaults.measure);
  const [agg, setAgg] = useState<AggKind>("count");
  const [visual, setVisual] = useState<VisualKind>("column");
  const [filters, setFilters] = useState<FilterClause[]>([]);
  const [crossFilter, setCrossFilter] = useState<string | null>(null);
  const [showRows, setShowRows] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  /** Switching dataset invalidates every field choice — reset rather than
   *  carry a dimension that does not exist on the new table. */
  const pickDataset = useCallback((id: string) => {
    const d = getDataset(id);
    if (!d) return;
    setDatasetId(id);
    setDimension(d.defaults.dimension);
    setSplitBy("");
    setMeasure(d.defaults.measure);
    setAgg(d.defaults.measure === COUNT_MEASURE ? "count" : "avg");
    setFilters([]);
    setCrossFilter(null);
  }, []);

  const allRows = useMemo(() => dataset.rows(snapshot), [dataset, snapshot]);

  const spec: QuerySpec = useMemo(() => {
    // A cross-filter click is an extra clause, not a change to the slicers,
    // so clearing it never disturbs what the user set by hand.
    const effective = crossFilter && dimension
      ? [...filters, { field: dimension, values: [crossFilter] }]
      : filters;
    return {
      datasetId, dimension: dimension || undefined, splitBy: splitBy || undefined,
      measure, agg, filters: effective, limit: 12,
      sort: visual === "line" || visual === "area" ? "label_asc" : "value_desc",
    };
  }, [datasetId, dimension, splitBy, measure, agg, filters, crossFilter, visual]);

  const result = useMemo(() => runQuery(dataset, allRows, spec), [dataset, allRows, spec]);

  // The unfiltered population, so a slicer can still list values it excluded.
  const slicerSource = useMemo(() => allRows, [allRows]);

  const dims = dimensionsOf(dataset);
  const dates = datesOf(dataset);
  const measures = measuresOf(dataset);
  const aggDef = AGGREGATIONS.find((a) => a.id === agg);

  function toggleFilterValue(fieldId: string, value: string) {
    setFilters((prev) => {
      const existing = prev.find((f) => f.field === fieldId);
      if (!existing) return [...prev, { field: fieldId, values: [value] }];
      const has = existing.values.includes(value);
      const values = has ? existing.values.filter((v) => v !== value) : [...existing.values, value];
      return values.length === 0
        ? prev.filter((f) => f.field !== fieldId)
        : prev.map((f) => (f.field === fieldId ? { ...f, values } : f));
    });
  }

  function exportCsv() {
    const dimName = dimension ? getField(dataset, dimension)?.name.en ?? "Category" : "All";
    const header = splitBy ? [dimName, "Series", "Value"] : [dimName, "Value"];
    const lines = [header.join(",")];
    for (const cell of result.cells) {
      const cols = splitBy
        ? [cell.category, cell.series, String(cell.value)]
        : [cell.category, String(cell.value)];
      lines.push(cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName(dataset.id)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pin() {
    const label = getField(dataset, dimension)?.name;
    saveTile({
      id: `tile-${Date.now()}`,
      title: {
        en: `${dataset.name.en} by ${label?.en ?? "total"}`,
        ar: `${dataset.name.ar} حسب ${label?.ar ?? "الإجمالي"}`,
      },
      visual,
      spec: { ...spec, filters },
    });
    setSaved(visual);
    window.setTimeout(() => setSaved(null), 2500);
  }

  if (loading) return <Page><PageHeader title="Data Explorer" titleAr="مستكشف البيانات" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Data Explorer"
        titleAr="مستكشف البيانات"
        subtitle="Question any dataset in the hospital. Click a mark to cross-filter, then open the rows behind it."
        subtitleAr="اسأل أي مجموعة بيانات في المستشفى. انقر على أي عنصر للتصفية ثم افتح السجلات خلفه."
        meta={[
          { label: "Datasets", labelAr: "مجموعات البيانات", value: String(DATASETS.length), tone: "data" },
          { label: "Rows in view", labelAr: "سجلات معروضة", value: result.matched.length.toLocaleString(), tone: "neutral" },
        ]}
        actions={
          <>
            <button type="button" onClick={exportCsv} className={btnGhost}>
              <Download size={14} /> {ar ? "تصدير" : "Export"}
            </button>
            <button type="button" onClick={pin} className={btnPrimary}>
              <Save size={14} /> {saved ? (ar ? "تم التثبيت" : "Pinned") : (ar ? "تثبيت في لوحة" : "Pin to dashboard")}
            </button>
          </>
        }
      />

      {/* ── Dataset picker ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DATASETS.map((d) => {
          const active = d.id === datasetId;
          const Icon = d.icon;
          return (
            <button
              key={d.id} type="button" onClick={() => pickDataset(d.id)}
              className={`shrink-0 inline-flex items-center gap-2 px-3 h-9 rounded-lg text-body font-medium transition-colors
                ${active ? "bg-data-wash text-data" : "text-muted-foreground hover:bg-muted/60"}`}
            >
              <Icon size={14} />
              {ar ? d.name.ar : d.name.en}
              <span className="text-micro opacity-60 tabular-nums">{d.rows(snapshot).length}</span>
            </button>
          );
        })}
      </div>

      <p className="text-caption text-muted-foreground -mt-3 max-w-[80ch]">
        {ar ? dataset.description.ar : dataset.description.en}
      </p>

      <div className="grid lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* ── Query builder ── */}
        <div className="space-y-4">
          <Section title="Build" titleAr="بناء الاستعلام">
            <div className="p-4 space-y-3.5">
              <div>
                <label className={labelCls}>
                  <Rows3 size={11} className="inline me-1" />{ar ? "التجميع حسب" : "Group by"}
                </label>
                <select value={dimension} onChange={(e) => { setDimension(e.target.value); setCrossFilter(null); }} className={inputCls}>
                  <option value="">{ar ? "بدون تجميع (رقم واحد)" : "No grouping (single figure)"}</option>
                  {dates.length > 0 && (
                    <optgroup label={ar ? "التواريخ" : "Dates"}>
                      {dates.map((f) => <option key={f.id} value={f.id}>{ar ? f.name.ar : f.name.en}</option>)}
                    </optgroup>
                  )}
                  <optgroup label={ar ? "الأبعاد" : "Dimensions"}>
                    {dims.map((f) => <option key={f.id} value={f.id}>{ar ? f.name.ar : f.name.en}</option>)}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  <Layers size={11} className="inline me-1" />{ar ? "التقسيم حسب" : "Split by"}
                </label>
                <select value={splitBy} onChange={(e) => setSplitBy(e.target.value)} className={inputCls}>
                  <option value="">{ar ? "بدون تقسيم" : "None"}</option>
                  {dims.filter((f) => f.id !== dimension).map((f) => (
                    <option key={f.id} value={f.id}>{ar ? f.name.ar : f.name.en}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  <Sigma size={11} className="inline me-1" />{ar ? "القياس" : "Measure"}
                </label>
                <select
                  value={measure}
                  onChange={(e) => {
                    setMeasure(e.target.value);
                    // Count is the only aggregation that works without a measure.
                    if (e.target.value === COUNT_MEASURE) setAgg("count");
                    else if (agg === "count") setAgg("avg");
                  }}
                  className={inputCls}
                >
                  <option value={COUNT_MEASURE}>{ar ? "عدد السجلات" : "Row count"}</option>
                  {measures.map((f) => (
                    <option key={f.id} value={f.id}>
                      {ar ? f.name.ar : f.name.en}{f.unit ? ` (${f.unit})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>{ar ? "طريقة التجميع" : "Aggregation"}</label>
                <div className="flex flex-wrap gap-1">
                  {AGGREGATIONS
                    .filter((a) => measure === COUNT_MEASURE ? !a.needsMeasure : true)
                    .map((a) => (
                      <button
                        key={a.id} type="button" onClick={() => setAgg(a.id)}
                        className={`px-2 h-7 rounded-md text-micro font-medium transition-colors
                          ${agg === a.id ? "bg-data text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"}`}
                      >
                        {ar ? a.ar : a.en}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>{ar ? "نوع الرسم" : "Visual"}</label>
                <div className="grid grid-cols-3 gap-1">
                  {VISUALS.map((v) => (
                    <button
                      key={v.id} type="button" onClick={() => setVisual(v.id)}
                      className={`px-1.5 h-8 rounded-md text-micro font-medium transition-colors truncate
                        ${visual === v.id ? "bg-data-wash text-data" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? v.ar : v.en}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* ── Slicers ── */}
          <Section
            title="Slicers" titleAr="المُرشِّحات"
            actions={filters.length > 0 ? (
              <button type="button" onClick={() => setFilters([])} className="text-micro text-brand-ink font-medium inline-flex items-center gap-1">
                <RotateCcw size={11} />{ar ? "مسح" : "Clear"}
              </button>
            ) : undefined}
          >
            <div className="p-4 space-y-3 max-h-[420px] overflow-y-auto">
              {dims.slice(0, 5).map((f) => {
                const values = distinctValues(slicerSource, f, 8);
                const active = filters.find((x) => x.field === f.id);
                if (values.length === 0) return null;
                return (
                  <div key={f.id}>
                    <div className="text-micro font-medium text-muted-foreground mb-1.5">
                      {ar ? f.name.ar : f.name.en}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {values.map((v) => {
                        const on = active?.values.includes(v) ?? false;
                        return (
                          <button
                            key={v} type="button" onClick={() => toggleFilterValue(f.id, v)}
                            className={`px-1.5 h-6 rounded-md text-micro transition-colors truncate max-w-[130px]
                              ${on ? "bg-data text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground"}`}
                            title={v}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* ── Result ── */}
        <div className="space-y-4 min-w-0">
          {(filters.length > 0 || crossFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <Filter size={13} className="text-muted-foreground" />
              {crossFilter && (
                <button
                  type="button" onClick={() => setCrossFilter(null)}
                  className="inline-flex items-center gap-1.5 px-2 h-7 rounded-lg text-micro font-medium bg-data-wash text-data"
                >
                  {crossFilter}<X size={11} />
                </button>
              )}
              {filters.map((f) => {
                const field = getField(dataset, f.field);
                return f.values.map((v) => (
                  <button
                    key={`${f.field}-${v}`} type="button" onClick={() => toggleFilterValue(f.field, v)}
                    className="inline-flex items-center gap-1.5 px-2 h-7 rounded-lg text-micro font-medium bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <span className="opacity-70">{ar ? field?.name.ar : field?.name.en}:</span> {v}
                    <X size={11} />
                  </button>
                ));
              })}
            </div>
          )}

          <VisualCard
            title={
              <span className="inline-flex items-center gap-2">
                <BarChart3 size={15} className="text-data" />
                {ar ? dataset.name.ar : dataset.name.en}
                {dimension && (
                  <span className="text-muted-foreground font-normal">
                    {ar ? " حسب " : " by "}
                    {ar ? getField(dataset, dimension)?.name.ar : getField(dataset, dimension)?.name.en}
                  </span>
                )}
              </span>
            }
            subtitle={
              `${ar ? aggDef?.ar : aggDef?.en}${measure !== COUNT_MEASURE
                ? ` · ${ar ? getField(dataset, measure)?.name.ar : getField(dataset, measure)?.name.en}` : ""}` +
              ` · ${ar ? "الإجمالي" : "total"} ${formatValue(result.total, result.unit, agg)}`
            }
            actions={
              <button
                type="button" onClick={() => setShowRows((v) => !v)}
                className="inline-flex items-center gap-1 text-micro text-muted-foreground hover:text-foreground px-1.5 h-6 rounded-md hover:bg-muted"
              >
                <Table2 size={12} />{ar ? "السجلات" : "Rows"}
                <ChevronDown size={11} className={showRows ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>
            }
          >
            <Visual
              kind={visual}
              result={result}
              agg={agg}
              selected={crossFilter}
              onSelect={(category) => setCrossFilter((cur) => (cur === category ? null : category))}
              height={visual === "kpi" ? 120 : 260}
            />
          </VisualCard>

          {showRows && (
            <Section
              title="Rows behind this figure"
              titleAr="السجلات خلف هذا الرقم"
              description={`${result.matched.length} ${ar ? "سجل" : "records"}`}
              descriptionAr={`${result.matched.length} سجل`}
            >
              <DrillTable rows={result.matched.slice(0, 60)} dataset={dataset} />
            </Section>
          )}
        </div>
      </div>
    </Page>
  );
}

/**
 * The records behind a figure. Columns are the dataset's own dimensions, so
 * the table always speaks the same vocabulary as the chart above it.
 */
function DrillTable({
  rows, dataset,
}: {
  rows: Record<string, unknown>[];
  dataset: ReturnType<typeof getDataset> extends infer D ? NonNullable<D> : never;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const cols = [...dimensionsOf(dataset).slice(0, 5), ...measuresOf(dataset).slice(0, 3)];

  if (rows.length === 0) {
    return <EmptyState icon={Database} title="No rows match" titleAr="لا توجد سجلات مطابقة" />;
  }

  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <table className="w-full text-body">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border/40">
            {cols.map((c) => (
              <th key={c.id} className="text-start text-caption font-medium text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                {ar ? c.name.ar : c.name.en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)} className="border-b border-border/20 last:border-0 hover:bg-muted/40 transition-colors">
              {cols.map((c) => {
                const v = c.get(r);
                return (
                  <td key={c.id} className="px-4 py-2 text-foreground whitespace-nowrap">
                    {v === null
                      ? <span className="text-muted-foreground">—</span>
                      : c.kind === "measure"
                        ? <span className="tabular-nums">{formatValue(Number(v), c.unit)}</span>
                        : String(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length >= 60 && (
        <p className="px-4 py-2 text-micro text-muted-foreground">
          {ar
            ? `تُعرض أول ٦٠ سجلاً. استخدم التصدير للحصول على الباقي — ${BRAND.shortNameAr}.`
            : "Showing the first 60 rows. Export to get the rest."}
        </p>
      )}
    </div>
  );
}
