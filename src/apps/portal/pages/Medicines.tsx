/**
 * Medicines.
 *
 * Written as instructions, not as a prescription. "One tablet, twice a day,
 * with food" is what a patient needs; "500 mg PO BD" is what a pharmacist
 * needs, and putting the second in front of the first is how people take the
 * wrong dose.
 *
 * The frequency and route codes stored on the row are therefore expanded into
 * sentences here rather than being printed raw. The abbreviations are still in
 * the record — the clinician's view shows them — but they never reach this
 * screen.
 */

import { useState } from "react";
import { Pill, RefreshCw, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { usePortal } from "../usePortal";
import { PortalPage } from "../PortalApp";
import { getDataSource } from "@/platform/data/repository";
import { cardCls, serif, LoadingRow, EmptyState, fmtDate, TONE_PILL, type Tone } from "@/platform/ui";

/** Dosing abbreviations, expanded. The portal never shows the short form. */
const FREQUENCY_TEXT: Record<string, { en: string; ar: string }> = {
  OD:   { en: "once a day",            ar: "مرة واحدة يومياً" },
  BD:   { en: "twice a day",           ar: "مرتين يومياً" },
  TDS:  { en: "three times a day",     ar: "ثلاث مرات يومياً" },
  QDS:  { en: "four times a day",      ar: "أربع مرات يومياً" },
  Q6H:  { en: "every 6 hours",         ar: "كل ٦ ساعات" },
  Q8H:  { en: "every 8 hours",         ar: "كل ٨ ساعات" },
  Q12H: { en: "every 12 hours",        ar: "كل ١٢ ساعة" },
  STAT: { en: "once, straight away",   ar: "جرعة واحدة فوراً" },
  PRN:  { en: "only when you need it", ar: "عند الحاجة فقط" },
};

const ROUTE_TEXT: Record<string, { en: string; ar: string }> = {
  oral:       { en: "by mouth",           ar: "عن طريق الفم" },
  iv:         { en: "into a vein",        ar: "في الوريد" },
  im:         { en: "as an injection",    ar: "حقنة عضلية" },
  sc:         { en: "under the skin",     ar: "تحت الجلد" },
  topical:    { en: "on the skin",        ar: "على الجلد" },
  inhaled:    { en: "breathed in",        ar: "بالاستنشاق" },
  rectal:     { en: "rectally",           ar: "شرجياً" },
  sublingual: { en: "under the tongue",   ar: "تحت اللسان" },
  ophthalmic: { en: "into the eye",       ar: "في العين" },
};

const STATUS: Record<string, { en: string; ar: string; tone: Tone }> = {
  signed:              { en: "Ready at the pharmacy",  ar: "جاهزة في الصيدلية", tone: "info" },
  transmitted:         { en: "Sent to the pharmacy",   ar: "أُرسلت للصيدلية",   tone: "info" },
  dispensed:           { en: "Collected",              ar: "تم استلامها",       tone: "success" },
  partially_dispensed: { en: "Partly collected",       ar: "استُلمت جزئياً",     tone: "warning" },
};

export default function Medicines() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { workspace } = useAuth();
  const { patient, medicines, loading } = usePortal();
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * A refill request is a message to the care team, not a silent counter
   * bump. It has to land in a human's inbox, because a repeat prescription
   * is a clinical decision — the drug may need bloods, or stopping.
   */
  async function requestRefill(rxId: string, drug: string) {
    if (!patient) return;
    setBusy(rxId);
    try {
      await getDataSource().portal_messages.create(workspace?.id ?? "demo", {
        patient_id: patient.id,
        patient_name: patient.name_en,
        direction: "inbound",
        category: "prescription_refill",
        subject_en: `Repeat prescription request — ${drug}`,
        subject_ar: `طلب إعادة صرف — ${drug}`,
        body_en: `${patient.name_en} has requested a repeat prescription for ${drug} through the patient portal.`,
        body_ar: `طلب ${patient.name_en} إعادة صرف ${drug} عبر بوابة المريض.`,
        provider_id: null,
        provider_name: null,
        status: "unread",
        sent_at: new Date().toISOString(),
        read_at: null,
        replied_at: null,
        parent_message_id: null,
        attachment_count: 0,
        metadata: { prescription_id: rxId },
      });
      toast.success(
        ar
          ? "وصل طلبك إلى فريق الرعاية. سيتواصلون معك."
          : "Your request has reached your care team. They will be in touch.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !patient) {
    return <PortalPage><LoadingRow label="Loading your medicines" labelAr="جاري تحميل أدويتك" /></PortalPage>;
  }

  return (
    <PortalPage>
      <header>
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {ar ? "أدويتك" : "Your medicines"}
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          {ar
            ? "ما وصفه لك أطباؤك، وكيف تأخذه."
            : "What your doctors have prescribed, and how to take it."}
        </p>
      </header>

      {medicines.length === 0 ? (
        <div className={cardCls}>
          <EmptyState
            icon={Pill}
            title="No current medicines"
            titleAr="لا أدوية حالياً"
            hint="Anything prescribed for you appears here as soon as it is signed."
            hintAr="يظهر هنا أي دواء يُوصف لك فور توقيعه."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {medicines.map((m) => {
            const freq = FREQUENCY_TEXT[m.frequency];
            const route = ROUTE_TEXT[m.route];
            const st = STATUS[m.status];
            const left = m.refills_allowed - m.refills_used;

            return (
              <article key={m.id} className={`${cardCls} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-brand-wash text-brand-ink grid place-items-center shrink-0">
                    <Pill size={19} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-title font-semibold text-foreground" style={serif}>
                      {ar ? m.drug_name_ar || m.drug_name_en : m.drug_name_en}
                      {m.strength && <span className="text-muted-foreground font-normal"> {m.strength}</span>}
                    </h2>

                    {/* The instruction, as a sentence. */}
                    <p className="text-body-lg text-foreground mt-1.5">
                      {ar ? "خذ " : "Take "}
                      <span className="font-semibold">{m.dose}</span>
                      {route && <>, {ar ? route.ar : route.en}</>}
                      {freq && <>, {ar ? freq.ar : freq.en}</>}
                      {m.duration_days && (
                        <>, {ar ? `لمدة ${m.duration_days} يوماً` : `for ${m.duration_days} days`}</>
                      )}
                      .
                    </p>

                    {m.notes_en && (
                      <p className="text-body text-foreground/85 mt-2 flex items-start gap-1.5">
                        <Info size={14} className="shrink-0 mt-0.5 text-brand-ink" />
                        {ar ? m.notes_ar || m.notes_en : m.notes_en}
                      </p>
                    )}

                    <p className="text-caption text-muted-foreground mt-2">
                      {ar ? "وصفها " : "Prescribed by "}{m.prescriber_name}
                      {" · "}{fmtDate(m.created_at, ar)}
                    </p>
                  </div>

                  {st && (
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-micro font-medium ${TONE_PILL[st.tone]}`}>
                      {ar ? st.ar : st.en}
                    </span>
                  )}
                </div>

                {left > 0 && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                    <button
                      type="button" disabled={busy === m.id}
                      onClick={() => requestRefill(m.id, m.drug_name_en)}
                      className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-border/60 text-body font-medium text-foreground hover:bg-brand-wash hover:text-brand-ink hover:border-primary/30 transition-colors"
                    >
                      {busy === m.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <RefreshCw size={14} />}
                      {ar ? "اطلب إعادة الصرف" : "Request more"}
                    </button>
                    <span className="text-caption text-muted-foreground">
                      {ar ? `متبقٍ ${left} صرفة` : `${left} repeat${left === 1 ? "" : "s"} left`}
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-caption text-muted-foreground text-center pb-4 max-w-[52ch] mx-auto">
        {ar
          ? "لا توقف أي دواء ولا تغيّر جرعته دون التحدث إلى طبيبك، حتى لو شعرت بتحسّن."
          : "Do not stop any medicine or change a dose without speaking to your doctor, even if you feel better."}
      </p>
    </PortalPage>
  );
}
