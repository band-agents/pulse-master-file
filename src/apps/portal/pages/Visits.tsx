/**
 * Visits — appointments, and booking one.
 *
 * Booking is the single most-used function of any patient portal, so it is a
 * full-width button at the top rather than an option inside a menu.
 *
 * Confirming is a real write, not a decoration: it sets `confirmed_at` on the
 * same row the clinic reads, which is what makes the clinic's "confirmed"
 * count mean something. A confirm button that only changed a colour on the
 * patient's phone would be worse than no button.
 */

import { useState } from "react";
import { CalendarPlus, CalendarDays, Video, MapPin, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { usePortal } from "../usePortal";
import { PortalPage } from "../PortalApp";
import { useNewEntry } from "@/app/shell/NewEntry";
import { getDataSource } from "@/platform/data/repository";
import { cardCls, serif, LoadingRow, EmptyState, fmtDate, fmtTime, TONE_PILL, type Tone } from "@/platform/ui";

const STATUS: Record<string, { en: string; ar: string; tone: Tone }> = {
  booked:      { en: "Awaiting your confirmation", ar: "بانتظار تأكيدك", tone: "warning" },
  confirmed:   { en: "Confirmed",     ar: "مؤكد",       tone: "success" },
  arrived:     { en: "Checked in",    ar: "تم الوصول",  tone: "info" },
  in_progress: { en: "In progress",   ar: "جارٍ الآن",  tone: "brand" },
  completed:   { en: "Completed",     ar: "تمت",        tone: "neutral" },
  no_show:     { en: "Missed",        ar: "لم تحضر",    tone: "critical" },
  cancelled:   { en: "Cancelled",     ar: "ملغى",       tone: "neutral" },
  rescheduled: { en: "Rescheduled",   ar: "أُعيد جدولته", tone: "neutral" },
};

export default function Visits() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { workspace } = useAuth();
  const { patient, upcoming, past, loading } = usePortal();
  const { open } = useNewEntry();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: "confirmed" | "cancelled") {
    setBusy(id);
    try {
      await getDataSource().appointments.update(workspace?.id ?? "demo", id, {
        status,
        ...(status === "confirmed"
          ? { confirmed_at: new Date().toISOString() }
          : { cancellation_reason: "Cancelled by the patient in the portal" }),
      });
      toast.success(
        status === "confirmed"
          ? (ar ? "تم تأكيد موعدك." : "Your appointment is confirmed.")
          : (ar ? "تم إلغاء موعدك." : "Your appointment is cancelled."),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !patient) {
    return <PortalPage><LoadingRow label="Loading your appointments" labelAr="جاري تحميل مواعيدك" /></PortalPage>;
  }

  return (
    <PortalPage>
      <header>
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {ar ? "مواعيدك" : "Your visits"}
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          {ar
            ? "احجز أو أكّد أو ألغِ موعداً. يظهر التغيير للعيادة فوراً."
            : "Book, confirm or cancel. The clinic sees the change immediately."}
        </p>
      </header>

      <button
        type="button"
        onClick={() => open("book-appointment", { fixed: { patient_id: patient.id } })}
        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:opacity-90 transition-opacity"
      >
        <CalendarPlus size={17} />
        {ar ? "احجز موعداً جديداً" : "Book a new appointment"}
      </button>

      <section className="space-y-2">
        <h2 className="text-title font-semibold text-foreground" style={serif}>
          {ar ? "القادمة" : "Coming up"}
          {upcoming.length > 0 && (
            <span className="text-caption text-muted-foreground font-normal ms-2 tabular-nums">
              {upcoming.length}
            </span>
          )}
        </h2>

        {upcoming.length === 0 ? (
          <div className={cardCls}>
            <EmptyState
              icon={CalendarDays}
              title="Nothing booked"
              titleAr="لا مواعيد محجوزة"
              hint="Use the button above and pick a clinic and a time."
              hintAr="استخدم الزر أعلاه واختر العيادة والوقت."
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcoming.map((a) => {
              const st = STATUS[a.status] ?? STATUS.booked;
              return (
                <article key={a.id} className={`${cardCls} p-4`}>
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 text-center rounded-xl bg-brand-wash text-brand-ink px-3 py-2">
                      <span className="block text-micro font-semibold uppercase">
                        {new Date(a.slot_start).toLocaleDateString(ar ? "ar-SA" : "en-GB", { month: "short" })}
                      </span>
                      <span className="block text-heading font-semibold tabular-nums leading-none mt-0.5" style={serif}>
                        {new Date(a.slot_start).getDate()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-body-lg font-semibold text-foreground" style={serif}>
                        {fmtTime(a.slot_start, ar)} · {a.department_name}
                      </p>
                      <p className="text-body text-muted-foreground mt-0.5">
                        {ar ? "مع " : "with "}{a.provider_name}
                      </p>
                      <p className="text-caption text-muted-foreground mt-1 flex items-center gap-1.5">
                        {a.is_telehealth
                          ? <><Video size={12} /> {ar ? "استشارة بالفيديو — رابط يصلك قبل الموعد" : "Video consultation — a link arrives beforehand"}</>
                          : <><MapPin size={12} /> {ar ? "في المستشفى" : "At the hospital"}</>}
                      </p>
                      {a.reason_en && (
                        <p className="text-caption text-foreground/80 mt-1.5">
                          {ar ? a.reason_ar || a.reason_en : a.reason_en}
                        </p>
                      )}
                    </div>

                    <span className={`shrink-0 px-2 py-1 rounded-lg text-micro font-medium ${TONE_PILL[st.tone]}`}>
                      {ar ? st.ar : st.en}
                    </span>
                  </div>

                  {(a.status === "booked" || a.status === "confirmed") && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                      {a.status === "booked" && (
                        <button
                          type="button" disabled={busy === a.id}
                          onClick={() => setStatus(a.id, "confirmed")}
                          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-body font-semibold hover:opacity-90 transition-opacity"
                        >
                          {busy === a.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          {ar ? "أؤكد الحضور" : "I'll be there"}
                        </button>
                      )}
                      <button
                        type="button" disabled={busy === a.id}
                        onClick={() => setStatus(a.id, "cancelled")}
                        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border/60 text-body text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={14} />
                        {ar ? "إلغاء" : "Cancel"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {ar ? "السابقة" : "Past visits"}
          </h2>
          <div className={`${cardCls} divide-y divide-border/25 overflow-hidden`}>
            {past.slice(0, 12).map((a) => {
              const st = STATUS[a.status] ?? STATUS.completed;
              return (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-lg text-foreground">{a.department_name}</p>
                    <p className="text-caption text-muted-foreground">
                      {fmtDate(a.slot_start, ar)} · {a.provider_name}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-micro font-medium ${TONE_PILL[st.tone]}`}>
                    {ar ? st.ar : st.en}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </PortalPage>
  );
}
