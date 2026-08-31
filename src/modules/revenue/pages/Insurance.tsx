/**
 * Insurance — التأمين
 *
 * The patient insurance / eligibility registry. Coverage that looks active
 * but has already lapsed is the quiet failure mode here — a policy still
 * marked "active" past its own end date will get billed against and denied
 * later, so that mismatch is surfaced as its own stat rather than left for
 * claims to discover.
 */

import { useState, useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield, CalendarClock } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, StatusPill, PatientCell, Meter,
  useCollection, matches, fmtDate, fmtMoney, type Column, type StatusMap,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type InsurancePolicy = Database["public"]["Tables"]["insurance_policies"]["Row"];

const COVERAGE_RANK_STATUS: StatusMap = {
  primary: { en: "Primary", ar: "أساسي", tone: "brand" },
  secondary: { en: "Secondary", ar: "ثانوي", tone: "info" },
  tertiary: { en: "Tertiary", ar: "ثالث", tone: "neutral" },
};

const ELIGIBILITY_STATUS: StatusMap = {
  verified: { en: "Verified", ar: "تم التحقق", tone: "success" },
  pending: { en: "Pending", ar: "قيد التحقق", tone: "warning" },
  inactive: { en: "Inactive", ar: "غير فعّال", tone: "neutral" },
  rejected: { en: "Rejected", ar: "مرفوض", tone: "critical" },
  unknown: { en: "Unknown", ar: "غير معروف", tone: "neutral" },
};

const POLICY_STATUS: StatusMap = {
  active: { en: "Active", ar: "فعّالة", tone: "success" },
  expired: { en: "Expired", ar: "منتهية", tone: "warning" },
  cancelled: { en: "Cancelled", ar: "ملغاة", tone: "critical" },
  suspended: { en: "Suspended", ar: "موقوفة", tone: "warning" },
};

