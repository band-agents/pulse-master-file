/**
 * Patient Portal Inbox — بوابة المرضى
 *
 * The hospital-staff-facing view of patient portal traffic. Patients see a
 * thread; staff need an inbox — what is unread, what has been escalated,
 * and who is waiting on a reply.
 */

import { useState, useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Inbox, AlertTriangle, MessageSquareReply, MessagesSquare } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill, PatientCell,
  useCollection, matches, fmtAgo,
  type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type PortalMessage = Database["public"]["Tables"]["portal_messages"]["Row"];

const MESSAGE_STATUS: StatusMap = {
  unread:     { en: "Unread",    ar: "غير مقروءة", tone: "warning" },
  read:       { en: "Read",      ar: "مقروءة",      tone: "neutral" },
  replied:    { en: "Replied",   ar: "تم الرد",      tone: "success" },
  closed:     { en: "Closed",    ar: "مغلقة",        tone: "neutral" },
  escalated:  { en: "Escalated", ar: "تصعيد",        tone: "critical" },
};

const CATEGORY_LABEL: Record<string, { en: string; ar: string }> = {
  question:            { en: "Question",           ar: "سؤال" },
  result_release:      { en: "Result release",      ar: "إصدار نتيجة" },
  appointment:         { en: "Appointment",         ar: "موعد" },
  prescription_refill: { en: "Prescription refill", ar: "تجديد وصفة" },
  billing:             { en: "Billing",             ar: "فوترة" },
  document:            { en: "Document",            ar: "مستند" },
  reminder:            { en: "Reminder",             ar: "تذكير" },
};

export default function PatientPortal() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: messages, loading } = useCollection("portal_messages");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [direction, setDirection] = useState("");

  const unread = messages.filter((m) => m.status === "unread");
  const escalated = messages.filter((m) => m.status === "escalated");
  const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
  const repliedToday = messages.filter((m) => m.replied_at && isToday(m.replied_at));

  const filtered = useMemo(
    () => messages
      .filter((m) =>
        (!category || m.category === category) &&
        (!status || m.status === status) &&
        (!direction || m.direction === direction) &&
        matches(search, m.patient_name, m.subject_en, m.subject_ar, m.body_en, m.provider_name))
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()),
    [messages, search, category, status, direction],
  );

  const columns: Column<PortalMessage>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      cell: (m) => <PatientCell name={m.patient_name} href={`/chart/${m.patient_id}`} />,
      sortValue: (m) => m.patient_name,
    },
    {
      key: "direction", header: "Direction", headerAr: "الاتجاه",
      cell: (m) => (
        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground" title={m.direction}>
          {m.direction === "inbound" ? <ArrowDownLeft size={13} className="text-info" /> : <ArrowUpRight size={13} className="text-muted-foreground" />}
          {ar ? (m.direction === "inbound" ? "وارد" : "صادر") : (m.direction === "inbound" ? "Inbound" : "Outbound")}
        </span>
      ),
      hideBelow: "md",
    },
    {
      key: "category", header: "Category", headerAr: "التصنيف",
      cell: (m) => {
        const c = CATEGORY_LABEL[m.category] ?? { en: m.category, ar: m.category };
        return <Pill tone="neutral">{ar ? c.ar : c.en}</Pill>;
      },
      hideBelow: "sm",
    },
    {
      key: "subject", header: "Subject", headerAr: "الموضوع",
      cell: (m) => {
        const unreadRow = m.status === "unread";
        return (
          <div className="min-w-0 max-w-[32ch]">
            <div className={`truncate ${unreadRow ? "font-semibold text-foreground" : "text-foreground/85"}`}>
              {ar ? (m.subject_ar ?? m.subject_en) : m.subject_en}
            </div>
          </div>
        );
      },
    },
    {
      key: "provider", header: "Provider", headerAr: "مقدم الرعاية",
      cell: (m) => m.provider_name ?? "—",
      hideBelow: "lg",
    },
    {
      key: "sent_at", header: "Sent", headerAr: "أُرسلت",
      cell: (m) => <span className="tabular-nums text-caption text-muted-foreground">{fmtAgo(m.sent_at, ar)}</span>,
      sortValue: (m) => new Date(m.sent_at).getTime(),
      align: "end",
    },
    {
      key: "status", header: "Status", headerAr: "الحالة",
      cell: (m) => <StatusPill map={MESSAGE_STATUS} value={m.status} />,
      align: "end",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Patient Portal"
        titleAr="بوابة المرضى"
        subtitle="Messages patients have sent through the portal, and what staff have done with them."
        subtitleAr="الرسائل التي أرسلها المرضى عبر البوابة، وما تم اتخاذه من إجراء بشأنها."
        meta={[
          { label: "Unread", labelAr: "غير مقروءة", value: String(unread.length), tone: unread.length > 0 ? "warning" : "success" },
          { label: "Escalated", labelAr: "مصعّدة", value: String(escalated.length), tone: escalated.length > 0 ? "critical" : "neutral" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile
          label="Unread" labelAr="غير مقروءة" value={unread.length}
          sub="Waiting on staff" subAr="بانتظار الموظفين"
          icon={Inbox} tone={unread.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Escalated" labelAr="مصعّدة" value={escalated.length}
          sub="Needs senior attention" subAr="تحتاج متابعة أعلى"
          icon={AlertTriangle} tone={escalated.length > 0 ? "critical" : "neutral"}
        />
        <StatTile
          label="Replied today" labelAr="تم الرد اليوم" value={repliedToday.length}
          icon={MessageSquareReply} tone="success"
        />
        <StatTile
          label="Total messages" labelAr="إجمالي الرسائل" value={messages.length}
          icon={MessagesSquare} tone="neutral"
        />
      </StatGrid>

      <Section title="Inbox" titleAr="الوارد">
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, subject or provider"
          searchPlaceholderAr="المريض أو الموضوع أو مقدم الرعاية"
          filters={[
            {
              key: "category", value: category, onChange: setCategory,
              allLabel: "All categories", allLabelAr: "كل التصنيفات",
              options: Object.entries(CATEGORY_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(MESSAGE_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "direction", value: direction, onChange: setDirection,
              allLabel: "All directions", allLabelAr: "كل الاتجاهات",
              options: [
                { value: "inbound", en: "Inbound", ar: "وارد" },
                { value: "outbound", en: "Outbound", ar: "صادر" },
              ],
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
