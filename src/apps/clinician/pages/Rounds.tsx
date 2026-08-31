/**
 * Rounds — the clinician's landing screen.
 *
 * The list is ranked by how sick each patient is, never alphabetically, and
 * every row leads with the thing that would change what you do next: an
 * unacknowledged critical result, then the early warning score and which way
 * it is moving, then what has changed since the last shift.
 *
 * The design rule for this screen is that a doctor should be able to decide
 * who to see first WITHOUT opening anything. If the ranked list still requires
 * twelve chart openings to triage, it has failed at its only job.
 */

import { Link } from "wouter";
import {
  AlertTriangle, ArrowUp, ArrowDown, Minus, Clock, ShieldAlert,
  Activity, ChevronRight, Stethoscope,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useClinician, type RoundsPatient } from "../useClinician";
import { NEWS2_RESPONSE } from "@/platform/clinical/scores";
import { useNewEntry } from "@/app/shell/NewEntry";
import {
  Page, cardCls, serif, LoadingRow, EmptyState, fmtAgo, TONE_PILL, type Tone,
} from "@/platform/ui";

const BAND_TONE: Record<"low" | "low_medium" | "medium" | "high", Tone> = {
  low: "success",
  low_medium: "info",
  medium: "warning",
  high: "critical",
};

export default function Rounds() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rounds, provider, loading } = useClinician();
  const { open } = useNewEntry();

  if (loading) {
    return (
      <Page>
        <LoadingRow label="Reading your patients" labelAr="جاري قراءة قائمة مرضاك" />
      </Page>
    );
  }

  const needNow = rounds.filter((r) => r.criticalResults > 0 || r.news2?.band === "high");
  const rest = rounds.filter((r) => !needNow.includes(r));

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display font-semibold text-foreground" style={serif}>
            {ar ? "جولة اليوم" : "Your rounding list"}
          </h1>
          <p className="text-body text-muted-foreground mt-1">
            {rounds.length === 0
              ? (ar ? "لا يوجد مرضى تحت رعايتك حالياً." : "No patients under your care right now.")
              : ar
                ? `${rounds.length} مريض، مرتّبون حسب الأولوية السريرية لا حسب الاسم.`
                : `${rounds.length} patients, ranked by clinical priority rather than by name.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => open("record-vitals")}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 bg-background text-body text-muted-foreground hover:text-foreground transition-colors"
        >
          <Activity size={14} /> {ar ? "تسجيل قياسات" : "Record observations"}
        </button>
      </header>

      {rounds.length === 0 && (
        <EmptyState
          icon={Stethoscope}
          title={provider ? "No admitted patients" : "No open encounters"}
          titleAr={provider ? "لا يوجد مرضى منوّمون" : "لا توجد زيارات مفتوحة"}
          hint={
            provider
              ? "Patients appear here as soon as you are recorded as their attending clinician."
              : "Admit a patient from the hospital system and they will appear here."
          }
          hintAr={
            provider
              ? "يظهر المرضى هنا فور تسجيلك كطبيب معالج لهم."
              : "سجّل دخول مريض من نظام المستشفى ليظهر هنا."
          }
        />
      )}

      {needNow.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-destructive" />
            <h2 className="text-title font-semibold text-foreground" style={serif}>
              {ar ? "يحتاج مراجعة الآن" : "See these first"}
            </h2>
            <span className="text-caption text-muted-foreground tabular-nums">{needNow.length}</span>
          </div>
          <div className="grid gap-2.5 lg:grid-cols-2">
            {needNow.map((p) => <PatientRow key={p.encounter.id} p={p} urgent />)}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {needNow.length > 0 ? (ar ? "بقية المرضى" : "The rest of the list") : (ar ? "المرضى" : "Patients")}
          </h2>
          <div className="grid gap-2.5 lg:grid-cols-2">
            {rest.map((p) => <PatientRow key={p.encounter.id} p={p} />)}
          </div>
        </section>
      )}
    </Page>
  );
}

function PatientRow({ p, urgent }: { p: RoundsPatient; urgent?: boolean }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const band = p.news2?.band;
  const response = band ? NEWS2_RESPONSE[band] : null;

  const Trend = p.trend === "up" ? ArrowUp : p.trend === "down" ? ArrowDown : Minus;
  // Rising is bad regardless of the current band — a score of 3 climbing from
  // 0 deserves attention that a stable 4 does not.
  const trendTone =
    p.trend === "up" ? "text-destructive" : p.trend === "down" ? "text-success" : "text-muted-foreground";

  // An observation set older than four hours on a sick patient is itself a
  // finding: the number on screen may no longer describe the patient.
  const stale = p.minutesSinceObs !== null && p.minutesSinceObs > 240;

  return (
    <Link
      href={`/clinic/${p.patientId}`}
      className={`${cardCls} group p-3.5 flex flex-col gap-2.5 transition-all hover:shadow-md hover:-translate-y-px
        ${urgent ? "border-destructive/40" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-foreground truncate group-hover:text-brand-ink transition-colors" style={serif}>
            {ar ? p.nameAr || p.name : p.name}
          </h3>
          <p className="text-micro text-muted-foreground mt-0.5 truncate">
            <span className="font-mono">{p.mrn}</span>
            {" · "}{p.age}
            {ar ? " سنة" : "y"}
            {" · "}{p.location}
          </p>
        </div>

        {p.news2 && response && (
          <div className="shrink-0 text-end">
            <div className="flex items-center gap-1 justify-end">
              <Trend size={13} className={trendTone} />
              <span
                className={`text-display font-semibold tabular-nums leading-none
                  ${band === "high" ? "text-destructive" : band === "medium" ? "text-warning" : "text-foreground"}`}
                style={serif}
              >
                {p.news2.score}
              </span>
            </div>
            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-micro font-medium ${TONE_PILL[BAND_TONE[band!]]}`}>
              NEWS2 {ar ? response.label_ar : response.label_en}
            </span>
          </div>
        )}
        {!p.news2 && (
          <span className="shrink-0 text-micro text-muted-foreground">
            {ar ? "لا قياسات" : "No obs"}
          </span>
        )}
      </div>

      {/* Flags — only the ones that change what happens next. */}
      {(p.criticalResults > 0 || p.severeAllergies.length > 0 || p.qsofaPositive || stale) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {p.criticalResults > 0 && (
            <Flag tone="critical" icon={AlertTriangle}>
              {ar
                ? `${p.criticalResults} نتيجة حرجة لم يُبلّغ بها`
                : `${p.criticalResults} critical result${p.criticalResults === 1 ? "" : "s"} unacknowledged`}
            </Flag>
          )}
          {p.qsofaPositive && (
            <Flag tone="critical" icon={Activity}>{ar ? "qSOFA إيجابي" : "qSOFA positive"}</Flag>
          )}
          {p.severeAllergies.length > 0 && (
            <Flag tone="warning" icon={ShieldAlert}>
              {ar ? "حساسية شديدة: " : "Severe allergy: "}{p.severeAllergies.slice(0, 2).join(", ")}
            </Flag>
          )}
          {stale && (
            <Flag tone="warning" icon={Clock}>
              {ar ? "قياسات قديمة" : "Observations overdue"}
            </Flag>
          )}
        </div>
      )}

      {/* What changed — the answer to the question a doctor actually arrives
          with, rather than a list of everything that exists. */}
      {p.changes.length > 0 && (
        <div className="pt-2 border-t border-border/30">
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            {ar ? "الجديد خلال ١٢ ساعة" : "New in the last 12 hours"}
          </p>
          <ul className="space-y-1">
            {p.changes.slice(0, 3).map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-caption">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0
                    ${c.tone === "critical" ? "bg-destructive" : c.tone === "warning" ? "bg-warning" : "bg-muted-foreground/40"}`}
                  aria-hidden
                />
                <span className="text-foreground/85 truncate flex-1">{ar ? c.label.ar : c.label.en}</span>
                <span className="text-micro text-muted-foreground shrink-0">{fmtAgo(c.at, ar)}</span>
              </li>
            ))}
          </ul>
          {p.changes.length > 3 && (
            <p className="text-micro text-muted-foreground mt-1">
              {ar ? `و${p.changes.length - 3} أخرى` : `and ${p.changes.length - 3} more`}
            </p>
          )}
        </div>
      )}

      {p.activeProblems.length > 0 && (
        <p className="text-micro text-muted-foreground truncate">
          {p.activeProblems.slice(0, 3).join(" · ")}
        </p>
      )}

      <span className="flex items-center gap-1 text-micro text-brand-ink font-medium mt-auto pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {ar ? "فتح الملف" : "Open chart"}
        <ChevronRight size={12} className="rtl:rotate-180" />
      </span>
    </Link>
  );
}

function Flag({
  tone, icon: Icon, children,
}: { tone: Tone; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-medium ${TONE_PILL[tone]}`}>
      <Icon size={10} className="shrink-0" />
      {children}
    </span>
  );
}
