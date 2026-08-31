/**
 * Patient Chart — الملف الطبي
 *
 * The EHR. Everything known about one patient, assembled from every module.
 *
 * The banner is the part that matters most: allergies, alerts and identity
 * stay pinned above the fold on every tab, because the commonest serious
 * error in a chart-driven system is acting on the right screen for the wrong
 * patient, or missing an allergy that was one tab away.
 */

import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import {
  AlertTriangle, Activity, ScrollText, FlaskConical, Scan, Syringe, FileText,
  ShieldAlert, Star, Phone, ArrowLeft, Stethoscope, ClipboardList, Droplet, User,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, Section, Pill, StatusPill, EmptyState, LoadingRow, useCollection,
  fmtDate, fmtDateTime, fmtAgo, fmtDuration, cardCls, serif, btnGhost,
  Field, FieldGrid, TONE_PILL, type Tone, type StatusMap,
} from "@/platform/ui";
import { computeNews2, formatAge, bmi, NEWS2_RESPONSE, resultFlag } from "@/platform/clinical/scores";

const ORDER_STATUS: StatusMap = {
  draft:             { en: "Draft",     ar: "مسودة",       tone: "neutral" },
  pending_signature: { en: "Unsigned",  ar: "دون توقيع",   tone: "warning" },
  active:            { en: "Active",    ar: "نشط",         tone: "success" },
  in_progress:       { en: "In progress", ar: "قيد التنفيذ", tone: "info" },
  completed:         { en: "Completed", ar: "مكتمل",       tone: "neutral" },
  held:              { en: "Held",      ar: "موقوف",       tone: "warning" },
  cancelled:         { en: "Cancelled", ar: "ملغى",        tone: "neutral" },
  expired:           { en: "Expired",   ar: "منتهٍ",       tone: "neutral" },
};

const LAB_STATUS: StatusMap = {
  ordered:     { en: "Ordered",     ar: "مطلوب",     tone: "neutral" },
  collected:   { en: "Collected",   ar: "تم السحب",  tone: "info" },
  received:    { en: "Received",    ar: "مستلم",     tone: "info" },
  in_progress: { en: "Processing",  ar: "قيد التحليل", tone: "info" },
  resulted:    { en: "Resulted",    ar: "صدرت النتيجة", tone: "warning" },
  verified:    { en: "Verified",    ar: "معتمد",     tone: "success" },
  rejected:    { en: "Rejected",    ar: "مرفوض",     tone: "critical" },
  cancelled:   { en: "Cancelled",   ar: "ملغى",      tone: "neutral" },
};

const IMAGING_STATUS: StatusMap = {
  ordered:     { en: "Ordered",   ar: "مطلوب",     tone: "neutral" },
  scheduled:   { en: "Scheduled", ar: "مجدول",     tone: "info" },
  arrived:     { en: "Arrived",   ar: "حضر",       tone: "info" },
  in_progress: { en: "Scanning",  ar: "قيد التصوير", tone: "info" },
  acquired:    { en: "Acquired",  ar: "تم التصوير", tone: "warning" },
  reported:    { en: "Reported",  ar: "تم التقرير", tone: "success" },
  verified:    { en: "Verified",  ar: "معتمد",     tone: "success" },
  cancelled:   { en: "Cancelled", ar: "ملغى",      tone: "neutral" },
  no_show:     { en: "No show",   ar: "لم يحضر",   tone: "warning" },
};

const SEVERITY_TONE: Record<string, Tone> = {
  mild: "neutral", moderate: "warning", severe: "critical", fatal: "critical",
};

const FLAG_TONE: Record<string, Tone> = {
  normal: "neutral", low: "warning", high: "warning",
  critical_low: "critical", critical_high: "critical", abnormal: "warning",
};

type TabId = "summary" | "orders" | "results" | "imaging" | "meds" | "notes";

const TABS: { id: TabId; en: string; ar: string; icon: React.ElementType }[] = [
  { id: "summary", en: "Summary",     ar: "الملخص",       icon: User },
  { id: "orders",  en: "Orders",      ar: "الأوامر",      icon: ScrollText },
  { id: "results", en: "Results",     ar: "النتائج",      icon: FlaskConical },
  { id: "imaging", en: "Imaging",     ar: "الأشعة",       icon: Scan },
  { id: "meds",    en: "Medications", ar: "الأدوية",      icon: Syringe },
  { id: "notes",   en: "Notes",       ar: "الملاحظات",    icon: FileText },
];

