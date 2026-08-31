/**
 * Quality & Safety — الجودة وسلامة المرضى
 *
 * The indicator set the hospital is actually held to. Each indicator declares
 * its own target and direction, and is computed from the same snapshot as
 * every other screen.
 *
 * Indicators are stated with their denominator visible. "94%" means nothing
 * without "of 51", and a rate computed from four cases should not be read the
 * same way as one computed from four hundred — so the population is shown
 * beside every figure rather than hidden in a tooltip.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import {
  ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, Minus, Target, ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, LoadingRow, Pill, Meter, cardCls, serif, type Tone,
} from "@/platform/ui";
import { useSnapshot, minutesSince } from "@/platform/data/snapshot";
import { isTriageBreached, computeNews2 } from "@/platform/clinical/scores";

interface Indicator {
  id: string;
  name: { en: string; ar: string };
  detail: { en: string; ar: string };
  /** The measured value, already as a percentage or an absolute. */
  value: number;
  /** Size of the population the value was computed from. */
  denominator: number;
  unit: "%" | "min" | "count";
  target: number;
  /** `below` means the target is an upper bound the hospital must stay under. */
  direction: "above" | "below";
  domain: "safety" | "flow" | "effectiveness" | "experience";
}

const DOMAINS: { id: Indicator["domain"]; en: string; ar: string }[] = [
  { id: "safety",        en: "Patient safety",   ar: "سلامة المرضى" },
  { id: "flow",          en: "Flow & access",    ar: "الانسياب والوصول" },
  { id: "effectiveness", en: "Effectiveness",    ar: "الفعالية" },
  { id: "experience",    en: "Experience",       ar: "تجربة المريض" },
];

/** Whether an indicator is meeting its target. */
function meets(i: Indicator): boolean {
  return i.direction === "above" ? i.value >= i.target : i.value <= i.target;
}

