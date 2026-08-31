/**
 * Wards — الأجنحة
 *
 * The ward register: what each unit is for, how big it is, and how much of it
 * is actually usable right now. Establishment size and usable size are shown
 * separately on purpose — a 10-bed ward with two blocked bays is an 8-bed
 * ward for every decision made today.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Building2, BedDouble, Users, Ban } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, DataTable, StatTile, StatGrid, Pill, Meter,
  useCollection, type Column, type StatusMap, StatusPill,
} from "@/platform/ui";
import type { Database } from "@/domain/types";

type Ward = Database["public"]["Tables"]["wards"]["Row"];

const WARD_STATUS: StatusMap = {
  open:    { en: "Open",           ar: "مفتوح",  tone: "success" },
  partial: { en: "Partially open", ar: "جزئي",   tone: "warning" },
  closed:  { en: "Closed",         ar: "مغلق",   tone: "critical" },
};

const WARD_TYPE: Record<string, { en: string; ar: string }> = {
  general: { en: "General", ar: "عام" },
  icu: { en: "Intensive care", ar: "عناية مركزة" },
  hdu: { en: "High dependency", ar: "عناية متوسطة" },
  nicu: { en: "Neonatal ICU", ar: "عناية حديثي الولادة" },
  picu: { en: "Paediatric ICU", ar: "عناية أطفال" },
  maternity: { en: "Maternity", ar: "ولادة" },
  surgical: { en: "Surgical", ar: "جراحة" },
  isolation: { en: "Isolation", ar: "عزل" },
  psychiatric: { en: "Psychiatric", ar: "نفسي" },
  day_care: { en: "Day care", ar: "رعاية نهارية" },
};

export default function Wards() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: wards, loading } = useCollection("wards");
  const { rows: beds } = useCollection("beds");
  const { rows: providers } = useCollection("providers");

  /** Bed counts per ward, computed from the beds themselves rather than the
   *  ward's declared `bed_count` — the two drift, and the beds are the truth. */
  const load = useMemo(() => {
    const m = new Map<string, { total: number; occupied: number; available: number; blocked: number; cleaning: number }>();
    for (const b of beds) {
      const w = m.get(b.ward_id) ?? { total: 0, occupied: 0, available: 0, blocked: 0, cleaning: 0 };
      w.total++;
      if (b.status === "occupied") w.occupied++;
      if (b.status === "available") w.available++;
      if (b.status === "blocked") w.blocked++;
      if (b.status === "cleaning") w.cleaning++;
      m.set(b.ward_id, w);
    }
    return m;
  }, [beds]);

  const totals = useMemo(() => {
    const t = { total: 0, occupied: 0, blocked: 0 };
    for (const v of load.values()) { t.total += v.total; t.occupied += v.occupied; t.blocked += v.blocked; }
    return t;
  }, [load]);

  const columns: Column<Ward>[] = [
    {
      key: "ward", header: "Ward", headerAr: "الجناح",
      sortValue: (w) => w.name_en,
      cell: (w) => (
        <div className="min-w-0">
          <div className="text-body font-medium text-foreground truncate">{ar ? (w.name_ar ?? w.name_en) : w.name_en}</div>
          <div className="text-micro text-muted-foreground tabular-nums">{w.code} · {ar ? "الطابق" : "floor"} {w.floor ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "type", header: "Type", headerAr: "النوع", hideBelow: "sm",
      cell: (w) => <Pill tone="neutral">{ar ? (WARD_TYPE[w.ward_type]?.ar ?? w.ward_type) : (WARD_TYPE[w.ward_type]?.en ?? w.ward_type)}</Pill>,
    },
    {
      key: "speciality", header: "Speciality", headerAr: "التخصص", hideBelow: "lg",
      cell: (w) => <span className="text-body text-muted-foreground">{w.speciality ?? "—"}</span>,
    },
    {
      key: "charge", header: "Charge nurse", headerAr: "رئيس التمريض", hideBelow: "lg",
      cell: (w) => {
        const n = providers.find((p) => p.id === w.charge_nurse_id);
        return <span className="text-body text-muted-foreground">{n ? (ar ? (n.name_ar ?? n.name_en) : n.name_en) : "—"}</span>;
      },
    },
    {
      key: "capacity", header: "Usable capacity", headerAr: "السعة القابلة للاستخدام",
      sortValue: (w) => load.get(w.id)?.available ?? 0,
      cell: (w) => {
        const l = load.get(w.id) ?? { total: 0, occupied: 0, available: 0, blocked: 0, cleaning: 0 };
        const usable = l.total - l.blocked;
        const tone = l.available === 0 ? "critical" : l.available <= 1 ? "warning" : "success";
        return (
          <div className="flex items-center gap-3 min-w-[190px]">
            <Meter value={l.occupied} max={usable || 1} tone={tone} label={`${l.occupied}/${usable}`} />
            {l.blocked > 0 && <Pill tone="critical" icon={Ban}>{l.blocked}</Pill>}
          </div>
        );
      },
    },
    {
      key: "free", header: "Free", headerAr: "شاغر", align: "end",
      sortValue: (w) => load.get(w.id)?.available ?? 0,
      cell: (w) => {
        const a = load.get(w.id)?.available ?? 0;
        return <span className={`text-body font-semibold tabular-nums ${a === 0 ? "text-destructive" : ""}`}>{a}</span>;
      },
    },
    {
      key: "status", header: "Status", headerAr: "الحالة", align: "end",
      cell: (w) => <StatusPill map={WARD_STATUS} value={w.status} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Wards"
        titleAr="الأجنحة"
        subtitle="Establishment and usable capacity per unit. Blocked bays are excluded from usable capacity."
        subtitleAr="السعة المعتمدة والقابلة للاستخدام لكل وحدة. الأسرة المحجوبة مستثناة من السعة القابلة للاستخدام."
      />

      <StatGrid cols={4}>
        <StatTile label="Wards" labelAr="عدد الأجنحة" value={wards.length} icon={Building2} tone="brand" />
        <StatTile label="Total beds" labelAr="إجمالي الأسرة" value={totals.total} icon={BedDouble} tone="neutral" />
        <StatTile label="Inpatients" labelAr="المنومون" value={totals.occupied} icon={Users} tone="info" />
        <StatTile
          label="Beds out of use" labelAr="أسرة خارج الخدمة" value={totals.blocked}
          sub="Excluded from capacity" subAr="مستثناة من السعة"
          icon={Ban} tone={totals.blocked > 0 ? "warning" : "success"}
        />
      </StatGrid>

      <Section actions={<Link href="/beds" className="text-caption text-brand-ink font-medium">{ar ? "لوحة الأسرة" : "Bed board"}</Link>}>
        <DataTable rows={wards} columns={columns} loading={loading} initialSort={{ key: "free", ascending: true }} />
      </Section>
    </Page>
  );
}
