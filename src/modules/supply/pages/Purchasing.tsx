/**
 * Procurement & Suppliers
 *
 * Supplier directory, purchase requests, purchase orders, approval flow.
 * Uses organizations (tagged "supplier") + work_items (type purchase_request/purchase_order).
 */

import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { getDataSource } from "@/platform/data/repository";
import { generateCode, peekNextCode } from "@/platform/lib/code-generator";
import { exportCSV, downloadTemplate } from "@/platform/lib/csv-export";
import { exportName } from "@/platform/lib/brand";
import type { Database } from "@/domain/types";
import {
  Truck, Building2, FileText, Plus, Search, X, Loader2, AlertCircle, Download,
  CheckCircle2, Clock, XCircle, Package, ShoppingCart, ClipboardList,
  DollarSign, Users, ChevronRight, Upload, Trash2,
} from "lucide-react";
import { ConfirmDeleteModal } from "@/app/components/ConfirmDeleteModal";

type Org = Database["public"]["Tables"]["suppliers"]["Row"];
type WorkItem = Database["public"]["Tables"]["procurement_orders"]["Row"];

// ─── Metadata shapes ─────────────────────────────────────

interface VendorMeta {
  org_type?: string;
  payment_terms?: string;
  vendor_category?: string;
  country?: string;
  city?: string;
  notes?: string;
}

interface PRMeta {
  po_number?: string;
  vendor_id?: string;
  vendor_name?: string;
  items_description?: string;
  estimated_amount?: number;
  department?: string;
  currency?: string;
  delivery_date?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
}

function getVendorMeta(org: Org): VendorMeta {
  const m = (org.metadata ?? {}) as Record<string, unknown>;
  return { org_type: m.org_type as string, payment_terms: m.payment_terms as string, vendor_category: m.vendor_category as string, country: m.country as string, city: m.city as string, notes: m.notes as string };
}

function getPRMeta(item: WorkItem): PRMeta {
  const m = (item.metadata ?? {}) as Record<string, unknown>;
  return { po_number: m.po_number as string, vendor_id: m.vendor_id as string, vendor_name: m.vendor_name as string, items_description: m.items_description as string, estimated_amount: m.estimated_amount as number, department: m.department as string, currency: m.currency as string, delivery_date: m.delivery_date as string, approved_by: m.approved_by as string, approved_at: m.approved_at as string, rejection_reason: m.rejection_reason as string };
}

// ─── Constants ───────────────────────────────────────────

const PR_STATUSES: { value: string; en: string; ar: string; pill: string }[] = [
  { value: "draft",     en: "Draft",     ar: "مسودة",           pill: "bg-muted text-muted-foreground" },
  { value: "submitted", en: "Submitted", ar: "تم التقديم",      pill: "bg-info/10 text-info" },
  { value: "approved",  en: "Approved",  ar: "تمت الموافقة",    pill: "bg-success/10 text-success" },
  { value: "rejected",  en: "Rejected",  ar: "مرفوض",           pill: "bg-destructive/10 text-destructive" },
  { value: "ordered",   en: "Ordered",   ar: "تم الطلب",        pill: "bg-chart-4/15 text-chart-4" },
  { value: "cancelled", en: "Cancelled", ar: "ملغي",            pill: "bg-muted text-muted-foreground" },
];

const PO_STATUSES: { value: string; en: string; ar: string; pill: string }[] = [
  { value: "draft",              en: "Draft",              ar: "مسودة",         pill: "bg-muted text-muted-foreground" },
  { value: "sent",               en: "Sent",               ar: "مُرسل",         pill: "bg-info/10 text-info" },
  { value: "partially_received", en: "Partially Received", ar: "استلام جزئي",  pill: "bg-warning/15 text-warning" },
  { value: "received",           en: "Received",           ar: "تم الاستلام",  pill: "bg-success/10 text-success" },
  { value: "cancelled",          en: "Cancelled",          ar: "ملغي",          pill: "bg-muted text-muted-foreground" },
];

const SUPPLIER_CATEGORIES = [
  { en: "Materials", ar: "مواد" }, { en: "Equipment", ar: "معدات" }, { en: "Services", ar: "خدمات" },
  { en: "Technology", ar: "تكنولوجيا" }, { en: "Office Supplies", ar: "مستلزمات مكتبية" },
  { en: "Logistics", ar: "لوجستيات" }, { en: "Consulting", ar: "استشارات" }, { en: "Other", ar: "أخرى" },
];

