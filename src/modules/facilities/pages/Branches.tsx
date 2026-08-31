import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { getDataSource } from "@/platform/data/repository";
import type { Database } from "@/domain/types";
import {
  Building2, MapPin, Phone, User, Plus, Search, X, Loader2,
  Edit, Trash2, ChevronRight,
} from "lucide-react";

type Branch = Database["public"]["Tables"]["facilities"]["Row"];

const BRANCH_TYPES = [
  { value: "factory", en: "Factory", ar: "مصنع", color: "bg-warning/15 text-warning" },
  { value: "showroom", en: "Showroom", ar: "معرض", color: "bg-chart-4/15 text-chart-4" },
  { value: "warehouse", en: "Warehouse", ar: "مخزن", color: "bg-info/10 text-info" },
  { value: "retail", en: "Retail", ar: "تجزئة", color: "bg-success/10 text-success" },
  { value: "office", en: "Office", ar: "مكتب", color: "bg-muted text-muted-foreground" },
];

const inputCls = "w-full h-10 rounded-xl border border-border/60 bg-background px-3.5 text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20 transition placeholder:text-muted-foreground/50";
const selectCls = inputCls + " appearance-none cursor-pointer";
const labelCls = "text-micro font-medium text-muted-foreground mb-1 block";
const btnPrimary = "flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 transition-opacity disabled:opacity-50";

// ─── Branch Modal ────────────────────────────────────────

