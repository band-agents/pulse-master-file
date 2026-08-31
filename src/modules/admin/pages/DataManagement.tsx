/**
 * Data Management Center
 *
 * Export all data, import CSVs, download templates, view record counts.
 */

import { useState, useEffect } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { getDataSource, type DataSource } from "@/platform/data/repository";
import { exportName } from "@/platform/lib/brand";
import { exportCSV, downloadTemplate, IMPORT_TEMPLATES, type ImportTemplate } from "@/platform/lib/csv-export";
import { CsvImport } from "@/app/components/CsvImport";
import {
  Database as DatabaseIcon, Download, Upload, FileText, Loader2,
  Users, UserSearch, ClipboardCheck, BedDouble, FlaskConical, Scan,
  Pill, Scissors, Siren, CalendarClock, Stethoscope, Receipt,
  ShieldCheck, Wrench, Activity, CheckCircle2,
} from "lucide-react";

/**
 * One row per exportable collection. The page's three data paths — first load,
 * export-all and post-import refresh — all read this list, so a new entity is
 * added in exactly one place.
 */
const ENTITIES: {
  id: string;
  key: keyof DataSource;
  labelEn: string;
  labelAr: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { id: "patients",           key: "patients",           labelEn: "Patients",            labelAr: "المرضى",            icon: UserSearch,     color: "text-success bg-success/10" },
  { id: "encounters",         key: "encounters",         labelEn: "Encounters",          labelAr: "الزيارات",           icon: ClipboardCheck, color: "text-chart-4 bg-chart-4/10" },
  { id: "beds",               key: "beds",               labelEn: "Beds",                labelAr: "الأسرة",             icon: BedDouble,      color: "text-info bg-info/10" },
  { id: "clinical_orders",    key: "clinical_orders",    labelEn: "Clinical Orders",     labelAr: "الأوامر الطبية",     icon: ClipboardCheck, color: "text-data bg-data/10" },
  { id: "lab_orders",         key: "lab_orders",         labelEn: "Lab Orders",          labelAr: "طلبات المختبر",      icon: FlaskConical,   color: "text-info bg-info/10" },
  { id: "imaging_orders",     key: "imaging_orders",     labelEn: "Imaging Orders",      labelAr: "طلبات الأشعة",       icon: Scan,           color: "text-info bg-info/10" },
  { id: "prescriptions",      key: "prescriptions",      labelEn: "Prescriptions",       labelAr: "الوصفات",            icon: Pill,           color: "text-success bg-success/10" },
  { id: "ot_cases",           key: "ot_cases",           labelEn: "Theatre Cases",       labelAr: "حالات العمليات",     icon: Scissors,       color: "text-destructive bg-destructive/10" },
  { id: "ed_visits",          key: "ed_visits",          labelEn: "ED Visits",           labelAr: "زيارات الطوارئ",     icon: Siren,          color: "text-warning bg-warning/12" },
  { id: "appointments",       key: "appointments",       labelEn: "Appointments",        labelAr: "المواعيد",           icon: CalendarClock,  color: "text-data bg-data/10" },
  { id: "providers",          key: "providers",          labelEn: "Providers",           labelAr: "مقدمو الرعاية",      icon: Stethoscope,    color: "text-muted-foreground bg-muted" },
  { id: "charge_items",       key: "charge_items",       labelEn: "Charges",             labelAr: "الرسوم",             icon: Receipt,        color: "text-brand-ink bg-primary/8" },
  { id: "claims",             key: "claims",             labelEn: "Claims",              labelAr: "المطالبات",          icon: FileText,       color: "text-warning bg-warning/12" },
  { id: "insurance_policies", key: "insurance_policies", labelEn: "Insurance Policies",  labelAr: "وثائق التأمين",      icon: ShieldCheck,    color: "text-lime-700 bg-lime-50" },
  { id: "biomed_assets",      key: "biomed_assets",      labelEn: "Biomedical Assets",   labelAr: "الأجهزة الطبية",     icon: Wrench,         color: "text-muted-foreground bg-muted" },
  { id: "staff",          key: "staff",          labelEn: "Employees",           labelAr: "الموظفين",           icon: Users,          color: "text-data bg-data/10" },
  { id: "activity_events",    key: "activity_events",    labelEn: "Activity Events",     labelAr: "أحداث النشاط",       icon: Activity,       color: "text-muted-foreground bg-muted" },
];

interface ModuleCount {
  id: string;
  labelEn: string;
  labelAr: string;
  icon: React.ElementType;
  color: string;
  count: number;
  data: Record<string, unknown>[];
  exportName: string;
  importTemplate?: ImportTemplate;
}

