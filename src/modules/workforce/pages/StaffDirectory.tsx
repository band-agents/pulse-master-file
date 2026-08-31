/**
 * Staff Directory — دليل الموظفين
 *
 * Everyone the hospital employs, clinical and non-clinical. Distinct from the
 * provider register: a provider is someone who may sign orders, a staff member
 * is someone on the payroll, and the overlap is partial in both directions —
 * a porter is staff and not a provider, a visiting surgeon is a provider and
 * not on payroll.
 */

import { useState, useMemo } from "react";
import { Users, UserCheck, CalendarOff, Stethoscope } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, DataTable, StatTile, StatGrid, Pill,
  useCollection, matches, fmtDate, type Column, type Tone,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Staff = Database["public"]["Tables"]["staff"]["Row"];

const STATUS_TONE: Record<string, Tone> = {
  active: "success", on_leave: "warning", inactive: "neutral", terminated: "neutral",
};

const STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  active: { en: "Active", ar: "على رأس العمل" },
  on_leave: { en: "On leave", ar: "في إجازة" },
  inactive: { en: "Inactive", ar: "غير نشط" },
  terminated: { en: "Left", ar: "منتهية خدمته" },
};

const EMPLOYMENT_LABEL: Record<string, { en: string; ar: string }> = {
  full_time: { en: "Full time", ar: "دوام كامل" },
  part_time: { en: "Part time", ar: "دوام جزئي" },
  visiting: { en: "Visiting", ar: "زائر" },
  locum: { en: "Locum", ar: "بديل" },
  contract: { en: "Contract", ar: "متعاقد" },
};

export default function StaffDirectory() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: staff, loading } = useCollection("staff");
  const { rows: providers } = useCollection("providers");
  const { rows: leave } = useCollection("leave_requests");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");

  const departments = useMemo(
    () => [...new Set(staff.map((s) => s.department))].filter(Boolean).sort(),
    [staff],
  );

  /** Staff who also hold a provider record — i.e. can be on a clinical rota. */
  const providerByStaff = useMemo(() => {
    const m = new Map<string, typeof providers[number]>();
    for (const p of providers) if (p.employee_id) m.set(p.employee_id, p);
    return m;
  }, [providers]);

  const onLeaveNow = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Set(
      leave
        .filter((l) => l.status === "approved" && l.start_date <= today && l.end_date >= today)
        .map((l) => l.employee_id),
    );
  }, [leave]);

  const filtered = useMemo(
    () => staff.filter((s) =>
      (!department || s.department === department) &&
      (!status || s.status === status) &&
      matches(search, s.full_name, s.full_name_ar, s.employee_number, s.job_title, s.email)),
    [staff, search, department, status],
  );

  const clinical = staff.filter((s) => providerByStaff.has(s.id)).length;

  const columns: Column<Staff>[] = [
    {
      key: "name", header: "Name", headerAr: "الاسم",
      sortValue: (s) => s.full_name,
      cell: (s) => (
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground truncate">
            {ar ? (s.full_name_ar ?? s.full_name) : s.full_name}
          </div>
          <div className="text-micro text-muted-foreground tabular-nums">{s.employee_number}</div>
        </div>
      ),
    },
    {
      key: "role", header: "Role", headerAr: "الوظيفة",
      cell: (s) => (
        <div className="min-w-0">
          <div className="text-body text-foreground truncate">
            {ar ? (s.job_title_ar ?? s.job_title ?? "—") : (s.job_title ?? "—")}
          </div>
          <div className="text-micro text-muted-foreground">{s.department}</div>
        </div>
      ),
    },
    {
      key: "employment", header: "Contract", headerAr: "التعاقد", hideBelow: "md",
      cell: (s) => (
        <Pill tone="neutral">
          {ar
            ? (EMPLOYMENT_LABEL[s.employment_type]?.ar ?? s.employment_type)
            : (EMPLOYMENT_LABEL[s.employment_type]?.en ?? s.employment_type)}
        </Pill>
      ),
    },
    {
      key: "clinical", header: "Clinical", headerAr: "سريري", hideBelow: "lg",
      cell: (s) => {
        const p = providerByStaff.get(s.id);
        if (!p) return <span className="text-micro text-muted-foreground">—</span>;
        return (
          <Pill tone={p.can_prescribe ? "brand" : "neutral"} icon={Stethoscope}>
            {p.can_prescribe ? (ar ? "يصف الأدوية" : "Prescriber") : (ar ? "مقدم خدمة" : "Provider")}
          </Pill>
        );
      },
    },
    {
      key: "hired", header: "Joined", headerAr: "تاريخ الالتحاق", hideBelow: "lg",
      sortValue: (s) => s.hire_date ?? "",
      cell: (s) => <span className="text-body text-muted-foreground">{fmtDate(s.hire_date, ar)}</span>,
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (s) => {
        const away = onLeaveNow.has(s.id);
        const key = away ? "on_leave" : s.status;
        return (
          <Pill tone={STATUS_TONE[key] ?? "neutral"}>
            {ar ? (STATUS_LABEL[key]?.ar ?? key) : (STATUS_LABEL[key]?.en ?? key)}
          </Pill>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Staff Directory"
        titleAr="دليل الموظفين"
        subtitle="Everyone on the payroll. Clinical privileges live in the provider register, not here."
        subtitleAr="جميع الموظفين على كشوف الرواتب. الصلاحيات السريرية في سجل مقدمي الخدمة لا هنا."
      />

      <StatGrid cols={4}>
        <StatTile label="On the payroll" labelAr="على كشوف الرواتب" value={staff.length} icon={Users} tone="brand" />
        <StatTile
          label="Clinical staff" labelAr="كوادر سريرية" value={clinical}
          sub="Hold a provider record" subAr="لديهم سجل مقدم خدمة"
          icon={Stethoscope} tone="info"
        />
        <StatTile
          label="Away today" labelAr="غائبون اليوم" value={onLeaveNow.size}
          icon={CalendarOff} tone={onLeaveNow.size > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Departments" labelAr="الأقسام" value={departments.length}
          icon={UserCheck} tone="neutral"
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Name, staff number, job title"
          searchPlaceholderAr="الاسم أو الرقم الوظيفي أو المسمى"
          filters={[
            {
              key: "department", value: department, onChange: setDepartment,
              allLabel: "All departments", allLabelAr: "كل الأقسام",
              options: departments.map((d) => ({ value: d, en: d, ar: d })),
            },
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(STATUS_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "موظف" : filtered.length === 1 ? "person" : "people"}
          </span>
        </FilterBar>
        <DataTable rows={filtered} columns={columns} loading={loading} initialSort={{ key: "name", ascending: true }} />
      </Section>
    </Page>
  );
}
