/**
 * Hub — الصفحة الرئيسية
 *
 * The landing surface, and the thing that replaces a permanent sidebar. Every
 * module the hospital runs is a card, each carrying live numbers rather than
 * a name and an icon — so the decision of where to go is made on the state of
 * the hospital, not on a menu.
 *
 * Cards for the current role are promoted to the top; everything else stays
 * one scroll away rather than being hidden, because a nurse covering triage
 * for an afternoon should not have to change role to find the ED board.
 *
 * All sixteen cards read one snapshot, so no two numbers on this page are
 * from different moments.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, RefreshCw, Search } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useSnapshot, type Snapshot } from "@/platform/data/snapshot";
import { MODULES } from "@/modules/registry";
import { MODULE_GROUPS, type HubMetric, type ModuleManifest } from "@/modules/types";
import { useRole } from "./RoleContext";
import { usePalette } from "./CommandPalette";
import {
  Page, LoadingRow, cardCls, serif, TONE_DOT, TONE_PILL, fmtDateTime, type Tone,
} from "@/platform/ui";
import { BRAND } from "@/platform/lib/brand";

export default function Hub() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { role, roles } = useRole();
  const { open } = usePalette();
  const { snapshot, loading, failed, takenAt, reload } = useSnapshot();

  const mine = useMemo(() => MODULES.filter((m) => m.roles.includes(role)), [role]);
  const rest = useMemo(() => MODULES.filter((m) => !m.roles.includes(role)), [role]);
  const roleLabel = roles.find((r) => r.id === role);

  /** Anything across the hospital that is red right now, for the banner. */
  const urgent = useMemo(() => {
    const items: { module: ModuleManifest; metric: HubMetric }[] = [];
    for (const m of MODULES) {
      for (const metric of m.metrics?.(snapshot) ?? []) {
        if (metric.tone === "critical" && Number(metric.value) > 0) items.push({ module: m, metric });
      }
    }
    return items;
  }, [snapshot]);

  if (loading) {
    return (
      <Page>
        <h1 className="text-display font-semibold" style={serif}>{ar ? BRAND.nameAr : BRAND.name}</h1>
        <LoadingRow label="Reading the hospital" labelAr="جاري قراءة حالة المستشفى" />
      </Page>
    );
  }

  return (
    <Page>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display font-semibold text-foreground" style={serif}>
            {ar ? BRAND.nameAr : BRAND.name}
          </h1>
          <p className="text-body text-muted-foreground mt-1">
            {ar
              ? `عرض ${roleLabel?.ar}. كل الأرقام من لحظة واحدة.`
              : `Viewing as ${roleLabel?.en}. Every figure on this page is from one instant.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={open}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 bg-background text-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search size={14} /> {ar ? "بحث" : "Search"}
            <kbd className="text-micro border border-border/60 rounded px-1">⌘K</kbd>
          </button>
          <button
            type="button" onClick={reload}
            title={takenAt ? fmtDateTime(takenAt.toISOString(), ar) : undefined}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 bg-background text-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} /> {ar ? "تحديث" : "Refresh"}
          </button>
        </div>
      </header>

      {failed.length > 0 && (
        <div className="rounded-xl bg-warning/10 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-warning shrink-0 mt-0.5" />
          <p className="text-caption text-foreground/85">
            {ar
              ? `تعذر تحميل ${failed.length} من مجموعات البيانات. البطاقات المعتمدة عليها تعرض أصفاراً — بقية النظام يعمل.`
              : `${failed.length} collection${failed.length === 1 ? "" : "s"} could not be loaded. Cards that depend on them read zero — the rest of the system is unaffected.`}
          </p>
        </div>
      )}

      {urgent.length > 0 && (
        <section className={`${cardCls} border-destructive/30 overflow-hidden`}>
          <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
            <AlertTriangle size={15} className="text-destructive" />
            <h2 className="text-title font-semibold text-foreground" style={serif}>
              {ar ? "يحتاج إلى تصرف الآن" : "Needs action now"}
            </h2>
            <span className="text-caption text-muted-foreground tabular-nums ms-auto">{urgent.length}</span>
          </div>
          <ul className="divide-y divide-border/25">
            {urgent.map(({ module, metric }, i) => (
              <li key={`${module.id}-${i}`}>
                <Link href={module.base} className="px-5 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT.critical}`} aria-hidden />
                  <module.icon size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-body text-foreground flex-1 min-w-0 truncate">
                    {ar ? metric.label.ar : metric.label.en}
                    <span className="text-muted-foreground"> · {ar ? module.name.ar : module.name.en}</span>
                  </span>
                  <span className="text-body font-semibold text-destructive tabular-nums shrink-0">{metric.value}</span>
                  <ArrowRight size={13} className="text-muted-foreground/50 shrink-0 rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Promoted for the current role */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {ar ? `شاشاتك — ${roleLabel?.ar}` : `Your workspace — ${roleLabel?.en}`}
          </h2>
          <span className="text-caption text-muted-foreground tabular-nums">{mine.length}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mine.map((m) => <ModuleCard key={m.id} module={m} snapshot={snapshot} featured />)}
        </div>
      </section>

      {/* Everything else, grouped */}
      {MODULE_GROUPS.map((group) => {
        const inGroup = rest.filter((m) => m.group === group.id);
        if (inGroup.length === 0) return null;
        return (
          <section key={group.id} className="space-y-3">
            <h2 className="text-body-lg font-semibold text-muted-foreground" style={serif}>
              {ar ? group.ar : group.en}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {inGroup.map((m) => <ModuleCard key={m.id} module={m} snapshot={snapshot} />)}
            </div>
          </section>
        );
      })}
    </Page>
  );
}

