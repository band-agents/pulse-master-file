/**
 * Interface Message Log — سجل الرسائل
 *
 * The audit trail of every message crossing an integration boundary — the
 * interop analogue of a lab worklist's chain of custody. An integration
 * engineer scanning this screen is looking for one thing first: the error
 * text on whatever just failed.
 */

import { useState, useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, FileWarning, RefreshCw, Timer, ListChecks } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  useCollection, matches, fmtAgo,
  type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type InterfaceMessage = Database["public"]["Tables"]["interface_messages"]["Row"];

const MESSAGE_STATUS: StatusMap = {
  queued:      { en: "Queued",       ar: "قيد الانتظار", tone: "neutral" },
  sending:     { en: "Sending",      ar: "قيد الإرسال",  tone: "neutral" },
  sent:        { en: "Sent",         ar: "أُرسلت",        tone: "success" },
  acknowledged:{ en: "Acknowledged", ar: "تم الإقرار",   tone: "success" },
  rejected:    { en: "Rejected",     ar: "مرفوضة",        tone: "critical" },
  error:       { en: "Error",        ar: "خطأ",           tone: "critical" },
  retrying:    { en: "Retrying",     ar: "إعادة محاولة",  tone: "warning" },
  dead_letter: { en: "Dead letter",  ar: "رسالة معلقة",   tone: "critical" },
};

const PROTOCOL_LABEL: Record<string, string> = {
  hl7v2: "HL7v2", fhir_r4: "FHIR R4", dicom: "DICOM", x12: "X12", custom: "Custom",
};

export default function InterfaceMessages() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: messages, loading } = useCollection("interface_messages");

  const [search, setSearch] = useState("");
  const [protocol, setProtocol] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [messageType, setMessageType] = useState("");

  const messageTypeOptions = useMemo(
    () => [...new Set(messages.map((m) => m.message_type))].sort().map((t) => ({ value: t, en: t, ar: t })),
    [messages],
  );

  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
  const today = messages.filter((m) => m.sent_at && isToday(m.sent_at));
  const failed = messages.filter((m) => m.status === "error" || m.status === "dead_letter" || m.status === "rejected");
  const retrying = messages.filter((m) => m.status === "retrying");
  const avgProcessingMs = useMemo(() => {
    const timed = messages.filter((m) => m.processing_ms !== null) as (InterfaceMessage & { processing_ms: number })[];
    if (!timed.length) return null;
    return Math.round(timed.reduce((sum, m) => sum + m.processing_ms, 0) / timed.length);
  }, [messages]);

  const filtered = useMemo(
    () => messages
      .filter((m) =>
        (!protocol || m.protocol === protocol) &&
        (!direction || m.direction === direction) &&
        (!status || m.status === status) &&
        (!messageType || m.message_type === messageType) &&
        matches(search, m.message_id, m.endpoint_name, m.message_type, m.patient_mrn, m.error_message))
      .sort((a, b) => {
        const at = a.sent_at ? new Date(a.sent_at).getTime() : 0;
        const bt = b.sent_at ? new Date(b.sent_at).getTime() : 0;
        return bt - at;
      }),
    [messages, search, protocol, direction, status, messageType],
  );

  const columns: Column<InterfaceMessage>[] = [
    {
      key: "message", header: "Message", headerAr: "الرسالة",
      cell: (m) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{m.message_type}</div>
          <div className="text-micro text-muted-foreground tabular-nums truncate">{m.message_id}</div>
          {m.patient_mrn && <div className="text-micro text-muted-foreground tabular-nums">{m.patient_mrn}</div>}
        </div>
      ),
    },
    {
      key: "endpoint", header: "Endpoint", headerAr: "النقطة",
      cell: (m) => m.endpoint_name,
      hideBelow: "md",
    },
    {
      key: "protocol", header: "Protocol", headerAr: "البروتوكول",
      cell: (m) => <Pill tone="neutral">{PROTOCOL_LABEL[m.protocol] ?? m.protocol}</Pill>,
      hideBelow: "lg",
    },
    {
      key: "direction", header: "Direction", headerAr: "الاتجاه",
      cell: (m) => (
        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
          {m.direction === "inbound" ? <ArrowDownLeft size={12} className="text-info" /> : <ArrowUpRight size={12} />}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "status", header: "Status", headerAr: "الحالة",
      cell: (m) => (
        <div className="space-y-1">
          <StatusPill map={MESSAGE_STATUS} value={m.status} />
          {m.error_message && (
            <div className="text-micro text-destructive truncate max-w-[24ch]" title={m.error_message}>
              {m.error_message}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "ack_code", header: "Ack", headerAr: "الإقرار",
      cell: (m) => m.ack_code ?? "—",
      hideBelow: "lg",
      align: "end",
    },
    {
      key: "retry_count", header: "Retries", headerAr: "المحاولات",
      cell: (m) => (
        <span className={`tabular-nums ${m.retry_count > 0 ? "text-warning font-semibold" : "text-muted-foreground"}`}>
          {m.retry_count}
        </span>
      ),
      sortValue: (m) => m.retry_count,
      hideBelow: "md",
      align: "end",
    },
    {
      key: "sent_at", header: "Sent", headerAr: "أُرسلت",
      cell: (m) => <span className="tabular-nums text-caption text-muted-foreground">{fmtAgo(m.sent_at, ar)}</span>,
      sortValue: (m) => (m.sent_at ? new Date(m.sent_at).getTime() : 0),
      align: "end",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Message Log"
        titleAr="سجل الرسائل"
        subtitle="The audit trail of every message crossing an integration boundary."
        subtitleAr="سجل تدقيق لكل رسالة تعبر حدود التكامل."
        meta={[
          { label: "Today", labelAr: "اليوم", value: String(today.length), tone: "neutral" },
          { label: "Failed", labelAr: "فاشلة", value: String(failed.length), tone: failed.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile
          label="Messages today" labelAr="رسائل اليوم" value={today.length}
          icon={ListChecks} tone="neutral"
        />
        <StatTile
          label="Errors / dead letter" labelAr="أخطاء / معلقة" value={failed.length}
          icon={FileWarning} tone={failed.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Retrying" labelAr="إعادة محاولة" value={retrying.length}
          icon={RefreshCw} tone={retrying.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Avg processing time" labelAr="متوسط زمن المعالجة"
          value={avgProcessingMs !== null ? `${avgProcessingMs} ms` : "—"}
          icon={Timer} tone="neutral"
        />
      </StatGrid>

      <Section title="Messages" titleAr="الرسائل">
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Message ID, endpoint, MRN or error"
          searchPlaceholderAr="رقم الرسالة أو النقطة أو رقم الملف أو الخطأ"
          filters={[
            {
              key: "protocol", value: protocol, onChange: setProtocol,
              allLabel: "All protocols", allLabelAr: "كل البروتوكولات",
              options: Object.entries(PROTOCOL_LABEL).map(([value, en]) => ({ value, en, ar: en })),
            },
            {
              key: "direction", value: direction, onChange: setDirection,
              allLabel: "All directions", allLabelAr: "كل الاتجاهات",
              options: [
                { value: "inbound", en: "Inbound", ar: "وارد" },
                { value: "outbound", en: "Outbound", ar: "صادر" },
              ],
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(MESSAGE_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "message_type", value: messageType, onChange: setMessageType,
              allLabel: "All message types", allLabelAr: "كل أنواع الرسائل",
              options: messageTypeOptions,
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "رسالة" : filtered.length === 1 ? "message" : "messages"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          initialSort={{ key: "sent_at", ascending: false }}
        />
      </Section>
    </Page>
  );
}
