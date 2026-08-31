/**
 * Clinical Decision Support — دعم القرار السريري
 *
 * Every alert the rules engine has fired, and what a human did about it.
 *
 * This screen exists mainly to make alert fatigue measurable. An override
 * rate is not a failure on its own — some overrides are correct medicine —
 * but a rule that is overridden almost every time it fires is a rule that
 * should be retuned or retired, and that is only visible in aggregate.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ShieldAlert, AlertTriangle, Check, Clock, TrendingUp, Activity } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  Page, PageHeader, Section, FilterBar, StatTile, StatGrid, Pill, EmptyState,
  Meter, useCollection, matches, fmtDateTime, fmtAgo, cardCls, serif,
  type Tone, type StatusMap, statusDef,
} from "@/platform/ui";
import { KB_STATS } from "@/platform/clinical/rules";

const ALERT_STATUS: StatusMap = {
  active:       { en: "Awaiting response", ar: "بانتظار رد", tone: "critical" },
  acknowledged: { en: "Acknowledged",      ar: "تم الاطلاع", tone: "info" },
  overridden:   { en: "Overridden",        ar: "تم التجاوز", tone: "warning" },
  resolved:     { en: "Resolved",          ar: "تمت المعالجة", tone: "success" },
  expired:      { en: "Expired",           ar: "منتهٍ",      tone: "neutral" },
};

const SEVERITY_TONE: Record<string, Tone> = {
  contraindicated: "critical", high: "critical", moderate: "warning", low: "info", info: "neutral",
};

const TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  drug_interaction:  { en: "Drug interaction",   ar: "تداخل دوائي" },
  allergy:           { en: "Allergy",            ar: "حساسية" },
  duplicate_therapy: { en: "Duplicate therapy",  ar: "تكرار علاجي" },
  dose_range:        { en: "Dose range",         ar: "نطاق الجرعة" },
  renal_dosing:      { en: "Renal dosing",       ar: "الجرعة الكلوية" },
  pregnancy:         { en: "Pregnancy",          ar: "الحمل" },
  critical_lab:      { en: "Critical result",    ar: "نتيجة حرجة" },
  sepsis:            { en: "Sepsis",             ar: "إنتان" },
  deterioration:     { en: "Deterioration",      ar: "تدهور" },
  vte_risk:          { en: "VTE risk",           ar: "خطر التخثر" },
  care_gap:          { en: "Care gap",           ar: "فجوة رعاية" },
};

export default function DecisionSupport() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const { rows: alerts, loading } = useCollection("cdss_alerts");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const active = alerts.filter((a) => a.status === "active");
  const overridden = alerts.filter((a) => a.status === "overridden");
  const responded = alerts.filter((a) => a.responded_at);

  /** Median minutes from firing to a human responding. A rule nobody answers
   *  for hours is not protecting anyone. */
  const medianResponse = useMemo(() => {
    const times = responded
      .map((a) => (new Date(a.responded_at!).getTime() - new Date(a.fired_at).getTime()) / 60_000)
      .sort((x, y) => x - y);
    return times.length ? Math.round(times[Math.floor(times.length / 2)]) : null;
  }, [responded]);

  /** Per-rule-type fire and override counts — the alert-fatigue view. */
  const byType = useMemo(() => {
    const m = new Map<string, { fired: number; overridden: number }>();
    for (const a of alerts) {
      const e = m.get(a.alert_type) ?? { fired: 0, overridden: 0 };
      e.fired++;
      if (a.status === "overridden") e.overridden++;
      m.set(a.alert_type, e);
    }
    return [...m.entries()]
      .map(([type, v]) => ({ type, ...v, rate: v.fired > 0 ? Math.round((v.overridden / v.fired) * 100) : 0 }))
      .sort((a, b) => b.fired - a.fired);
  }, [alerts]);

  const filtered = useMemo(
    () => alerts
      .filter((a) =>
        (!status || a.status === status) &&
        (!type || a.alert_type === type) &&
        matches(search, a.title_en, a.title_ar, a.message_en, a.rule_id, a.responded_by))
      .sort((a, b) => {
        // Unanswered alerts always float, whatever the sort.
        if ((a.status === "active") !== (b.status === "active")) return a.status === "active" ? -1 : 1;
        return new Date(b.fired_at).getTime() - new Date(a.fired_at).getTime();
      }),
    [alerts, search, status, type],
  );

  const overrideRate = alerts.length > 0 ? Math.round((overridden.length / alerts.length) * 100) : 0;

  return (
    <Page>
      <PageHeader
        title="Clinical Decision Support"
        titleAr="دعم القرار السريري"
        subtitle="Every alert the rules engine fired, and what a clinician did about it."
        subtitleAr="كل تنبيه أطلقه محرك القواعد وما فعله الطبيب حياله."
        meta={[
          { label: "Awaiting response", labelAr: "بانتظار رد", value: String(active.length), tone: active.length > 0 ? "critical" : "success" },
          { label: "Override rate", labelAr: "نسبة التجاوز", value: `${overrideRate}%`, tone: overrideRate > 50 ? "warning" : "neutral" },
        ]}
      />

      <StatGrid cols={4}>
        <StatTile
          label="Awaiting response" labelAr="بانتظار رد" value={active.length}
          sub="Nobody has acted yet" subAr="لم يتصرف أحد بعد"
          icon={AlertTriangle} tone={active.length > 0 ? "critical" : "success"}
        />
        <StatTile
          label="Median response time" labelAr="وسيط زمن الاستجابة"
          value={medianResponse !== null ? (medianResponse < 60 ? `${medianResponse}m` : `${Math.round(medianResponse / 60)}h`) : "—"}
          sub="Fired to acted on" subAr="من الإطلاق إلى التصرف"
          icon={Clock} tone={medianResponse !== null && medianResponse > 60 ? "warning" : "success"}
        />
        <StatTile
          label="Overridden" labelAr="تم تجاوزها" value={overridden.length}
          sub={`${overrideRate}% of all alerts`} subAr={`${overrideRate}٪ من كل التنبيهات`}
          icon={ShieldAlert} tone={overrideRate > 50 ? "warning" : "neutral"}
        />
        <StatTile
          label="Rules in the knowledge base" labelAr="قواعد قاعدة المعرفة"
          value={KB_STATS.interactions + KB_STATS.doseRules + KB_STATS.pregnancyRules + KB_STATS.criticalAnalytes}
          sub={`${KB_STATS.interactions} interactions · ${KB_STATS.doseRules} dose rules`}
          subAr={`${KB_STATS.interactions} تداخل · ${KB_STATS.doseRules} قاعدة جرعة`}
          icon={Activity} tone="neutral"
        />
      </StatGrid>

      <Section
        title="Alert fatigue by rule type"
        titleAr="إجهاد التنبيهات حسب نوع القاعدة"
        description="A rule overridden almost every time it fires should be retuned or retired."
        descriptionAr="القاعدة التي تُتجاوز في كل مرة تقريباً يجب إعادة ضبطها أو إيقافها."
      >
        <div className="p-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {byType.map((t) => {
            const label = TYPE_LABEL[t.type] ?? { en: t.type, ar: t.type };
            const tone: Tone = t.rate >= 70 ? "critical" : t.rate >= 40 ? "warning" : "success";
            return (
              <div key={t.type} className={`${cardCls} p-3.5`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-medium text-foreground truncate">{ar ? label.ar : label.en}</span>
                  <span className="text-caption text-muted-foreground tabular-nums shrink-0">
                    {t.fired} {ar ? "إطلاق" : "fired"}
                  </span>
                </div>
                <div className="mt-2">
                  <Meter value={t.overridden} max={t.fired} tone={tone} label={`${t.rate}%`} />
                </div>
                <div className="text-micro text-muted-foreground mt-1.5">
                  {t.overridden} {ar ? "تجاوز" : "overridden"}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section>
        <FilterBar
          search={search} onSearch={setSearch}
          searchPlaceholder="Alert, rule or responder"
          searchPlaceholderAr="التنبيه أو القاعدة أو المستجيب"
          filters={[
            {
              key: "status", value: status, onChange: setStatus,
              allLabel: "All statuses", allLabelAr: "كل الحالات",
              options: Object.entries(ALERT_STATUS).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
            {
              key: "type", value: type, onChange: setType,
              allLabel: "All rule types", allLabelAr: "كل الأنواع",
              options: Object.entries(TYPE_LABEL).map(([value, d]) => ({ value, en: d.en, ar: d.ar })),
            },
          ]}
        >
          <span className="text-caption text-muted-foreground tabular-nums ms-auto">
            {filtered.length} {ar ? "تنبيه" : filtered.length === 1 ? "alert" : "alerts"}
          </span>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="No alerts match" titleAr="لا توجد تنبيهات مطابقة" />
        ) : (
          <ul className="divide-y divide-border/25">
            {filtered.map((a) => {
              const sDef = statusDef(ALERT_STATUS, a.status);
              const typeLabel = TYPE_LABEL[a.alert_type] ?? { en: a.alert_type, ar: a.alert_type };
              const evidence = a.evidence as Record<string, unknown> | null;
              return (
                <li key={a.id} className={`px-5 py-4 ${a.status === "active" ? "bg-destructive/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 mt-0.5
                      ${a.severity === "contraindicated" || a.severity === "high"
                        ? "bg-destructive/12 text-destructive"
                        : "bg-warning/15 text-warning"}`}>
                      <AlertTriangle size={14} />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body font-semibold text-foreground" style={serif}>
                          {ar ? a.title_ar : a.title_en}
                        </span>
                        <Pill tone={SEVERITY_TONE[a.severity] ?? "warning"}>{a.severity}</Pill>
                        <Pill tone="neutral">{ar ? typeLabel.ar : typeLabel.en}</Pill>
                      </div>

                      <p className="text-caption text-foreground/85 mt-1">{ar ? a.message_ar : a.message_en}</p>

                      {a.recommendation_en && (
                        <p className="text-caption text-foreground/70 mt-1.5">
                          <span className="font-medium">{ar ? "التوصية: " : "Recommended: "}</span>
                          {ar ? a.recommendation_ar : a.recommendation_en}
                        </p>
                      )}

                      {evidence && Object.keys(evidence).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(evidence).slice(0, 5).map(([k, v]) => (
                            <span key={k} className="text-micro text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md tabular-nums">
                              {k.replace(/_/g, " ")}: <span className="text-foreground">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {a.override_reason && (
                        <div className="mt-2 rounded-lg bg-warning/10 px-3 py-2">
                          <div className="text-micro font-semibold text-warning">
                            {ar ? "سبب التجاوز الموثق" : "Documented override reason"}
                          </div>
                          <p className="text-caption text-foreground/80 mt-0.5">{a.override_reason}</p>
                        </div>
                      )}

                      <div className="text-micro text-muted-foreground mt-2 tabular-nums">
                        {ar ? "أُطلق" : "fired"} {fmtDateTime(a.fired_at, ar)}
                        {a.responded_by && ` · ${ar ? "استجاب" : "answered by"} ${a.responded_by} ${fmtAgo(a.responded_at, ar)}`}
                        {a.rule_id && ` · ${a.rule_id}`}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <Pill tone={sDef.tone} icon={a.status === "resolved" ? Check : undefined}>
                        {ar ? sDef.ar : sDef.en}
                      </Pill>
                      {a.patient_id && (
                        <Link href={`/chart/${a.patient_id}`} className="text-micro text-brand-ink font-medium">
                          {ar ? "فتح الملف" : "Open chart"}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </Page>
  );
}
