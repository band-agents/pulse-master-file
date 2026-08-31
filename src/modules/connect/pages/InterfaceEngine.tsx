/**
 * Interface Engine — محرك التكامل
 *
 * A systems-integration status page, not a clinical worklist — but it reuses
 * the exact same primitives as the rest of the system. An interface being down
 * silently breaks whatever downstream workflow depends on it, so "how many
 * are not up" is the number that matters most here.
 */

import { useState, useMemo } from "react";
import { Plug, PlugZap, AlertOctagon, Activity, MessageSquareWarning } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill,
  useCollection, matches, fmtAgo,
  type Column, type StatusMap, TONE_DOT,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type InterfaceEndpoint = Database["public"]["Tables"]["interface_endpoints"]["Row"];

const ENDPOINT_STATUS: StatusMap = {
  up:       { en: "Up",       ar: "متصل",   tone: "success" },
  degraded: { en: "Degraded", ar: "متدهور", tone: "warning" },
  down:     { en: "Down",     ar: "معطل",   tone: "critical" },
  disabled: { en: "Disabled", ar: "معطّل يدويًا", tone: "neutral" },
};

const PROTOCOL_LABEL: Record<string, string> = {
  hl7v2: "HL7v2", fhir_r4: "FHIR R4", dicom: "DICOM", x12: "X12", custom: "Custom",
};

const DIRECTION_LABEL: Record<string, { en: string; ar: string }> = {
  inbound:       { en: "Inbound",       ar: "وارد" },
  outbound:      { en: "Outbound",      ar: "صادر" },
  bidirectional: { en: "Bidirectional", ar: "ثنائي الاتجاه" },
};

export default function InterfaceEngine() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: endpoints, loading } = useCollection("interface_endpoints");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [protocol, setProtocol] = useState("");

  const up = endpoints.filter((e) => e.status === "up");
  const unhealthy = endpoints.filter((e) => e.status === "degraded" || e.status === "down");
  const messagesToday = endpoints.reduce((sum, e) => sum + e.messages_today, 0);
  const errorsToday = endpoints.reduce((sum, e) => sum + e.errors_today, 0);

  const filtered = useMemo(
    () => endpoints
      .filter((e) =>
        (!status || e.status === status) &&
        (!protocol || e.protocol === protocol) &&
        matches(search, e.name_en, e.name_ar, e.system_name, e.owner_team))
      .sort((a, b) => {
        const order: Record<string, number> = { down: 0, degraded: 1, up: 2, disabled: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }),
    [endpoints, search, status, protocol],
  );

  const columns: Column<InterfaceEndpoint>[] = [
    {
      key: "name", header: "Endpoint", headerAr: "النقطة",
      cell: (e) => (
        <div className="min-w-0">
          <span className={`inline-block w-1.5 h-1.5 rounded-full me-1.5 ${TONE_DOT[ENDPOINT_STATUS[e.status].tone]}`} aria-hidden />
          <span className="font-medium text-foreground">{ar ? (e.name_ar ?? e.name_en) : e.name_en}</span>
          <div className="text-micro text-muted-foreground ms-3">{e.system_name}</div>
        </div>
      ),
      sortValue: (e) => e.name_en,
    },
    {
      key: "protocol", header: "Protocol", headerAr: "البروتوكول",
      cell: (e) => <Pill tone="neutral">{PROTOCOL_LABEL[e.protocol] ?? e.protocol}</Pill>,
      hideBelow: "md",
    },
    {
      key: "direction", header: "Direction", headerAr: "الاتجاه",
      cell: (e) => {
        const d = DIRECTION_LABEL[e.direction] ?? { en: e.direction, ar: e.direction };
        return <span className="text-caption text-muted-foreground">{ar ? d.ar : d.en}</span>;
      },
      hideBelow: "lg",
    },
    {
      key: "status", header: "Status", headerAr: "الحالة",
      cell: (e) => <StatusPill map={ENDPOINT_STATUS} value={e.status} />,
    },
    {
      key: "heartbeat", header: "Last heartbeat", headerAr: "آخر نبضة",
      cell: (e) => <span className="tabular-nums text-caption text-muted-foreground">{fmtAgo(e.last_heartbeat_at, ar)}</span>,
      sortValue: (e) => (e.last_heartbeat_at ? new Date(e.last_heartbeat_at).getTime() : 0),
      hideBelow: "sm",
    },
    {
      key: "messages", header: "Messages today", headerAr: "رسائل اليوم",
      cell: (e) => <span className="tabular-nums">{e.messages_today}</span>,
      sortValue: (e) => e.messages_today,
      align: "end",
    },
    {
      key: "errors", header: "Errors today", headerAr: "أخطاء اليوم",
      cell: (e) => (
        <span className={`tabular-nums ${e.errors_today > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
          {e.errors_today}
        </span>
      ),
      sortValue: (e) => e.errors_today,
      align: "end",
    },
    {
      key: "owner", header: "Owner", headerAr: "الفريق المالك",
      cell: (e) => e.owner_team ?? "—",
      hideBelow: "lg",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Interface Engine"
        titleAr="محرك التكامل"
        subtitle="Every integration endpoint, and whether it is actually up right now."
        subtitleAr="كل نقطة تكامل، وما إذا كانت متصلة فعليًا الآن."
        meta={[
          { label: "Up", labelAr: "متصلة", value: String(up.length), tone: "success" },
          { label: "Degraded / down", labelAr: "متدهورة / معطلة", value: String(unhealthy.length), tone: unhealthy.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile
          label="Endpoints up" labelAr="نقاط متصلة" value={up.length}
          sub={`of ${endpoints.length} total`} subAr={`من أصل ${endpoints.length}`}
          icon={PlugZap} tone="success"
        />
        <StatTile
          label="Degraded or down" labelAr="متدهورة أو معطلة" value={unhealthy.length}
          sub="Breaks downstream workflows" subAr="تعطّل سير العمل التابع"
          icon={AlertOctagon} tone={unhealthy.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Messages today" labelAr="رسائل اليوم" value={messagesToday}
          icon={Activity} tone="neutral"
        />
        <StatTile
          label="Errors today" labelAr="أخطاء اليوم" value={errorsToday}
          icon={MessageSquareWarning} tone={errorsToday > 0 ? "warning" : "success"}
        />
      </StatGrid>

      <Section title="Endpoints" titleAr="نقاط التكامل">
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Name, system or owner team"
          searchPlaceholderAr="الاسم أو النظام أو الفريق المالك"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(ENDPOINT_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "protocol", value: protocol, onChange: setProtocol,
              allLabel: "All protocols", allLabelAr: "كل البروتوكولات",
              options: Object.entries(PROTOCOL_LABEL).map(([value, en]) => ({ value, en, ar: en })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "نقطة" : filtered.length === 1 ? "endpoint" : "endpoints"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          empty={
            <div className="py-14 px-6 flex flex-col items-center text-center gap-3 text-muted-foreground">
              <Plug size={19} strokeWidth={1.6} />
              <p className="text-body-lg font-medium text-foreground">{ar ? "لا توجد نقاط مطابقة" : "No endpoints match"}</p>
            </div>
          }
        />
      </Section>
    </Page>
  );
}