export default function PatientChart() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [, params] = useRoute("/chart/:id");
  const [, params2] = useRoute("/patients/:id");
  const patientId = params?.id ?? params2?.id ?? "";
  const [tab, setTab] = useState<TabId>("summary");

  const { rows: patients, loading } = useCollection("patients");
  const { rows: encounters } = useCollection("encounters");
  const { rows: allergies } = useCollection("allergies");
  const { rows: diagnoses } = useCollection("diagnoses");
  const { rows: vitals } = useCollection("vitals");
  const { rows: notes } = useCollection("clinical_notes");
  const { rows: orders } = useCollection("clinical_orders");
  const { rows: labOrders } = useCollection("lab_orders");
  const { rows: labResults } = useCollection("lab_results");
  const { rows: imaging } = useCollection("imaging_orders");
  const { rows: mar } = useCollection("med_administrations");
  const { rows: alerts } = useCollection("cdss_alerts");
  const { rows: policies } = useCollection("insurance_policies");

  const patient = patients.find((p) => p.id === patientId);

  // The encounter in progress, or the most recent one if none is open.
  const encounter = useMemo(() => {
    const mine = encounters.filter((e) => e.patient_id === patientId);
    return mine.find((e) => e.status === "in_progress" || e.status === "arrived")
      ?? [...mine].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  }, [encounters, patientId]);

  const myAllergies = allergies.filter((a) => a.patient_id === patientId && a.status === "active");
  const myDiagnoses = diagnoses.filter((d) => d.patient_id === patientId);
  const myVitals = useMemo(
    () => vitals.filter((v) => v.patient_id === patientId)
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()),
    [vitals, patientId],
  );
  const myNotes = useMemo(
    () => notes.filter((n) => n.patient_id === patientId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notes, patientId],
  );
  const myOrders = orders.filter((o) => o.patient_id === patientId);
  const myLabs = labOrders.filter((l) => l.patient_id === patientId);
  const myImaging = imaging.filter((i) => i.patient_id === patientId);
  const myMar = mar.filter((m) => m.patient_id === patientId);
  const myAlerts = alerts.filter((a) => a.patient_id === patientId && a.status === "active");
  const policy = policies.find((p) => p.patient_id === patientId && p.status === "active");

  const latestVitals = myVitals[0];
  const news2 = latestVitals ? computeNews2(latestVitals) : null;

  if (loading) return <Page><LoadingRow /></Page>;

  if (!patient) {
    return (
      <Page>
        <EmptyState
          icon={User}
          title="Patient not found"
          titleAr="المريض غير موجود"
          hint="The record may have been merged into another, or the link is out of date."
          hintAr="ربما دُمج السجل في سجل آخر أو أن الرابط قديم."
          action={<Link href="/patients" className={btnGhost}><ArrowLeft size={14} className="rtl:rotate-180" /> {ar ? "سجل المرضى" : "Patient registry"}</Link>}
        />
      </Page>
    );
  }

  return (
    <Page>
      {/* ── Identity banner: pinned context on every tab ── */}
      <div className={`${cardCls} overflow-hidden`}>
        <div className="px-5 py-4 flex flex-wrap items-start gap-x-6 gap-y-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-brand-wash text-brand-ink grid place-items-center shrink-0 text-body-lg font-semibold" style={serif}>
              {(ar ? (patient.name_ar ?? patient.name_en) : patient.name_en).slice(0, 2)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-heading font-semibold text-foreground" style={serif}>
                  {ar ? (patient.name_ar ?? patient.name_en) : patient.name_en}
                </h1>
                {patient.vip_flag && <Star size={14} className="text-warning" aria-label="VIP" />}
              </div>
              <div className="text-caption text-muted-foreground tabular-nums mt-0.5">
                {patient.mrn} · {formatAge(patient.date_of_birth, ar)} ·{" "}
                {patient.sex === "male" ? (ar ? "ذكر" : "Male") : patient.sex === "female" ? (ar ? "أنثى" : "Female") : "—"}
                {patient.blood_group && patient.blood_group !== "unknown" && ` · ${patient.blood_group}`}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {myAllergies.length === 0 ? (
              <Pill tone="neutral">{ar ? "لا حساسية معروفة" : "No known allergies"}</Pill>
            ) : (
              myAllergies.map((a) => (
                <Pill key={a.id} tone={SEVERITY_TONE[a.severity] ?? "warning"} icon={AlertTriangle}>
                  {ar ? (a.substance_ar ?? a.substance_en) : a.substance_en}
                  <span className="opacity-70">· {a.kind === "intolerance" ? (ar ? "عدم تحمل" : "intolerance") : a.severity}</span>
                </Pill>
              ))
            )}
            {encounter?.isolation_required && (
              <Pill tone="critical" icon={ShieldAlert}>{ar ? "عزل" : "Isolation"}</Pill>
            )}
            {myAlerts.length > 0 && (
              <Link href="/cdss">
                <Pill tone="warning" icon={ShieldAlert}>
                  {myAlerts.length} {ar ? "تنبيه نشط" : myAlerts.length === 1 ? "active alert" : "active alerts"}
                </Pill>
              </Link>
            )}
          </div>

          <div className="ms-auto text-end shrink-0">
            {encounter ? (
              <>
                <div className="text-caption text-muted-foreground">{ar ? "الزيارة الحالية" : "Current encounter"}</div>
                <div className="text-body font-medium text-foreground">
                  {encounter.bed_label ? `${encounter.bed_label} · ` : ""}{encounter.department_name}
                </div>
                <div className="text-micro text-muted-foreground tabular-nums">
                  {encounter.encounter_number} · {ar ? "منذ" : "since"} {fmtAgo(encounter.admitted_at ?? encounter.created_at, ar)}
                </div>
              </>
            ) : (
              <div className="text-caption text-muted-foreground">{ar ? "لا توجد زيارة نشطة" : "No active encounter"}</div>
            )}
          </div>
        </div>

        {/* NEWS2 strip — the one number the whole ward reacts to. */}
        {news2 && (
          <div className={`px-5 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border/40 ${
            news2.band === "high" ? "bg-destructive/8" : news2.band === "medium" ? "bg-warning/8" : "bg-muted/30"}`}
          >
            <span className="inline-flex items-center gap-2">
              <span className="text-caption text-muted-foreground">NEWS2</span>
              <span className={`px-2 py-0.5 rounded-lg text-body font-bold tabular-nums ${TONE_PILL[news2.band === "high" ? "critical" : news2.band === "medium" ? "warning" : "success"]}`}>
                {news2.score}
              </span>
              <span className="text-caption text-foreground">
                {ar ? NEWS2_RESPONSE[news2.band].frequency_ar : NEWS2_RESPONSE[news2.band].frequency_en}
              </span>
            </span>
            {latestVitals && (
              <>
                <Vital label="BP" labelAr="ضغط" value={latestVitals.systolic_bp && latestVitals.diastolic_bp ? `${latestVitals.systolic_bp}/${latestVitals.diastolic_bp}` : null} />
                <Vital label="HR" labelAr="نبض" value={latestVitals.heart_rate} />
                <Vital label="RR" labelAr="تنفس" value={latestVitals.respiratory_rate} />
                <Vital label="SpO₂" labelAr="أكسجين" value={latestVitals.spo2 ? `${latestVitals.spo2}%${latestVitals.on_oxygen ? " (O₂)" : ""}` : null} />
                <Vital label="Temp" labelAr="حرارة" value={latestVitals.temperature_c ? `${latestVitals.temperature_c}°C` : null} />
                <span className="text-micro text-muted-foreground ms-auto">
                  {ar ? "سُجل" : "recorded"} {fmtAgo(latestVitals.recorded_at, ar)}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border/40 -mt-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-3.5 h-10 text-body whitespace-nowrap border-b-2 -mb-px transition-colors
                ${active ? "border-brand-ink text-brand-ink font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon size={14} strokeWidth={active ? 2.2 : 1.8} />
              {ar ? t.ar : t.en}
            </button>
          );
        })}
      </div>

      {tab === "summary" && (
        <div className="grid lg:grid-cols-3 gap-5">
          <Section className="lg:col-span-2" title="Problems & diagnoses" titleAr="المشاكل والتشخيصات">
            {myDiagnoses.length === 0 ? (
              <EmptyState icon={Stethoscope} title="No diagnoses recorded" titleAr="لا توجد تشخيصات مسجلة" />
            ) : (
              <ul className="divide-y divide-border/25">
                {myDiagnoses.map((d) => (
                  <li key={d.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-body font-medium text-foreground">
                          {ar ? (d.description_ar ?? d.description_en) : d.description_en}
                        </div>
                        <div className="text-micro text-muted-foreground mt-0.5">
                          {d.code_system.toUpperCase()} {d.code} · {d.diagnosed_by ?? "—"}
                          {d.onset_date && ` · ${ar ? "بدأ" : "onset"} ${fmtDate(d.onset_date, ar)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Pill tone={d.category === "principal" ? "brand" : "neutral"}>{d.category}</Pill>
                        <Pill tone={d.certainty === "confirmed" ? "success" : "warning"}>{d.certainty}</Pill>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="space-y-5">
            <Section title="Demographics" titleAr="البيانات الشخصية">
              <div className="p-5">
                <FieldGrid>
                  <Field label="Date of birth" labelAr="تاريخ الميلاد">{fmtDate(patient.date_of_birth, ar)}</Field>
                  <Field label="National ID" labelAr="رقم الهوية"><span className="tabular-nums">{patient.national_id ?? "—"}</span></Field>
                  <Field label="Phone" labelAr="الهاتف"><span className="tabular-nums" dir="ltr">{patient.phone ?? "—"}</span></Field>
                  <Field label="Language" labelAr="اللغة">{patient.preferred_language === "ar" ? "العربية" : patient.preferred_language === "en" ? "English" : "—"}</Field>
                  <Field label="Address" labelAr="العنوان" full>{ar ? (patient.address_ar ?? patient.address_en) : patient.address_en}</Field>
                  <Field label="Next of kin" labelAr="أقرب شخص" full>
                    {patient.next_of_kin_name
                      ? <span className="inline-flex items-center gap-2">
                          {patient.next_of_kin_name}
                          <span className="text-muted-foreground">({patient.next_of_kin_relation})</span>
                          <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums" dir="ltr">
                            <Phone size={11} />{patient.next_of_kin_phone}
                          </span>
                        </span>
                      : "—"}
                  </Field>
                </FieldGrid>
              </div>
            </Section>

            <Section title="Coverage" titleAr="التغطية التأمينية">
              <div className="p-5">
                {policy ? (
                  <FieldGrid>
                    <Field label="Payer" labelAr="جهة الدفع" full>{policy.payer_name}</Field>
                    <Field label="Policy" labelAr="رقم الوثيقة"><span className="tabular-nums">{policy.policy_number}</span></Field>
                    <Field label="Covers" labelAr="نسبة التغطية">{policy.coverage_percent}%</Field>
                    <Field label="Eligibility" labelAr="الأهلية">
                      <Pill tone={policy.eligibility_status === "verified" ? "success" : policy.eligibility_status === "pending" ? "warning" : "critical"}>
                        {policy.eligibility_status}
                      </Pill>
                    </Field>
                    <Field label="Checked" labelAr="تاريخ التحقق">{fmtAgo(policy.eligibility_checked_at, ar)}</Field>
                  </FieldGrid>
                ) : (
                  <p className="text-body text-muted-foreground">{ar ? "لا توجد وثيقة تأمين نشطة." : "No active insurance policy on file."}</p>
                )}
              </div>
            </Section>

            {latestVitals && (
              <Section title="Measurements" titleAr="القياسات">
                <div className="p-5">
                  <FieldGrid>
                    <Field label="Weight" labelAr="الوزن">{latestVitals.weight_kg ? `${latestVitals.weight_kg} kg` : "—"}</Field>
                    <Field label="Height" labelAr="الطول">{latestVitals.height_cm ? `${latestVitals.height_cm} cm` : "—"}</Field>
                    <Field label="BMI" labelAr="مؤشر الكتلة">{bmi(latestVitals.weight_kg, latestVitals.height_cm) ?? "—"}</Field>
                    <Field label="Pain score" labelAr="درجة الألم">{latestVitals.pain_score ?? "—"}{latestVitals.pain_score !== null ? "/10" : ""}</Field>
                  </FieldGrid>
                </div>
              </Section>
            )}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <Section title="Orders" titleAr="الأوامر" description="Every order placed on this encounter, newest first." descriptionAr="جميع الأوامر على هذه الزيارة، الأحدث أولاً.">
          {myOrders.length === 0 ? (
            <EmptyState icon={ScrollText} title="No orders on this chart" titleAr="لا توجد أوامر" />
          ) : (
            <ul className="divide-y divide-border/25">
              {[...myOrders].sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()).map((o) => (
                <li key={o.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body font-medium text-foreground">{ar ? (o.item_ar ?? o.item_en) : o.item_en}</span>
                        <Pill tone="neutral">{o.category}</Pill>
                        {o.priority === "stat" && <Pill tone="critical">STAT</Pill>}
                        {o.prn && <Pill tone="info">PRN</Pill>}
                      </div>
                      {(o.dose || o.frequency) && (
                        <div className="text-caption text-foreground/80 mt-0.5">
                          {[o.dose && `${o.dose} ${o.dose_unit ?? ""}`.trim(), o.route?.toUpperCase(), o.frequency].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="text-micro text-muted-foreground mt-0.5">
                        {o.order_number} · {o.ordered_by_name} · {fmtDateTime(o.ordered_at, ar)}
                      </div>
                      {o.override_reason && (
                        <div className="mt-2 rounded-lg bg-warning/10 px-3 py-2">
                          <div className="text-micro font-semibold text-warning">
                            {ar ? "تم تجاوز تنبيه — السبب الموثق" : "Alert overridden — documented reason"}
                          </div>
                          <div className="text-caption text-foreground/80 mt-0.5">{o.override_reason}</div>
                        </div>
                      )}
                    </div>
                    <StatusPill map={ORDER_STATUS} value={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "results" && (
        <Section title="Laboratory results" titleAr="نتائج المختبر">
          {myLabs.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No laboratory orders" titleAr="لا توجد طلبات مختبر" />
          ) : (
            <div className="divide-y divide-border/25">
              {[...myLabs].sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()).map((l) => {
                const results = labResults.filter((r) => r.lab_order_id === l.id);
                return (
                  <div key={l.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-body font-medium text-foreground">{ar ? (l.panel_ar ?? l.panel_en) : l.panel_en}</span>
                          {l.priority === "stat" && <Pill tone="critical">STAT</Pill>}
                          {l.has_critical_result && <Pill tone="critical" icon={AlertTriangle}>{ar ? "نتيجة حرجة" : "Critical"}</Pill>}
                        </div>
                        <div className="text-micro text-muted-foreground mt-0.5 tabular-nums">
                          {l.accession_number} · {l.discipline} · {fmtDateTime(l.ordered_at, ar)}
                          {l.tat_minutes && ` · ${ar ? "زمن الإنجاز" : "TAT"} ${fmtDuration(l.tat_minutes, ar)}`}
                        </div>
                        {l.rejection_reason && (
                          <div className="text-caption text-destructive mt-1">{l.rejection_reason}</div>
                        )}
                      </div>
                      <StatusPill map={LAB_STATUS} value={l.status} />
                    </div>

                    {results.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-body">
                          <tbody>
                            {results.map((r) => {
                              const flag = r.flag ?? resultFlag(r.value_numeric, r.reference_low, r.reference_high);
                              return (
                                <tr key={r.id} className="border-t border-border/20">
                                  <td className="py-1.5 pe-3 text-muted-foreground">{ar ? (r.analyte_ar ?? r.analyte_en) : r.analyte_en}</td>
                                  <td className="py-1.5 pe-3 font-semibold text-foreground tabular-nums whitespace-nowrap">
                                    {r.value} {r.unit ?? ""}
                                  </td>
                                  <td className="py-1.5 pe-3 text-micro text-muted-foreground tabular-nums whitespace-nowrap">
                                    {r.reference_text ?? (r.reference_low !== null && r.reference_high !== null ? `${r.reference_low}–${r.reference_high}` : "")}
                                  </td>
                                  <td className="py-1.5 text-end">
                                    {flag && flag !== "normal" && <Pill tone={FLAG_TONE[flag] ?? "warning"}>{flag.replace("_", " ")}</Pill>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {tab === "imaging" && (
        <Section title="Imaging" titleAr="الأشعة">
          {myImaging.length === 0 ? (
            <EmptyState icon={Scan} title="No imaging studies" titleAr="لا توجد دراسات أشعة" />
          ) : (
            <ul className="divide-y divide-border/25">
              {[...myImaging].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((i) => (
                <li key={i.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body font-medium text-foreground">{ar ? (i.procedure_ar ?? i.procedure_en) : i.procedure_en}</span>
                        <Pill tone="neutral">{i.modality.toUpperCase()}</Pill>
                        {i.critical_finding && <Pill tone="critical" icon={AlertTriangle}>{ar ? "نتيجة حرجة" : "Critical finding"}</Pill>}
                      </div>
                      <div className="text-micro text-muted-foreground mt-0.5 tabular-nums">
                        {i.accession_number}
                        {i.performed_at && ` · ${fmtDateTime(i.performed_at, ar)}`}
                        {i.radiologist && ` · ${i.radiologist}`}
                      </div>
                      {i.report_en && (
                        <div className="mt-2 rounded-xl bg-muted/40 px-3.5 py-2.5">
                          <p className="text-caption text-foreground/85 leading-relaxed">{ar ? (i.report_ar ?? i.report_en) : i.report_en}</p>
                          {i.impression_en && (
                            <p className="text-caption font-semibold text-foreground mt-2">
                              {ar ? "الانطباع: " : "Impression: "}{i.impression_en}
                            </p>
                          )}
                        </div>
                      )}
                      {i.study_uid && (
                        <div className="text-micro text-muted-foreground mt-1.5 tabular-nums">
                          PACS · {i.series_count} {ar ? "سلسلة" : "series"} · {i.image_count} {ar ? "صورة" : "images"}
                        </div>
                      )}
                    </div>
                    <StatusPill map={IMAGING_STATUS} value={i.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "meds" && (
        <Section title="Medication administration" titleAr="سجل إعطاء الدواء" description="Scheduled doses and what happened to each." descriptionAr="الجرعات المجدولة وما حدث لكل منها.">
          {myMar.length === 0 ? (
            <EmptyState icon={Syringe} title="No scheduled doses" titleAr="لا توجد جرعات مجدولة" />
          ) : (
            <ul className="divide-y divide-border/25">
              {[...myMar].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()).map((m) => {
                const tone: Tone = m.status === "given" ? "success"
                  : m.status === "missed" ? "critical"
                  : m.status === "refused" || m.status === "held" ? "warning" : "info";
                return (
                  <li key={m.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-body font-medium text-foreground">{m.drug_name}</div>
                      <div className="text-caption text-muted-foreground">
                        {m.dose} · {m.route.toUpperCase()} · {ar ? "مجدول" : "due"} {fmtDateTime(m.scheduled_at, ar)}
                      </div>
                      {m.administered_by && (
                        <div className="text-micro text-muted-foreground mt-0.5">
                          {ar ? "أعطاه" : "given by"} {m.administered_by}
                          {m.witnessed_by && ` · ${ar ? "بشهادة" : "witnessed by"} ${m.witnessed_by}`}
                          {m.site && ` · ${m.site}`}
                        </div>
                      )}
                      {m.hold_reason && <div className="text-caption text-warning mt-1">{m.hold_reason}</div>}
                    </div>
                    <Pill tone={tone}>{m.status}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      {tab === "notes" && (
        <Section title="Clinical notes" titleAr="الملاحظات السريرية">
          {myNotes.length === 0 ? (
            <EmptyState icon={FileText} title="No notes on this chart" titleAr="لا توجد ملاحظات" />
          ) : (
            <ul className="divide-y divide-border/25">
              {myNotes.map((n) => (
                <li key={n.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-body-lg font-semibold text-foreground" style={serif}>
                          {ar ? (n.title_ar ?? n.title_en) : n.title_en}
                        </h3>
                        <Pill tone="neutral">{n.note_type}</Pill>
                      </div>
                      <div className="text-micro text-muted-foreground mt-0.5">
                        {n.author_name}{n.author_role && ` · ${n.author_role}`} · {fmtDateTime(n.created_at, ar)}
                      </div>
                    </div>
                    <Pill tone={n.status === "signed" ? "success" : n.status === "draft" ? "warning" : "neutral"}>{n.status}</Pill>
                  </div>
                  <p className="text-body text-foreground/85 leading-relaxed whitespace-pre-line">
                    {ar ? (n.body_ar ?? n.body_en) : n.body_en}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </Page>
  );
}

/** One vital in the banner strip. Renders nothing when the value is absent,
 *  rather than an em dash — a blank slot reads as "not measured" correctly. */
function Vital({ label, labelAr, value }: { label: string; labelAr: string; value: string | number | null }) {
  const { lang } = useLanguage();
  if (value === null || value === undefined) return null;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-micro text-muted-foreground">{lang === "ar" ? labelAr : label}</span>
      <span className="text-body font-semibold text-foreground tabular-nums">{value}</span>
    </span>
  );
}
