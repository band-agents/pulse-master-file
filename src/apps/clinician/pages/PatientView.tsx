/**
 * The chart, as a clinician needs it.
 *
 * One screen, not a document tree. The old pattern — a folder of notes, a
 * folder of results, a folder of orders — makes the reader assemble the
 * picture themselves every single time, and the picture they assemble is the
 * one thing that actually matters.
 *
 * So this page is a summary first: what is wrong with them, what they are
 * taking, how they are now, and what has come back. Everything is on screen at
 * once because the questions are asked together.
 *
 * The identity banner is sticky. That is a patient-safety convention rather
 * than a styling choice: a clinician who scrolls to a result and prescribes
 * against it must be able to see, without scrolling back, whose result it is
 * and what they are allergic to.
 */

import { useMemo } from "react";
import { Link, useParams } from "wouter";
import {
  AlertTriangle, ShieldAlert, Activity, Pill, FileText, FlaskConical, Scan,
  ClipboardPlus, MessageSquarePlus, ArrowLeft, ArrowUp, ArrowDown, Minus, UserX,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useSnapshot } from "@/platform/data/snapshot";
import { useNewEntry } from "@/app/shell/NewEntry";
import {
  computeNews2, computeQSofa, NEWS2_RESPONSE, formatAge, ageFromDob,
} from "@/platform/clinical/scores";
import {
  Page, cardCls, serif, LoadingRow, EmptyState, fmtAgo, fmtDateTime, fmtDate,
  TONE_PILL, type Tone,
} from "@/platform/ui";

const FLAG_TONE: Record<string, Tone> = {
  normal: "success",
  low: "warning",
  high: "warning",
  abnormal: "warning",
  critical_low: "critical",
  critical_high: "critical",
};

