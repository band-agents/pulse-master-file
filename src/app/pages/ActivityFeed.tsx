/**
 * Activity Feed — النشاط
 *
 * A chronological audit trail across the system, not a worklist — so it is
 * built as a grouped timeline rather than a DataTable. Grouping by day is
 * computed client-side from `created_at`; nothing here is stored pre-grouped.
 */

import { useState, useMemo } from "react";
import {
  Activity, User, Stethoscope, Receipt, Wrench, CalendarClock, Pill,
  FlaskConical, ScanLine, BedDouble, FileText, ClipboardList, ShieldAlert,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, StatTile, StatGrid,
  Pill as StatusChip, useCollection, matches, fmtAgo, serif,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];

const ENTITY_ICON: Record<string, React.ElementType> = {
  patient: User,
  encounter: Stethoscope,
  claim: Receipt,
  invoice: Receipt,
  maintenance_order: Wrench,
  appointment: CalendarClock,
  prescription: Pill,
  lab_order: FlaskConical,
  imaging_order: ScanLine,
  bed: BedDouble,
  document: FileText,
  order: ClipboardList,
  incident: ShieldAlert,
};

function entityIcon(entityType: string): React.ElementType {
  return ENTITY_ICON[entityType] ?? Activity;
}

function entityLabel(entityType: string, ar: boolean): string {
  const en = entityType.replace(/_/g, " ");
  if (!ar) return en;
  return en; // no dedicated Arabic vocabulary per entity type — raw type is shown either way
}

function dayLabel(iso: string, ar: boolean): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return ar ? "اليوم" : "Today";
  if (d.toDateString() === yesterday.toDateString()) return ar ? "أمس" : "Yesterday";
  return d.toLocaleDateString(ar ? "ar-SA" : "en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ActivityFeed() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: events, loading } = useCollection("activity_events");

  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");

  const todayKey = new Date().toDateString();
  const todayEvents = useMemo(
    () => events.filter((e) => new Date(e.created_at).toDateString() === todayKey),
    [events, todayKey],
  );
  const distinctTypesToday = new Set(todayEvents.map((e) => e.entity_type)).size;

  const mostActiveActor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!e.actor_id) continue;
      counts.set(e.actor_id, (counts.get(e.actor_id) ?? 0) + 1);
    }
    let top: string | null = null;
    let max = 0;
    for (const [actor, n] of counts) {
      if (n > max) { max = n; top = actor; }
    }
    return top;
  }, [events]);

  const entityTypeOptions = useMemo(() => {
    const set = new Set(events.map((e) => e.entity_type));
    return [...set].sort().map((v) => ({ value: v, en: v.replace(/_/g, " "), ar: v.replace(/_/g, " ") }));
  }, [events]);

  const filtered = useMemo(
    () => events
      .filter((e) =>
        (!entityType || e.entity_type === entityType) &&
        matches(search, e.description_en, e.description_ar, e.entity_type, e.action))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events, search, entityType],
  );

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, ActivityEvent[]>();
    for (const e of filtered) {
      const label = dayLabel(e.created_at, ar);
      if (!map.has(label)) { map.set(label, []); order.push(label); }
      map.get(label)!.push(e);
    }
    return order.map((label) => ({ label, rows: map.get(label)! }));
  }, [filtered, ar]);

  return (
    <Page>
      <PageHeader
        title="Activity"
        titleAr="النشاط"
        subtitle="A chronological record of what happened across the system."
        subtitleAr="سجل زمني لما حدث عبر النظام."
      />

      <StatGrid cols={3}>
        <StatTile label="Events today" labelAr="أحداث اليوم" value={todayEvents.length} icon={Activity} tone="brand" />
        <StatTile label="Entity types today" labelAr="أنواع الكيانات اليوم" value={distinctTypesToday} icon={ClipboardList} tone="info" />
        <StatTile
          label={mostActiveActor ? "Most active actor" : "Total events"}
          labelAr={mostActiveActor ? "الأكثر نشاطاً" : "إجمالي الأحداث"}
          value={mostActiveActor ?? events.length}
          icon={User} tone="neutral"
        />
      </StatGrid>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Description, entity type or action"
          searchPlaceholderAr="الوصف أو نوع الكيان أو الإجراء"
          filters={[
            {
              key: "entityType", value: entityType, onChange: setEntityType,
              allLabel: "All entity types", allLabelAr: "كل أنواع الكيانات",
              options: entityTypeOptions,
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "نتيجة" : filtered.length === 1 ? "result" : "results"}
          </span>
        </FilterBar>

        {loading ? (
          <div className="py-12 text-center text-body text-muted-foreground">{ar ? "جاري التحميل" : "Loading"}</div>
        ) : groups.length === 0 ? (
          <div className="py-14 px-6 text-center text-body text-muted-foreground">
            {ar ? "لا توجد أحداث مطابقة." : "No matching events."}
          </div>
        ) : (
          <div className="divide-y divide-border/25">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-5 py-2 bg-muted/30 text-caption font-medium text-muted-foreground" style={serif}>
                  {g.label}
                </div>
                <ul className="divide-y divide-border/25">
                  {g.rows.map((e) => {
                    const Icon = entityIcon(e.entity_type);
                    const desc = (ar ? e.description_ar : e.description_en) ?? (ar ? e.description_en : e.description_ar) ?? e.action.replace(/_/g, " ");
                    return (
                      <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0">
                          <Icon size={14} strokeWidth={2} />
                        </span>
                        <span className="flex-1 min-w-0 text-body text-foreground truncate">{desc}</span>
                        <StatusChip tone="neutral">{entityLabel(e.entity_type, ar)}</StatusChip>
                        <span className="text-micro text-muted-foreground tabular-nums shrink-0 w-14 text-end">
                          {fmtAgo(e.created_at, ar)}
                        </span>
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
