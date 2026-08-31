/**
 * Laboratory Results — نتائج المختبر
 *
 * Results with their reference intervals attached. Critical values are split
 * out and carry the notification record: a critical result that nobody was
 * told about is the failure mode this screen exists to prevent, so "notified"
 * is a first-class column rather than a note buried in the row.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { TestTube2, AlertTriangle, PhoneCall, CheckCircle2, Activity } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, StatTile, StatGrid, Pill, EmptyState,
  useCollection, matches, fmtDateTime, fmtAgo, cardCls, serif, type Tone,
} from "@/platform/ui";
import { resultFlag } from "@/platform/clinical/scores";

const FLAG_TONE: Record<string, Tone> = {
  normal: "neutral", low: "warning", high: "warning",
  critical_low: "critical", critical_high: "critical", abnormal: "warning",
};

const FLAG_LABEL: Record<string, { en: string; ar: string }> = {
  low: { en: "Low", ar: "منخفض" },
  high: { en: "High", ar: "مرتفع" },
  critical_low: { en: "Critical low", ar: "منخفض حرج" },
  critical_high: { en: "Critical high", ar: "مرتفع حرج" },
  abnormal: { en: "Abnormal", ar: "غير طبيعي" },
  normal: { en: "Normal", ar: "طبيعي" },
};

export default function LabResults() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: results, loading } = useCollection("lab_results");
  const { rows: orders } = useCollection("lab_orders");
  const [search, setSearch] = useState("");
  const [flagFilter, setFlagFilter] = useState("");

  const withOrder = useMemo(
    () => results.map((r) => ({
      result: r,
      order: orders.find((o) => o.id === r.lab_order_id),
      flag: r.flag ?? resultFlag(r.value_numeric, r.reference_low, r.reference_high),
    })),
    [results, orders],
  );

  const criticals = withOrder.filter((x) => x.flag === "critical_low" || x.flag === "critical_high" || x.result.critical_notified_at);
  const unnotified = criticals.filter((x) => !x.result.critical_notified_at);
  const abnormal = withOrder.filter((x) => x.flag && x.flag !== "normal");

  /** Median minutes from result to the clinician being told, for criticals. */
  const medianNotify = useMemo(() => {
    const times = criticals
      .filter((x) => x.result.critical_notified_at)
      .map((x) => (new Date(x.result.critical_notified_at!).getTime() - new Date(x.result.resulted_at).getTime()) / 60_000)
      .sort((a, b) => a - b);
    return times.length ? Math.round(times[Math.floor(times.length / 2)]) : null;
  }, [criticals]);

  const filtered = useMemo(
    () => withOrder
      .filter((x) =>
        (!flagFilter || x.flag === flagFilter) &&
        matches(search, x.result.analyte_en, x.result.analyte_ar, x.order?.patient_name, x.order?.patient_mrn, x.result.loinc_code))
      .sort((a, b) => new Date(b.result.resulted_at).getTime() - new Date(a.result.resulted_at).getTime()),
    [withOrder, search, flagFilter],
  );

  return (
    <Page>
      <PageHeader
        title="Laboratory Results"
        titleAr="نتائج المختبر"
        subtitle="Results with their reference intervals. Critical values carry a notification record."
        subtitleAr="النتائج مع نطاقاتها المرجعية. القيم الحرجة تحمل سجل الإبلاغ."
        meta={[
          { label: "Critical values", labelAr: "قيم حرجة", value: String(criticals.length), tone: criticals.length > 0 ? "critical" : "success" },
          { label: "Not yet notified", labelAr: "لم يُبلَّغ عنها", value: String(unnotified.length), tone: unnotified.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Results released" labelAr="نتائج صادرة" value={results.length} icon={TestTube2} tone="brand" />
        <StatTile
          label="Outside reference range" labelAr="خارج النطاق المرجعي" value={abnormal.length}
          icon={Activity} tone={abnormal.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Critical values" labelAr="قيم حرجة" value={criticals.length}
          sub={unnotified.length > 0 ? `${unnotified.length} not yet phoned through` : "All notified"}
          subAr={unnotified.length > 0 ? `${unnotified.length} لم يُبلَّغ عنها` : "تم إبلاغ الجميع"}
          icon={AlertTriangle} tone={unnotified.length > 0 ? "critical" : criticals.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Median time to notify" labelAr="وسيط زمن الإبلاغ"
          value={medianNotify !== null ? `${medianNotify}m` : "—"}
          sub="Result to clinician told" subAr="من النتيجة إلى إبلاغ الطبيب"
          icon={PhoneCall} tone={medianNotify !== null && medianNotify > 15 ? "warning" : "success"}
        />
      </StatGrid>

      {criticals.length > 0 && (
        <Section
          title="Critical values"
          titleAr="القيم الحرجة"
          description="Each one requires the ordering clinician to be told directly, not just filed."
          descriptionAr="كل قيمة تستوجب إبلاغ الطبيب الطالب مباشرة لا مجرد التسجيل."
        >
          <ul className="divide-y divide-border/25">
            {criticals.map(({ result: r, order, flag }) => (
              <li key={r.id} className="px-5 py-3.5 flex items-start gap-3">
                <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body font-semibold text-foreground" style={serif}>
                      {ar ? (r.analyte_ar ?? r.analyte_en) : r.analyte_en}
                    </span>
                    <span className="text-body-lg font-bold text-destructive tabular-nums">
                      {r.value} {r.unit ?? ""}
                    </span>
                    {flag && <Pill tone={FLAG_TONE[flag] ?? "critical"}>{ar ? FLAG_LABEL[flag]?.ar : FLAG_LABEL[flag]?.en}</Pill>}
                  </div>
                  <div className="text-caption text-muted-foreground mt-0.5">
                    {order && (
                      <Link href={`/chart/${order.patient_id}`} className="hover:text-brand-ink transition-colors">
                        {order.patient_name}
                      </Link>
                    )}
                    {order && ` · ${order.patient_mrn}`}
                    {r.reference_text && ` · ${ar ? "المرجع" : "ref"} ${r.reference_text}`}
                  </div>
                  <div className="text-micro text-muted-foreground mt-1 tabular-nums">
                    {ar ? "صدرت" : "resulted"} {fmtDateTime(r.resulted_at, ar)}
                    {r.instrument && ` · ${r.instrument}`}
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  {r.critical_notified_at ? (
                    <>
                      <Pill tone="success" icon={CheckCircle2}>{ar ? "تم الإبلاغ" : "Notified"}</Pill>
                      <div className="text-micro text-muted-foreground mt-1">
                        {r.critical_notified_to}
                        <br />
                        {fmtAgo(r.critical_notified_at, ar)}
                      </div>
                    </>
                  ) : (
                    <Pill tone="critical" icon={PhoneCall}>{ar ? "لم يُبلَّغ" : "Not notified"}</Pill>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Analyte, patient, MRN or LOINC"
          searchPlaceholderAr="التحليل أو المريض أو رقم الملف أو LOINC"
          filters={[{
            key: "flag", value: flagFilter, onChange: setFlagFilter,
            allLabel: "All results", allLabelAr: "كل النتائج",
            options: Object.entries(FLAG_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
          }]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "نتيجة" : filtered.length === 1 ? "result" : "results"}
          </span>
        </FilterBar>

        {loading ? null : filtered.length === 0 ? (
          <EmptyState icon={TestTube2} title="No results match" titleAr="لا توجد نتائج مطابقة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border/40">
                  {[
                    { en: "Analyte", ar: "التحليل" },
                    { en: "Patient", ar: "المريض" },
                    { en: "Value", ar: "القيمة" },
                    { en: "Reference", ar: "المرجع" },
                    { en: "Method", ar: "الطريقة" },
                    { en: "Resulted", ar: "وقت الصدور" },
                    { en: "Flag", ar: "التصنيف" },
                  ].map((h, i) => (
                    <th key={h.en} className={`px-4 py-3 text-caption font-medium text-muted-foreground whitespace-nowrap ${i === 6 ? "text-end" : "text-start"} ${i >= 4 ? "hidden lg:table-cell" : ""}`}>
                      {ar ? h.ar : h.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ result: r, order, flag }) => (
                  <tr key={r.id} className="border-b border-border/25 last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-body text-foreground">{ar ? (r.analyte_ar ?? r.analyte_en) : r.analyte_en}</div>
                      {r.loinc_code && <div className="text-micro text-muted-foreground tabular-nums">{r.loinc_code}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {order ? (
                        <Link href={`/chart/${order.patient_id}`} className="text-body text-foreground hover:text-brand-ink transition-colors">
                          {order.patient_name}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-body font-semibold tabular-nums whitespace-nowrap ${
                        flag === "critical_low" || flag === "critical_high" ? "text-destructive" : "text-foreground"}`}>
                        {r.value} {r.unit ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-caption text-muted-foreground tabular-nums whitespace-nowrap">
                      {r.reference_text ?? (r.reference_low !== null && r.reference_high !== null ? `${r.reference_low}–${r.reference_high}` : "—")}
                    </td>
                    <td className="px-4 py-3 text-caption text-muted-foreground hidden lg:table-cell">{r.method ?? "—"}</td>
                    <td className="px-4 py-3 text-caption text-muted-foreground hidden lg:table-cell whitespace-nowrap">{fmtAgo(r.resulted_at, ar)}</td>
                    <td className="px-4 py-3 text-end hidden lg:table-cell">
                      {flag && flag !== "normal"
                        ? <Pill tone={FLAG_TONE[flag] ?? "warning"}>{ar ? FLAG_LABEL[flag]?.ar : FLAG_LABEL[flag]?.en}</Pill>
                        : <span className="text-micro text-muted-foreground">{ar ? "طبيعي" : "Normal"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Page>
  );
}