export default function PatientView() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const params = useParams<{ id: string }>();
  const { snapshot, loading } = useSnapshot();
  const { open } = useNewEntry();

  const data = useMemo(() => {
    const patient = snapshot.patients.find((p) => p.id === params.id);
    if (!patient) return null;

    const encounters = snapshot.encounters
      .filter((e) => e.patient_id === patient.id)
      // admitted_at is nullable on an outpatient encounter that has not been
      // arrived yet; fall back to when the row was created so ordering holds.
      .sort((a, b) => +new Date(b.admitted_at ?? b.created_at) - +new Date(a.admitted_at ?? a.created_at));
    const current = encounters.find((e) => e.status === "in_progress" || e.status === "arrived");

    const obs = snapshot.vitals
      .filter((v) => v.patient_id === patient.id)
      .sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at));

    const toInput = (v: (typeof obs)[number]) => ({
      respiratory_rate: v.respiratory_rate,
      spo2: v.spo2,
      on_oxygen: v.on_oxygen,
      temperature_c: v.temperature_c,
      systolic_bp: v.systolic_bp,
      heart_rate: v.heart_rate,
      consciousness: v.consciousness,
    });

    const latest = obs[0];
    const news2 = latest ? computeNews2(toInput(latest)) : null;
    const prevScore = obs[1] ? computeNews2(toInput(obs[1])).score : null;
    const qsofa = latest ? computeQSofa(toInput(latest)) : null;

    const allergies = snapshot.allergies.filter(
      (a) => a.patient_id === patient.id && a.status === "active",
    );
    const problems = snapshot.diagnoses
      .filter((d) => d.patient_id === patient.id && d.status === "active")
      .sort((a, b) => (a.category === "principal" ? -1 : 1));

    const meds = snapshot.orders.filter(
      (o) => o.patient_id === patient.id && o.category === "medication" &&
        (o.status === "active" || o.status === "in_progress"),
    );
    const scripts = snapshot.prescriptions
      .filter((r) => r.patient_id === patient.id && r.status !== "cancelled" && r.status !== "expired")
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const labOrders = snapshot.labOrders.filter((o) => o.patient_id === patient.id);
    const labOrderIds = new Set(labOrders.map((o) => o.id));
    const results = snapshot.labResults
      .filter((r) => labOrderIds.has(r.lab_order_id))
      .sort((a, b) => +new Date(b.resulted_at) - +new Date(a.resulted_at));

    const imaging = snapshot.imagingOrders
      .filter((i) => i.patient_id === patient.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const notes = snapshot.clinicalNotes
      .filter((n) => n.patient_id === patient.id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    return {
      patient, current, encounters, obs, latest, news2, prevScore, qsofa,
      allergies, problems, meds, scripts, results, imaging, notes,
    };
  }, [snapshot, params.id]);

  if (loading) {
    return <Page><LoadingRow label="Opening the chart" labelAr="جاري فتح الملف" /></Page>;
  }

  if (!data) {
    return (
      <Page>
        <EmptyState
          icon={UserX}
          title="No such patient"
          titleAr="لا يوجد مريض بهذا المعرّف"
          hint="The record may have been merged into another, or the link is out of date."
          hintAr="ربما دُمج السجل في سجل آخر، أو أن الرابط قديم."
          action={
            <Link href="/clinic" className="text-brand-ink text-body font-medium hover:underline">
              {ar ? "العودة إلى الجولة" : "Back to your rounding list"}
            </Link>
          }
        />
      </Page>
    );
  }

  const {
    patient, current, obs, latest, news2, prevScore, qsofa,
    allergies, problems, meds, scripts, results, imaging, notes,
  } = data;

  const severe = allergies.filter((a) => a.severity === "severe" || a.severity === "fatal");
  const band = news2?.band;
  const response = band ? NEWS2_RESPONSE[band] : null;
  const Trend =
    news2 && prevScore !== null
      ? news2.score > prevScore ? ArrowUp : news2.score < prevScore ? ArrowDown : Minus
      : null;

  const fixed = { patient_id: patient.id, ...(current ? { encounter_id: current.id } : {}) };

  return (
    <div>
      {/* ── Identity banner. Sticky, deliberately. ── */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-3">
          <Link
            href="/clinic"
            className="inline-flex items-center gap-1.5 text-caption text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft size={13} className="rtl:rotate-180" />
            {ar ? "الجولة" : "Rounding list"}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <h1 className="text-heading font-semibold text-foreground" style={serif}>
                {ar ? patient.name_ar || patient.name_en : patient.name_en}
              </h1>
              <p className="text-caption text-muted-foreground mt-0.5">
                <span className="font-mono">{patient.mrn}</span>
                {" · "}{formatAge(patient.date_of_birth, ar)}
                {" · "}{ar ? sexAr(patient.sex) : patient.sex}
                {patient.blood_group && patient.blood_group !== "unknown" && (
                  <> · <span className="font-mono">{patient.blood_group}</span></>
                )}
                {current && (
                  <> · {current.department_name}{current.bed_label ? ` · ${current.bed_label}` : ""}</>
                )}
              </p>
            </div>

            {news2 && response && (
              <div className="flex items-center gap-2 shrink-0">
                {Trend && <Trend size={15} className={
                  news2.score > (prevScore ?? 0) ? "text-destructive"
                    : news2.score < (prevScore ?? 0) ? "text-success" : "text-muted-foreground"
                } />}
                <span className="text-display font-semibold tabular-nums leading-none" style={serif}>
                  {news2.score}
                </span>
                <span className={`px-2 py-0.5 rounded text-micro font-medium ${TONE_PILL[response.tone as Tone]}`}>
                  NEWS2 {ar ? response.label_ar : response.label_en}
                </span>
              </div>
            )}
          </div>

          {/* Allergies never scroll away. */}
          {severe.length > 0 ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-1.5">
              <ShieldAlert size={14} className="text-destructive shrink-0 mt-0.5" />
              <p className="text-caption text-foreground/90">
                <span className="font-semibold text-destructive">
                  {ar ? "حساسية شديدة: " : "Severe allergy: "}
                </span>
                {severe.map((a) => `${a.substance_en}${a.reaction_en ? ` (${a.reaction_en})` : ""}`).join(" · ")}
              </p>
            </div>
          ) : allergies.length > 0 ? (
            <p className="mt-2 text-caption text-muted-foreground">
              <span className="font-medium">{ar ? "حساسية: " : "Allergies: "}</span>
              {allergies.map((a) => a.substance_en).join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-caption text-muted-foreground">
              {ar ? "لا حساسية مسجّلة." : "No recorded allergies."}
            </p>
          )}

          {/* ── Actions. Every one writes to the shared record. ── */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Action icon={ClipboardPlus} onClick={() => open("place-order", { fixed })}>
              {ar ? "أمر طبي" : "Order"}
            </Action>
            <Action icon={Pill} onClick={() => open("prescribe", { fixed: { patient_id: patient.id } })}>
              {ar ? "وصفة" : "Prescribe"}
            </Action>
            <Action icon={Activity} onClick={() => open("record-vitals", { fixed })}>
              {ar ? "قياسات" : "Observations"}
            </Action>
            <Action icon={FileText} onClick={() => open("write-note", { fixed })}>
              {ar ? "ملاحظة" : "Note"}
            </Action>
            <Action icon={FlaskConical} onClick={() => open("order-lab", { fixed })}>
              {ar ? "مختبر" : "Lab"}
            </Action>
            <Action icon={Scan} onClick={() => open("order-imaging", { fixed })}>
              {ar ? "أشعة" : "Imaging"}
            </Action>
            <Action icon={MessageSquarePlus} onClick={() => open("message-patient", { fixed: { patient_id: patient.id } })}>
              {ar ? "مراسلة" : "Message"}
            </Action>
          </div>
        </div>
      </div>

      <Page>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* ── Problems ── */}
          <Panel title={ar ? "قائمة المشاكل" : "Problem list"} count={problems.length}>
            {problems.length === 0 ? (
              <Blank>{ar ? "لا تشخيصات نشطة." : "No active diagnoses."}</Blank>
            ) : (
              <ul className="divide-y divide-border/25">
                {problems.map((d) => (
                  <li key={d.id} className="px-4 py-2 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-body text-foreground">
                        {ar ? d.description_ar || d.description_en : d.description_en}
                      </p>
                      <p className="text-micro text-muted-foreground font-mono mt-0.5">
                        {d.code_system.toUpperCase()} {d.code}
                        {d.onset_date && <> · {fmtDate(d.onset_date, ar)}</>}
                      </p>
                    </div>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-micro font-medium ${
                      d.category === "principal" ? TONE_PILL.brand : TONE_PILL.neutral
                    }`}>
                      {ar ? categoryAr(d.category) : d.category.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ── Latest observations ── */}
          <Panel
            title={ar ? "آخر القياسات" : "Latest observations"}
            meta={latest ? fmtAgo(latest.recorded_at, ar) : undefined}
          >
            {!latest ? (
              <Blank>{ar ? "لم تُسجَّل قياسات لهذا المريض." : "No observations recorded."}</Blank>
            ) : (
              <>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-3 px-4 py-3">
                  <Vital label={ar ? "التنفس" : "Resp"} value={latest.respiratory_rate} unit="/min" />
                  <Vital label="SpO₂" value={latest.spo2} unit="%" note={latest.on_oxygen ? (ar ? "على O₂" : "on O₂") : undefined} />
                  <Vital label={ar ? "الحرارة" : "Temp"} value={latest.temperature_c} unit="°C" />
                  <Vital
                    label={ar ? "الضغط" : "BP"}
                    value={latest.systolic_bp !== null && latest.diastolic_bp !== null
                      ? `${latest.systolic_bp}/${latest.diastolic_bp}`
                      : latest.systolic_bp}
                    unit="mmHg"
                  />
                  <Vital label={ar ? "النبض" : "Pulse"} value={latest.heart_rate} unit="bpm" />
                  <Vital
                    label={ar ? "الوعي" : "ACVPU"}
                    value={latest.consciousness ? (ar ? acvpuAr(latest.consciousness) : latest.consciousness) : null}
                  />
                </dl>

                {response && (
                  <div className="px-4 pb-3">
                    <div className={`rounded-lg px-3 py-2 ${TONE_PILL[response.tone as Tone]}`}>
                      <p className="text-caption font-semibold">
                        {ar ? response.response_ar : response.response_en}
                      </p>
                      <p className="text-micro opacity-80 mt-0.5">
                        {ar ? response.frequency_ar : response.frequency_en}
                      </p>
                    </div>
                    {qsofa?.positive && (
                      <p className="mt-2 text-caption text-destructive flex items-start gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        {ar
                          ? `qSOFA ${qsofa.score}/3 — يستوجب تقييم الإنتان.`
                          : `qSOFA ${qsofa.score}/3 — prompts a sepsis assessment.`}
                      </p>
                    )}
                  </div>
                )}

                {obs.length > 1 && (
                  <div className="px-4 pb-3">
                    <p className="text-micro text-muted-foreground">
                      {ar
                        ? `${obs.length} مجموعة قياسات مسجّلة · السابقة ${fmtAgo(obs[1].recorded_at, ar)}`
                        : `${obs.length} observation sets on record · previous ${fmtAgo(obs[1].recorded_at, ar)}`}
                    </p>
                  </div>
                )}
              </>
            )}
          </Panel>

          {/* ── Medication ── */}
          <Panel title={ar ? "الأدوية" : "Medication"} count={meds.length + scripts.length}>
            {meds.length === 0 && scripts.length === 0 ? (
              <Blank>{ar ? "لا أدوية نشطة." : "Nothing active."}</Blank>
            ) : (
              <ul className="divide-y divide-border/25">
                {meds.map((m) => (
                  <li key={m.id} className="px-4 py-2">
                    <p className="text-body text-foreground">
                      {ar ? m.item_ar || m.item_en : m.item_en}
                      {m.prn && <span className="text-muted-foreground"> · {ar ? "عند اللزوم" : "PRN"}</span>}
                    </p>
                    <p className="text-micro text-muted-foreground mt-0.5">
                      {[m.dose, m.route?.toUpperCase(), m.frequency].filter(Boolean).join(" · ")}
                      {" · "}{ar ? "أمر داخلي" : "inpatient order"}
                    </p>
                  </li>
                ))}
                {scripts.map((r) => (
                  <li key={r.id} className="px-4 py-2">
                    <p className="text-body text-foreground">
                      {ar ? r.drug_name_ar || r.drug_name_en : r.drug_name_en}
                      {r.strength && <span className="text-muted-foreground"> {r.strength}</span>}
                    </p>
                    <p className="text-micro text-muted-foreground mt-0.5">
                      {[r.dose, r.route?.toUpperCase(), r.frequency].filter(Boolean).join(" · ")}
                      {" · "}<span className="font-mono">{r.rx_number}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* ── Results ── */}
          <Panel title={ar ? "النتائج" : "Results"} count={results.length}>
            {results.length === 0 ? (
              <Blank>{ar ? "لا نتائج مخبرية." : "No laboratory results."}</Blank>
            ) : (
              <ul className="divide-y divide-border/25">
                {results.slice(0, 10).map((r) => {
                  const tone = r.flag ? FLAG_TONE[r.flag] ?? "neutral" : "neutral";
                  const notable = r.flag && r.flag !== "normal";
                  return (
                    <li key={r.id} className="px-4 py-2 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body text-foreground truncate">
                          {ar ? r.analyte_ar || r.analyte_en : r.analyte_en}
                        </p>
                        <p className="text-micro text-muted-foreground">
                          {fmtDateTime(r.resulted_at, ar)}
                          {(r.reference_low !== null || r.reference_high !== null) && (
                            <> · {ar ? "المرجع" : "ref"} {r.reference_low ?? "—"}–{r.reference_high ?? "—"}</>
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 text-body font-semibold tabular-nums font-mono ${
                        notable ? (tone === "critical" ? "text-destructive" : "text-warning") : "text-foreground"
                      }`}>
                        {r.value}{r.unit ? ` ${r.unit}` : ""}
                      </span>
                      {notable && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-micro font-medium ${TONE_PILL[tone]}`}>
                          {r.flag?.replace("_", " ")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* ── Imaging ── */}
          {imaging.length > 0 && (
            <Panel title={ar ? "الأشعة" : "Imaging"} count={imaging.length}>
              <ul className="divide-y divide-border/25">
                {imaging.slice(0, 6).map((i) => (
                  <li key={i.id} className="px-4 py-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-body text-foreground">
                          <span className="font-mono uppercase text-muted-foreground">{i.modality}</span>
                          {" "}{ar ? i.procedure_ar || i.procedure_en : i.procedure_en}
                        </p>
                        <p className="text-micro text-muted-foreground">
                          {i.reported_at ? fmtDateTime(i.reported_at, ar) : (ar ? "لم يصدر تقرير" : "not yet reported")}
                        </p>
                      </div>
                      {i.critical_finding && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-micro font-medium ${TONE_PILL.critical}`}>
                          {ar ? "حرج" : "Critical"}
                        </span>
                      )}
                    </div>
                    {i.impression_en && (
                      <p className="text-caption text-foreground/80 mt-1 leading-snug">{i.impression_en}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* ── Notes ── */}
          <Panel title={ar ? "الملاحظات" : "Notes"} count={notes.length}>
            {notes.length === 0 ? (
              <Blank>{ar ? "لا ملاحظات." : "Nothing documented yet."}</Blank>
            ) : (
              <ul className="divide-y divide-border/25">
                {notes.slice(0, 6).map((n) => (
                  <li key={n.id} className="px-4 py-2.5">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-body font-medium text-foreground">
                        {ar ? n.title_ar || n.title_en : n.title_en}
                      </span>
                      {n.status === "draft" && (
                        <span className={`px-1.5 py-0.5 rounded text-micro font-medium ${TONE_PILL.warning}`}>
                          {ar ? "غير موقّعة" : "Unsigned"}
                        </span>
                      )}
                    </div>
                    <p className="text-micro text-muted-foreground mt-0.5">
                      {n.author_name} · {fmtDateTime(n.signed_at ?? n.created_at, ar)}
                    </p>
                    <p className="text-caption text-foreground/80 mt-1 leading-snug line-clamp-3">
                      {ar ? n.body_ar || n.body_en : n.body_en}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Page>
    </div>
  );
}

// ─── Small parts ───────────────────────────────────────────

function Panel({
  title, count, meta, children,
}: { title: string; count?: number; meta?: string; children: React.ReactNode }) {
  return (
    <section className={`${cardCls} overflow-hidden self-start`}>
      <div className="px-4 py-2.5 border-b border-border/40 flex items-baseline gap-2">
        <h2 className="text-body-lg font-semibold text-foreground" style={serif}>{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-caption text-muted-foreground tabular-nums">{count}</span>
        )}
        {meta && <span className="text-micro text-muted-foreground ms-auto">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-5 text-caption text-muted-foreground text-center">{children}</p>;
}

function Vital({
  label, value, unit, note,
}: { label: string; value: string | number | null; unit?: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro text-muted-foreground">{label}</dt>
      <dd className="text-body-lg font-semibold text-foreground tabular-nums leading-tight mt-0.5" style={serif}>
        {value === null || value === undefined ? (
          <span className="text-muted-foreground font-normal">—</span>
        ) : (
          <>
            {value}
            {unit && <span className="text-micro text-muted-foreground font-normal"> {unit}</span>}
          </>
        )}
      </dd>
      {note && <dd className="text-micro text-warning">{note}</dd>}
    </div>
  );
}

function Action({
  icon: Icon, onClick, children,
}: { icon: React.ElementType; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border/60 bg-background text-caption font-medium text-foreground hover:bg-brand-wash hover:text-brand-ink hover:border-primary/30 transition-colors"
    >
      <Icon size={13} />
      {children}
    </button>
  );
}

function sexAr(sex: string): string {
  return { male: "ذكر", female: "أنثى", other: "آخر", unknown: "غير معروف" }[sex] ?? sex;
}

function categoryAr(c: string): string {
  return {
    principal: "رئيسي", admitting: "عند الدخول", secondary: "ثانوي",
    comorbidity: "مصاحب", complication: "مضاعفة", discharge: "عند الخروج",
  }[c] ?? c;
}

function acvpuAr(c: string): string {
  return {
    alert: "واعٍ", confused: "مشوّش", voice: "يستجيب للصوت",
    pain: "يستجيب للألم", unresponsive: "لا يستجيب",
  }[c] ?? c;
}