export default function DataManagement() {
  const { lang } = useLanguage();
  const { workspace } = useAuth();
  const ar = lang === "ar";

  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleCount[]>([]);
  const [importModal, setImportModal] = useState<ImportTemplate | null>(null);
  const [importAdapter, setImportAdapter] = useState<any>(null);

  // Demo mode has no workspace id, so it passes "demo" rather than waiting for
  // one that never arrives — the adapter serves the demo arrays either way.
  const wid = workspace?.id ?? "demo";

  async function loadCounts() {
    const ds = getDataSource();
    const loaded = await Promise.all(
      ENTITIES.map((e) => (ds[e.key] as { list: (w: string) => Promise<unknown[]> }).list(wid))
    );
    setModules(ENTITIES.map((e, i) => {
      const data = loaded[i] as Record<string, unknown>[];
      return {
        ...e,
        count: data.length,
        data,
        exportName: e.id.replace(/_/g, "-"),
        importTemplate: IMPORT_TEMPLATES.find((t) => t.id === e.id),
      };
    }));
    setLoading(false);
  }

  useEffect(() => { loadCounts(); }, [wid]);

  const totalRecords = modules.reduce((s, m) => s + m.count, 0);

  function exportAll() {
    modules.forEach((m) => {
      if (m.data.length > 0) {
        exportCSV(m.data as Record<string, unknown>[], `${exportName(m.exportName)}.csv`);
      }
    });
  }

  function openImport(tmpl: ImportTemplate) {
    const ds = getDataSource();
    const entity = ENTITIES.find((e) => e.id === tmpl.id);
    setImportAdapter(entity ? ds[entity.key] : null);
    setImportModal(tmpl);
  }

  function handleImportComplete() {
    setLoading(true);
    loadCounts();
  }

  return (
    <div className="min-h-full py-8 px-7 md:px-10 max-w-[900px] mx-auto">

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-3">
          <DatabaseIcon size={14} strokeWidth={1.75} className="text-brand-ink" />
          <p className="text-micro text-muted-foreground/60 tracking-[0.08em] uppercase">
            {ar ? "إدارة البيانات" : "Data Management"}
          </p>
        </div>
        <h1 className="text-display font-medium text-foreground leading-tight mb-3" style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.025em" }}>
          {ar ? "بياناتك" : "Your Data"}
        </h1>
        <p className="text-body text-muted-foreground leading-relaxed max-w-[500px]">
          {ar
            ? "صدّر بياناتك، استورد ملفات CSV، أو حمّل نماذج جاهزة."
            : "Export your data, import CSV files, or download templates."}
        </p>
        {!loading && (
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success/50 border border-success/40 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-micro text-success font-medium">
                {ar ? `${totalRecords} سجل · بيانات حية` : `${totalRecords} records · Live data`}
              </span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            <button onClick={exportAll} disabled={totalRecords === 0}
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 transition-opacity disabled:opacity-40">
              <Download size={14} />
              {ar ? "صدّر كل البيانات" : "Export All Data"}
            </button>
          </div>

          {/* Module grid */}
          <div className="space-y-3 mb-10">
            {modules.map((m) => {
              const Icon = m.icon;
              const [iconCl, bgCl] = m.color.split(" ");
              return (
                <div key={m.id} className="flex items-center gap-4 p-4 bg-background border border-border/40 rounded-xl hover:border-border/60 transition-colors">
                  <div className={`w-10 h-10 rounded-xl ${bgCl} flex items-center justify-center shrink-0`}>
                    <Icon size={17} strokeWidth={1.75} className={iconCl} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-lg font-medium text-foreground">{ar ? m.labelAr : m.labelEn}</p>
                    <p className="text-micro text-muted-foreground">
                      {m.count} {ar ? "سجل" : "records"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.count > 0 && (
                      <button onClick={() => exportCSV(m.data as Record<string, unknown>[], `${exportName(m.exportName)}.csv`)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 text-micro font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        <Download size={12} />
                        {ar ? "صدّر" : "Export"}
                      </button>
                    )}
                    {m.importTemplate && (
                      <>
                        <button onClick={() => downloadTemplate(m.importTemplate!.headers, `${exportName(m.id)}-template.csv`)}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border/60 text-micro font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                          <FileText size={12} />
                          {ar ? "نموذج" : "Template"}
                        </button>
                        <button onClick={() => openImport(m.importTemplate!)}
                          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary/8 text-micro font-medium text-brand-ink hover:bg-primary/12 transition-colors">
                          <Upload size={12} />
                          {ar ? "استورد" : "Import"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Templates section */}
          <div className="mb-10">
            <h2 className="text-body font-semibold text-muted-foreground tracking-[0.08em] uppercase mb-4">
              {ar ? "نماذج جاهزة للتحميل" : "CSV Templates"}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {IMPORT_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => downloadTemplate(t.headers, `${exportName(t.id)}-template.csv`)}
                  className="group flex items-center gap-3 p-3.5 rounded-xl border border-border/40 bg-background hover:border-primary/30 hover:shadow-sm transition-all text-start">
                  <Download size={14} className="text-muted-foreground/40 group-hover:text-brand-ink transition-colors shrink-0" />
                  <div className="min-w-0">
                    <p className="text-caption font-medium text-foreground truncate">{ar ? t.labelAr : t.labelEn}</p>
                    <p className="text-micro text-muted-foreground">{t.headers.length} {ar ? "عمود" : "columns"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Import Modal */}
      {importModal && importAdapter && (
        <CsvImport
          open={!!importModal}
          onClose={() => { setImportModal(null); setImportAdapter(null); }}
          template={importModal}
          adapter={importAdapter}
          ar={ar}
          onComplete={handleImportComplete}
        />
      )}
    </div>
  );
}
