/**
 * Studies & PACS — الدراسات والأرشيف
 *
 * The completed side of radiology: studies that have a report attached.
 * Critical findings carry the same weight as a critical lab value — a
 * finding nobody was told about is the failure this screen exists to catch,
 * so notification status is a first-class column, not a footnote.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ScanLine, AlertTriangle, PhoneCall, CheckCircle2, Layers, Gauge } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, StatTile, StatGrid, Pill, EmptyState,
  useCollection, matches, fmtDateTime, fmtAgo, serif,
} from "@/platform/ui";

const MODALITY_LABEL: Record<string, { en: string; ar: string }> = {
  xr: { en: "X-Ray", ar: "أشعة سينية" },
  ct: { en: "CT", ar: "مقطعية" },
  mri: { en: "MRI", ar: "رنين مغناطيسي" },
  us: { en: "Ultrasound", ar: "موجات صوتية" },
  mammo: { en: "Mammography", ar: "تصوير الثدي" },
  nm: { en: "Nuclear medicine", ar: "طب نووي" },
  pet: { en: "PET", ar: "بيت" },
  fluoro: { en: "Fluoroscopy", ar: "تنظير إشعاعي" },
  dexa: { en: "DEXA", ar: "قياس كثافة العظام" },
  angio: { en: "Angiography", ar: "قسطرة تشخيصية" },
};

const LATERALITY_LABEL: Record<string, { en: string; ar: string }> = {
  left: { en: "L", ar: "يسار" },
  right: { en: "R", ar: "يمين" },
  bilateral: { en: "Bilateral", ar: "ثنائي" },
  na: { en: "", ar: "" },
};

export default function ImagingStudies() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: allOrders, loading } = useCollection("imaging_orders");
  const [search, setSearch] = useState("");
  const [modality, setModality] = useState("");

  /** Completed studies only — an order isn't a "study" for this page until it has a report. */
  const studies = useMemo(
    () => allOrders.filter((o) => o.status === "reported" || o.status === "verified"),
    [allOrders],
  );

  const criticalFindings = studies.filter((s) => s.critical_finding);
  const unnotified = criticalFindings.filter((s) => !s.critical_notified_at);

  const avgSeries = useMemo(() => {
    const v = studies.filter((s) => s.series_count !== null).map((s) => s.series_count!);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  }, [studies]);
  const avgImages = useMemo(() => {
    const v = studies.filter((s) => s.image_count !== null).map((s) => s.image_count!);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }, [studies]);
  const totalDose = useMemo(
    () => studies.reduce((sum, s) => sum + (s.radiation_dose ?? 0), 0),
    [studies],
  );

  const filtered = useMemo(
    () => studies
      .filter((s) =>
        (!modality || s.modality === modality) &&
        matches(search, s.procedure_en, s.procedure_ar, s.patient_name, s.patient_mrn, s.accession_number, s.radiologist, s.impression_en))
      .sort((a, b) => new Date(b.reported_at ?? b.created_at).getTime() - new Date(a.reported_at ?? a.created_at).getTime()),
    [studies, search, modality],
  );

  return (
    <Page>
      <PageHeader
        title="Studies & PACS"
        titleAr="الدراسات والأرشيف"
        subtitle="Completed studies with a report attached. Critical findings carry their notification record."
        subtitleAr="الدراسات المكتملة مع تقاريرها. النتائج الحرجة تحمل سجل الإبلاغ عنها."
        meta={[
          { label: "Critical findings", labelAr: "نتائج حرجة", value: String(criticalFindings.length), tone: criticalFindings.length > 0 ? "critical" : "success" },
          { label: "Not yet notified", labelAr: "لم يُبلَّغ عنها", value: String(unnotified.length), tone: unnotified.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Studies reported" labelAr="دراسات مكتملة" value={studies.length} icon={ScanLine} tone="brand" />
        <StatTile
          label="Critical findings" labelAr="نتائج حرجة" value={criticalFindings.length}
          sub={unnotified.length > 0 ? `${unnotified.length} not yet phoned through` : "All notified"}
          subAr={unnotified.length > 0 ? `${unnotified.length} لم يُبلَّغ عنها` : "تم إبلاغ الجميع"}
          icon={AlertTriangle} tone={unnotified.length > 0 ? "critical" : criticalFindings.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Avg. series / images" labelAr="متوسط السلاسل / الصور"
          value={avgSeries !== null && avgImages !== null ? `${avgSeries} / ${avgImages}` : "—"}
          icon={Layers} tone="neutral"
        />
        <StatTile
          label="Cumulative radiation dose" labelAr="إجمالي الجرعة الإشعاعية"
          value={totalDose > 0 ? totalDose.toLocaleString(ar ? "ar-SA" : "en-US") : "—"}
          sub="DLP or equivalent" subAr="جرعة أو ما يعادلها"
          icon={Gauge} tone="neutral"
        />
      </StatGrid>

      {unnotified.length > 0 && (
        <Section
          title="Critical findings"
          titleAr="النتائج الحرجة"
          description="Each one requires the ordering clinician to be told directly, not just filed."
          descriptionAr="كل نتيجة تستوجب إبلاغ الطبيب الطالب مباشرة لا مجرد التسجيل."
        >
          <ul className="divide-y divide-border/25">
            {unnotified.map((s) => (
              <li key={s.id} className="px-5 py-3.5 flex items-start gap-3">
                <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body font-semibold text-foreground" style={serif}>
                      {ar ? (s.procedure_ar ?? s.procedure_en) : s.procedure_en}
                    </span>
                    <Pill tone="brand">{(MODALITY_LABEL[s.modality]?.en ?? s.modality).toUpperCase()}</Pill>
                  </div>
                  <div className="text-caption text-muted-foreground mt-0.5">
                    <Link href={`/chart/${s.patient_id}`} className="hover:text-brand-ink transition-colors">{s.patient_name}</Link>
                    {` · ${s.patient_mrn}`}
                    {s.radiologist && ` · ${s.radiologist}`}
                  </div>
                  {s.impression_en && (
                    <div className="text-caption text-foreground/80 mt-1 max-w-[70ch] truncate">{s.impression_en}</div>
                  )}
                  <div className="text-micro text-muted-foreground mt-1 tabular-nums">
                    {ar ? "صدر" : "reported"} {fmtAgo(s.reported_at, ar)}
                  </div>
                </div>
                <div className="shrink-0">
                  <Pill tone="critical" icon={PhoneCall}>{ar ? "لم يُبلَّغ" : "Not notified"}</Pill>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Procedure, patient, MRN, accession, radiologist or impression"
          searchPlaceholderAr="الإجراء أو المريض أو رقم الملف أو الطبيب أو الانطباع"
          filters={[{
            key: "modality", value: modality, onChange: setModality,
            allLabel: "All modalities", allLabelAr: "كل الوسائل",
            options: Object.entries(MODALITY_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
          }]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "دراسة" : filtered.length === 1 ? "study" : "studies"}
          </span>
        </FilterBar>

        {loading ? null : filtered.length === 0 ? (
          <EmptyState icon={ScanLine} title="No studies match" titleAr="لا توجد دراسات مطابقة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-border/40">
                  {[
                    { en: "Patient", ar: "المريض" },
                    { en: "Study", ar: "الدراسة" },
                    { en: "Procedure", ar: "الإجراء" },
                    { en: "Radiologist", ar: "الطبيب" },
                    { en: "Reported", ar: "وقت التقرير" },
                    { en: "Impression", ar: "الانطباع" },
                    { en: "Critical", ar: "حرج" },
                  ].map((h, i) => (
                    <th key={h.en} className={`px-4 py-3 text-caption font-medium text-muted-foreground whitespace-nowrap ${i === 6 ? "text-end" : "text-start"} ${i >= 3 ? "hidden lg:table-cell" : ""}`}>
                      {ar ? h.ar : h.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/25 last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/chart/${s.patient_id}`} className="text-body text-foreground hover:text-brand-ink transition-colors">{s.patient_name}</Link>
                      <div className="text-micro text-muted-foreground tabular-nums">{s.patient_mrn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Pill tone="brand">{(MODALITY_LABEL[s.modality]?.en ?? s.modality).toUpperCase()}</Pill>
                        {s.body_part && <span className="text-caption text-muted-foreground">{s.body_part}</span>}
                        {s.laterality && s.laterality !== "na" && (
                          <span className="text-caption text-muted-foreground">{ar ? LATERALITY_LABEL[s.laterality]?.ar : LATERALITY_LABEL[s.laterality]?.en}</span>
                        )}
                      </div>
                      <div className="text-micro text-muted-foreground tabular-nums mt-0.5">
                        {s.study_uid ? `${s.study_uid.slice(0, 16)}…` : "—"}
                        {s.series_count !== null && s.image_count !== null && ` · ${s.series_count}${ar ? "س" : "ser"}/${s.image_count}${ar ? "ص" : "img"}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-body text-foreground">
                      {ar ? (s.procedure_ar ?? s.procedure_en) : s.procedure_en}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-caption text-muted-foreground">{s.radiologist ?? "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-caption text-muted-foreground tabular-nums whitespace-nowrap">{fmtDateTime(s.reported_at, ar)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-caption text-foreground/80 max-w-[28ch] truncate">{s.impression_en ?? "—"}</td>
                    <td className="px-4 py-3 text-end">
                      {s.critical_finding ? (
                        s.critical_notified_at ? (
                          <Pill tone="success" icon={CheckCircle2}>{ar ? "تم الإبلاغ" : "Notified"}</Pill>
                        ) : (
                          <Pill tone="critical" icon={AlertTriangle}>{ar ? "لم يُبلَّغ" : "Not notified"}</Pill>
                        )
                      ) : (
                        <span className="text-micro text-muted-foreground">—</span>
                      )}
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