function ModuleCard({
  module, snapshot, featured,
}: { module: ModuleManifest; snapshot: Snapshot; featured?: boolean }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const metrics = module.metrics?.(snapshot) ?? [];
  const Icon = module.icon;

  // The card takes its edge from its worst metric — the state of a module is
  // the state of the thing most wrong with it.
  const worst: Tone = metrics.some((m) => m.tone === "critical" && Number(m.value) > 0)
    ? "critical"
    : metrics.some((m) => m.tone === "warning" && Number(m.value) > 0)
      ? "warning"
      : "neutral";

  return (
    <Link
      href={module.base}
      className={`${cardCls} group p-4 flex flex-col gap-3 transition-all hover:shadow-md hover:-translate-y-px
        ${worst === "critical" ? "border-destructive/35" : worst === "warning" ? "border-warning/35" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${featured ? TONE_PILL.brand : "bg-muted text-muted-foreground"}`}>
          <Icon size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-foreground truncate group-hover:text-brand-ink transition-colors" style={serif}>
            {ar ? module.name.ar : module.name.en}
          </h3>
          <p className="text-micro text-muted-foreground leading-snug line-clamp-2 mt-0.5">
            {ar ? module.summary.ar : module.summary.en}
          </p>
        </div>
      </div>

      {metrics.length > 0 && (
        <dl className="grid grid-cols-3 gap-2 mt-auto pt-2.5 border-t border-border/30">
          {metrics.slice(0, 3).map((m, i) => (
            <div key={i} className="min-w-0">
              <dd
                className={`text-body-lg font-semibold tabular-nums leading-none truncate
                  ${m.tone === "critical" && Number(m.value) > 0 ? "text-destructive"
                    : m.tone === "warning" && Number(m.value) > 0 ? "text-warning"
                    : m.tone === "data" ? "text-data"
                    : "text-foreground"}`}
                style={serif}
                title={String(m.value)}
              >
                {m.value}
              </dd>
              <dt className="text-micro text-muted-foreground leading-tight mt-1 line-clamp-2">
                {ar ? m.label.ar : m.label.en}
              </dt>
            </div>
          ))}
        </dl>
      )}
    </Link>
  );
}