function BranchModal({ onClose, onSaved, ar, initial }: {
  onClose: () => void; onSaved: (b: Branch) => void; ar: boolean; initial?: Branch;
}) {
  const { workspace } = useAuth();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    nameAr: initial?.name_ar ?? "",
    code: initial?.branch_code ?? "",
    type: initial?.branch_type ?? "retail",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    manager: initial?.manager_name ?? "",
    active: initial?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !form.name.trim()) return;
    setLoading(true); setError(null);
    try {
      const ds = getDataSource();
      const wid = workspace?.id || "demo";
      const payload = {
        name: form.name.trim(),
        name_ar: form.nameAr || undefined,
        branch_code: form.code || undefined,
        branch_type: form.type,
        address: form.address || undefined,
        phone: form.phone || undefined,
        manager_name: form.manager || undefined,
        is_active: form.active,
        metadata: {},
      };
      if (initial) {
        await ds.facilities.update(wid, initial.id, payload as Record<string, unknown>);
        onSaved({ ...initial, ...payload } as Branch);
      } else {
        const created = await ds.facilities.create(wid, payload as Record<string, unknown>);
        if (created) onSaved(created as Branch);
      }
      onClose();
    } catch { setError(ar ? "فشل الحفظ" : "Failed to save."); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl shadow-xl w-full max-w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 sticky top-0 bg-background z-10">
          <h2 className="text-title font-medium" style={{ fontFamily: "var(--app-font-display)" }}>
            {initial ? (ar ? "تعديل الفرع" : "Edit Branch") : (ar ? "إضافة فرع" : "Add Branch")}
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{ar ? "الاسم (EN)" : "Name"} <span className="text-destructive">*</span></label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus className={inputCls} placeholder={ar ? "مثال: فرع المعادي" : "e.g. Maadi Branch"} />
            </div>
            <div>
              <label className={labelCls}>{ar ? "الاسم (AR)" : "Name (AR)"}</label>
              <input type="text" value={form.nameAr} onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))} className={inputCls} dir="rtl" placeholder="مثال: فرع المعادي" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{ar ? "الكود" : "Code"}</label>
              <input type="text" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputCls} placeholder="BR-001" />
            </div>
            <div>
              <label className={labelCls}>{ar ? "النوع" : "Type"}</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={selectCls}>
                {BRANCH_TYPES.map((t) => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>{ar ? "العنوان" : "Address"}</label>
            <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={inputCls} placeholder={ar ? "مثال: شارع المعادي" : "e.g. Maadi St"} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{ar ? "الهاتف" : "Phone"}</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="+20 ..." />
            </div>
            <div>
              <label className={labelCls}>{ar ? "المدير" : "Manager"}</label>
              <input type="text" value={form.manager} onChange={(e) => setForm((f) => ({ ...f, manager: e.target.value }))} className={inputCls} placeholder={ar ? "اسم المدير" : "Manager name"} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="sr-only peer" />
              <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary/80 transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-caption text-foreground">{ar ? "نشط" : "Active"}</span>
          </div>
          {error && <p className="text-caption text-destructive flex items-center gap-1">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">{ar ? "إلغاء" : "Cancel"}</button>
            <button type="submit" disabled={loading || !form.name.trim()} className={btnPrimary + " flex-1 h-10"}>
              {loading && <Loader2 size={12} className="animate-spin" />} {initial ? (ar ? "احفظ" : "Save") : (ar ? "إضافة" : "Add")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function BranchesPage() {
  const { lang, isRtl } = useLanguage();
  const { workspace } = useAuth();
  const wsId = workspace?.id || "demo";
  const ds = useMemo(() => getDataSource(), []);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const b = await ds.facilities.list(wsId);
      setBranches(b as Branch[]);
      setLoading(false);
    }
    load();
  }, [wsId, ds]);

  const filteredBranches = useMemo(() => {
    if (!searchQuery) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter((b) => b.name.toLowerCase().includes(q) || (b.name_ar && b.name_ar.includes(searchQuery)) || b.branch_code.toLowerCase().includes(q));
  }, [branches, searchQuery]);

  function getBranchType(value: string) {
    return BRANCH_TYPES.find((t) => t.value === value) ?? BRANCH_TYPES[BRANCH_TYPES.length - 1];
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Building2 size={24} className="mx-auto text-muted-foreground/40 animate-pulse" />
          <p className="text-body text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-56px)] flex overflow-hidden bg-background">
      {/* ─── Left: Branch List ─── */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-border/40">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/40">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-body-lg font-semibold text-foreground" style={{ fontFamily: "var(--app-font-display)" }}>
              {lang === "ar" ? "الفروع" : "Branches"}
            </h1>
            <button
              onClick={() => { setEditBranch(null); setShowBranchModal(true); }}
              className="w-8 h-8 rounded-lg bg-primary/10 text-brand-ink flex items-center justify-center hover:bg-primary/20 transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "ar" ? "بحث عن فرع..." : "Search branches..."}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-body placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-brand-ink/30"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredBranches.map((branch) => {
            const bt = getBranchType(branch.branch_type);
            const isActive = selectedBranch?.id === branch.id;
            return (
              <button
                key={branch.id}
                onClick={() => setSelectedBranch(branch)}
                className={`w-full px-4 py-3 text-left hover:bg-muted/40 transition-colors border-b border-border/20 ${isActive ? "bg-primary/5 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bt.color}`}>
                      <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-body font-medium text-foreground truncate">{branch.name}</p>
                      {branch.name_ar && <p className="text-micro text-muted-foreground truncate" dir="rtl">{branch.name_ar}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-micro px-1.5 py-0.5 rounded-full ${bt.color}`}>{lang === "ar" ? bt.ar : bt.en}</span>
                        {!branch.is_active && (
                          <span className="text-micro text-destructive">{lang === "ar" ? "غير نشط" : "Inactive"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/30 shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
          {filteredBranches.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Building2 size={20} className="text-muted-foreground/30 mb-2" />
              <p className="text-caption text-muted-foreground">{lang === "ar" ? "لا توجد فروع" : "No branches found"}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Branch Detail ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {selectedBranch ? (
          <div className="max-w-[720px] mx-auto w-full p-6 space-y-6">
            {/* Branch Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {(() => {
                  const bt = getBranchType(selectedBranch.branch_type);
                  return (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bt.color}`}>
                      <Building2 size={18} />
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-title font-semibold text-foreground" style={{ fontFamily: "var(--app-font-display)" }}>
                    {selectedBranch.name}
                  </h2>
                  {selectedBranch.name_ar && <p className="text-body text-muted-foreground" dir="rtl">{selectedBranch.name_ar}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-micro font-mono text-muted-foreground/60">{selectedBranch.branch_code}</span>
                    <span className="text-micro text-muted-foreground/40">·</span>
                    <span className="text-micro text-muted-foreground/60">{selectedBranch.branch_type}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setEditBranch(selectedBranch); setShowBranchModal(true); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-border/60 hover:bg-muted/50 transition-colors"
                >
                  <Edit size={13} />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(lang === "ar" ? "هل أنت متأكد؟" : "Are you sure?")) return;
                    await ds.facilities.remove(wsId, selectedBranch.id);
                    setBranches((prev) => prev.filter((b) => b.id !== selectedBranch.id));
                    setSelectedBranch(null);
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-border/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background border border-border/40 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin size={12} className="text-muted-foreground/50" />
                  <span className="text-micro text-muted-foreground/60 uppercase tracking-wider">{lang === "ar" ? "العنوان" : "Address"}</span>
                </div>
                <p className="text-caption text-foreground">{selectedBranch.address || "—"}</p>
              </div>
              <div className="bg-background border border-border/40 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Phone size={12} className="text-muted-foreground/50" />
                  <span className="text-micro text-muted-foreground/60 uppercase tracking-wider">{lang === "ar" ? "الهاتف" : "Phone"}</span>
                </div>
                <p className="text-caption text-foreground">{selectedBranch.phone || "—"}</p>
              </div>
              <div className="bg-background border border-border/40 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <User size={12} className="text-muted-foreground/50" />
                  <span className="text-micro text-muted-foreground/60 uppercase tracking-wider">{lang === "ar" ? "المدير" : "Manager"}</span>
                </div>
                <p className="text-caption text-foreground">{selectedBranch.manager_name || "—"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <Building2 size={32} className="mx-auto text-muted-foreground/20" />
              <div>
                <p className="text-body-lg font-medium text-foreground" style={{ fontFamily: "var(--app-font-display)" }}>
                  {lang === "ar" ? "اختر فرعاً" : "Select a branch"}
                </p>
                <p className="text-caption text-muted-foreground mt-1">
                  {lang === "ar" ? "من القائمة على اليسار" : "from the list on the left"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      {showBranchModal && (
        <BranchModal
          ar={lang === "ar"}
          initial={editBranch ?? undefined}
          onClose={() => { setShowBranchModal(false); setEditBranch(null); }}
          onSaved={(b) => {
            if (editBranch) setBranches((prev) => prev.map((x) => x.id === b.id ? b : x));
            else setBranches((prev) => [...prev, b]);
            if (selectedBranch?.id === b.id) setSelectedBranch(b);
          }}
        />
      )}
    </div>
  );
}