// ─── Shared UI ───────────────────────────────────────────

const inputCls = "w-full h-10 rounded-xl border border-border/60 bg-background px-3.5 text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20 transition placeholder:text-muted-foreground/50";
const selectCls = inputCls + " appearance-none cursor-pointer";
const labelCls = "text-micro font-medium text-muted-foreground mb-1 block";
const btnPrimary = "flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-body font-medium hover:opacity-90 transition-opacity disabled:opacity-50";

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative bg-background border border-border/60 rounded-2xl shadow-xl w-full max-w-[500px] max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 sticky top-0 bg-background z-10">
          <h2 className="text-title font-medium" style={{ fontFamily: "var(--app-font-display)" }}>{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Add Supplier Modal ────────────────────────────────────

function AddSupplierModal({ onClose, onAdd, ar }: { onClose: () => void; onAdd: (o: Org) => void; ar: boolean }) {
  const { workspace } = useAuth();
  const [form, setForm] = useState({ name: "", category: "", website: "", paymentTerms: "", country: "", city: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !form.name.trim()) return;
    setLoading(true); setError(null);
    try {
      const created = await getDataSource().suppliers.create(workspace.id, {
        name_en: form.name.trim(), name_ar: form.name.trim(),
        category: form.category || null, website: form.website.trim() || null,
        phone: null, email: null,
        // A new supplier has no delivery history yet, so lead time and OTIF
        // stay null rather than being guessed — an invented 100% would make
        // an unproven supplier look like the best one on the list.
        lead_time_days: null, otif_percent: null,
        performance_score: 70,
        contract_expiry: null,
        status: "active",
        tags: [],
        metadata: {
          payment_terms: form.paymentTerms || null,
          country: form.country || null,
          city: form.city || null,
          notes: form.notes.trim() || null,
        },
      });
      if (created) onAdd(created as Org);
      onClose();
    } catch { setError(ar ? "فشل الحفظ" : "Failed to save."); }
    finally { setLoading(false); }
  }

  return (
    <ModalShell title={ar ? "ضيف مورد" : "Add Supplier"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className={labelCls}>{ar ? "اسم المورد" : "Supplier Name"} <span className="text-destructive">*</span></label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus className={inputCls} placeholder={ar ? "مثال: شركة التوريدات العامة" : "e.g. General Supplies Co."} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{ar ? "التصنيف" : "Category"}</label>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={selectCls}>
              <option value="">{ar ? "اختار..." : "Select..."}</option>
              {SUPPLIER_CATEGORIES.map((c) => <option key={c.en} value={c.en}>{ar ? c.ar : c.en}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{ar ? "القطاع" : "Sector"}</label>
            <input type="text" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inputCls} placeholder={ar ? "اختياري" : "Optional"} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{ar ? "البلد" : "Country"}</label>
            <input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{ar ? "المدينة" : "City"}</label>
            <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>{ar ? "شروط الدفع" : "Payment Terms"}</label>
          <input type="text" value={form.paymentTerms} onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))} className={inputCls} placeholder={ar ? "مثال: 30 يوم" : "e.g. Net 30"} />
        </div>
        <div>
          <label className={labelCls}>{ar ? "الموقع الإلكتروني" : "Website"}</label>
          <input type="url" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className={inputCls} placeholder="https://" />
        </div>
        <div>
          <label className={labelCls}>{ar ? "ملاحظات" : "Notes"}</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls + " h-16 py-2.5 resize-none"} placeholder={ar ? "اختياري" : "Optional"} />
        </div>
        {error && <p className="text-caption text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">{ar ? "إلغاء" : "Cancel"}</button>
          <button type="submit" disabled={loading || !form.name.trim()} className={btnPrimary + " flex-1 h-10"}>
            {loading && <Loader2 size={12} className="animate-spin" />} {ar ? "ضيف" : "Add Supplier"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Add Purchase Request Modal ──────────────────────────

function AddPRModal({ onClose, onAdd, ar, suppliers, currency }: { onClose: () => void; onAdd: (w: WorkItem) => void; ar: boolean; suppliers: Org[]; currency: string }) {
  const { workspace } = useAuth();
  const [form, setForm] = useState({ title: "", supplier: "", amount: "", priority: "medium", department: "", items: "", neededBy: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !form.title.trim()) return;
    setLoading(true); setError(null);
    const supplier = suppliers.find((v) => v.id === form.supplier);
    try {
      const created = await getDataSource().procurement_orders.create(workspace.id, {
        title_en: form.title.trim(), title_ar: form.title.trim(),
        type: "purchase_request" as WorkItem["type"],
        status: "draft" as WorkItem["status"],
        priority: form.priority as WorkItem["priority"],
        due_date: form.neededBy || null,
        organization_id: form.supplier || null,
        progress: 0, tags: ["purchasing"],
        metadata: {
          vendor_id: form.supplier || null,
          vendor_name: supplier?.name_en || null,
          items_description: form.items.trim() || null,
          estimated_amount: parseFloat(form.amount) || 0,
          department: form.department || null,
          currency,
        },
      });
      if (created) onAdd(created as WorkItem);
      onClose();
    } catch { setError(ar ? "فشل الحفظ" : "Failed to save."); }
    finally { setLoading(false); }
  }

  return (
    <ModalShell title={ar ? "طلب شراء جديد" : "New Purchase Request"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className={labelCls}>{ar ? "عنوان الطلب" : "Request Title"} <span className="text-destructive">*</span></label>
          <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required autoFocus className={inputCls} placeholder={ar ? "مثال: شراء أجهزة كمبيوتر" : "e.g. Purchase laptops for team"} />
        </div>
        <div>
          <label className={labelCls}>{ar ? "المورد" : "Supplier"}</label>
          <select value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className={selectCls}>
            <option value="">{ar ? "اختار مورد..." : "Select supplier..."}</option>
            {suppliers.map((v) => <option key={v.id} value={v.id}>{v.name_en}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{ar ? "المواد/الخدمات المطلوبة" : "Items / Services"}</label>
          <textarea value={form.items} onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))} className={inputCls + " h-16 py-2.5 resize-none"} placeholder={ar ? "وصف ما تحتاجه..." : "Describe what you need..."} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>{ar ? `المبلغ (${currency})` : `Amount (${currency})`}</label>
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} min="0" className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>{ar ? "الأولوية" : "Priority"}</label>
            <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={selectCls}>
              {["low", "medium", "high", "urgent", "critical"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>{ar ? "مطلوب بحلول" : "Needed By"}</label>
            <input type="date" value={form.neededBy} onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))} className={inputCls} />
          </div>
        </div>
        {error && <p className="text-caption text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">{ar ? "إلغاء" : "Cancel"}</button>
          <button type="submit" disabled={loading || !form.title.trim()} className={btnPrimary + " flex-1 h-10"}>
            {loading && <Loader2 size={12} className="animate-spin" />} {ar ? "أنشئ طلب" : "Create Request"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Add Purchase Order Modal ────────────────────────────

function AddPOModal({ onClose, onAdd, ar, suppliers, currency }: { onClose: () => void; onAdd: (w: WorkItem) => void; ar: boolean; suppliers: Org[]; currency: string }) {
  const { workspace } = useAuth();
  const [form, setForm] = useState({ poNumber: peekNextCode("purchase_order"), title: "", supplier: "", amount: "", deliveryDate: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace || !form.poNumber.trim() || !form.title.trim()) return;
    setLoading(true); setError(null);
    const supplier = suppliers.find((v) => v.id === form.supplier);
    // Mint the code (advancing the counter) only when the auto default is kept.
    const auto = peekNextCode("purchase_order");
    const poNumber = form.poNumber.trim() === auto ? generateCode("purchase_order") : form.poNumber.trim();
    try {
      const created = await getDataSource().procurement_orders.create(workspace.id, {
        title_en: form.title.trim(), title_ar: form.title.trim(),
        type: "purchase_order" as WorkItem["type"],
        status: "draft" as WorkItem["status"],
        priority: "medium" as WorkItem["priority"],
        due_date: form.deliveryDate || null,
        organization_id: form.supplier || null,
        progress: 0, tags: ["purchasing"],
        metadata: {
          po_number: poNumber,
          vendor_id: form.supplier || null,
          vendor_name: supplier?.name_en || null,
          estimated_amount: parseFloat(form.amount) || 0,
          currency,
          delivery_date: form.deliveryDate || null,
        },
      });
      if (created) onAdd(created as WorkItem);
      onClose();
    } catch { setError(ar ? "فشل الحفظ" : "Failed to save."); }
    finally { setLoading(false); }
  }

  return (
    <ModalShell title={ar ? "أمر شراء جديد" : "New Purchase Order"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{ar ? "رقم أمر الشراء" : "PO Number"} <span className="text-destructive">*</span></label>
            <input type="text" value={form.poNumber} onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))} required className={inputCls} placeholder="PO-001" />
          </div>
          <div>
            <label className={labelCls}>{ar ? `المبلغ (${currency})` : `Amount (${currency})`}</label>
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} min="0" className={inputCls} placeholder="0" />
          </div>
        </div>
        <div>
          <label className={labelCls}>{ar ? "وصف الأمر" : "Description"} <span className="text-destructive">*</span></label>
          <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required className={inputCls} placeholder={ar ? "مثال: توريد مواد بناء" : "e.g. Building materials delivery"} />
        </div>
        <div>
          <label className={labelCls}>{ar ? "المورد" : "Supplier"}</label>
          <select value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} className={selectCls}>
            <option value="">{ar ? "اختار مورد..." : "Select supplier..."}</option>
            {suppliers.map((v) => <option key={v.id} value={v.id}>{v.name_en}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{ar ? "تاريخ التسليم المتوقع" : "Expected Delivery"}</label>
          <input type="date" value={form.deliveryDate} onChange={(e) => setForm((f) => ({ ...f, deliveryDate: e.target.value }))} className={inputCls} />
        </div>
        {error && <p className="text-caption text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">{ar ? "إلغاء" : "Cancel"}</button>
          <button type="submit" disabled={loading || !form.poNumber.trim() || !form.title.trim()} className={btnPrimary + " flex-1 h-10"}>
            {loading && <Loader2 size={12} className="animate-spin" />} {ar ? "أنشئ أمر" : "Create PO"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Main page ───────────────────────────────────────────

type PurchTab = "dashboard" | "suppliers" | "requests" | "orders";

export default function Purchasing() {
  const { lang } = useLanguage();
  const { workspace } = useAuth();
  const ar = lang === "ar";
  const settings = workspace?.settings as Record<string, unknown> | undefined;
  const currency = (settings?.currency as string) || "SAR";

  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [tab, setTab] = useState<PurchTab>("dashboard");
  const [search, setSearch] = useState("");
  const [vendorModal, setVendorModal] = useState(false);
  const [prModal, setPrModal] = useState(false);
  const [poModal, setPoModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const wid = workspace?.id || "demo";
    const ds = getDataSource();
    Promise.all([
      ds.suppliers.list(wid),
      ds.procurement_orders.list(wid),
    ]).then(([o, w]) => {
      setOrgs(o as Org[]);
      setWorkItems(w as WorkItem[]);
    }).finally(() => setLoading(false));
  }, [workspace?.id]);

  const suppliers = useMemo(() => orgs.filter((o) => (o.tags ?? []).includes("supplier") || (getVendorMeta(o).org_type === "supplier")), [orgs]);
  const purchaseRequests = useMemo(() => workItems.filter((w) => w.type === "purchase_request"), [workItems]);
  const purchaseOrders = useMemo(() => workItems.filter((w) => w.type === "purchase_order"), [workItems]);

  const openPRs = purchaseRequests.filter((p) => ["draft", "submitted"].includes(p.status));
  const approvedPRs = purchaseRequests.filter((p) => p.status === "approved");
  const pendingApproval = purchaseRequests.filter((p) => p.status === "submitted");
  const openPOs = purchaseOrders.filter((p) => ["draft", "sent"].includes(p.status));
  const totalPRValue = purchaseRequests.reduce((s, p) => s + (getPRMeta(p).estimated_amount || 0), 0);
  const totalPOValue = purchaseOrders.reduce((s, p) => s + (getPRMeta(p).estimated_amount || 0), 0);

  const fmtVal = (v: number) => new Intl.NumberFormat(ar ? "ar-SA" : "en-SA", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);

  // Filtered items per tab
  const filteredVendors = useMemo(() => {
    const q = search.toLowerCase().trim();
    return !q ? suppliers : suppliers.filter((v) => v.name_en.toLowerCase().includes(q) || (v.category ?? "").toLowerCase().includes(q));
  }, [suppliers, search]);

  const filteredPRs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return !q ? purchaseRequests : purchaseRequests.filter((p) => p.title_en.toLowerCase().includes(q) || (getPRMeta(p).vendor_name ?? "").toLowerCase().includes(q));
  }, [purchaseRequests, search]);

  const filteredPOs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return !q ? purchaseOrders : purchaseOrders.filter((p) => p.title_en.toLowerCase().includes(q) || (getPRMeta(p).po_number ?? "").toLowerCase().includes(q));
  }, [purchaseOrders, search]);

  // Approval action
  async function updateStatus(id: string, newStatus: string) {
    await getDataSource().procurement_orders.update(workspace?.id ?? "", id, { status: newStatus as never });
    setWorkItems((prev) => prev.map((w) => w.id === id ? { ...w, status: newStatus as WorkItem["status"] } : w));
  }

  // Delete PR/PO
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    await getDataSource().procurement_orders.remove(workspace?.id || "demo", deleteTarget.id);
    setWorkItems((prev) => prev.filter((w) => w.id !== deleteTarget.id));
    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  const hasData = suppliers.length > 0 || purchaseRequests.length > 0 || purchaseOrders.length > 0;

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 size={20} className="animate-spin text-muted-foreground/40" /></div>;

  return (
    <div className="min-h-full">
      {/* ── Header with metrics ── */}
      <div className="border-b border-border/40 px-7 md:px-10 py-7" style={{ background: "linear-gradient(160deg, hsl(var(--muted)/0.3) 0%, hsl(var(--background)) 60%)" }}>
        <div className="max-w-[1100px]">
          <div className="flex items-center gap-2.5 mb-2">
            <ShoppingCart size={14} className="text-brand-ink" />
            <p className="text-micro text-muted-foreground/60 tracking-[0.08em] uppercase">{ar ? "المشتريات" : "Purchasing"}</p>
          </div>
          <div className="flex items-start justify-between gap-4 mb-5">
            <h1 className="text-display font-medium text-foreground leading-tight" style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.025em" }}>
              {ar ? "المشتريات والموردين" : "Purchasing & Supplier"}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setVendorModal(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 text-caption font-medium hover:bg-muted/50 transition-colors">
                <Building2 size={13} /> {ar ? "ضيف مورد" : "Add Supplier"}
              </button>
              <button onClick={() => setPrModal(true)} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 text-caption font-medium hover:bg-muted/50 transition-colors">
                <ClipboardList size={13} /> {ar ? "طلب شراء" : "New PR"}
              </button>
              <button onClick={() => setPoModal(true)} className={btnPrimary + " h-9"}>
                <FileText size={14} /> {ar ? "أمر شراء" : "New PO"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: Building2, value: suppliers.length, label: ar ? "الموردين" : "Supplier", color: "text-chart-4" },
              { icon: ClipboardList, value: openPRs.length, label: ar ? "طلبات مفتوحة" : "Open PRs", color: "text-info" },
              { icon: Clock, value: pendingApproval.length, label: ar ? "مستني موافقة" : "Pending Approval", color: "text-warning" },
              { icon: CheckCircle2, value: approvedPRs.length, label: ar ? "تمت الموافقة" : "Approved", color: "text-success" },
              { icon: FileText, value: openPOs.length, label: ar ? "أوامر مفتوحة" : "Open POs", color: "text-brand-ink" },
              { icon: DollarSign, value: fmtVal(totalPOValue), label: ar ? "قيمة الأوامر" : "PO Value", color: "text-foreground", isText: true },
            ].map((m, i) => (
              <div key={i} className="bg-background border border-border/40 rounded-xl px-4 py-3.5">
                <m.icon size={14} strokeWidth={1.75} className={m.color + " mb-2"} />
                <p className="text-title font-medium text-foreground leading-none tabular-nums mb-1" style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.02em" }}>
                  {typeof m.value === "number" ? m.value : m.value}
                </p>
                <p className="text-micro text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <div className="px-7 md:px-10 flex items-center gap-0">
          {([
            { id: "dashboard" as const, en: "Overview", ar: "نظرة عامة" },
            { id: "suppliers" as const, en: `Supplier (${suppliers.length})`, ar: `الموردين (${suppliers.length})` },
            { id: "requests" as const, en: `Requests (${purchaseRequests.length})`, ar: `الطلبات (${purchaseRequests.length})` },
            { id: "orders" as const, en: `Orders (${purchaseOrders.length})`, ar: `الأوامر (${purchaseOrders.length})` },
          ]).map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(""); }}
              className={`px-4 py-3 text-caption font-medium border-b-2 transition-all ${tab === t.id ? "border-primary text-brand-ink" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {ar ? t.ar : t.en}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-7 md:px-10 py-6 max-w-[1100px]">
        {!hasData && tab === "dashboard" ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
              <ShoppingCart size={24} className="text-muted-foreground/40" />
            </div>
            <div className="text-center max-w-[400px]">
              <p className="text-body-lg font-medium mb-1" style={{ fontFamily: "var(--app-font-display)" }}>
                {ar ? "مفيش بيانات مشتريات لسه" : "No purchasing data yet"}
              </p>
              <p className="text-body text-muted-foreground leading-relaxed">
                {ar ? "ضيف أول مورد أو أنشئ طلب شراء عشان تبدأ." : "Add your first supplier or create a purchase request to get started."}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setVendorModal(true)} className={btnPrimary + " h-10"}>
                <Building2 size={14} /> {ar ? "ضيف مورد" : "Add Supplier"}
              </button>
              <button onClick={() => setPrModal(true)} className="flex items-center gap-2 h-10 px-5 rounded-xl border border-border/60 text-body font-medium hover:bg-muted/50 transition-colors">
                <ClipboardList size={14} /> {ar ? "طلب شراء" : "New PR"}
              </button>
            </div>
          </div>
        ) : tab === "dashboard" ? (
          /* Dashboard overview — show recent items */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending approvals */}
            <div>
              <h3 className="text-body font-medium mb-3" style={{ fontFamily: "var(--app-font-display)" }}>
                {ar ? "مستني موافقة" : "Pending Approval"} <span className="text-warning ml-1">{pendingApproval.length}</span>
              </h3>
              {pendingApproval.length === 0 ? (
                <p className="text-caption text-muted-foreground/50 py-8 text-center">{ar ? "مفيش طلبات معلقة" : "No pending requests"}</p>
              ) : (
                <div className="space-y-2">
                  {pendingApproval.slice(0, 5).map((pr) => {
                    const meta = getPRMeta(pr);
                    return (
                      <div key={pr.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-warning/30 bg-warning/10">
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-medium truncate" style={{ fontFamily: "var(--app-font-display)" }}>{pr.title_en}</p>
                          <p className="text-micro text-muted-foreground mt-0.5">{meta.vendor_name || (ar ? "بدون مورد" : "No supplier")} · {meta.estimated_amount ? fmtVal(meta.estimated_amount) : ""}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => updateStatus(pr.id, "approved")} className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center hover:bg-success/10 transition-colors" title={ar ? "موافقة" : "Approve"}>
                            <CheckCircle2 size={15} />
                          </button>
                          <button onClick={() => updateStatus(pr.id, "rejected")} className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors" title={ar ? "رفض" : "Reject"}>
                            <XCircle size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent POs */}
            <div>
              <h3 className="text-body font-medium mb-3" style={{ fontFamily: "var(--app-font-display)" }}>
                {ar ? "أوامر شراء حديثة" : "Recent Purchase Orders"} <span className="text-brand-ink ml-1">{purchaseOrders.length}</span>
              </h3>
              {purchaseOrders.length === 0 ? (
                <p className="text-caption text-muted-foreground/50 py-8 text-center">{ar ? "مفيش أوامر شراء" : "No purchase orders"}</p>
              ) : (
                <div className="space-y-2">
                  {purchaseOrders.slice(0, 5).map((po) => {
                    const meta = getPRMeta(po);
                    const st = PO_STATUSES.find((s) => s.value === po.status) ?? PO_STATUSES[0];
                    return (
                      <div key={po.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border/40 bg-background hover:shadow-sm transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-micro font-mono text-muted-foreground">{meta.po_number}</span>
                            <span className={`text-micro px-2 py-0.5 rounded-full font-medium ${st.pill}`}>{ar ? st.ar : st.en}</span>
                          </div>
                          <p className="text-body font-medium truncate" style={{ fontFamily: "var(--app-font-display)" }}>{po.title_en}</p>
                        </div>
                        {meta.estimated_amount ? <p className="text-body font-semibold tabular-nums shrink-0" style={{ fontFamily: "var(--app-font-display)" }}>{fmtVal(meta.estimated_amount)}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : tab === "suppliers" ? (
          /* Supplier list */
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-[300px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={ar ? "ابحث في الموردين..." : "Search suppliers..."} className="w-full h-9 pl-9 pr-4 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-1 focus:ring-brand-ink/30" />
              </div>
              <div className="flex-1" />
              {suppliers.length > 0 && (
                <button onClick={() => exportCSV(suppliers, exportName("suppliers") + ".csv")} className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 text-caption font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <Download size={13} /> {ar ? "صدّر" : "Export"}
                </button>
              )}
            </div>
            {filteredVendors.length === 0 ? (
              <div className="py-16 text-center text-body text-muted-foreground/50">{search ? (ar ? "مفيش نتائج" : "No results") : (ar ? "مفيش موردين لسه" : "No suppliers yet")}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredVendors.map((v) => {
                  const meta = getVendorMeta(v);
                  return (
                    <div key={v.id} className="bg-background border border-border/40 rounded-xl p-5 hover:shadow-sm hover:border-border/70 transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-chart-4/15 text-chart-4 flex items-center justify-center text-micro font-semibold shrink-0">
                          {v.name_en.split(" ").slice(0,2).map((w) => w[0]).join("").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-lg font-medium truncate" style={{ fontFamily: "var(--app-font-display)" }}>{v.name_en}</p>
                          {v.category && <p className="text-micro text-muted-foreground truncate mt-0.5">{v.category}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {meta.vendor_category && <span className="text-micro px-2 py-0.5 rounded-full bg-chart-4/10 text-chart-4 font-medium">{meta.vendor_category}</span>}
                        {meta.payment_terms && <span className="text-micro px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{meta.payment_terms}</span>}
                        {meta.country && <span className="text-micro text-muted-foreground">{[meta.city, meta.country].filter(Boolean).join(", ")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : tab === "requests" ? (
          /* Purchase requests */
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-[300px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={ar ? "ابحث..." : "Search..."} className="w-full h-9 pl-9 pr-4 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-1 focus:ring-brand-ink/30" />
              </div>
              <div className="flex-1" />
              <button onClick={() => setPrModal(true)} className={btnPrimary + " h-9"}><Plus size={14} /> {ar ? "طلب جديد" : "New Request"}</button>
            </div>
            {filteredPRs.length === 0 ? (
              <div className="py-16 text-center text-body text-muted-foreground/50">{ar ? "مفيش طلبات شراء" : "No purchase requests"}</div>
            ) : (
              <div className="space-y-2">
                {filteredPRs.map((pr) => {
                  const meta = getPRMeta(pr);
                  const st = PR_STATUSES.find((s) => s.value === pr.status) ?? PR_STATUSES[0];
                  return (
                    <div key={pr.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-background hover:shadow-sm transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-micro px-2 py-0.5 rounded-full font-medium ${st.pill}`}>{ar ? st.ar : st.en}</span>
                          <span className="text-micro text-muted-foreground">{meta.vendor_name || ""}</span>
                        </div>
                        <p className="text-body-lg font-medium truncate" style={{ fontFamily: "var(--app-font-display)" }}>{ar ? (pr.title_ar ?? pr.title_en) : pr.title_en}</p>
                        {pr.due_date && <p className="text-micro text-muted-foreground mt-0.5">{ar ? "مطلوب بحلول" : "Needed by"} {pr.due_date.slice(0,10)}</p>}
                      </div>
                      {meta.estimated_amount ? <p className="text-body-lg font-semibold tabular-nums shrink-0" style={{ fontFamily: "var(--app-font-display)" }}>{fmtVal(meta.estimated_amount)}</p> : null}
                      {pr.status === "submitted" && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => updateStatus(pr.id, "approved")} className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center hover:bg-success/10 transition-colors"><CheckCircle2 size={14} /></button>
                          <button onClick={() => updateStatus(pr.id, "rejected")} className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors"><XCircle size={14} /></button>
                        </div>
                      )}
                      {pr.status === "draft" && (
                        <button onClick={() => updateStatus(pr.id, "submitted")} className="text-micro text-brand-ink font-medium hover:opacity-70">{ar ? "قدّم" : "Submit"}</button>
                      )}
                      <button onClick={() => setDeleteTarget(pr)} title={ar ? "حذف" : "Delete"} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Purchase orders */
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-[300px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={ar ? "ابحث..." : "Search..."} className="w-full h-9 pl-9 pr-4 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-1 focus:ring-brand-ink/30" />
              </div>
              <div className="flex-1" />
              {purchaseOrders.length > 0 && (
                <button onClick={() => { const rows = purchaseOrders.map((p) => { const m = getPRMeta(p); return { po_number: m.po_number, title: p.title_en, supplier: m.vendor_name, amount: m.estimated_amount, status: p.status, delivery_date: m.delivery_date, created_at: p.created_at }; }); exportCSV(rows, exportName("purchase-orders") + ".csv"); }}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border/60 text-caption font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                  <Download size={13} /> {ar ? "صدّر" : "Export"}
                </button>
              )}
              <button onClick={() => setPoModal(true)} className={btnPrimary + " h-9"}><Plus size={14} /> {ar ? "أمر جديد" : "New PO"}</button>
            </div>
            {filteredPOs.length === 0 ? (
              <div className="py-16 text-center text-body text-muted-foreground/50">{ar ? "مفيش أوامر شراء" : "No purchase orders"}</div>
            ) : (
              <div className="space-y-2">
                {filteredPOs.map((po) => {
                  const meta = getPRMeta(po);
                  const st = PO_STATUSES.find((s) => s.value === po.status) ?? PO_STATUSES[0];
                  return (
                    <div key={po.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-background hover:shadow-sm transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-micro font-mono text-muted-foreground">{meta.po_number}</span>
                          <span className={`text-micro px-2 py-0.5 rounded-full font-medium ${st.pill}`}>{ar ? st.ar : st.en}</span>
                        </div>
                        <p className="text-body-lg font-medium truncate" style={{ fontFamily: "var(--app-font-display)" }}>{po.title_en}</p>
                        <p className="text-micro text-muted-foreground mt-0.5">{meta.vendor_name || ""}{meta.delivery_date ? ` · ${ar ? "تسليم" : "Delivery"} ${meta.delivery_date}` : ""}</p>
                      </div>
                      {meta.estimated_amount ? <p className="text-body-lg font-semibold tabular-nums shrink-0" style={{ fontFamily: "var(--app-font-display)" }}>{fmtVal(meta.estimated_amount)}</p> : null}
                      {po.status === "draft" && (
                        <button onClick={() => updateStatus(po.id, "sent")} className="text-micro text-brand-ink font-medium hover:opacity-70">{ar ? "أرسل" : "Send"}</button>
                      )}
                      {po.status === "sent" && (
                        <button onClick={() => updateStatus(po.id, "received")} className="text-micro text-success font-medium hover:opacity-70">{ar ? "تم الاستلام" : "Received"}</button>
                      )}
                      <button onClick={() => setDeleteTarget(po)} title={ar ? "حذف" : "Delete"} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {vendorModal && <AddSupplierModal ar={ar} onClose={() => setVendorModal(false)} onAdd={(o) => setOrgs((prev) => [o, ...prev])} />}
      {prModal && <AddPRModal ar={ar} suppliers={suppliers} currency={currency} onClose={() => setPrModal(false)} onAdd={(w) => setWorkItems((prev) => [w, ...prev])} />}
      {poModal && <AddPOModal ar={ar} suppliers={suppliers} currency={currency} onClose={() => setPoModal(false)} onAdd={(w) => setWorkItems((prev) => [w, ...prev])} />}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        ar={ar}
        title={deleteTarget?.type === "purchase_order" ? (ar ? "حذف أمر الشراء" : "Delete Purchase Order") : (ar ? "حذف طلب الشراء" : "Delete Purchase Request")}
        itemName={deleteTarget ? (getPRMeta(deleteTarget).po_number || deleteTarget.title_en) : ""}
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

    </div>
  );
}
