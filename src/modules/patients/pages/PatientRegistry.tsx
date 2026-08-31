/**
 * Patient Registry — سجل المرضى
 *
 * The master patient index. Search is the primary interaction: staff arrive
 * here knowing a name, an MRN or a phone number, and anything that makes them
 * scroll instead of type is a failure. Merged and deceased records stay
 * findable but never appear in the default view.
 */

import { useState, useMemo } from "react";
import { Users, Plus, AlertTriangle, Star, Search as SearchIcon } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid,
  Pill, StatusPill, PatientCell, EmptyState, useCollection, matches,
  fmtDate, btnPrimary, type Column, type StatusMap,
} from "@/platform/ui";
import { formatAge } from "@/platform/clinical/scores";
import type { Database } from "@/domain/types";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

const PATIENT_STATUS: StatusMap = {
  active:   { en: "Active",   ar: "نشط",   tone: "success" },
  inactive: { en: "Inactive", ar: "غير نشط", tone: "neutral" },
  deceased: { en: "Deceased", ar: "متوفى",  tone: "neutral" },
  merged:   { en: "Merged",   ar: "مدموج",  tone: "warning" },
};

const SEX_LABEL: Record<string, { en: string; ar: string }> = {
  male: { en: "Male", ar: "ذكر" },
  female: { en: "Female", ar: "أنثى" },
  other: { en: "Other", ar: "آخر" },
  unknown: { en: "Unknown", ar: "غير معروف" },
};

export default function PatientRegistry() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: patients, loading } = useCollection("patients");
  const { rows: encounters } = useCollection("encounters");
  const { rows: allergies } = useCollection("allergies");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sex, setSex] = useState("");

  /** Patients currently inside the building, so the list can say so. */
  const admittedIds = useMemo(
    () => new Set(encounters.filter((e) => e.status === "in_progress" || e.status === "arrived").map((e) => e.patient_id)),
    [encounters],
  );

  /** Severe or fatal drug allergies — the flag that must survive any filter. */
  const highRiskAllergy = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allergies) {
      if (a.status !== "active") continue;
      if (a.severity !== "severe" && a.severity !== "fatal") continue;
      m.set(a.patient_id, (m.get(a.patient_id) ?? 0) + 1);
    }
    return m;
  }, [allergies]);

  const filtered = useMemo(
    () => patients.filter((p) =>
      (!status || p.status === status) &&
      (!sex || p.sex === sex) &&
      matches(search, p.name_en, p.name_ar, p.mrn, p.phone, p.national_id, p.email)),
    [patients, search, status, sex],
  );

  const columns: Column<Patient>[] = [
    {
      key: "patient", header: "Patient", headerAr: "المريض",
      sortValue: (p) => p.name_en,
      cell: (p) => (
        <div className="flex items-center gap-2 min-w-0">
          <PatientCell name={ar ? (p.name_ar ?? p.name_en) : p.name_en} mrn={p.mrn} />
          {p.vip_flag && <Star size={12} className="text-warning shrink-0" aria-label="VIP" />}
        </div>
      ),
    },
    {
      key: "age", header: "Age", headerAr: "العمر", hideBelow: "sm",
      sortValue: (p) => p.date_of_birth,
      cell: (p) => (
        <span className="text-body tabular-nums">
          {formatAge(p.date_of_birth, ar)}
          <span className="text-muted-foreground"> · {ar ? SEX_LABEL[p.sex].ar : SEX_LABEL[p.sex].en}</span>
        </span>
      ),
    },
    {
      key: "blood", header: "Blood", headerAr: "الفصيلة", hideBelow: "md",
      cell: (p) => p.blood_group && p.blood_group !== "unknown"
        ? <span className="text-body font-medium tabular-nums">{p.blood_group}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "flags", header: "Flags", headerAr: "تنبيهات",
      cell: (p) => {
        const n = highRiskAllergy.get(p.id) ?? 0;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {n > 0 && (
              <Pill tone="critical" icon={AlertTriangle}>
                {ar ? `حساسية شديدة` : n === 1 ? "Severe allergy" : `${n} severe allergies`}
              </Pill>
            )}
            {admittedIds.has(p.id) && <Pill tone="info">{ar ? "داخل المستشفى" : "In hospital"}</Pill>}
          </div>
        );
      },
    },
    {
      key: "phone", header: "Contact", headerAr: "التواصل", hideBelow: "lg",
      cell: (p) => <span className="text-body text-muted-foreground tabular-nums" dir="ltr">{p.phone ?? "—"}</span>,
    },
    {
      key: "registered", header: "Registered", headerAr: "تاريخ التسجيل", hideBelow: "lg",
      sortValue: (p) => p.registered_at,
      cell: (p) => <span className="text-body text-muted-foreground">{fmtDate(p.registered_at, ar)}</span>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (p) => <StatusPill map={PATIENT_STATUS} value={p.status} />,
    },
  ];

  const active = patients.filter((p) => p.status === "active");

  return (
    <Page>
      <PageHeader
        title="Patient Registry"
        titleAr="سجل المرضى"
        subtitle="The master patient index. Search by name, MRN, national ID or phone."
        subtitleAr="الفهرس الرئيسي للمرضى. ابحث بالاسم أو رقم الملف أو الهوية أو الهاتف."
        actions={
          <button type="button" className={btnPrimary}>
            <Plus size={14} /> {ar ? "تسجيل مريض" : "Register patient"}
          </button>
        }
      />

      <StatGrid cols={4}>
        <StatTile label="Active patients" labelAr="مرضى نشطون" value={active.length} icon={Users} tone="brand" />
        <StatTile
          label="Currently admitted" labelAr="منومون حالياً" value={admittedIds.size}
          sub="Inpatient, ED or day case" subAr="تنويم أو طوارئ أو حالة يومية" icon={Users} tone="info"
        />
        <StatTile
          label="High-risk allergies" labelAr="حساسية عالية الخطورة" value={highRiskAllergy.size}
          sub="Severe or fatal, on record" subAr="شديدة أو مميتة، موثقة" icon={AlertTriangle}
          tone={highRiskAllergy.size > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Registered this month" labelAr="مسجلون هذا الشهر"
          value={patients.filter((p) => Date.now() - new Date(p.registered_at).getTime() < 30 * 86_400_000).length}
          icon={Plus} tone="neutral"
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Name, MRN, national ID or phone"
          searchPlaceholderAr="الاسم أو رقم الملف أو الهوية أو الهاتف"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(PATIENT_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "sex", value: sex, onChange: setSex,
              allLabel: "Any sex", allLabelAr: "كل الأجناس",
              options: Object.entries(SEX_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "نتيجة" : filtered.length === 1 ? "result" : "results"}
          </span>
        </FilterBar>

        <DataTable
          rows={filtered}
          columns={columns}
          loading={loading}
          rowHref={(p) => `/chart/${p.id}`}
          initialSort={{ key: "patient", ascending: true }}
          empty={
            <EmptyState
              icon={SearchIcon}
              title="No patient matches that search"
              titleAr="لا يوجد مريض مطابق"
              hint="Check the spelling, or widen the status filter — merged and deceased records are hidden by default."
              hintAr="تحقق من الإملاء أو وسّع فلتر الحالة — السجلات المدموجة والمتوفاة مخفية افتراضياً."
            />
          }
        />
      </Section>
    </Page>
  );
}
