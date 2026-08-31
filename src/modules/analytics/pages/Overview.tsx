/**
 * Executive Overview — النظرة التنفيذية
 *
 * The hospital's standing report: activity, flow, quality, revenue and
 * workforce on one page, all from a single snapshot so the figures reconcile.
 *
 * Every tile is a real query against the same engine the explorer uses —
 * there are no hand-written numbers on this page. If a figure looks wrong,
 * it can be opened in the explorer and interrogated, which is the only way a
 * board report ever gets trusted.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp, Activity, Clock, Receipt, BedDouble, Siren, Scissors,
  FlaskConical, ArrowRight, Users, ShieldAlert,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, LoadingRow, Pill,
  fmtDateTime, serif, type Tone,
} from "@/platform/ui";
import { useSnapshot, bedSummary, edLive, minutesSince } from "@/platform/data/snapshot";
import { getDataset } from "@/platform/analytics/datasets";
import { runQuery, formatValue, type QuerySpec } from "@/platform/analytics/query";
import { Visual, VisualCard } from "@/platform/analytics/visuals";
import { isTriageBreached } from "@/platform/clinical/scores";

/** A tile on the standing report. Declared, not drawn by hand. */
interface Tile {
  title: { en: string; ar: string };
  subtitle?: { en: string; ar: string };
  visual: Parameters<typeof Visual>[0]["kind"];
  spec: QuerySpec;
  span?: string;
}

const TILES: Tile[] = [
  {
    title: { en: "Encounters by department", ar: "الزيارات حسب القسم" },
    subtitle: { en: "Activity mix across the hospital", ar: "توزيع النشاط في المستشفى" },
    visual: "column",
    spec: { datasetId: "encounters", dimension: "department", measure: "__count", agg: "count", limit: 8 },
    span: "lg:col-span-2",
  },
  {
    title: { en: "Encounter type", ar: "نوع الزيارة" },
    visual: "donut",
    spec: { datasetId: "encounters", dimension: "class", measure: "__count", agg: "count" },
  },
  {
    title: { en: "Median door to doctor", ar: "وسيط الوصول للطبيب" },
    subtitle: { en: "By triage category, minutes", ar: "حسب فئة الفرز، بالدقائق" },
    visual: "bar",
    spec: { datasetId: "ed_visits", dimension: "triage", measure: "door_to_doctor", agg: "median", sort: "label_asc" },
  },
  {
    title: { en: "Laboratory turnaround", ar: "زمن إنجاز المختبر" },
    subtitle: { en: "90th percentile by discipline, minutes", ar: "المئين ٩٠ حسب التخصص، بالدقائق" },
    visual: "bar",
    spec: { datasetId: "lab_orders", dimension: "discipline", measure: "tat", agg: "p90", limit: 6 },
  },
  {
    title: { en: "Theatre utilisation", ar: "استغلال غرف العمليات" },
    subtitle: { en: "Total operating minutes by theatre", ar: "إجمالي دقائق التشغيل حسب الغرفة" },
    visual: "column",
    spec: { datasetId: "ot_cases", dimension: "theatre", measure: "duration", agg: "sum" },
  },
  {
    title: { en: "Claim value by payer", ar: "قيمة المطالبات حسب جهة الدفع" },
    subtitle: { en: "Split by claim status", ar: "موزعة حسب حالة المطالبة" },
    visual: "stacked",
    spec: { datasetId: "claims", dimension: "payer", splitBy: "status", measure: "claimed", agg: "sum" },
    span: "lg:col-span-2",
  },
  {
    title: { en: "Revenue by category", ar: "الإيراد حسب الفئة" },
    visual: "donut",
    spec: { datasetId: "charges", dimension: "category", measure: "total", agg: "sum" },
  },
  {
    title: { en: "Bed state by ward", ar: "حالة الأسرة حسب الجناح" },
    subtitle: { en: "Capacity that is available, occupied or lost", ar: "السعة المتاحة والمشغولة والمفقودة" },
    visual: "stacked",
    spec: { datasetId: "beds", dimension: "ward", splitBy: "status", measure: "__count", agg: "count" },
    span: "lg:col-span-2",
  },
  {
    title: { en: "Alert override rate", ar: "نسبة تجاوز التنبيهات" },
    subtitle: { en: "Decision support outcomes by rule type", ar: "نتائج دعم القرار حسب نوع القاعدة" },
    visual: "heatmap",
    spec: { datasetId: "cdss_alerts", dimension: "status", splitBy: "alert_type", measure: "__count", agg: "count" },
  },
  {
    title: { en: "Bed turnaround by ward", ar: "دوران الأسرة حسب الجناح" },
    subtitle: { en: "Median cleaning time, minutes", ar: "وسيط زمن التنظيف بالدقائق" },
    visual: "bar",
    spec: { datasetId: "housekeeping", dimension: "ward", measure: "turnaround", agg: "median" },
  },
  {
    title: { en: "Workforce cost by department", ar: "تكلفة القوى العاملة حسب القسم" },
    subtitle: { en: "Monthly payroll, SAR", ar: "الرواتب الشهرية بالريال" },
    visual: "bar",
    spec: { datasetId: "workforce", dimension: "department", measure: "salary", agg: "sum", limit: 8 },
  },
  {
    title: { en: "Imaging mix", ar: "توزيع الأشعة" },
    subtitle: { en: "Studies by modality", ar: "الدراسات حسب الجهاز" },
    visual: "donut",
    spec: { datasetId: "imaging_orders", dimension: "modality", measure: "__count", agg: "count" },
  },
];

