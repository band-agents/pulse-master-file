/**
 * Claims — المطالبات
 *
 * The insurance claim lifecycle, payer to payout. A denial nobody follows up
 * on is the failure mode this screen exists to prevent, so denied/appealed
 * claims get their own callout above the main table — the same shape
 * LabResults uses for critical values that haven't been notified yet.
 */

import { useState, useMemo } from "react";
import { FileWarning, AlertTriangle, Banknote, Clock, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill, StatusPill, PatientCell,
  useCollection, matches, fmtDate, fmtMoney, serif, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Claim = Database["public"]["Tables"]["claims"]["Row"];

const CLAIM_STATUS: StatusMap = {
  draft: { en: "Draft", ar: "مسودة", tone: "neutral" },
  ready: { en: "Ready", ar: "جاهزة", tone: "neutral" },
  submitted: { en: "Submitted", ar: "مُرسَلة", tone: "info" },
  acknowledged: { en: "Acknowledged", ar: "مؤكدة الاستلام", tone: "info" },
  in_review: { en: "In review", ar: "قيد المراجعة", tone: "info" },
  approved: { en: "Approved", ar: "معتمدة", tone: "success" },
  partially_paid: { en: "Partially paid", ar: "مدفوعة جزئياً", tone: "warning" },
  paid: { en: "Paid", ar: "مدفوعة", tone: "success" },
  denied: { en: "Denied", ar: "مرفوضة", tone: "critical" },
  appealed: { en: "Appealed", ar: "مستأنَفة", tone: "warning" },
  written_off: { en: "Written off", ar: "مشطوبة", tone: "neutral" },
};

const CLAIM_TYPE_LABEL: Record<Claim["claim_type"], { en: string; ar: string }> = {
  institutional: { en: "Institutional", ar: "مؤسسية" },
  professional: { en: "Professional", ar: "مهنية" },
  dental: { en: "Dental", ar: "أسنان" },
  pharmacy: { en: "Pharmacy", ar: "صيدلية" },
  pre_authorisation: { en: "Pre-authorisation", ar: "تصريح مسبق" },
};

const AR_DAYS_WARN = 45;

export default function Claims() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("claims");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [payerFilter, setPayerFilter] = useState("");

  const payerOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.payer_name))).sort().map((name) => ({ value: name, en: name, ar: name })),
    [rows],
  );

  const denied = useMemo(() => rows.filter((r) => r.status === "denied" || r.status === "appealed"), [rows]);

  const totalClaimed = useMemo(() => rows.reduce((s, r) => s + r.claimed_amount, 0), [rows]);
  const totalPaid = useMemo(() => rows.reduce((s, r) => s + (r.paid_amount ?? 0), 0), [rows]);
  const deniedCount = useMemo(() => rows.filter((r) => r.status === "denied").length, [rows]);
  const avgArDays = useMemo(() => {
    const withAge = rows.filter((r) => r.ar_days !== null) as (Claim & { ar_days: number })[];
    if (withAge.length === 0) return null;
    return Math.round(withAge.reduce((s, r) => s + r.ar_days, 0) / withAge.length);
  }, [rows]);

  const filtered = useMemo(
    () => rows.filter((r) =>
      (!statusFilter || r.status === statusFilter)
      && (!typeFilter || r.claim_type === typeFilter)
      && (!payerFilter || r.payer_name === payerFilter)
      && matches(search, r.claim_number, r.patient_name, r.payer_name, r.policy_number)),
    [rows, statusFilter, typeFilter, payerFilter, search],
  );

  const columns: Column<Claim>[] = [
    {
      key: "claim_number", header: "Claim #", headerAr: "رقم المطالبة",
      cell: (r) => <span className="font-mono text-caption text-foreground whitespace-nowrap">{r.claim_number}</span>,
    },
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      cell: (r) => <PatientCell name={r.patient_name} href={`/chart/${r.patient_id}`} />,
    },
    {
      key: "payer", header: "Payer", headerAr: "الجهة الدافعة", hideBelow: "md",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate max-w-[160px]">{r.payer_name}</div>
          {r.policy_number && <div className="text-micro text-muted-foreground tabular-nums">{r.policy_number}</div>}
        </div>
      ),
    },
    {
      key: "type", header: "Type", headerAr: "النوع", hideBelow: "lg",
      cell: (r) => <Pill tone="neutral">{ar ? CLAIM_TYPE_LABEL[r.claim_type].ar : CLAIM_TYPE_LABEL[r.claim_type].en}</Pill>,
    },
    {
      key: "claimed", header: "Claimed", headerAr: "المُطالَب به", align: "end",
      cell: (r) => <span className="text-caption text-muted-foreground tabular-nums whitespace-nowrap">{fmtMoney(r.claimed_amount, r.currency, ar)}</span>,
      sortValue: (r) => r.claimed_amount,
    },
    {
      key: "approved", header: "Approved", headerAr: "المعتمد", align: "end", hideBelow: "lg",
      cell: (r) => <span className="text-caption text-muted-foreground tabular-nums whitespace-nowrap">{fmtMoney(r.approved_amount, r.currency, ar)}</span>,
      sortValue: (r) => r.approved_amount ?? -1,
    },
    {
      key: "paid", header: "Paid", headerAr: "المدفوع", align: "end",
      cell: (r) => <span className="font-semibold text-foreground tabular-nums whitespace-nowrap" style={serif}>{fmtMoney(r.paid_amount, r.currency, ar)}</span>,
      sortValue: (r) => r.paid_amount ?? -1,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة",
      cell: (r) => <StatusPill map={CLAIM_STATUS} value={r.status} />,
    },
    {
      key: "ar_days", header: "AR days", headerAr: "أيام الاستحقاق", align: "end", hideBelow: "md",
      cell: (r) => (
        <span className={`text-caption font-medium tabular-nums whitespace-nowrap ${
          r.ar_days !== null && r.ar_days > AR_DAYS_WARN ? "text-warning" : "text-muted-foreground"}`}>
          {r.ar_days ?? "—"}
        </span>
      ),
      sortValue: (r) => r.ar_days ?? -1,
    },
    {
      key: "submitted_at", header: "Submitted", headerAr: "تاريخ الإرسال", hideBelow: "lg",
      cell: (r) => <span className="text-caption text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(r.submitted_at, ar)}</span>,
      sortValue: (r) => r.submitted_at ? new Date(r.submitted_at).getTime() : -1,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Claims"
        titleAr="المطالبات"
        subtitle="Insurance claims from submission to payout."
        subtitleAr="مطالبات التأمين من الإرسال حتى السداد."
        meta={[
          { label: "Denied", labelAr: "مرفوضة", value: String(deniedCount), tone: deniedCount > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Total claimed" labelAr="إجمالي المطالبات" value={fmtMoney(totalClaimed, "SAR", ar)} icon={FileWarning} tone="brand" />
        <StatTile
          label="Denied claims" labelAr="مطالبات مرفوضة" value={deniedCount}
          icon={AlertTriangle} tone={deniedCount > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Average AR days" labelAr="متوسط أيام الاستحقاق"
          value={avgArDays !== null ? `${avgArDays}d` : "—"}
          icon={Clock} tone={avgArDays !== null && avgArDays > AR_DAYS_WARN ? "warning" : "success"}
        />
        <StatTile label="Total paid" labelAr="إجمالي المدفوع" value={fmtMoney(totalPaid, "SAR", ar)} icon={Banknote} tone="success" />
      </StatGrid>

      {denied.length > 0 && (
        <Section
          title="Denied claims"
          titleAr="المطالبات المرفوضة"
          description="Each one needs a follow-up — an appeal, a correction, or a write-off decision."
          descriptionAr="كل مطالبة تحتاج متابعة — استئناف أو تصحيح أو قرار شطب."
        >
          <ul className="divide-y divide-border/25">
            {denied.map((r) => (
              <li key={r.id} className="px-5 py-3.5 flex items-start gap-3">
                <AlertTriangle size={15} className="text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body font-semibold text-foreground" style={serif}>{r.claim_number}</span>
                    <span className="text-caption text-muted-foreground">{r.patient_name} · {r.payer_name}</span>
                    <StatusPill map={CLAIM_STATUS} value={r.status} />
                  </div>
                  <div className="text-caption text-foreground mt-1">
                    {r.denial_reason_en || r.denial_reason_ar
                      ? (ar ? (r.denial_reason_ar ?? r.denial_reason_en) : r.denial_reason_en)
                      : (ar ? "لا يوجد سبب مسجل" : "No reason recorded")}
                    {r.denial_code && <span className="text-muted-foreground"> · {r.denial_code}</span>}
                  </div>
                  <div className="text-micro text-muted-foreground mt-1 tabular-nums">
                    {ar ? "استئنافات" : "appeals"}: {r.appeal_count} · {ar ? "المُطالَب به" : "claimed"} {fmtMoney(r.claimed_amount, r.currency, ar)}
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <span className="text-body-lg font-bold text-destructive tabular-nums">
                    {fmtMoney(r.claimed_amount - (r.paid_amount ?? 0), r.currency, ar)}
                  </span>
                  <div className="text-micro text-muted-foreground mt-0.5">{ar ? "غير محصّل" : "uncollected"}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Claim #, patient, payer or policy"
          searchPlaceholderAr="رقم المطالبة أو المريض أو الجهة أو رقم الوثيقة"
          filters={[
            {
              key: "status", value: statusFilter, onChange: setStatusFilter,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(CLAIM_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "type", value: typeFilter, onChange: setTypeFilter,
              allLabel: "All types", allLabelAr: "كل الأنواع",
              options: Object.entries(CLAIM_TYPE_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "payer", value: payerFilter, onChange: setPayerFilter,
              allLabel: "All payers", allLabelAr: "كل الجهات",
              options: payerOptions,
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "مطالبة" : filtered.length === 1 ? "claim" : "claims"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          initialSort={{ key: "submitted_at", ascending: false }}
        />
      </Section>
    </Page>
  );
}
