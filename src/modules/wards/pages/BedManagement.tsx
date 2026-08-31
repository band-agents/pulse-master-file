/**
 * Bed Management — إدارة الأسرة
 *
 * The occupancy board. A bed has five states and only two of them are good
 * news, so the board is organised around the three that cost you capacity:
 * cleaning, blocked and reserved. Ward columns sort by fewest free beds,
 * because that is the ward that will ring the site manager first.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { BedDouble, SprayCan, Ban, Clock, CheckCircle2, Wind, Activity } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, StatTile, StatGrid, Pill, Meter, useCollection,
  LoadingRow, fmtAgo, fmtDuration, minutesSince, cardCls, serif,
  TONE_PILL, type Tone, type StatusMap, statusDef,
} from "@/platform/ui";

const BED_STATUS: StatusMap = {
  available: { en: "Available", ar: "متاح",        tone: "success" },
  occupied:  { en: "Occupied",  ar: "مشغول",       tone: "info" },
  cleaning:  { en: "Cleaning",  ar: "قيد التنظيف", tone: "warning" },
  blocked:   { en: "Blocked",   ar: "محجوب",       tone: "critical" },
  reserved:  { en: "Reserved",  ar: "محجوز",       tone: "neutral" },
};

const STATUS_ICON: Record<string, React.ElementType> = {
  available: CheckCircle2, occupied: BedDouble, cleaning: SprayCan, blocked: Ban, reserved: Clock,
};

export default function BedManagement() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: beds, loading } = useCollection("beds");
  const { rows: wards } = useCollection("wards");
  const { rows: encounters } = useCollection("encounters");
  const { rows: housekeeping } = useCollection("housekeeping_tasks");
  const { rows: edVisits } = useCollection("ed_visits");

  const [wardFilter, setWardFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const stats = useMemo(() => {
    const by = (s: string) => beds.filter((b) => b.status === s).length;
    return {
      total: beds.length,
      occupied: by("occupied"),
      available: by("available"),
      cleaning: by("cleaning"),
      blocked: by("blocked"),
      reserved: by("reserved"),
    };
  }, [beds]);

  const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
  const occupancyTone: Tone = pct >= 95 ? "critical" : pct >= 85 ? "warning" : "success";

  /** Patients admitted but with no bed yet — the demand side of the board. */
  const boarding = edVisits.filter((v) => v.boarding_since && v.status !== "departed");

  const grouped = useMemo(() => {
    const map = new Map<string, { ward: typeof wards[number] | undefined; name: string; beds: typeof beds }>();
    for (const b of beds) {
      if (wardFilter && b.ward_id !== wardFilter) continue;
      if (statusFilter && b.status !== statusFilter) continue;
      const g = map.get(b.ward_id) ?? { ward: wards.find((w) => w.id === b.ward_id), name: b.ward_name, beds: [] };
      g.beds.push(b);
      map.set(b.ward_id, g);
    }
    return [...map.values()]
      .map((g) => ({ ...g, beds: [...g.beds].sort((a, b) => a.label.localeCompare(b.label)) }))
      .sort((a, b) => {
        const af = a.beds.filter((x) => x.status === "available").length;
        const bf = b.beds.filter((x) => x.status === "available").length;
        return af - bf;
      });
  }, [beds, wards, wardFilter, statusFilter]);

  if (loading) return <Page><PageHeader title="Bed Management" titleAr="إدارة الأسرة" /><LoadingRow /></Page>;

  return (
    <Page>
      <PageHeader
        title="Bed Management"
        titleAr="إدارة الأسرة"
        subtitle="Live occupancy across every ward. Wards with the fewest free beds appear first."
        subtitleAr="الإشغال المباشر لكل الأجنحة. الأجنحة الأقل توفراً تظهر أولاً."
        meta={[
          { label: "Occupancy", labelAr: "نسبة الإشغال", value: `${pct}%`, tone: occupancyTone },
          { label: "Awaiting a bed", labelAr: "بانتظار سرير", value: String(boarding.length), tone: boarding.length > 0 ? "critical" : "success" },
        ]}
      />

      <StatGrid cols={5}>
        <StatTile label="Occupied" labelAr="مشغول" value={stats.occupied} sub={`of ${stats.total} beds`} subAr={`من ${stats.total} سرير`} tone={occupancyTone} icon={BedDouble} />
        <StatTile label="Available now" labelAr="متاح الآن" value={stats.available} tone={stats.available === 0 ? "critical" : "success"} icon={CheckCircle2} />
        <StatTile label="Being cleaned" labelAr="قيد التنظيف" value={stats.cleaning} sub="Capacity you get back soon" subAr="سعة ستعود قريباً" tone="warning" icon={SprayCan} href="/housekeeping" />
        <StatTile label="Blocked" labelAr="محجوب" value={stats.blocked} sub="Not usable at all" subAr="غير قابل للاستخدام" tone={stats.blocked > 0 ? "critical" : "neutral"} icon={Ban} />
        <StatTile label="Reserved" labelAr="محجوز" value={stats.reserved} tone="neutral" icon={Clock} />
      </StatGrid>

      {boarding.length > 0 && (
        <Section title="Waiting for a bed" titleAr="بانتظار سرير" description="Admitted from the emergency department but not yet placed." descriptionAr="تم قبولهم من الطوارئ ولم يُخصص لهم سرير بعد.">
          <ul className="divide-y divide-border/25">
            {boarding.map((v) => (
              <li key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-body font-medium text-foreground">{v.patient_name}</div>
                  <div className="text-micro text-muted-foreground tabular-nums">{v.patient_mrn} · {v.area}</div>
                </div>
                <Pill tone={minutesSince(v.boarding_since) > 240 ? "critical" : "warning"} icon={Clock}>
                  {ar ? "بانتظار" : "waiting"} {fmtDuration(minutesSince(v.boarding_since), ar)}
                </Pill>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={wardFilter} onChange={(e) => setWardFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20"
        >
          <option value="">{ar ? "كل الأجنحة" : "All wards"}</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{ar ? (w.name_ar ?? w.name_en) : w.name_en}</option>)}
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(BED_STATUS).map(([value, def]) => {
            const active = statusFilter === value;
            return (
              <button
                key={value} type="button"
                onClick={() => setStatusFilter(active ? "" : value)}
                className={`inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-caption font-medium transition-colors
                  ${active ? TONE_PILL[def.tone] : "text-muted-foreground hover:bg-muted/60"}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-current" : ""}`} style={!active ? { background: "currentColor", opacity: 0.4 } : undefined} aria-hidden />
                {ar ? def.ar : def.en}
                <span className="tabular-nums opacity-70">{beds.filter((b) => b.status === value).length}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ward boards */}
      <div className="space-y-5">
        {grouped.map((g) => {
          const free = g.beds.filter((b) => b.status === "available").length;
          const occ = g.beds.filter((b) => b.status === "occupied").length;
          const tone: Tone = free === 0 ? "critical" : free <= 1 ? "warning" : "success";
          return (
            <Section
              key={g.name}
              title={g.name}
              titleAr={ar ? (g.ward?.name_ar ?? g.name) : g.name}
              description={g.ward ? `${g.ward.ward_type.toUpperCase()} · ${g.ward.speciality ?? ""}` : undefined}
              descriptionAr={g.ward ? `${g.ward.ward_type.toUpperCase()} · ${g.ward.speciality ?? ""}` : undefined}
              actions={
                <div className="flex items-center gap-3">
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {occ}/{g.beds.length} {ar ? "مشغول" : "occupied"}
                  </span>
                  <Meter value={occ} max={g.beds.length} tone={tone} />
                </div>
              }
            >
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                {g.beds.map((b) => {
                  const def = statusDef(BED_STATUS, b.status);
                  const Icon = STATUS_ICON[b.status] ?? BedDouble;
                  const enc = b.current_encounter_id ? encounters.find((e) => e.id === b.current_encounter_id) : undefined;
                  const clean = b.status === "cleaning"
                    ? housekeeping.find((t) => t.bed_id === b.id && t.status !== "completed" && t.status !== "verified")
                    : undefined;
                  const blockedReason = (b.metadata as Record<string, unknown> | null)?.blocked_reason as string | undefined;

                  const card = (
                    <div className={`${cardCls} p-3 h-full flex flex-col gap-1.5 ${enc ? "hover:border-border transition-colors" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-body font-semibold text-foreground tabular-nums" style={serif}>{b.label}</span>
                        <span className={`w-5 h-5 rounded-md grid place-items-center ${TONE_PILL[def.tone]}`}>
                          <Icon size={11} strokeWidth={2.2} />
                        </span>
                      </div>
                      <div className="text-micro text-muted-foreground">{ar ? def.ar : def.en}</div>

                      {enc && (
                        <>
                          <div className="text-caption text-foreground font-medium truncate">{enc.patient_name}</div>
                          <div className="text-micro text-muted-foreground tabular-nums truncate">
                            {enc.patient_mrn} · {fmtAgo(b.occupied_since, ar)}
                          </div>
                        </>
                      )}
                      {b.status === "occupied" && !enc && b.current_patient_name && (
                        <div className="text-caption text-muted-foreground truncate">{b.current_patient_name}</div>
                      )}
                      {clean && (
                        <div className="text-micro text-warning">
                          {clean.assigned_to ?? (ar ? "لم يُسند بعد" : "unassigned")} · {fmtAgo(clean.requested_at, ar)}
                        </div>
                      )}
                      {blockedReason && (
                        <div className="text-micro text-destructive leading-snug">{blockedReason}</div>
                      )}

                      <div className="flex items-center gap-1.5 mt-auto pt-1">
                        {b.has_oxygen && <span title={ar ? "أكسجين" : "Oxygen"}><Wind size={11} className="text-muted-foreground" /></span>}
                        {b.has_monitor && <span title={ar ? "مراقبة" : "Monitored"}><Activity size={11} className="text-muted-foreground" /></span>}
                        <span className="text-micro text-muted-foreground ms-auto">{b.bed_type}</span>
                      </div>
                    </div>
                  );

                  return enc
                    ? <Link key={b.id} href={`/chart/${enc.patient_id}`} className="block h-full">{card}</Link>
                    : <div key={b.id}>{card}</div>;
                })}
              </div>
            </Section>
          );
        })}
      </div>
    </Page>
  );
}
