/**
 * Universal CSV Import Modal
 *
 * Workflow: Select file → Preview & Validate → Import
 * Shows valid/invalid/duplicate rows before committing.
 */

import { useState, useRef } from "react";
import {
  X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download,
} from "lucide-react";
import { parseCSV, downloadTemplate, type ImportTemplate } from "@/platform/lib/csv-export";
import { exportName } from "@/platform/lib/brand";
import { getDataSource, type EntityAdapter } from "@/platform/data/repository";
import { useAuth } from "@/app/context/AuthContext";

interface CsvImportProps {
  open: boolean;
  onClose: () => void;
  template: ImportTemplate;
  adapter: EntityAdapter<any>;
  ar: boolean;
  onComplete: (count: number) => void;
}

type RowStatus = "valid" | "invalid" | "imported" | "failed";

interface PreviewRow {
  data: Record<string, string>;
  mapped: Record<string, unknown>;
  status: RowStatus;
  error?: string;
}

export function CsvImport({ open, onClose, template, adapter, ar, onComplete }: CsvImportProps) {
  const { workspace } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  function reset() {
    setStep("upload");
    setRows([]);
    setImportedCount(0);
    setFailedCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows: parsed } = parseCSV(text);

      // Check headers match
      const missingRequired = template.requiredHeaders.filter((h) => !headers.includes(h));

      const preview: PreviewRow[] = parsed.map((row) => {
        // Validate required fields
        const missingFields = template.requiredHeaders.filter((h) => !row[h]?.trim());
        if (missingRequired.length > 0) {
          return { data: row, mapped: {}, status: "invalid" as const, error: `Missing columns: ${missingRequired.join(", ")}` };
        }
        if (missingFields.length > 0) {
          return { data: row, mapped: {}, status: "invalid" as const, error: ar ? `حقول ناقصة: ${missingFields.join(", ")}` : `Missing: ${missingFields.join(", ")}` };
        }
        try {
          const mapped = template.mapRow(row);
          return { data: row, mapped, status: "valid" as const };
        } catch {
          return { data: row, mapped: {}, status: "invalid" as const, error: ar ? "خطأ في تحويل البيانات" : "Data mapping error" };
        }
      });

      setRows(preview);
      setStep("preview");
    };
    reader.readAsText(file);

    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    if (!workspace) return;
    setStep("importing");

    let imported = 0;
    let failed = 0;

    const validRows = rows.filter((r) => r.status === "valid");

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const result = await adapter.create(workspace.id, row.mapped);
        if (result) {
          row.status = "imported";
          imported++;
        } else {
          row.status = "failed";
          row.error = ar ? "فشل الحفظ" : "Save failed";
          failed++;
        }
      } catch {
        row.status = "failed";
        row.error = ar ? "خطأ في الحفظ" : "Save error";
        failed++;
      }
      setRows([...rows]);
      setImportedCount(imported);
      setFailedCount(failed);
    }

    setStep("done");
    if (imported > 0) onComplete(imported);
  }

  const validCount = rows.filter((r) => r.status === "valid").length;
  const invalidCount = rows.filter((r) => r.status === "invalid").length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[3px]" onClick={handleClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl shadow-xl w-full max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0">
          <h2 className="text-title font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
            {ar ? `استيراد ${template.labelAr}` : `Import ${template.labelEn}`}
          </h2>
          <button onClick={handleClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-5">
              <div className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
                <Upload size={24} className="mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-body-lg font-medium mb-1">
                  {ar ? "اختار ملف CSV" : "Select CSV File"}
                </p>
                <p className="text-caption text-muted-foreground mb-4">
                  {ar ? "ارفع ملف CSV يحتوي على البيانات" : "Upload a CSV file with your data"}
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 cursor-pointer transition-opacity">
                  <FileText size={14} />
                  {ar ? "اختار ملف" : "Choose File"}
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-micro text-muted-foreground">{ar ? "أو" : "or"}</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              <button onClick={() => downloadTemplate(template.headers, `${exportName(template.id)}-template.csv`)}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border/60 text-body font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                <Download size={14} />
                {ar ? "حمّل نموذج جاهز" : "Download Template"}
              </button>

              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-micro font-medium text-foreground mb-2">{ar ? "الأعمدة المطلوبة" : "Required Columns"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {template.headers.map((h) => (
                    <span key={h} className={`text-micro px-2 py-0.5 rounded-full font-mono ${
                      template.requiredHeaders.includes(h)
                        ? "bg-primary/10 text-brand-ink border border-primary/20"
                        : "bg-muted text-muted-foreground border border-border/40"
                    }`}>
                      {h}{template.requiredHeaders.includes(h) ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-3">
                <span className="text-caption font-medium bg-success/10 text-success px-2.5 py-1 rounded-full">
                  {validCount} {ar ? "صالح" : "valid"}
                </span>
                {invalidCount > 0 && (
                  <span className="text-caption font-medium bg-destructive/10 text-destructive px-2.5 py-1 rounded-full">
                    {invalidCount} {ar ? "غير صالح" : "invalid"}
                  </span>
                )}
                <span className="text-caption text-muted-foreground">
                  {ar ? `${rows.length} سجل إجمالي` : `${rows.length} total rows`}
                </span>
              </div>

              {/* Row list */}
              <div className="border border-border/40 rounded-xl overflow-hidden divide-y divide-border/30 max-h-[300px] overflow-auto">
                {rows.map((row, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 text-caption ${
                    row.status === "invalid" ? "bg-destructive/30" : "bg-background"
                  }`}>
                    <div className="shrink-0 mt-0.5">
                      {row.status === "valid" ? (
                        <CheckCircle2 size={14} className="text-success" />
                      ) : (
                        <AlertCircle size={14} className="text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">
                        {row.data[template.requiredHeaders[0]] || `Row ${i + 1}`}
                      </p>
                      {row.error && <p className="text-destructive text-micro mt-0.5">{row.error}</p>}
                    </div>
                    <span className="text-muted-foreground/50 tabular-nums shrink-0">#{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 size={24} className="animate-spin text-brand-ink" />
              <p className="text-body-lg font-medium">
                {ar ? "جاري الاستيراد..." : "Importing..."}
              </p>
              <p className="text-caption text-muted-foreground">
                {importedCount} / {validCount}
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-success" />
              </div>
              <div className="text-center">
                <p className="text-title font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
                  {ar ? "تم الاستيراد بنجاح" : "Import Complete"}
                </p>
                <p className="text-body text-muted-foreground mt-1">
                  {ar
                    ? `تم استيراد ${importedCount} سجل${failedCount > 0 ? ` · ${failedCount} فشل` : ""}`
                    : `${importedCount} imported${failedCount > 0 ? ` · ${failedCount} failed` : ""}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 flex items-center justify-end gap-3">
          {step === "upload" && (
            <button onClick={handleClose} className="h-9 px-4 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">
              {ar ? "إلغاء" : "Cancel"}
            </button>
          )}
          {step === "preview" && (
            <>
              <button onClick={reset} className="h-9 px-4 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">
                {ar ? "رجوع" : "Back"}
              </button>
              <button onClick={handleImport} disabled={validCount === 0}
                className="h-9 px-5 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                <Upload size={14} />
                {ar ? `استورد ${validCount} سجل` : `Import ${validCount} rows`}
              </button>
            </>
          )}
          {step === "done" && (
            <button onClick={handleClose}
              className="h-9 px-5 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 transition-opacity">
              {ar ? "تم" : "Done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
