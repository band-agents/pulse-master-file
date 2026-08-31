/**
 * Code Settings — Customizable Numbering System
 *
 * إعدادات الأكواد — نظام ترقيم قابل للتخصيص
 * Users configure prefix, separator, and digit count per entity type.
 */

import { useState, useEffect } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import {
  type EntityType, type CodeSettings, type CodeConfig,
  DEFAULT_CODE_SETTINGS, ENTITY_LABELS,
  loadCodeSettings, saveCodeSettings, previewCode, resetCounters,
} from "@/platform/lib/code-generator";
import {
  Settings, Hash, RotateCcw, Save, CheckCircle2, Eye, Info,
  ChevronDown, ChevronRight, Sparkles,
} from "lucide-react";

const inputCls = "h-10 px-3 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20 transition w-full";
const smallInput = "h-8 px-2.5 rounded-lg border border-border/50 bg-background text-caption focus:outline-none focus:ring-1 focus:ring-brand-ink/20 transition w-full";
const labelCls = "text-micro text-muted-foreground font-medium mb-1 block";
const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-body font-medium px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 text-caption font-medium px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors";

// Entity groups for organized display
const ENTITY_GROUPS: { label: string; labelAr: string; entities: EntityType[] }[] = [
  {
    label: "Sales & Quoting",
    labelAr: "المبيعات وعروض الأسعار",
    entities: ["quotation", "sales_order", "invoice", "pos_transaction"],
  },
  {
    label: "Products & Production",
    labelAr: "المنتجات والإنتاج",
    entities: ["product", "production_order", "design_brief", "qc_inspection"],
  },
  {
    label: "Operations",
    labelAr: "العمليات",
    entities: ["delivery", "site_visit", "expense"],
  },
  {
    label: "People",
    labelAr: "الأشخاص",
    entities: ["employee"],
  },
];

function CodeRow({ entityType, config, onChange, ar }: {
  entityType: EntityType;
  config: CodeConfig;
  onChange: (cfg: CodeConfig) => void;
  ar: boolean;
}) {
  const label = ENTITY_LABELS[entityType];
  const preview = previewCode(entityType, { entities: { ...DEFAULT_CODE_SETTINGS.entities, [entityType]: config } });

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-2 min-w-[180px]">
        <Hash size={13} className="text-muted-foreground/50 shrink-0" />
        <div>
          <p className="text-body font-medium">{ar ? label.ar : label.en}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <div className="w-[120px]">
          <label className="text-micro text-muted-foreground/60">{ar ? "البادئة" : "Prefix"}</label>
          <input
            value={config.prefix}
            onChange={e => onChange({ ...config, prefix: e.target.value.toUpperCase() })}
            className={smallInput}
            placeholder="QT"
          />
        </div>
        <div className="w-[80px]">
          <label className="text-micro text-muted-foreground/60">{ar ? "الفاصل" : "Separator"}</label>
          <input
            value={config.separator}
            onChange={e => onChange({ ...config, separator: e.target.value })}
            className={smallInput}
            placeholder="-"
            maxLength={3}
          />
        </div>
        <div className="w-[80px]">
          <label className="text-micro text-muted-foreground/60">{ar ? "الأرقام" : "Digits"}</label>
          <input
            type="number"
            min={3}
            max={10}
            value={config.digits}
            onChange={e => onChange({ ...config, digits: Math.min(10, Math.max(3, parseInt(e.target.value) || 5)) })}
            className={smallInput}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 min-w-[140px] justify-end opacity-70 group-hover:opacity-100 transition-opacity">
        <Eye size={11} className="text-muted-foreground/40" />
        <span className="text-caption font-mono text-muted-foreground tabular-nums bg-muted/40 px-2.5 py-1 rounded-lg">
          {preview}
        </span>
      </div>
    </div>
  );
}

export default function CodeSettingsPage() {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const [settings, setSettings] = useState<CodeSettings>(() => loadCodeSettings());
  const [saved, setSaved] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(0);

  function updateConfig(entityType: EntityType, config: CodeConfig) {
    setSettings(prev => ({
      entities: { ...prev.entities, [entityType]: config },
    }));
    setSaved(false);
  }

  function handleSave() {
    saveCodeSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    if (confirm(ar ? "هل تريد إعادة تعيين جميع الإعدادات؟" : "Reset all settings to defaults?")) {
      setSettings({ ...DEFAULT_CODE_SETTINGS });
      saveCodeSettings({ ...DEFAULT_CODE_SETTINGS });
      resetCounters();
      setSaved(false);
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[800px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-heading font-semibold flex items-center gap-2.5" style={{ fontFamily: "var(--app-font-display)" }}>
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Settings size={16} className="text-brand-ink" />
              </div>
              {ar ? "إعدادات أكواد الترقيم" : "Code Numbering Settings"}
            </h1>
            <p className="text-body text-muted-foreground mt-1.5 ml-[46px]">
              {ar ? "خصص البادئة والفاصل وعدد الأرقام لكل نوع" : "Customize prefix, separator, and digits for each entity type"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className={btnSecondary}>
              <RotateCcw size={13} />
              {ar ? "إعادة تعيين" : "Reset"}
            </button>
            <button onClick={handleSave} className={btnPrimary} disabled={saved}>
              {saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {saved ? (ar ? "تم الحفظ" : "Saved!") : (ar ? "حفظ" : "Save")}
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <Info size={14} className="text-brand-ink shrink-0 mt-0.5" />
          <div className="text-caption text-muted-foreground space-y-1">
            <p>{ar ? "الأكواد تتزايد تلقائياً عند إنشاء سجل جديد. يمكنك تخصيص البادئة والفاصل وعدد الأرقام لكل نوع." : "Codes auto-increment when creating new records. Customize the prefix, separator, and digit count for each type."}</p>
            <p className="text-micro text-muted-foreground/60">
              {ar ? "مثال: إذا اخترت البادئة QT والفاصل - و5 أرقام، سيكون الكود التالي QT-00001" : "Example: If you choose prefix QT, separator -, and 5 digits, the next code will be QT-00001"}
            </p>
          </div>
        </div>

        {/* Entity Groups */}
        <div className="space-y-3">
          {ENTITY_GROUPS.map((group, gi) => (
            <div key={gi} className="border border-border/40 rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedGroup(expandedGroup === gi ? null : gi)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-brand-ink/60" />
                  <span className="text-body font-medium">{ar ? group.labelAr : group.label}</span>
                  <span className="text-micro text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">{group.entities.length}</span>
                </div>
                {expandedGroup === gi ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
              </button>
              {expandedGroup === gi && (
                <div className="border-t border-border/30 divide-y divide-border/20">
                  {group.entities.map(entityType => (
                    <CodeRow
                      key={entityType}
                      entityType={entityType}
                      config={settings.entities[entityType]}
                      onChange={cfg => updateConfig(entityType, cfg)}
                      ar={ar}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Preview summary */}
        <div className="p-5 rounded-2xl border border-border/40 bg-muted/20">
          <h3 className="text-body font-medium mb-3 flex items-center gap-2">
            <Eye size={13} className="text-muted-foreground" />
            {ar ? "معاينة الأكواد" : "Code Preview"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(ENTITY_LABELS) as EntityType[]).map(et => {
              const label = ENTITY_LABELS[et];
              const code = previewCode(et, settings, Math.floor(Math.random() * 999) + 1);
              return (
                <div key={et} className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border/30">
                  <span className="text-micro text-muted-foreground truncate">{ar ? label.ar : label.en}</span>
                  <span className="text-micro font-mono font-medium ml-auto tabular-nums">{code}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
