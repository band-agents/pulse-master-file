/**
 * Portal home.
 *
 * Answers, in order, the four questions a patient opens a portal to ask:
 * am I in hospital right now, when am I next seen, is there anything I have
 * to do, and who is looking after me.
 *
 * The "things to do" list is the part that earns the screen. A portal that
 * only displays information makes the patient hunt for whether any of it
 * requires them; naming the actions means an unconfirmed appointment cannot
 * quietly become a missed one.
 */

import { Link } from "wouter";
import {
  CalendarDays, Pill, FlaskConical, MessageSquare, ChevronRight,
  BedDouble, CircleCheck, Stethoscope, CalendarPlus,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { usePortal } from "../usePortal";
import { PortalPage } from "../PortalApp";
import { useNewEntry } from "@/app/shell/NewEntry";
import { cardCls, serif, LoadingRow, fmtDate, fmtTime } from "@/platform/ui";

export default function PortalHome() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { patient, nextAppointment, actions, medicines, results, admitted, careTeam, loading } = usePortal();
  const { open } = useNewEntry();

  if (loading || !patient) {
    return <PortalPage><LoadingRow label="Loading your record" labelAr="جاري تحميل سجلك" /></PortalPage>;
  }

  const firstName = (ar ? patient.name_ar || patient.name_en : patient.name_en).split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? (ar ? "صباح الخير" : "Good morning")
    : hour < 18 ? (ar ? "مساء الخير" : "Good afternoon") : (ar ? "مساء الخير" : "Good evening");

  return (
    <PortalPage>
      <header>
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {greeting}, {firstName}
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          {ar ? "هذا سجلك في مستشفى المدينة." : "This is your record at Al-Madinah Hospital."}
        </p>
      </header>

      {/* ── In hospital right now ── */}
      {admitted && (
        <section className={`${cardCls} border-primary/30 p-4 flex items-start gap-3`}>
          <span className="w-10 h-10 rounded-xl bg-brand-wash text-brand-ink grid place-items-center shrink-0">
            <BedDouble size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="text-body-lg font-semibold text-foreground" style={serif}>
              {ar ? "أنت في المستشفى حالياً" : "You are in hospital"}
            </h2>
            <p className="text-body text-muted-foreground mt-0.5">
              {admitted.department_name}
              {admitted.bed_label ? ` · ${admitted.bed_label}` : ""}
              {admitted.attending_provider_name && (
                <> · {ar ? "تحت رعاية " : "under the care of "}{admitted.attending_provider_name}</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* ── Things to do ── */}
      {actions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {ar ? "أشياء تحتاج منك" : "Things that need you"}
          </h2>
          <div className={`${cardCls} divide-y divide-border/25 overflow-hidden`}>
            {actions.map((a) => (
              <Link
                key={a.id} href={a.href}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors group"
              >
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-lg font-medium text-foreground group-hover:text-brand-ink transition-colors">
                    {ar ? a.label.ar : a.label.en}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {ar ? a.detail.ar : a.detail.en}
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted-foreground/50 shrink-0 rtl:rotate-180" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Next appointment ── */}
      <section className="space-y-2">
        <h2 className="text-title font-semibold text-foreground" style={serif}>
          {ar ? "موعدك القادم" : "Your next appointment"}
        </h2>
        {nextAppointment ? (
          <Link href="/portal/visits" className={`${cardCls} block p-4 hover:shadow-md transition-all`}>
            <div className="flex items-start gap-4">
              <div className="shrink-0 text-center rounded-xl bg-brand-wash text-brand-ink px-3 py-2">
                <span className="block text-micro font-semibold uppercase">
                  {new Date(nextAppointment.slot_start).toLocaleDateString(ar ? "ar-SA" : "en-GB", { month: "short" })}
                </span>
                <span className="block text-heading font-semibold tabular-nums leading-none mt-0.5" style={serif}>
                  {new Date(nextAppointment.slot_start).getDate()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-lg font-semibold text-foreground" style={serif}>
                  {fmtTime(nextAppointment.slot_start, ar)} · {nextAppointment.department_name}
                </p>
                <p className="text-body text-muted-foreground mt-0.5">
                  {ar ? "مع " : "with "}{nextAppointment.provider_name}
                </p>
                {nextAppointment.reason_en && (
                  <p className="text-caption text-muted-foreground mt-1">
                    {ar ? nextAppointment.reason_ar || nextAppointment.reason_en : nextAppointment.reason_en}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 shrink-0 mt-1 rtl:rotate-180" />
            </div>
          </Link>
        ) : (
          <div className={`${cardCls} p-5 text-center`}>
            <p className="text-body-lg text-foreground">
              {ar ? "لا توجد مواعيد قادمة." : "You have no upcoming appointments."}
            </p>
            <button
              type="button"
              onClick={() => open("book-appointment", { fixed: { patient_id: patient.id } })}
              className="mt-3 inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:opacity-90 transition-opacity"
            >
              <CalendarPlus size={16} />
              {ar ? "احجز موعداً" : "Book an appointment"}
            </button>
          </div>
        )}
      </section>

      {/* ── Quick summary of the rest ── */}
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          href="/portal/medicines" icon={Pill}
          title={ar ? "أدويتك" : "Your medicines"}
          value={medicines.length}
          detail={medicines.length > 0
            ? (ar ? "وصفة نشطة" : `active prescription${medicines.length === 1 ? "" : "s"}`)
            : (ar ? "لا شيء حالياً" : "nothing active")}
        />
        <SummaryCard
          href="/portal/results" icon={FlaskConical}
          title={ar ? "نتائجك" : "Your results"}
          value={results.length}
          detail={results.length > 0
            ? (ar ? "نتيجة متاحة" : `available to view`)
            : (ar ? "لا نتائج بعد" : "none yet")}
        />
        <SummaryCard
          href="/portal/messages" icon={MessageSquare}
          title={ar ? "الرسائل" : "Messages"}
          value={0}
          detail={ar ? "تواصل مع فريقك" : "talk to your care team"}
          hideValue
        />
      </section>

      {/* ── Care team ── */}
      {careTeam.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {ar ? "فريق الرعاية" : "Your care team"}
          </h2>
          <div className={`${cardCls} divide-y divide-border/25 overflow-hidden`}>
            {careTeam.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-9 h-9 rounded-full bg-muted text-muted-foreground grid place-items-center shrink-0">
                  <Stethoscope size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-body-lg text-foreground">{ar ? p.nameAr || p.name : p.name}</p>
                  {p.speciality && <p className="text-caption text-muted-foreground">{p.speciality}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-caption text-muted-foreground text-center pt-2 pb-4 flex items-center justify-center gap-1.5">
        <CircleCheck size={13} className="text-success" />
        {ar
          ? "كل ما تراه هنا هو نفس السجل الذي يراه طبيبك."
          : "Everything here is the same record your doctor sees."}
      </p>
    </PortalPage>
  );
}

function SummaryCard({
  href, icon: Icon, title, value, detail, hideValue,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  value: number;
  detail: string;
  hideValue?: boolean;
}) {
  return (
    <Link href={href} className={`${cardCls} p-4 flex flex-col gap-2 hover:shadow-md transition-all group`}>
      <span className="w-9 h-9 rounded-xl bg-muted text-muted-foreground grid place-items-center group-hover:bg-brand-wash group-hover:text-brand-ink transition-colors">
        <Icon size={17} />
      </span>
      <div>
        <p className="text-body-lg font-semibold text-foreground" style={serif}>{title}</p>
        <p className="text-caption text-muted-foreground mt-0.5">
          {!hideValue && <span className="tabular-nums font-medium text-foreground">{value} </span>}
          {detail}
        </p>
      </div>
    </Link>
  );
}
