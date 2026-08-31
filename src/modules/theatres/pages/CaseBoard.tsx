/**
 * Theatre Case Board — لوحة الحالات
 *
 * Cases as a pipeline: requested → scheduled → pre-op → in theatre →
 * recovery → completed. The board is for the theatre coordinator, who needs
 * to see where every patient physically is right now, not what time their
 * slot was booked for.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Scissors, Droplet, Package, FileText, Users, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, Pill, EmptyState, LoadingRow, useCollection,
  fmtTime, fmtDuration, cardCls, serif, TONE_PILL, type Tone,
} from "@/platform/ui";

const STAGES: { id: string; en: string; ar: string; tone: Tone }[] = [
  { id: "requested",  en: "Requested",  ar: "مطلوبة",     tone: "neutral" },
  { id: "scheduled",  en: "Scheduled",  ar: "مجدولة",     tone: "info" },
  { id: "pre_op",     en: "Pre-op",     ar: "تحضير",      tone: "warning" },
  { id: "in_theatre", en: "In theatre", ar: "داخل الغرفة", tone: "critical" },
  { id: "recovery",   en: "Recovery",   ar: "الإفاقة",    tone: "info" },
  { id: "completed",  en: "Completed",  ar: "مكتملة",     tone: "success" },
];

export default function CaseBoard() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: cases, loading } = useCollection("ot_cases");
  const { rows: bloodUnits } = useCollection("blood_units");

  const byStage = useMemo(() => {
    const m = new Map<string, typeof cases>();
    for (const c of cases) {
      if (c.status === "cancelled" || c.status === "postponed") continue;
      m.set(c.status, [...(m.get(c.status) ?? []), c]);
    }
    for (const [k, v] of m) {
      m.set(k, [...v].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()));
    }
    return m;
  }, [cases]);

  const live = cases.filter((c) => ["pre_op", "in_theatre", "recovery"].includes(c.status));

  if (loading) return <Page><PageHeader title="Case Board" titleAr="لوحة الحالات" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Case Board"
        titleAr="لوحة الحالات"
        subtitle="Where every surgical patient physically is, right now."
        subtitleAr="أين يوجد كل مريض جراحي فعلياً في هذه اللحظة."
        meta={[
          { label: "Live cases", labelAr: "حالات جارية", value: String(live.length), tone: live.length > 0 ? "info" : "neutral" },
          { label: "Completed", labelAr: "مكتملة", value: String(byStage.get("completed")?.length ?? 0), tone: "success" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {STAGES.map((stage) => {
          const list = byStage.get(stage.id) ?? [];
          return (
            <Section
              key={stage.id}
              title={stage.en} titleAr={stage.ar}
              actions={
                <span className={`px-2 py-0.5 rounded-lg text-micro font-semibold tabular-nums ${TONE_PILL[stage.tone]}`}>
                  {list.length}
                </span>
              }
            >
              {list.length === 0 ? (
                <div className="px-5 py-8 text-center text-caption text-muted-foreground">
                  {ar ? "لا توجد حالات" : "No cases"}
                </div>
              ) : (
                <div className="p-3 space-y-2.5">
                  {list.map((c) => {
                    const reserved = bloodUnits.filter(
                      (u) => u.reserved_for_patient_id === c.patient_id && (u.status === "crossmatched" || u.status === "reserved"),
                    );
                    const implants = (c.implants_used as unknown[] | null) ?? [];
                    const checklist = c.checklist as { sign_in?: { completed: boolean }; time_out?: { completed: boolean } } | null;
                    const missingSignIn = c.status !== "scheduled" && c.status !== "requested" && !checklist?.sign_in?.completed;

                    return (
                      <div key={c.id} className={`${cardCls} p-3 space-y-2 ${missingSignIn ? "border-warning/40" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/chart/${c.patient_id}`} className="text-body font-medium text-foreground hover:text-brand-ink transition-colors truncate block">
                              {c.patient_name}
                            </Link>
                            <div className="text-micro text-muted-foreground tabular-nums">{c.patient_mrn}</div>
                          </div>
                          <span className="text-micro text-muted-foreground tabular-nums shrink-0">{c.theatre}</span>
                        </div>

                        <p className="text-caption text-foreground/85 line-clamp-2">
                          {ar ? (c.procedure_ar ?? c.procedure_en) : c.procedure_en}
                          {c.laterality && c.laterality !== "na" && (
                            <span className="text-warning font-medium"> · {c.laterality}</span>
                          )}
                        </p>

                        <div className="text-micro text-muted-foreground inline-flex items-center gap-1">
                          <Users size={10} />{c.surgeon_name}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.urgency !== "elective" && <Pill tone="warning">{c.urgency}</Pill>}
                          {reserved.length > 0 && (
                            <Pill tone="critical" icon={Droplet}>{reserved.length} {ar ? "وحدة" : "units"}</Pill>
                          )}
                          {implants.length > 0 && <Pill tone="info" icon={Package}>{ar ? "غرسة" : "Implant"}</Pill>}
                          {c.specimen_sent && <Pill tone="neutral" icon={FileText}>{ar ? "عينة" : "Specimen"}</Pill>}
                          {missingSignIn && (
                            <Pill tone="warning" icon={AlertTriangle}>{ar ? "التحقق الأول ناقص" : "Sign-in missing"}</Pill>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/25 text-micro text-muted-foreground tabular-nums">
                          <span>
                            {c.actual_start
                              ? `${ar ? "بدأت" : "started"} ${fmtTime(c.actual_start, ar)}`
                              : `${ar ? "مجدولة" : "listed"} ${fmtTime(c.scheduled_start, ar)}`}
                          </span>
                          {c.duration_minutes
                            ? <span>{fmtDuration(c.duration_minutes, ar)}</span>
                            : c.estimated_blood_loss_ml
                              ? <span>{c.estimated_blood_loss_ml} mL</span>
                              : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          );
        })}
      </div>

      {cases.filter((c) => c.status === "cancelled" || c.status === "postponed").length > 0 && (
        <Section title="Off the list" titleAr="خارج القائمة" description="Cancelled and postponed cases still need rebooking." descriptionAr="الحالات الملغاة والمؤجلة تحتاج إعادة جدولة.">
          <ul className="divide-y divide-border/25">
            {cases.filter((c) => c.status === "cancelled" || c.status === "postponed").map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                <Scissors size={14} className="text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-body text-foreground truncate">
                    {ar ? (c.procedure_ar ?? c.procedure_en) : c.procedure_en} · {c.patient_name}
                  </div>
                  {c.cancellation_reason && (
                    <div className="text-micro text-muted-foreground truncate">{c.cancellation_reason}</div>
                  )}
                </div>
                <Pill tone="critical">{c.status}</Pill>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