export default function Overview() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { snapshot, loading, takenAt } = useSnapshot();
  const [focus, setFocus] = useState<string | null>(null);

  /** Headline figures, computed the same way the module cards compute them. */
  const headline = useMemo(() => {
    const beds = bedSummary(snapshot);
    const live = edLive(snapshot);
    const breaches = live.filter(
      (v) => v.status === "waiting" && isTriageBreached(v.triage_level, minutesSince(v.arrival_at)),
    ).length;

    const claimed = snapshot.claims.reduce((s, c) => s + Number(c.claimed_amount ?? 0), 0);
    const paid = snapshot.claims.reduce((s, c) => s + Number(c.paid_amount ?? 0), 0);
    const collection = claimed > 0 ? Math.round((paid / claimed) * 100) : 0;

    const denied = snapshot.claims.filter((c) => c.status === "denied").length;
    const denialRate = snapshot.claims.length > 0
      ? Math.round((denied / snapshot.claims.length) * 100) : 0;

    const losValues = snapshot.encounters
      .filter((e) => e.class === "inpatient" && e.los_hours)
      .map((e) => Number(e.los_hours));
    const meanLos = losValues.length > 0
      ? Math.round(losValues.reduce((a, b) => a + b, 0) / losValues.length / 24 * 10) / 10
      : null;

    const overridden = snapshot.alerts.filter((a) => a.status === "overridden").length;
    const overrideRate = snapshot.alerts.length > 0
      ? Math.round((overridden / snapshot.alerts.length) * 100) : 0;

    return { beds, live, breaches, collection, denialRate, meanLos, overrideRate };
  }, [snapshot]);

  if (loading) {
    return <Page><PageHeader title="Executive Overview" titleAr="النظرة التنفيذية" /><LoadingRow /></Page>;
  }

  return (
    <Page>
      <PageHeader
        title="Executive Overview"
        titleAr="النظرة التنفيذية"
        subtitle="The standing report. Every figure is a live query — open any of them in the explorer to see the records behind it."
        subtitleAr="التقرير الدائم. كل رقم هنا استعلام حي — افتح أياً منها في المستكشف لترى السجلات خلفه."
        meta={takenAt ? [{
          label: "Snapshot taken", labelAr: "لحظة القراءة",
          value: fmtDateTime(takenAt.toISOString(), ar), tone: "data",
        }] : undefined}
        actions={
          <Link href="/analytics/explorer" className="inline-flex items-center gap-2 h-9 rounded-xl bg-data text-primary-foreground text-body font-medium px-4 hover:opacity-90 transition-opacity">
            <TrendingUp size={14} /> {ar ? "المستكشف" : "Explorer"}
          </Link>
        }
      />

      <StatGrid cols={6}>
        <StatTile
          label="Bed occupancy" labelAr="إشغال الأسرة" value={`${headline.beds.pct}%`}
          sub={`${headline.beds.available} free`} subAr={`${headline.beds.available} شاغر`}
          icon={BedDouble} href="/wards"
          tone={headline.beds.pct >= 95 ? "critical" : headline.beds.pct >= 85 ? "warning" : "success"}
        />
        <StatTile
          label="In emergency" labelAr="في الطوارئ" value={headline.live.length}
          sub={headline.breaches > 0 ? `${headline.breaches} breaching` : "Within target"}
          subAr={headline.breaches > 0 ? `${headline.breaches} تجاوز` : "ضمن الهدف"}
          icon={Siren} href="/emergency"
          tone={headline.breaches > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Mean length of stay" labelAr="متوسط مدة البقاء"
          value={headline.meanLos !== null ? `${headline.meanLos}d` : "—"}
          sub="Completed inpatient" subAr="حالات التنويم المكتملة"
          icon={Clock} tone="neutral"
        />
        <StatTile
          label="Collection rate" labelAr="نسبة التحصيل" value={`${headline.collection}%`}
          sub="Paid against claimed" subAr="المدفوع مقابل المطالب"
          icon={Receipt} href="/revenue"
          tone={headline.collection >= 85 ? "success" : headline.collection >= 70 ? "warning" : "critical"}
        />
        <StatTile
          label="Denial rate" labelAr="نسبة الرفض" value={`${headline.denialRate}%`}
          icon={Receipt} href="/revenue/claims"
          tone={headline.denialRate > 10 ? "critical" : headline.denialRate > 5 ? "warning" : "success"}
        />
        <StatTile
          label="Alert override rate" labelAr="نسبة تجاوز التنبيهات" value={`${headline.overrideRate}%`}
          sub="Alert fatigue indicator" subAr="مؤشر إجهاد التنبيهات"
          icon={ShieldAlert} href="/orders/decision-support"
          tone={headline.overrideRate > 50 ? "warning" : "success"}
        />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        {TILES.map((tile, i) => {
          const dataset = getDataset(tile.spec.datasetId);
          if (!dataset) return null;
          const rows = dataset.rows(snapshot);
          const result = runQuery(dataset, rows, tile.spec);
          const Icon = dataset.icon;
          return (
            <VisualCard
              key={i}
              className={tile.span}
              title={
                <span className="inline-flex items-center gap-2">
                  <Icon size={14} className="text-data shrink-0" />
                  {ar ? tile.title.ar : tile.title.en}
                </span>
              }
              subtitle={tile.subtitle ? (ar ? tile.subtitle.ar : tile.subtitle.en) : undefined}
              actions={
                <Link
                  href="/analytics/explorer"
                  className="text-micro text-muted-foreground hover:text-data inline-flex items-center gap-1"
                  title={ar ? "افتح في المستكشف" : "Open in explorer"}
                >
                  <ArrowRight size={12} className="rtl:rotate-180" />
                </Link>
              }
            >
              <Visual
                kind={tile.visual}
                result={result}
                agg={tile.spec.agg}
                selected={focus}
                onSelect={(c) => setFocus((cur) => (cur === c ? null : c))}
                height={tile.span ? 240 : 200}
              />
            </VisualCard>
          );
        })}
      </div>
    </Page>
  );
}