export default function Insurance() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows, loading } = useCollection("insurance_policies");
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const now = Date.now();
  const isLapsed = (r: InsurancePolicy) => !!r.effective_to && new Date(r.effective_to).getTime() < now;

  const activeCount = useMemo(() => rows.filter((r) => r.status === "active").length, [rows]);
  const verifiedCount = useMemo(() => rows.filter((r) => r.eligibility_status === "verified").length, [rows]);
  const needsAttention = useMemo(
    () => rows.filter((r) => r.eligibility_status === "pending" || r.eligibility_status === "rejected" || r.eligibility_status === "unknown"),
    [rows],
  );
  const rejectedCount = useMemo(() => rows.filter((r) => r.eligibility_status === "rejected").length, [rows]);
  const preAuthCount = useMemo(() => rows.filter((r) => r.requires_pre_auth).length, [rows]);
  const lapsedButActive = useMemo(() => rows.filter((r) => r.status === "active" && isLapsed(r)), [rows, now]);

  const filtered = useMemo(
    () => rows.filter((r) =>
      (!rankFilter || r.coverage_rank === rankFilter)
      && (!eligibilityFilter || r.eligibility_status === eligibilityFilter)
      && (!statusFilter || r.status === statusFilter)
      && matches(search, r.patient_name, r.payer_name, r.plan_name, r.policy_number)),
    [rows, rankFilter, eligibilityFilter, statusFilter, search],
  );

  const columns: Column<InsurancePolicy>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      cell: (r) => <PatientCell name={r.patient_name} href={`/chart/${r.patient_id}`} />,
    },
    {
      key: "payer", header: "Payer", headerAr: "الجهة الدافعة",
      cell: (r) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate max-w-[160px]">{r.payer_name}</div>
          {r.plan_name && <div className="text-micro text-muted-foreground truncate max-w-[160px]">{r.plan_name}</div>}
        </div>
      ),
    },
    {
      key: "policy_number", header: "Policy #", headerAr: "رقم الوثيقة", hideBelow: "md",
      cell: (r) => <span className="font-mono text-caption text-foreground whitespace-nowrap">{r.policy_number}</span>,
    },
    {
      key: "rank", header: "Rank", headerAr: "الترتيب",
      cell: (r) => <StatusPill map={COVERAGE_RANK_STATUS} value={r.coverage_rank} />,
    },
    {
      key: "period", header: "Coverage period", headerAr: "فترة التغطية", hideBelow: "lg",
      cell: (r) => {
        const lapsed = isLapsed(r);
        return (
          <span className={`text-caption tabular-nums whitespace-nowrap ${lapsed ? "text-destructive font-medium" : "text-muted-foreground"}`}>
            {fmtDate(r.effective_from, ar)} – {r.effective_to ? fmtDate(r.effective_to, ar) : (ar ? "مستمر" : "Ongoing")}
          </span>
        );
      },
      sortValue: (r) => new Date(r.effective_from).getTime(),
    },
    {
      key: "coverage", header: "Coverage", headerAr: "التغطية", hideBelow: "lg",
      cell: (r) => (
        <div className="min-w-[150px]">
          <div className="text-caption text-foreground tabular-nums mb-1">
            {r.coverage_percent}%
            {r.copay_amount ? ` · ${ar ? "مشاركة" : "copay"} ${fmtMoney(r.copay_amount, undefined, ar)}` : ""}
          </div>
          {r.deductible_amount ? (
            <Meter
              value={r.deductible_met ?? 0}
              max={r.deductible_amount}
              tone="brand"
              label={`${fmtMoney(r.deductible_met ?? 0, undefined, ar)}/${fmtMoney(r.deductible_amount, undefined, ar)}`}
            />
          ) : (
            <span className="text-micro text-muted-foreground">{ar ? "بدون حد أدنى" : "No deductible"}</span>
          )}
        </div>
      ),
    },
    {
      key: "eligibility", header: "Eligibility", headerAr: "الأهلية",
      cell: (r) => <StatusPill map={ELIGIBILITY_STATUS} value={r.eligibility_status} />,
    },
    {
      key: "status", header: "Policy status", headerAr: "حالة الوثيقة", hideBelow: "md",
      cell: (r) => <StatusPill map={POLICY_STATUS} value={r.status} />,
    },
    {
      key: "pre_auth", header: "Pre-auth", headerAr: "تصريح مسبق", align: "end",
      cell: (r) => r.requires_pre_auth
        ? <ShieldAlert size={15} className="text-warning" aria-label={ar ? "يتطلب تصريح مسبق" : "Requires pre-authorisation"} />
        : <span className="text-muted-foreground/40">—</span>,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Insurance"
        titleAr="التأمين"
        subtitle="Patient insurance policies and eligibility status."
        subtitleAr="وثائق تأمين المرضى وحالة الأهلية."
        meta={[
          { label: "Needs verification", labelAr: "بحاجة للتحقق", value: String(needsAttention.length), tone: needsAttention.length > 0 ? "warning" : "success" },
          { label: "Lapsed but active", labelAr: "منتهية لكن فعّالة", value: String(lapsedButActive.length), tone: lapsedButActive.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={5}>
        <StatTile label="Active policies" labelAr="وثائق فعّالة" value={activeCount} icon={Shield} tone="brand" />
        <StatTile label="Eligibility verified" labelAr="تم التحقق منها" value={verifiedCount} icon={ShieldCheck} tone="success" />
        <StatTile
          label="Needs verification" labelAr="بحاجة للتحقق" value={needsAttention.length}
          icon={ShieldQuestion} tone={rejectedCount > 0 ? "critical" : needsAttention.length > 0 ? "warning" : "success"}
        />
        <StatTile label="Requires pre-auth" labelAr="تتطلب تصريح مسبق" value={preAuthCount} icon={ShieldAlert} tone={preAuthCount > 0 ? "warning" : "neutral"} />
        <StatTile
          label="Lapsed but active" labelAr="منتهية لكن فعّالة" value={lapsedButActive.length}
          sub="Effective-to date has passed" subAr="تجاوزت تاريخ الانتهاء"
          icon={CalendarClock} tone={lapsedButActive.length > 0 ? "critical" : "success"}
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, payer, plan or policy number"
          searchPlaceholderAr="المريض أو الجهة أو الخطة أو رقم الوثيقة"
          filters={[
            {
              key: "rank", value: rankFilter, onChange: setRankFilter,
              allLabel: "All ranks", allLabelAr: "كل الترتيبات",
              options: Object.entries(COVERAGE_RANK_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "eligibility", value: eligibilityFilter, onChange: setEligibilityFilter,
              allLabel: "All eligibility", allLabelAr: "كل حالات الأهلية",
              options: Object.entries(ELIGIBILITY_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "status", value: statusFilter, onChange: setStatusFilter,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(POLICY_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "وثيقة" : filtered.length === 1 ? "policy" : "policies"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          initialSort={{ key: "period", ascending: false }}
        />
      </Section>
    </Page>
  );
}
