/**
 * Roster & Cover — الجدول والتغطية
 *
 * Shift cover by department for the next fortnight, plus the leave that
 * threatens it. The screen answers one question a matron asks every morning:
 * where am I short, and who is off.
 *
 * Cover is computed against an establishment figure per department rather
 * than a headcount, because a department with ten staff and four on nights
 * is not covered by "ten".
 */

import { useMemo, useState } from "react";
import { CalendarDays, CalendarOff, AlertTriangle, Users, Clock } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, Pill, Meter, EmptyState,
  LoadingRow, useCollection, fmtDate, cardCls, serif, TONE_PILL, type Tone,
} from "@/platform/ui";

/** Minimum staff a department needs on shift to run safely. In a live system
 *  this comes from the establishment table; here it is a declared baseline. */
const ESTABLISHMENT: Record<string, number> = {
  "Intensive Care": 6,
  "Emergency Medicine": 5,
  "General Surgery": 4,
  "Cardiology": 3,
  "Paediatrics": 3,
  "Pharmacy": 2,
  "Biomedical Engineering": 2,
  "Revenue Cycle": 2,
  "Housekeeping": 3,
  "Dietary": 2,
};

const LEAVE_LABEL: Record<string, { en: string; ar: string; tone: Tone }> = {
  annual:   { en: "Annual",   ar: "سنوية",   tone: "info" },
  sick:     { en: "Sick",     ar: "مرضية",   tone: "warning" },
  training: { en: "Training", ar: "تدريب",   tone: "neutral" },
  study:    { en: "Study",    ar: "دراسية",  tone: "neutral" },
  unpaid:   { en: "Unpaid",   ar: "بدون أجر", tone: "neutral" },
  maternity:{ en: "Maternity",ar: "أمومة",   tone: "info" },
};

const DAYS_AHEAD = 14;

