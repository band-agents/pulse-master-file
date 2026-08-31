/**
 * Medication Administration Record — سجل إعطاء الدواء
 *
 * The MAR is a safety document, not a task list. Two design consequences:
 * a dose that was not given is as prominent as one that was, and a missed
 * dose is never silently dropped from the view. `missed` is set by the
 * scheduler rather than by a nurse, so it is evidence rather than an opinion.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Syringe, Check, X, Clock, AlertTriangle, ShieldAlert, Users } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, StatTile, StatGrid, Pill, EmptyState,
  useCollection, matches, fmtTime, fmtDateTime, minutesSince, fmtDuration,
  cardCls, serif, type Tone,
} from "@/platform/ui";

const STATUS_TONE: Record<string, Tone> = {
  given: "success", due: "info", missed: "critical",
  refused: "warning", held: "warning", not_required: "neutral",
};

const STATUS_LABEL: Record<string, { en: string; ar: string; icon: React.ElementType }> = {
  given:        { en: "Given",        ar: "أُعطي",      icon: Check },
  due:          { en: "Due",          ar: "مستحق",      icon: Clock },
  missed:       { en: "Missed",       ar: "فائت",       icon: AlertTriangle },
  refused:      { en: "Refused",      ar: "رفض المريض", icon: X },
  held:         { en: "Held",         ar: "موقوف",      icon: Clock },
  not_required: { en: "Not required", ar: "غير مطلوب",  icon: X },
};

export default function MedicationRecord() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: mar, loading } = useCollection("med_administrations");
  const { rows: encounters } = useCollection("encounters");
  const { rows: orders } = useCollection("clinical_orders");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const due = mar.filter((m) => m.status === "due");
  const overdue = due.filter((m) => minutesSince(m.scheduled_at) > 60);
  const missed = mar.filter((m) => m.status === "missed");
  const given = mar.filter((m) => m.status === "given");

  /** Group by patient — the round is walked patient by patient, not drug by drug. */
  const byPatient = useMemo(() => {
    const m = new Map<string, { name: string; bed: string | null; rows: typeof mar }>();
    for (const row of mar) {
      if (status && row.status !== status) continue;
      const enc = encounters.find((e) => e.id === row.encounter_id);
      const name = enc?.patient_name ?? row.patient_id;
      if (!matches(search, name, row.drug_name, enc?.bed_label)) continue;
      const g = m.get(row.patient_id) ?? { name, bed: enc?.bed_label ?? null, rows: [] };
      g.rows.push(row);
      m.set(row.patient_id, g);
    }
    // Patients with something outstanding come first.
    return [...m.entries()]
      .map(([id, g]) => ({
        id, ...g,
        rows: [...g.rows].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
        outstanding: g.rows.filter((r) => r.status === "due" || r.status === "missed").length,
      }))
      .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name));
  }, [mar, encounters, search, status]);

  return (
    <Page>
      <PageHeader
        title="Medication Record"
        titleAr="سجل إعطاء الدواء"
        subtitle="Scheduled doses per patient. Doses not given stay visible — the record is evidence, not a task list."
        subtitleAr="الجرعات المجدولة لكل مريض. الجرعات غير المعطاة تبقى ظاهرة — السجل دليل وليس قائمة مهام."
        meta={[
          { label: "Due now", labelAr: "مستحق الآن", value: String(due.length), tone: due.length > 0 ? "info" : "success" },
          { label: "Overdue", labelAr: "متأخر", value: String(overdue.length), tone: overdue.length > 0 ? "critical" : "success" },
          { label: "Missed", labelAr: "فائت", value: String(missed.length), tone: missed.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile label="Doses due" labelAr="جرعات مستحقة" value={due.length} icon={Clock} tone={due.length > 0 ? "info" : "success"} />
        <StatTile
          label="Overdue by an hour" labelAr="متأخر أكثر من ساعة" value={overdue.length}
          icon={AlertTriangle} tone={overdue.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Missed doses" labelAr="جرعات فائتة" value={missed.length}
          sub="Flagged by the scheduler" subAr="مؤشرة آلياً من النظام"
          icon={AlertTriangle} tone={missed.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Given today" labelAr="أُعطيت اليوم" value={given.length}
          sub={`${given.filter((g) => g.witnessed_by).length} double-checked`}
          subAr={`${given.filter((g) => g.witnessed_by).length} بتحقق مزدوج`}
          icon={Check} tone="success"
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Patient, drug or bed"
          searchPlaceholderAr="المريض أو الدواء أو السرير"
          filters={[{
            key: "status", value: status, onChange: setStatus,
            allLabel: "All statuses", allLabelAr: "كل الحالات",
            options: Object.entries(STATUS_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
          }]}
        />

        {byPatient.length === 0 ? (
          <EmptyState
            icon={Syringe}
            title="No scheduled doses match"
            titleAr="لا توجد جرعات مطابقة"
            hint="Try clearing the status filter — given and not-required doses are included by default."
            hintAr="جرّب مسح فلتر الحالة — الجرعات المعطاة وغير المطلوبة مشمولة افتراضياً."
          />
        ) : (
          <div className="p-4 space-y-3">
            {byPatient.map((p) => (
              <div key={p.id} className={cardCls}>
                <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-border/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Link href={`/chart/${p.id}`} className="text-body font-semibold text-foreground hover:text-brand-ink transition-colors" style={serif}>
                      {p.name}
                    </Link>
                    {p.bed && <Pill tone="neutral">{p.bed}</Pill>}
                  </div>
                  {p.outstanding > 0 && (
                    <Pill tone="warning">
                      {p.outstanding} {ar ? "قائم" : p.outstanding === 1 ? "outstanding" : "outstanding"}
                    </Pill>
                  )}
                </div>
                <ul className="divide-y divide-border/25">
                  {p.rows.map((m) => {
                    const label = STATUS_LABEL[m.status] ?? { en: m.status, ar: m.status, icon: Clock };
                    const tone = STATUS_TONE[m.status] ?? "neutral";
                    const order = orders.find((o) => o.id === m.order_id);
                    const lateBy = m.status === "due" ? minutesSince(m.scheduled_at) : 0;
                    return (
                      <li key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                        <span className="text-body font-medium text-foreground tabular-nums w-14 shrink-0">
                          {fmtTime(m.scheduled_at, ar)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-body text-foreground">{m.drug_name}</span>
                            <span className="text-caption text-muted-foreground">{m.dose} · {m.route.toUpperCase()}</span>
                            {order?.prn && <Pill tone="info">PRN</Pill>}
                            {m.witnessed_by && <Pill tone="neutral" icon={Users}>{ar ? "تحقق مزدوج" : "Witnessed"}</Pill>}
                            {(m.metadata as Record<string, unknown> | null)?.controlled_register_entry ? (
                              <Pill tone="warning" icon={ShieldAlert}>{ar ? "دواء مراقب" : "Controlled"}</Pill>
                            ) : null}
                          </div>
                          {m.administered_by && (
                            <div className="text-micro text-muted-foreground">
                              {ar ? "أعطاه" : "given by"} {m.administered_by} · {fmtDateTime(m.administered_at, ar)}
                              {m.site && ` · ${m.site}`}
                            </div>
                          )}
                          {m.hold_reason && (
                            <div className="text-micro text-warning">{m.hold_reason}</div>
                          )}
                          {(m.metadata as Record<string, unknown> | null)?.note ? (
                            <div className="text-micro text-destructive">
                              {String((m.metadata as Record<string, unknown>).note)}
                            </div>
                          ) : null}
                        </div>
                        {lateBy > 60 && (
                          <span className="text-micro text-destructive tabular-nums shrink-0">
                            +{fmtDuration(lateBy, ar)}
                          </span>
                        )}
                        <Pill tone={tone} icon={label.icon}>{ar ? label.ar : label.en}</Pill>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}
