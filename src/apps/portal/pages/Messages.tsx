/**
 * Messages.
 *
 * Sending here writes an inbound `portal_messages` row, which is the same row
 * the clinician's Inbox reads and ranks. There is no bridge, no sync and no
 * copy: switch persona to the doctor after sending and the message is already
 * sitting in their list.
 *
 * The screen states plainly that this is not for emergencies. A portal message
 * queue that looks like a chat app invites someone with chest pain to type
 * into it and wait, and that is a foreseeable harm rather than a support
 * problem.
 */

import { useState } from "react";
import { MessageSquare, Send, Loader2, AlertTriangle, User, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { usePortal } from "../usePortal";
import { PortalPage } from "../PortalApp";
import { getDataSource } from "@/platform/data/repository";
import { cardCls, serif, LoadingRow, EmptyState, inputCls, fmtDateTime } from "@/platform/ui";

type Topic = "question" | "appointment" | "prescription_refill" | "result_release" | "billing";

const TOPICS: { value: Topic; en: string; ar: string }[] = [
  { value: "question",           en: "A general question",     ar: "سؤال عام" },
  { value: "appointment",        en: "About an appointment",   ar: "بخصوص موعد" },
  { value: "prescription_refill", en: "About a medicine",      ar: "بخصوص دواء" },
  { value: "result_release",     en: "About a result",         ar: "بخصوص نتيجة" },
  { value: "billing",            en: "About a bill",           ar: "بخصوص فاتورة" },
];

export default function Messages() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { workspace } = useAuth();
  const { patient, messages, careTeam, loading } = usePortal();

  const [topic, setTopic] = useState<Topic>("question");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!patient || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      await getDataSource().portal_messages.create(workspace?.id ?? "demo", {
        patient_id: patient.id,
        patient_name: patient.name_en,
        direction: "inbound",
        category: topic,
        subject_en: subject.trim(),
        subject_ar: null,
        body_en: body.trim(),
        body_ar: null,
        // Addressed to the care team rather than to one clinician: a message
        // sent to a doctor who is on leave should not sit unread for a week.
        provider_id: null,
        provider_name: null,
        status: "unread",
        sent_at: new Date().toISOString(),
        read_at: null,
        replied_at: null,
        parent_message_id: null,
        attachment_count: 0,
        metadata: {},
      });
      setSubject("");
      setBody("");
      toast.success(
        ar
          ? "أُرسلت رسالتك إلى فريق الرعاية."
          : "Your message has been sent to your care team.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  if (loading || !patient) {
    return <PortalPage><LoadingRow label="Loading your messages" labelAr="جاري تحميل رسائلك" /></PortalPage>;
  }

  return (
    <PortalPage>
      <header>
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {ar ? "الرسائل" : "Messages"}
        </h1>
        <p className="text-body-lg text-muted-foreground mt-1">
          {careTeam.length > 0
            ? ar
              ? `تصل رسالتك إلى فريق الرعاية، ومنهم ${careTeam[0].nameAr || careTeam[0].name}.`
              : `Your message reaches your care team, including ${careTeam[0].name}.`
            : ar
              ? "تصل رسالتك إلى فريق الرعاية في المستشفى."
              : "Your message reaches your care team at the hospital."}
        </p>
      </header>

      <div className="rounded-xl bg-warning/12 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
        <p className="text-body text-foreground/90">
          {ar
            ? "هذه الرسائل تُقرأ في أوقات الدوام وقد يستغرق الرد يومي عمل. إن كانت حالتك عاجلة اتصل بالمستشفى، وإن كانت طارئة اتصل بالإسعاف."
            : "These messages are read during working hours and a reply can take up to two working days. If it is urgent, telephone the hospital. If it is an emergency, call an ambulance."}
        </p>
      </div>

      {/* ── Compose ── */}
      <form onSubmit={send} className={`${cardCls} p-4 space-y-3`}>
        <h2 className="text-title font-semibold text-foreground" style={serif}>
          {ar ? "اكتب رسالة" : "Write a message"}
        </h2>

        <div>
          <label htmlFor="topic" className="text-caption text-muted-foreground font-medium mb-1 block">
            {ar ? "الموضوع" : "What is it about?"}
          </label>
          <select
            id="topic" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}
            className={`${inputCls} h-11 text-body-lg`}
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className="text-caption text-muted-foreground font-medium mb-1 block">
            {ar ? "عنوان قصير" : "A short title"}
          </label>
          <input
            id="subject" value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder={ar ? "سؤال عن دواء الضغط" : "Question about my blood pressure tablets"}
            className={`${inputCls} h-11 text-body-lg`}
          />
        </div>

        <div>
          <label htmlFor="body" className="text-caption text-muted-foreground font-medium mb-1 block">
            {ar ? "رسالتك" : "Your message"}
          </label>
          <textarea
            id="body" rows={4} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={ar
              ? "اكتب ما تريد أن يعرفه فريقك."
              : "Tell your team what you want them to know."}
            className={`${inputCls} py-2.5 min-h-[110px] resize-y text-body-lg`}
          />
        </div>

        <button
          type="submit"
          disabled={sending || !subject.trim() || !body.trim()}
          className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:opacity-90 disabled:opacity-45 transition-opacity"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {ar ? "إرسال" : "Send"}
        </button>
      </form>

      {/* ── Thread ── */}
      <section className="space-y-2">
        <h2 className="text-title font-semibold text-foreground" style={serif}>
          {ar ? "سجل الرسائل" : "Your messages"}
        </h2>

        {messages.length === 0 ? (
          <div className={cardCls}>
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              titleAr="لا رسائل بعد"
              hint="Anything you send, and every reply, is kept here."
              hintAr="يُحفظ هنا كل ما ترسله وكل رد يصلك."
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.map((m) => {
              const fromPatient = m.direction === "inbound";
              return (
                <article
                  key={m.id}
                  className={`${cardCls} p-4 ${fromPatient ? "" : "border-primary/25 bg-brand-wash/40"}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${
                      fromPatient ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                    }`}>
                      {fromPatient ? <User size={13} /> : <Stethoscope size={13} />}
                    </span>
                    <span className="text-caption font-medium text-foreground">
                      {fromPatient
                        ? (ar ? "أنت" : "You")
                        : m.provider_name || (ar ? "فريق الرعاية" : "Your care team")}
                    </span>
                    <span className="text-micro text-muted-foreground ms-auto">
                      {fmtDateTime(m.sent_at, ar)}
                    </span>
                  </div>

                  <p className="text-body-lg font-semibold text-foreground">
                    {ar ? m.subject_ar || m.subject_en : m.subject_en}
                  </p>
                  <p className="text-body text-foreground/85 mt-1 leading-relaxed whitespace-pre-wrap">
                    {ar ? m.body_ar || m.body_en : m.body_en}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PortalPage>
  );
}
