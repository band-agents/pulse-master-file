/**
 * Inbox — what is waiting for this clinician.
 *
 * Inbasket volume is the most consistently cited driver of physician burnout,
 * and the mechanism is not the count: it is that a critical potassium and a
 * request for a repeat prescription arrive in the same undifferentiated list,
 * so every item has to be opened to find out whether it mattered.
 *
 * This inbox is therefore sorted by clinical consequence rather than by time,
 * and every row states what it is waiting FOR — "acknowledge and act", "sign
 * or discard" — so the reader can decide without opening it. Time is shown,
 * but it is never the sort key.
 */

import { Link } from "wouter";
import {
  AlertTriangle, FlaskConical, MessageSquare, FileSignature, Pill, Scan, Inbox as InboxIcon, ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useClinician, type InboxItem } from "../useClinician";
import {
  Page, cardCls, serif, LoadingRow, EmptyState, fmtAgo, TONE_PILL,
} from "@/platform/ui";

const KIND_ICON: Record<InboxItem["kind"], React.ElementType> = {
  critical_result: AlertTriangle,
  abnormal_result: FlaskConical,
  imaging_report: Scan,
  message: MessageSquare,
  refill: Pill,
  unsigned_note: FileSignature,
};

const KIND_LABEL: Record<InboxItem["kind"], { en: string; ar: string }> = {
  critical_result: { en: "Critical result", ar: "نتيجة حرجة" },
  abnormal_result: { en: "Abnormal result", ar: "نتيجة غير طبيعية" },
  imaging_report:  { en: "Critical imaging finding", ar: "نتيجة أشعة حرجة" },
  message:         { en: "Patient message", ar: "رسالة من مريض" },
  refill:          { en: "Refill request", ar: "طلب إعادة صرف" },
  unsigned_note:   { en: "Unsigned note", ar: "ملاحظة غير موقّعة" },
};

export default function ClinicianInbox() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { inbox, loading } = useClinician();

  if (loading) {
    return <Page><LoadingRow label="Reading your inbox" labelAr="جاري قراءة صندوق الوارد" /></Page>;
  }

  const critical = inbox.filter((i) => i.tone === "critical");
  const rest = inbox.filter((i) => i.tone !== "critical");

  return (
    <Page>
      <header>
        <h1 className="text-display font-semibold text-foreground" style={serif}>
          {ar ? "الوارد" : "Inbox"}
        </h1>
        <p className="text-body text-muted-foreground mt-1">
          {inbox.length === 0
            ? (ar ? "لا شيء ينتظرك." : "Nothing is waiting for you.")
            : ar
              ? `${inbox.length} عنصر، مرتّبة حسب الأثر السريري لا حسب الوقت.`
              : `${inbox.length} items, ordered by clinical consequence rather than by time.`}
        </p>
      </header>

      {inbox.length === 0 && (
        <EmptyState
          icon={InboxIcon}
          title="Inbox clear"
          titleAr="الوارد فارغ"
          hint="Critical results, patient messages, refill requests and unsigned notes appear here."
          hintAr="تظهر هنا النتائج الحرجة ورسائل المرضى وطلبات إعادة الصرف والملاحظات غير الموقعة."
        />
      )}

      {critical.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-destructive" />
            <h2 className="text-title font-semibold text-foreground" style={serif}>
              {ar ? "لم يُبلّغ به أحد بعد" : "Nobody has been told yet"}
            </h2>
            <span className="text-caption text-muted-foreground tabular-nums">{critical.length}</span>
          </div>
          <p className="text-caption text-muted-foreground max-w-[70ch]">
            {ar
              ? "هذه نتائج حرجة صدرت ولم تُسجَّل عليها أي عملية إبلاغ. البقاء في هذه القائمة يعني أن المريض لم يُتخذ بشأنه إجراء."
              : "These are critical results with no recorded notification against them. Staying on this list means nothing has been done for that patient."}
          </p>
          <div className={`${cardCls} border-destructive/30 divide-y divide-border/25 overflow-hidden`}>
            {critical.map((item) => <Row key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {critical.length > 0 ? (ar ? "بقية الوارد" : "Everything else") : (ar ? "الوارد" : "Waiting")}
          </h2>
          <div className={`${cardCls} divide-y divide-border/25 overflow-hidden`}>
            {rest.map((item) => <Row key={item.id} item={item} />)}
          </div>
        </section>
      )}
    </Page>
  );
}

function Row({ item }: { item: InboxItem }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const Icon = KIND_ICON[item.kind];
  const kind = KIND_LABEL[item.kind];

  return (
    <Link href={item.href} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group">
      <span
        className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 mt-0.5 ${TONE_PILL[item.tone]}`}
      >
        <Icon size={15} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
            {ar ? kind.ar : kind.en}
          </span>
          <span className="text-micro text-muted-foreground">·</span>
          <span className="text-micro text-muted-foreground">{fmtAgo(item.at, ar)}</span>
        </div>

        <p className="text-body-lg font-medium text-foreground mt-0.5 group-hover:text-brand-ink transition-colors">
          {ar ? item.title.ar : item.title.en}
        </p>

        <p className="text-caption text-muted-foreground truncate">
          {item.patientName}
          {(ar ? item.detail.ar : item.detail.en) && (
            <> · {ar ? item.detail.ar : item.detail.en}</>
          )}
        </p>

        <p className={`text-micro mt-1 font-medium ${item.tone === "critical" ? "text-destructive" : "text-muted-foreground"}`}>
          {ar ? item.action.ar : item.action.en}
        </p>
      </div>

      <ChevronRight size={14} className="text-muted-foreground/40 shrink-0 mt-2 rtl:rotate-180" />
    </Link>
  );
}
