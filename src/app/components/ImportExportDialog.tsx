/**
 * Import/Export Dialog — Reusable CSV import with preview/validation
 * حوار الاستيراد/التصدير — استيراد CSV مع معاينة وتحقق
 */

import { useState, useRef } from "react";
import { X, Upload, Download, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { type ImportColumn, type ImportResult, validateAndImport, downloadTemplate } from "@/platform/lib/import-export";

const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-caption font-medium px-4 py-2 hover:opacity-90 transition-opacity";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 text-micro font-medium px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors";

interface Props {
  title: string;
  columns: ImportColumn[];
  templateFilename: string;
  ar?: boolean;
  existingIds?: Set<string>;
  onImport: (validRows: Record<string, unknown>[]) => Promise<void>;
  onClose: () => void;
}

export default function ImportExportDialog({ title, columns, templateFilename, ar, existingIds, onImport, onClose }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const res = validateAndImport(text, columns, existingIds);
      setResult(res);
      setStep("preview");
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!result || result.validRows.length === 0) return;
    setImporting(true);
    await onImport(result.validRows);
    setImporting(false);
    setStep("result");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-background border border-border/40 rounded-2xl shadow-2xl w-full max-w-[550px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
          <h2 className="text-title font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
            <Upload size={15} className="inline mr-2" />{title}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">

          {step === "upload" && (
            <div className="space-y-5">
              {/* Template download */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/30 border border-border/30">
                <div>
                  <p className="text-caption font-medium">{ar ? "حمّل القالب أولاً" : "Download template first"}</p>
                  <p className="text-micro text-muted-foreground mt-0.5">{ar ? "استخدم الأعمدة الصحيحة" : "Use correct column headers"}</p>
                </div>
                <button onClick={() => downloadTemplate(columns, templateFilename)} className={btnSecondary}>
                  <Download size={11} /> {ar ? "قالب CSV" : "CSV Template"}
                </button>
              </div>

              {/* Upload area */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <FileText size={24} className="mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-body font-medium">{ar ? "اختر ملف CSV" : "Select CSV file"}</p>
                <p className="text-micro text-muted-foreground mt-1">{ar ? "أو اسحب وأفلت هنا" : "or drag and drop here"}</p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
              </div>

              {/* Expected columns */}
              <div>
                <p className="text-micro font-semibold text-muted-foreground tracking-[0.06em] uppercase mb-2">{ar ? "الأعمدة المطلوبة" : "Expected Columns"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {columns.map(c => (
                    <span key={c.key} className={`text-micro px-2 py-1 rounded ${c.required ? "bg-primary/10 text-brand-ink font-medium" : "bg-muted text-muted-foreground"}`}>
                      {c.header}{c.required ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === "preview" && result && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center px-3 py-3 rounded-xl bg-muted/30">
                  <p className="text-title font-medium text-foreground tabular-nums">{result.total}</p>
                  <p className="text-micro text-muted-foreground">{ar ? "إجمالي الصفوف" : "Total Rows"}</p>
                </div>
                <div className="text-center px-3 py-3 rounded-xl bg-success/10">
                  <p className="text-title font-medium text-success tabular-nums">{result.success}</p>
                  <p className="text-micro text-success">{ar ? "صالح" : "Valid"}</p>
                </div>
                <div className="text-center px-3 py-3 rounded-xl bg-destructive/10">
                  <p className="text-title font-medium text-destructive tabular-nums">{result.failed}</p>
                  <p className="text-micro text-destructive">{ar ? "فشل" : "Failed"}</p>
                </div>
              </div>

              {result.duplicates > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/30 text-warning text-micro">
                  <AlertCircle size={12} />{result.duplicates} {ar ? "مكرر تم تجاهله" : "duplicates skipped"}
                </div>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="max-h-[150px] overflow-auto border border-border/40 rounded-xl divide-y divide-border/25">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-2 text-micro">
                      <span className="text-muted-foreground tabular-nums shrink-0">Row {err.row}</span>
                      <span className="text-destructive">{err.message}</span>
                    </div>
                  ))}
                  {result.errors.length > 10 && <div className="px-3 py-2 text-micro text-muted-foreground">+{result.errors.length - 10} more errors</div>}
                </div>
              )}

              {/* Preview rows */}
              {result.validRows.length > 0 && (
                <div>
                  <p className="text-micro font-semibold text-muted-foreground mb-1.5">{ar ? "معاينة (أول 5 صفوف)" : "Preview (first 5 rows)"}</p>
                  <div className="overflow-auto max-h-[120px] border border-border/40 rounded-xl">
                    <table className="w-full text-micro">
                      <thead>
                        <tr className="bg-muted/30">
                          {columns.slice(0, 5).map(c => <th key={c.key} className="px-2 py-1.5 text-left font-medium">{c.header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {result.validRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-t border-border/20">
                            {columns.slice(0, 5).map(c => <td key={c.key} className="px-2 py-1.5 truncate max-w-[100px]">{String(row[c.key] ?? "")}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "result" && result && (
            <div className="text-center py-6">
              <CheckCircle2 size={32} className="mx-auto mb-3 text-success" />
              <p className="text-title font-medium" style={{ fontFamily: "var(--app-font-display)" }}>{ar ? "تم الاستيراد بنجاح!" : "Import Complete!"}</p>
              <p className="text-caption text-muted-foreground mt-1">{result.success} {ar ? "صف تم استيراده" : "rows imported successfully"}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 flex justify-end gap-3 shrink-0">
          {step === "upload" && <button onClick={onClose} className={btnSecondary}>{ar ? "إلغاء" : "Cancel"}</button>}
          {step === "preview" && (
            <>
              <button onClick={() => { setStep("upload"); setResult(null); }} className={btnSecondary}>{ar ? "رجوع" : "Back"}</button>
              <button onClick={confirmImport} disabled={!result || result.success === 0 || importing} className={btnPrimary + " disabled:opacity-40"}>
                {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {ar ? `استورد ${result?.success || 0} صف` : `Import ${result?.success || 0} rows`}
              </button>
            </>
          )}
          {step === "result" && <button onClick={onClose} className={btnPrimary}>{ar ? "تم" : "Done"}</button>}
        </div>
      </div>
    </div>
  );
}
