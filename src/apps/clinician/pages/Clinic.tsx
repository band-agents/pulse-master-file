/**
 * Clinic — today's list.
 *
 * A running order, not a calendar grid. A clinic list is read one row at a
 * time in sequence, and the only questions it has to answer are: who is next,
 * who has arrived, and who is still in the waiting room past their slot.
 *
 * The "running late" figure is computed from arrivals against slot times
 * rather than being a status someone remembers to set, because the status
 * nobody updates is the status nobody trusts.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { CalendarDays, Clock, Video, CheckCircle2, CircleDot, UserX, CalendarPlus } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useClinician } from "../useClinician";
import { useNewEntry } from "@/app/shell/NewEntry";
import {
  Page, cardCls, serif, LoadingRow, EmptyState, fmtTime, TONE_PILL, StatGrid, StatTile, type Tone,
} from "@/platform/ui";

const STATUS: Record<string, { en: string; ar: string; tone: Tone; icon: React.ElementType }> = {
  booked:      { en: "Booked",      ar: "محجوز",     tone: "neutral", icon: CircleDot },
  confirmed:   { en: "Confirmed",   ar: "مؤكد",      tone: "info",    icon: CheckCircle2 },
  arrived:     { en: "Waiting",     ar: "في الانتظار", tone: "warning", icon: Clock },
  in_progress: { en: "In room",     ar: "داخل العيادة", tone: "brand",   icon: CircleDot },
  completed:   { en: "Seen",        ar: "تمت",       tone: "success", icon: CheckCircle2 },
  no_show:     { en: "Did not attend", ar: "لم يحضر", tone: "critical", icon: UserX },
  cancelled:   { en: "Cancelled",   ar: "ملغى",      tone: "neutral", icon: UserX },
  rescheduled: { en: "Rescheduled", ar: "أُعيد جدولته", tone: "neutral", icon: CalendarDays },
};

export default function Clinic() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { today, upcomingCount, loading } = useClinician();
  const { open } = useNewEntry();

  const stats = useMemo(() => {
    const seen = today.filter((a) => a.status === "completed").length;
    const waiting = today.filter((a) => a.status === "arrived").length;
    // Someone who arrived on time and is still waiting past their slot is the
    // number a clinic actually needs; a raw "waiting" count hides it.
    const late = today.filter(
      (a) => a.status === "arrived" && new Date(a.slot_start).getTime() < Date.now(),
    ).length;
    const dna = today.filter((a) => a.status === "no_show").length;
    return { seen, waiting, late, dna };
  }, [today]);

  if (loading) {
    return <Page><LoadingRow label="Reading today's clinic" labelAr="جاري قراءة عيادة اليوم" /></Page>;
  }

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display font-semibold text-foreground" style={serif}>
            {ar ? "عيادة اليوم" : "Today's clinic"}
          </h1>
          <p className="text-body text-muted-foreground mt-1">
            {today.length === 0
              ? upcomingCount > 0
                ? ar
                  ? `لا مواعيد اليوم · ${upcomingCount} موعد قادم`
                  : `Nothing today · ${upcomingCount} booked further ahead`
                : (ar ? "لا مواعيد اليوم." : "Nothing booked today.")
              : ar
                ? `${today.length} موعد · ${upcomingCount} موعد قادم بعد اليوم`
                : `${today.length} appointments · ${upcomingCount} booked beyond today`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => open("book-appointment")}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 bg-background text-body text-muted-foreground hover:text-foreground transition-colors"
        >
          <CalendarPlus size={14} /> {ar ? "حجز موعد" : "Book an appointment"}
        </button>
      </header>

      {today.length > 0 && (
        <StatGrid cols={4}>
          <StatTile label="Seen" labelAr="تمت" value={stats.seen} tone="success" />
          <StatTile label="Waiting" labelAr="في الانتظار" value={stats.waiting} tone={stats.waiting > 0 ? "warning" : "neutral"} />
          <StatTile label="Past their slot" labelAr="تجاوزوا موعدهم" value={stats.late} tone={stats.late > 0 ? "critical" : "neutral"} />
          <StatTile label="Did not attend" labelAr="لم يحضروا" value={stats.dna} tone={stats.dna > 0 ? "warning" : "neutral"} />
        </StatGrid>
      )}

      {today.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No appointments today"
          titleAr="لا مواعيد اليوم"
          hint={
            upcomingCount > 0
              ? "Your next clinic is further ahead — this screen only ever shows today."
              : "Book one and it appears here, on the hospital's schedule, and in the patient's portal at the same moment."
          }
          hintAr={
            upcomingCount > 0
              ? "عيادتك القادمة في يوم لاحق — هذه الشاشة تعرض اليوم فقط."
              : "احجز موعداً وسيظهر هنا وفي جدول المستشفى وفي بوابة المريض في اللحظة نفسها."
          }
        />
      ) : (
        <div className={`${cardCls} divide-y divide-border/25 overflow-hidden`}>
          {today.map((a) => {
            const st = STATUS[a.status] ?? STATUS.booked;
            const Icon = st.icon;
            const overdue = a.status === "arrived" && new Date(a.slot_start).getTime() < Date.now();
            return (
              <Link
                key={a.id}
                href={`/clinic/${a.patient_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <div className="shrink-0 text-end w-14">
                  <span className="block text-body-lg font-semibold text-foreground tabular-nums" style={serif}>
                    {fmtTime(a.slot_start, ar)}
                  </span>
                  <span className="block text-micro text-muted-foreground tabular-nums">
                    {a.duration_minutes}
                    {ar ? " د" : "m"}
                  </span>
                </div>

                <span className="w-px h-9 bg-border/50 shrink-0" aria-hidden />

                <div className="min-w-0 flex-1">
                  <p className="text-body-lg font-medium text-foreground truncate group-hover:text-brand-ink transition-colors">
                    {a.patient_name}
                  </p>
                  <p className="text-micro text-muted-foreground truncate">
                    <span className="font-mono">{a.patient_mrn}</span>
                    {a.reason_en && <> · {ar ? a.reason_ar || a.reason_en : a.reason_en}</>}
                  </p>
                </div>

                {a.is_telehealth && (
                  <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-medium ${TONE_PILL.info}`}>
                    <Video size={10} /> {ar ? "عن بعد" : "Video"}
                  </span>
                )}

                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-micro font-medium
                    ${TONE_PILL[overdue ? "critical" : st.tone]}`}
                >
                  <Icon size={10} />
                  {overdue ? (ar ? "متأخر" : "Overdue") : ar ? st.ar : st.en}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