function toneFor(i: Indicator): Tone {
  if (meets(i)) return "success";
  // Within a tenth of the target is "close", not "failing".
  const margin = i.direction === "above" ? i.target - i.value : i.value - i.target;
  const scale = Math.max(i.target * 0.1, 1);
  return margin <= scale ? "warning" : "critical";
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export default function Quality() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { snapshot: s, loading } = useSnapshot();

  const indicators: Indicator[] = useMemo(() => {
    /* ── Safety ── */
    const doses = s.medAdministrations.filter((m) => m.status !== "not_required");
    const missed = doses.filter((m) => m.status === "missed").length;

    const criticals = s.labResults.filter(
      (r) => r.flag === "critical_low" || r.flag === "critical_high",
    );
    const notified = criticals.filter((r) => r.critical_notified_at).length;

    const highAlerts = s.alerts.filter(
      (a) => a.severity === "high" || a.severity === "contraindicated",
    );
    const answered = highAlerts.filter((a) => a.responded_at).length;

    const surgical = s.otCases.filter((c) =>
      ["pre_op", "in_theatre", "recovery", "completed"].includes(c.status));
    const signedIn = surgical.filter((c) => {
      const cl = c.checklist as { sign_in?: { completed?: boolean } } | null;
      return cl?.sign_in?.completed === true;
    }).length;

    /* ── Flow ── */
    const edSeen = s.edVisits.filter((v) => v.door_to_doctor_minutes !== null);
    const d2d = median(edSeen.map((v) => v.door_to_doctor_minutes!));

    const waiting = s.edVisits.filter((v) => v.status === "waiting");
    const withinTarget = waiting.filter(
      (v) => !isTriageBreached(v.triage_level, minutesSince(v.arrival_at)),
    ).length;

    const cleans = s.housekeeping.filter((t) => t.turnaround_minutes !== null);
    const turnaround = median(cleans.map((t) => t.turnaround_minutes!));

    const lwbs = s.edVisits.filter((v) => v.disposition === "lwbs").length;
    const attendances = s.edVisits.length;

    /* ── Effectiveness ── */
    const labs = s.labOrders.filter((o) => o.tat_minutes !== null);
    const labTat = median(labs.map((o) => o.tat_minutes!));

    const cancelled = s.otCases.filter((c) => c.status === "cancelled").length;

    const rejected = s.labOrders.filter((o) => o.status === "rejected").length;

    /* ── Experience ── */
    const appts = s.appointments.filter((a) =>
      ["completed", "no_show", "cancelled"].includes(a.status));
    const noShow = appts.filter((a) => a.status === "no_show").length;

    const inbound = s.portalMessages.filter((m) => m.direction === "inbound");
    const answeredMsgs = inbound.filter((m) => m.status === "replied" || m.status === "closed").length;

    const telehealth = s.telehealth.filter((t) =>
      ["completed", "failed", "no_show"].includes(t.status));
    const completedCalls = telehealth.filter((t) => t.status === "completed").length;

    return [
      {
        id: "critical_notified",
        name: { en: "Critical results notified", ar: "إبلاغ النتائج الحرجة" },
        detail: {
          en: "Critical laboratory values where the ordering clinician was told directly.",
          ar: "القيم المخبرية الحرجة التي أُبلغ عنها الطبيب الطالب مباشرة.",
        },
        value: pct(notified, criticals.length), denominator: criticals.length,
        unit: "%", target: 100, direction: "above", domain: "safety",
      },
      {
        id: "who_signin",
        name: { en: "Surgical sign-in completed", ar: "إتمام التحقق الجراحي الأول" },
        detail: {
          en: "WHO checklist sign-in recorded before the patient entered theatre.",
          ar: "تسجيل التحقق الأول من قائمة السلامة قبل دخول المريض غرفة العمليات.",
        },
        value: pct(signedIn, surgical.length), denominator: surgical.length,
        unit: "%", target: 100, direction: "above", domain: "safety",
      },
      {
        id: "missed_doses",
        name: { en: "Missed medication doses", ar: "الجرعات الدوائية الفائتة" },
        detail: {
          en: "Scheduled doses with no administration and no documented reason.",
          ar: "جرعات مجدولة لم تُعطَ ولم يُوثق سبب لذلك.",
        },
        value: pct(missed, doses.length), denominator: doses.length,
        unit: "%", target: 2, direction: "below", domain: "safety",
      },
      {
        id: "alert_response",
        name: { en: "High-severity alerts answered", ar: "الرد على التنبيهات الحرجة" },
        detail: {
          en: "High and contraindicated decision-support alerts a clinician acted on.",
          ar: "تنبيهات دعم القرار العالية والممنوعة التي تصرف حيالها طبيب.",
        },
        value: pct(answered, highAlerts.length), denominator: highAlerts.length,
        unit: "%", target: 95, direction: "above", domain: "safety",
      },
      {
        id: "door_to_doctor",
        name: { en: "Median door to doctor", ar: "وسيط الوصول للطبيب" },
        detail: {
          en: "Arrival to first clinician assessment in the emergency department.",
          ar: "من الوصول إلى أول تقييم طبي في قسم الطوارئ.",
        },
        value: d2d, denominator: edSeen.length,
        unit: "min", target: 30, direction: "below", domain: "flow",
      },
      {
        id: "triage_target",
        name: { en: "Waiting within triage target", ar: "الانتظار ضمن هدف الفرز" },
        detail: {
          en: "Patients still waiting who are inside the target for their category.",
          ar: "المرضى المنتظرون ضمن الهدف المحدد لفئتهم.",
        },
        value: pct(withinTarget, waiting.length), denominator: waiting.length,
        unit: "%", target: 95, direction: "above", domain: "flow",
      },
      {
        id: "bed_turnaround",
        name: { en: "Median bed turnaround", ar: "وسيط دوران السرير" },
        detail: {
          en: "Discharge to bed available again — the real constraint on capacity.",
          ar: "من الخروج حتى إتاحة السرير — القيد الحقيقي على السعة.",
        },
        value: turnaround, denominator: cleans.length,
        unit: "min", target: 90, direction: "below", domain: "flow",
      },
      {
        id: "lwbs",
        name: { en: "Left without being seen", ar: "غادروا دون فحص" },
        detail: {
          en: "Emergency attendances that departed before a clinician saw them.",
          ar: "زيارات الطوارئ التي غادرت قبل أن يفحصها طبيب.",
        },
        value: pct(lwbs, attendances), denominator: attendances,
        unit: "%", target: 5, direction: "below", domain: "flow",
      },
      {
        id: "lab_tat",
        name: { en: "Median laboratory turnaround", ar: "وسيط زمن إنجاز المختبر" },
        detail: {
          en: "Order to verified result, across all disciplines and priorities.",
          ar: "من الطلب إلى النتيجة المعتمدة لجميع التخصصات والأولويات.",
        },
        value: labTat, denominator: labs.length,
        unit: "min", target: 120, direction: "below", domain: "effectiveness",
      },
      {
        id: "ot_cancellations",
        name: { en: "Theatre cancellations", ar: "إلغاءات غرف العمليات" },
        detail: {
          en: "Listed cases cancelled for any reason, including equipment failure.",
          ar: "الحالات المجدولة الملغاة لأي سبب بما فيها أعطال الأجهزة.",
        },
        value: pct(cancelled, s.otCases.length), denominator: s.otCases.length,
        unit: "%", target: 5, direction: "below", domain: "effectiveness",
      },
      {
        id: "specimen_rejection",
        name: { en: "Specimen rejection rate", ar: "نسبة رفض العينات" },
        detail: {
          en: "Samples rejected before analysis, requiring a recollection.",
          ar: "العينات المرفوضة قبل التحليل والتي تستوجب إعادة السحب.",
        },
        value: pct(rejected, s.labOrders.length), denominator: s.labOrders.length,
        unit: "%", target: 3, direction: "below", domain: "effectiveness",
      },
      {
        id: "no_show",
        name: { en: "Outpatient no-show rate", ar: "نسبة عدم الحضور" },
        detail: {
          en: "Booked appointments where the patient did not attend.",
          ar: "المواعيد المحجوزة التي لم يحضرها المريض.",
        },
        value: pct(noShow, appts.length), denominator: appts.length,
        unit: "%", target: 10, direction: "below", domain: "experience",
      },
      {
        id: "portal_replies",
        name: { en: "Portal messages answered", ar: "الرد على رسائل البوابة" },
        detail: {
          en: "Messages from patients that received a reply or were closed.",
          ar: "رسائل المرضى التي حصلت على رد أو أُغلقت.",
        },
        value: pct(answeredMsgs, inbound.length), denominator: inbound.length,
        unit: "%", target: 90, direction: "above", domain: "experience",
      },
      {
        id: "telehealth_success",
        name: { en: "Telehealth consultations completed", ar: "اكتمال الاستشارات عن بعد" },
        detail: {
          en: "Scheduled video consultations that ran to completion.",
          ar: "الاستشارات المرئية المجدولة التي اكتملت بنجاح.",
        },
        value: pct(completedCalls, telehealth.length), denominator: telehealth.length,
        unit: "%", target: 90, direction: "above", domain: "experience",
      },
    ];
  }, [s]);

  const failing = indicators.filter((i) => !meets(i));

  if (loading) return <Page><PageHeader title="Quality & Safety" titleAr="الجودة وسلامة المرضى" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Quality & Safety"
        titleAr="الجودة وسلامة المرضى"
        subtitle="The indicator set the hospital is held to, each with its target and the population it was measured over."
        subtitleAr="مجموعة المؤشرات التي تُقاس بها المستشفى، كلٌّ بهدفه وحجم العينة التي حُسب منها."
        meta={[
          {
            label: "Meeting target", labelAr: "محققة للهدف",
            value: `${indicators.length - failing.length}/${indicators.length}`,
            tone: failing.length === 0 ? "success" : failing.length > 3 ? "critical" : "warning",
          },
        ]}
      />

      {failing.length > 0 && (
        <Section
          title="Below target"
          titleAr="دون الهدف"
          description="These are the indicators to take to the next governance meeting."
          descriptionAr="هذه هي المؤشرات التي تُرفع لاجتماع الحوكمة القادم."
        >
          <ul className="divide-y divide-border/25">
            {failing.map((i) => (
              <li key={i.id} className="px-5 py-3 flex items-center gap-3">
                <AlertTriangle size={15} className={toneFor(i) === "critical" ? "text-destructive shrink-0" : "text-warning shrink-0"} />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium text-foreground">{ar ? i.name.ar : i.name.en}</div>
                  <div className="text-micro text-muted-foreground tabular-nums">
                    {ar ? "من" : "measured over"} {i.denominator} {ar ? "سجل" : "records"}
                  </div>
                </div>
                <span className="text-body font-semibold tabular-nums text-foreground">
                  {i.value}{i.unit === "%" ? "%" : i.unit === "min" ? "m" : ""}
                </span>
                <Pill tone={toneFor(i)} icon={Target}>
                  {i.direction === "above" ? "≥" : "≤"} {i.target}{i.unit === "%" ? "%" : i.unit === "min" ? "m" : ""}
                </Pill>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {DOMAINS.map((domain) => {
        const group = indicators.filter((i) => i.domain === domain.id);
        if (group.length === 0) return null;
        return (
          <Section key={domain.id} title={domain.en} titleAr={domain.ar}>
            <div className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {group.map((i) => {
                const tone = toneFor(i);
                const ok = meets(i);
                // Progress toward the target, capped so an overshoot still reads full.
                const progress = i.direction === "above"
                  ? Math.min(100, (i.value / (i.target || 1)) * 100)
                  : Math.min(100, (i.target / (i.value || i.target || 1)) * 100);
                return (
                  <div key={i.id} className={`${cardCls} p-4 flex flex-col gap-2.5`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-caption text-muted-foreground leading-snug">
                        {ar ? i.name.ar : i.name.en}
                      </span>
                      {ok
                        ? <ShieldCheck size={14} className="text-success shrink-0" />
                        : i.direction === "above"
                          ? <TrendingDown size={14} className="text-warning shrink-0" />
                          : <TrendingUp size={14} className="text-warning shrink-0" />}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-heading font-semibold text-foreground tabular-nums leading-none" style={serif}>
                        {i.value}{i.unit === "%" ? "%" : ""}
                      </span>
                      {i.unit === "min" && <span className="text-caption text-muted-foreground">min</span>}
                    </div>

                    <Meter value={progress} max={100} tone={tone} label={`${i.direction === "above" ? "≥" : "≤"}${i.target}`} />

                    <p className="text-micro text-muted-foreground leading-snug">
                      {ar ? i.detail.ar : i.detail.en}
                    </p>

                    <div className="text-micro text-muted-foreground tabular-nums mt-auto pt-1.5 border-t border-border/25">
                      {ar ? "العينة" : "Population"}: {i.denominator.toLocaleString()}
                      {i.denominator < 20 && (
                        <span className="text-warning"> · {ar ? "عينة صغيرة" : "small sample"}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        );
      })}

      <Section>
        <div className="px-5 py-4 flex items-center justify-between gap-3">
          <p className="text-caption text-muted-foreground max-w-[70ch]">
            {ar
              ? "كل مؤشر هنا محسوب من نفس اللقطة التي تغذي بقية النظام. لفحص أي رقم، افتح مجموعة البيانات المقابلة في المستكشف."
              : "Every indicator here is computed from the same snapshot that feeds the rest of the system. To interrogate a figure, open the matching dataset in the explorer."}
          </p>
          <Link href="/analytics/explorer" className="text-caption text-data font-medium inline-flex items-center gap-1 shrink-0">
            {ar ? "المستكشف" : "Explorer"} <ArrowRight size={12} className="rtl:rotate-180" />
          </Link>
        </div>
      </Section>
    </Page>
  );
}