export default function Roster() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: staff, loading } = useCollection("staff");
  const { rows: leave } = useCollection("leave_requests");
  const { rows: attendance } = useCollection("attendance");
  const [dayOffset, setDayOffset] = useState(0);

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    }),
    [],
  );
  const selectedDay = days[dayOffset];

  /** Who is away on the selected day, by staff id. */
  const awayOn = useMemo(() => {
    const m = new Map<string, typeof leave[number]>();
    for (const l of leave) {
      if (l.status !== "approved") continue;
      if (l.start_date <= selectedDay && l.end_date >= selectedDay) m.set(l.employee_id, l);
    }
    return m;
  }, [leave, selectedDay]);

  /** Cover per department on the selected day. */
  const cover = useMemo(() => {
    const byDept = new Map<string, { total: number; away: number }>();
    for (const s of staff) {
      if (s.status === "terminated" || s.status === "inactive") continue;
      const e = byDept.get(s.department) ?? { total: 0, away: 0 };
      e.total++;
      if (awayOn.has(s.id)) e.away++;
      byDept.set(s.department, e);
    }
    return [...byDept.entries()]
      .map(([dept, v]) => {
        const onDuty = v.total - v.away;
        const required = ESTABLISHMENT[dept] ?? Math.max(1, Math.ceil(v.total * 0.6));
        return { dept, ...v, onDuty, required, short: Math.max(0, required - onDuty) };
      })
      .sort((a, b) => b.short - a.short || a.dept.localeCompare(b.dept));
  }, [staff, awayOn]);

  const shortDepts = cover.filter((c) => c.short > 0);

  const pendingLeave = leave.filter((l) => l.status === "pending");

  /** Overtime already logged this period — the cost of covering the gaps. */
  const overtimeHours = useMemo(
    () => attendance.reduce((sum, a) => sum + Number(a.overtime_hours ?? 0), 0),
    [attendance],
  );

  if (loading) return <Page><PageHeader title="Roster & Cover" titleAr="الجدول والتغطية" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Roster & Cover"
        titleAr="الجدول والتغطية"
        subtitle="Cover by department against establishment, and the leave that threatens it."
        subtitleAr="التغطية لكل قسم مقابل الملاك المعتمد، والإجازات التي تهددها."
        meta={[
          { label: "Departments short", labelAr: "أقسام ناقصة", value: String(shortDepts.length), tone: shortDepts.length > 0 ? "critical" : "success" },
          { label: "Away today", labelAr: "غائبون اليوم", value: String(awayOn.size), tone: awayOn.size > 0 ? "warning" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Active staff" labelAr="موظفون نشطون" value={staff.filter((s) => s.status === "active").length} icon={Users} tone="brand" />
        <StatTile
          label="Departments short of cover" labelAr="أقسام دون تغطية كافية" value={shortDepts.length}
          icon={AlertTriangle} tone={shortDepts.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Leave requests pending" labelAr="طلبات إجازة معلقة" value={pendingLeave.length}
          sub="Awaiting a decision" subAr="بانتظار القرار"
          icon={CalendarOff} tone={pendingLeave.length > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Overtime logged" labelAr="ساعات إضافية مسجلة" value={`${overtimeHours}h`}
          sub="Across the last 30 days" subAr="خلال آخر ٣٠ يوماً"
          icon={Clock} tone={overtimeHours > 100 ? "warning" : "neutral"}
        />
      </StatGrid>

      {/* Day selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {days.map((d, i) => {
          const date = new Date(d);
          const active = i === dayOffset;
          const isWeekend = date.getDay() === 5 || date.getDay() === 6;
          return (
            <button
              key={d} type="button" onClick={() => setDayOffset(i)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-center transition-colors
                ${active ? TONE_PILL.brand : isWeekend ? "text-muted-foreground/70 hover:bg-muted/60" : "text-muted-foreground hover:bg-muted/60"}`}
            >
              <div className="text-micro">
                {date.toLocaleDateString(ar ? "ar-SA" : "en-GB", { weekday: "short" })}
              </div>
              <div className="text-body font-semibold tabular-nums">{date.getDate()}</div>
            </button>
          );
        })}
      </div>

      <Section
        title="Cover by department"
        titleAr="التغطية حسب القسم"
        description="On duty against the establishment figure for that unit."
        descriptionAr="العدد على رأس العمل مقابل الملاك المعتمد للوحدة."
        actions={<span className="text-caption text-muted-foreground">{fmtDate(selectedDay, ar)}</span>}
      >
        <ul className="divide-y divide-border/25">
          {cover.map((c) => {
            const tone: Tone = c.short > 1 ? "critical" : c.short === 1 ? "warning" : "success";
            return (
              <li key={c.dept} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-body font-medium text-foreground truncate">{c.dept}</div>
                  <div className="text-micro text-muted-foreground tabular-nums">
                    {c.onDuty} {ar ? "على رأس العمل من" : "on duty of"} {c.total}
                    {c.away > 0 && ` · ${c.away} ${ar ? "غائب" : "away"}`}
                  </div>
                </div>
                <Meter value={c.onDuty} max={c.required} tone={tone} label={`${c.onDuty}/${c.required}`} />
                {c.short > 0 && (
                  <Pill tone={tone} icon={AlertTriangle}>
                    {ar ? `ناقص ${c.short}` : `short ${c.short}`}
                  </Pill>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Away on this day" titleAr="غائبون في هذا اليوم">
          {awayOn.size === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Everyone is in"
              titleAr="الجميع على رأس العمل"
              hint="No approved leave falls on this date."
              hintAr="لا توجد إجازات معتمدة في هذا التاريخ."
            />
          ) : (
            <ul className="divide-y divide-border/25">
              {[...awayOn.entries()].map(([staffId, l]) => {
                const person = staff.find((s) => s.id === staffId);
                const label = LEAVE_LABEL[l.leave_type] ?? { en: l.leave_type, ar: l.leave_type, tone: "neutral" as Tone };
                return (
                  <li key={l.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-body text-foreground truncate">
                        {person ? (ar ? (person.full_name_ar ?? person.full_name) : person.full_name) : staffId}
                      </div>
                      <div className="text-micro text-muted-foreground">
                        {person?.department} · {fmtDate(l.start_date, ar)} → {fmtDate(l.end_date, ar)}
                      </div>
                    </div>
                    <Pill tone={label.tone}>{ar ? label.ar : label.en}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Leave awaiting a decision"
          titleAr="إجازات بانتظار القرار"
          description="Approving these changes the cover figures above."
          descriptionAr="الموافقة على هذه الطلبات تغيّر أرقام التغطية أعلاه."
        >
          {pendingLeave.length === 0 ? (
            <EmptyState icon={CalendarOff} title="Nothing pending" titleAr="لا توجد طلبات معلقة" />
          ) : (
            <ul className="divide-y divide-border/25">
              {pendingLeave.map((l) => {
                const person = staff.find((s) => s.id === l.employee_id);
                const label = LEAVE_LABEL[l.leave_type] ?? { en: l.leave_type, ar: l.leave_type, tone: "neutral" as Tone };
                const conflict = (l.metadata as Record<string, unknown> | null)?.conflict as string | undefined;
                return (
                  <li key={l.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-body font-medium text-foreground">
                          {person ? (ar ? (person.full_name_ar ?? person.full_name) : person.full_name) : l.employee_id}
                        </div>
                        <div className="text-micro text-muted-foreground">
                          {person?.department} · {l.days} {ar ? "يوم" : "days"} · {fmtDate(l.start_date, ar)} → {fmtDate(l.end_date, ar)}
                        </div>
                        {l.reason && <div className="text-caption text-foreground/80 mt-1">{l.reason}</div>}
                        {conflict && (
                          <div className={`${cardCls} mt-2 px-3 py-2 border-warning/30`}>
                            <div className="text-micro font-semibold text-warning">
                              {ar ? "تعارض في التغطية" : "Cover conflict"}
                            </div>
                            <div className="text-caption text-foreground/80 mt-0.5">{conflict}</div>
                          </div>
                        )}
                      </div>
                      <Pill tone={label.tone}>{ar ? label.ar : label.en}</Pill>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </Page>
  );
}
