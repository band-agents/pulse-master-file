/**
 * Hub — the hospital system's landing surface.
 *
 * This screen was rebuilt because of one specific failure: the modules were
 * on it, but nobody could see them. A page title, a subtitle and a seven-row
 * alert panel filled the entire first screen, so the sixteen cards that ARE
 * the navigation began below the fold and the system looked like it had none.
 *
 * The order is now the order of use. Modules are the first thing on the page
 * and always visible; alerts are one line that expands, because a count of
 * seven problems tells you as much as a list of seven problems and costs a
 * tenth of the height; the title is a single line.
 *
 * The three applications are surfaced here too, since nothing else told a
 * first-time reader that the clinician workspace and the patient portal
 * existed.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, ArrowRight, RefreshCw, Search, Plus, ChevronDown,
  Stethoscope, User, Building2,
} from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useSnapshot, type Snapshot } from "@/platform/data/snapshot";
import { MODULES } from "@/modules/registry";
import { MODULE_GROUPS, type HubMetric, type ModuleManifest } from "@/modules/types";
import { useRole } from "./RoleContext";
import { usePalette } from "./CommandPalette";
import { useNewEntry } from "./NewEntry";
import {
  Page, LoadingRow, cardCls, serif, TONE_DOT, TONE_PILL, fmtDateTime, type Tone,
} from "@/platform/ui";
import { BRAND } from "@/platform/lib/brand";

export default function Hub() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { role, roles } = useRole();
  const { open: openPalette } = usePalette();
  const { open: openEntry } = useNewEntry();
  const { snapshot, loading, failed, takenAt, reload } = useSnapshot();
  const [alertsOpen, setAlertsOpen] = useState(false);

  const mine = useMemo(() => MODULES.filter((m) => m.roles.includes(role)), [role]);
  const rest = useMemo(() => MODULES.filter((m) => !m.roles.includes(role)), [role]);
  const roleLabel = roles.find((r) => r.id === role);

  /** Anything across the hospital that is red right now. */
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
        <LoadingRow label="Reading the hospital" labelAr="جاري قراءة حالة المستشفى" />
      </Page>
    );
  }

  return (
    <Page>
      {/* ── One line of identity, one row of controls. ── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-heading font-semibold text-foreground" style={serif}>
            {ar ? BRAND.nameAr : BRAND.name}
          </h1>
          <p className="text-caption text-muted-foreground">
            {ar
              ? `${roleLabel?.ar} · كل الأرقام من لحظة واحدة`
              : `${roleLabel?.en} · every figure from one instant`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => openEntry()}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus size={15} strokeWidth={2.4} /> {ar ? "تسجيل جديد" : "New entry"}
          </button>
          <button
            type="button" onClick={openPalette}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-border/60 bg-background text-body text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search size={14} /> {ar ? "بحث" : "Search"}
            <kbd className="text-micro border border-border/60 rounded px-1">⌘K</kbd>
          </button>
          <button
            type="button" onClick={reload}
            title={takenAt ? fmtDateTime(takenAt.toISOString(), ar) : undefined}
            className="grid place-items-center w-9 h-9 rounded-xl border border-border/60 bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {failed.length > 0 && (
        <div className="rounded-xl bg-warning/10 px-4 py-2.5 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
          <p className="text-caption text-foreground/85">
            {ar
              ? `تعذر تحميل ${failed.length} من مجموعات البيانات. البطاقات المعتمدة عليها تعرض أصفاراً — بقية النظام يعمل.`
              : `${failed.length} collection${failed.length === 1 ? "" : "s"} could not be loaded. Cards that depend on them read zero — the rest of the system is unaffected.`}
          </p>
        </div>
      )}

      {/* ── Alerts: one line by default. ── */}
      {urgent.length > 0 && (
        <section className={`${cardCls} border-destructive/30 overflow-hidden`}>
          <button
            type="button"
            onClick={() => setAlertsOpen((v) => !v)}
            aria-expanded={alertsOpen}
            className="w-full px-4 py-2.5 flex items-center gap-2.5 text-start hover:bg-destructive/5 transition-colors"
          >
            <AlertTriangle size={15} className="text-destructive shrink-0" />
            <span className="text-body-lg font-semibold text-foreground" style={serif}>
              {ar
                ? `${urgent.length} حالة تحتاج تصرفاً الآن`
                : `${urgent.length} thing${urgent.length === 1 ? "" : "s"} need action now`}
            </span>
            <span className="text-caption text-muted-foreground truncate hidden sm:block">
              {urgent.slice(0, 2).map((u) => (ar ? u.module.name.ar : u.module.name.en)).join(" · ")}
              {urgent.length > 2 && ` · +${urgent.length - 2}`}
            </span>
            <ChevronDown
              size={15}
              className={`ms-auto shrink-0 text-muted-foreground transition-transform ${alertsOpen ? "rotate-180" : ""}`}
            />
          </button>

          {alertsOpen && (
            <ul className="divide-y divide-border/25 border-t border-border/40">
              {urgent.map(({ module, metric }, i) => (
                <li key={`${module.id}-${i}`}>
                  <Link href={module.base} className="px-4 py-2 flex items-center gap-3 hover:bg-muted/40 transition-colors">
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
          )}
        </section>
      )}

      {/* ── Modules. First on the page, always. ── */}
      <section className="space-y-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-title font-semibold text-foreground" style={serif}>
            {ar ? `شاشاتك — ${roleLabel?.ar}` : `Your workspace — ${roleLabel?.en}`}
          </h2>
          <span className="text-caption text-muted-foreground tabular-nums">{mine.length}</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mine.map((m) => <ModuleCard key={m.id} module={m} snapshot={snapshot} featured />)}
        </div>
      </section>

      {MODULE_GROUPS.map((group) => {
        const inGroup = rest.filter((m) => m.group === group.id);
        if (inGroup.length === 0) return null;
        return (
          <section key={group.id} className="space-y-2.5">
            <h2 className="text-body-lg font-semibold text-muted-foreground" style={serif}>
              {ar ? group.ar : group.en}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {inGroup.map((m) => <ModuleCard key={m.id} module={m} snapshot={snapshot} />)}
            </div>
          </section>
        );
      })}

      {/* ── The other two applications. ── */}
      <section className="space-y-2.5">
        <div>
          <h2 className="text-body-lg font-semibold text-muted-foreground" style={serif}>
            {ar ? "التطبيقات الأخرى" : "The other applications"}
          </h2>
          <p className="text-caption text-muted-foreground mt-0.5 max-w-[70ch]">
            {ar
              ? "ثلاثة تطبيقات فوق سجل واحد. ما يُسجَّل في أحدها يظهر في الآخرَين في اللحظة نفسها."
              : "Three applications over one record. Anything recorded in one appears in the other two at the same moment."}
          </p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <AppCard
            href="/clinic" icon={Stethoscope}
            title={ar ? "مساحة الطبيب" : "Clinician workspace"}
            body={ar
              ? "قائمة الجولة مرتّبة حسب شدة الحالة، وصندوق وارد مرتّب حسب الأثر السريري."
              : "A rounding list ranked by acuity, and an inbox ranked by clinical consequence."}
          />
          <AppCard
            href="/portal" icon={User}
            title={ar ? "بوابة المريض" : "Patient portal"}
            body={ar
              ? "المواعيد والأدوية والنتائج والمراسلة — بلغة مفهومة وخط كبير."
              : "Appointments, medicines, results and messaging — plain language, large type."}
          />
          <AppCard
            href="/analytics" icon={Building2}
            title={ar ? "التحليلات" : "Analytics"}
            body={ar
              ? "مستكشف البيانات ولوحات المؤشرات فوق سبعة عشر مجموعة بيانات."
              : "The data explorer and dashboards over seventeen datasets."}
          />
        </div>
      </section>
    </Page>
  );
}

function AppCard({
  href, icon: Icon, title, body,
}: { href: string; icon: React.ElementType; title: string; body: string }) {
  return (
    <Link href={href} className={`${cardCls} group p-4 flex items-start gap-3 transition-all hover:shadow-md hover:-translate-y-px`}>
      <span className="w-9 h-9 rounded-xl bg-brand-wash text-brand-ink grid place-items-center shrink-0">
        <Icon size={17} strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <h3 className="text-body-lg font-semibold text-foreground group-hover:text-brand-ink transition-colors" style={serif}>
          {title}
        </h3>
        <p className="text-micro text-muted-foreground leading-snug mt-0.5">{body}</p>
      </div>
    </Link>
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
      className={`${cardCls} group p-3.5 flex flex-col gap-2.5 transition-all hover:shadow-md hover:-translate-y-px
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
        <dl className="grid grid-cols-3 gap-2 mt-auto pt-2 border-t border-border/30">
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
