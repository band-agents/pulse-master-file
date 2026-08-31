import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/app/context/LanguageContext";
import { useAuth } from "@/app/context/AuthContext";
import { isDemoMode, getSupabaseClient } from "@/platform/lib/supabase";
import { DEPARTMENTS } from "@/platform/lib/access-control";
import {
  MODULES, PERMISSION_LABELS, ROLE_TEMPLATES, type PermissionMap, type PermissionAction,
  hasPermission, countPermissions, countDangerousPermissions, getTemplateById,
} from "@/platform/lib/permissions";
import { UserDetailDrawer } from "@/app/components/UserDetailDrawer";
import { InviteUserModal } from "@/app/components/InviteUserModal";
import {
  Users, Plus, X, Shield, Clock, CheckCircle2, AlertCircle, Loader2,
  Check, UserPlus, Building2, Eye, Edit3, Trash2, AlertTriangle,
  Lock, Key, Briefcase, ChevronDown, ChevronRight, Search,
  Filter, ArrowUpDown, Mail, Phone, Activity, Star, Send,
  Download, Upload, MoreHorizontal, UserCheck, UserX, Copy,
  BarChart3, TrendingUp,   ShieldCheck, ShieldAlert, Fingerprint, Globe,
  Smartphone, Monitor, LogOut, History, Settings, EyeOff,
  Grid3X3, List, RefreshCw, Link, Calendar, Ban,
} from "lucide-react";

const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-caption font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 text-micro font-medium px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors";
const inputCls = "w-full h-10 px-3 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20";
const labelCls = "text-micro text-muted-foreground font-medium mb-1 block";

interface Member {
  id: string;
  user_id: string;
  role: string;
  department?: string;
  display_name?: string;
  status: string;
  email?: string;
  phone?: string;
  permissions?: PermissionMap;
  joined_at?: string;
  last_active?: string;
  avatar_url?: string;
  two_factor?: boolean;
  branch_access?: string[];
  login_count?: number;
}

interface PendingInvite {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  sent_at: string;
  status: "pending" | "accepted" | "expired";
}

type Tab = "dashboard" | "members" | "invites" | "roles" | "audit";

/**
 * The same clinical staff who appear in the seeded providers and employee
 * records, so a person's name means the same thing on every screen.
 */
const DEMO_MEMBERS: Member[] = [
  { id: "1", user_id: "u1", role: "owner", department: "cardiology", display_name: "Dr. Hala Al-Rasheed", status: "active", email: "h.rasheed@alobour.sa", phone: "+966-55-410-0001", joined_at: "2022-03-01", last_active: "Just now", login_count: 812, two_factor: true, branch_access: ["br-01", "br-02"] },
  { id: "2", user_id: "u2", role: "admin", department: "administration", display_name: "System Administrator", status: "active", email: "it.admin@alobour.sa", phone: "+966-55-410-0100", joined_at: "2022-03-01", last_active: "12 min ago", login_count: 604, two_factor: true, branch_access: ["br-01", "br-02", "br-03", "br-04"] },
  { id: "3", user_id: "u3", role: "surgeon", department: "surgery", display_name: "Dr. Faisal Al-Harthy", status: "active", email: "f.harthy@alobour.sa", phone: "+966-55-410-0002", joined_at: "2022-08-14", last_active: "40 min ago", login_count: 388, two_factor: true, branch_access: ["br-01"] },
  { id: "4", user_id: "u4", role: "physician", department: "cardiology", display_name: "Dr. Maha Al-Sanea", status: "active", email: "m.sanea@alobour.sa", phone: "+966-55-410-0004", joined_at: "2024-09-02", last_active: "1 hour ago", login_count: 211, two_factor: false, branch_access: ["br-01"] },
  { id: "5", user_id: "u5", role: "resident", department: "emergency", display_name: "Dr. Rakan Al-Shammari", status: "active", email: "r.shammari@alobour.sa", phone: "+966-55-410-0081", joined_at: "2026-02-10", last_active: "8 min ago", login_count: 96, two_factor: false, branch_access: ["br-01"] },
  { id: "6", user_id: "u6", role: "charge_nurse", department: "icu", display_name: "Nurse Aisha Al-Dakhil", status: "active", email: "a.dakhil@alobour.sa", phone: "+966-55-410-0005", joined_at: "2023-06-20", last_active: "3 min ago", login_count: 540, two_factor: true, branch_access: ["br-01"] },
  { id: "7", user_id: "u7", role: "nurse", department: "emergency", display_name: "Nurse Khalid Al-Ruwais", status: "active", email: "k.ruwais@alobour.sa", phone: "+966-55-410-0015", joined_at: "2024-05-30", last_active: "Just now", login_count: 421, two_factor: false, branch_access: ["br-01"] },
  { id: "8", user_id: "u8", role: "pharmacist", department: "pharmacy", display_name: "Dr. Huda Al-Qarni", status: "active", email: "h.qarni@alobour.sa", phone: "+966-55-410-0012", joined_at: "2023-11-05", last_active: "25 min ago", login_count: 367, two_factor: true, branch_access: ["br-01", "br-04"] },
  { id: "9", user_id: "u9", role: "lab_technician", department: "laboratory", display_name: "Dr. Salma Al-Hazmi", status: "active", email: "s.hazmi@alobour.sa", phone: "+966-55-410-0010", joined_at: "2023-04-18", last_active: "2 hours ago", login_count: 298, two_factor: false, branch_access: ["br-01"] },
  { id: "10", user_id: "u10", role: "radiologist", department: "radiology", display_name: "Dr. Tariq Al-Balawi", status: "active", email: "t.balawi@alobour.sa", phone: "+966-55-410-0011", joined_at: "2023-04-18", last_active: "Today", login_count: 264, two_factor: true, branch_access: ["br-01"] },
  { id: "11", user_id: "u11", role: "receptionist", department: "administration", display_name: "Munira Al-Ajmi", status: "active", email: "m.ajmi@alobour.sa", phone: "+966-55-410-0101", joined_at: "2025-01-12", last_active: "6 min ago", login_count: 189, two_factor: false, branch_access: ["br-02"] },
  { id: "12", user_id: "u12", role: "billing_officer", department: "revenue_cycle", display_name: "Noura Al-Mansouri", status: "active", email: "n.mansouri@alobour.sa", phone: "+966-55-410-0042", joined_at: "2025-07-21", last_active: "Yesterday", login_count: 143, two_factor: true, branch_access: ["br-01", "br-02"] },
  { id: "13", user_id: "u13", role: "biomed_technician", department: "biomedical", display_name: "Eng. Tariq Al-Sulami", status: "active", email: "t.sulami@alobour.sa", phone: "+966-55-410-0032", joined_at: "2025-04-17", last_active: "3 days ago", login_count: 71, two_factor: false, branch_access: ["br-01", "br-04"] },
  { id: "14", user_id: "u14", role: "viewer", department: "icu", display_name: "Nurse Mona Al-Faraj", status: "inactive", email: "m.faraj@alobour.sa", phone: "+966-55-410-0091", joined_at: "2025-03-09", last_active: "5 weeks ago", login_count: 88, two_factor: false, branch_access: [] },
];

const DEMO_INVITES: PendingInvite[] = [
  { id: "inv-1", email: "r.suwailem@alobour.sa", name: "Dr. Rana Al-Suwailem", role: "physician", department: "paediatrics", sent_at: "2 hours ago", status: "pending" },
  { id: "inv-2", email: "y.habib@alobour.sa", name: "Dr. Yasser Al-Habib (locum)", role: "physician", department: "theatres", sent_at: "1 day ago", status: "pending" },
  { id: "inv-3", email: "nurse.bank@agency-partner.sa", name: "Agency Nurse — Bank Shift", role: "viewer", department: "nursing", sent_at: "2 weeks ago", status: "expired" },
];

/** The widest template there is, so each role card's bar reads against a real ceiling. */
const MAX_TEMPLATE_PERMS = Math.max(...ROLE_TEMPLATES.map(t => countPermissions(t.permissions)), 1);

export default function UsersAccess() {
  const { lang } = useLanguage();
  const { workspace } = useAuth();
  const ar = lang === "ar";

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [searchQ, setSearchQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name" | "role" | "joined" | "last_active">("name");
  const [showFilters, setShowFilters] = useState(false);

  // View
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Drawers
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "", email: "", department: "", role: "viewer", jobTitle: "", password: "",
  });
  const [creating, setCreating] = useState(false);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setMembers(DEMO_MEMBERS);
      setInvites(DEMO_INVITES);
      setLoading(false);
    }, 600);
  }, []);

  // Filtered members
  const filteredMembers = useMemo(() => {
    let list = [...members];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(m =>
        (m.display_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.phone || "").includes(q) ||
        (m.department || "").toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") list = list.filter(m => m.role === roleFilter);
    if (deptFilter !== "all") list = list.filter(m => m.department === deptFilter);
    if (statusFilter !== "all") list = list.filter(m => m.status === statusFilter);
    list.sort((a, b) => {
      switch (sortBy) {
        case "name": return (a.display_name || "").localeCompare(b.display_name || "");
        case "role": return a.role.localeCompare(b.role);
        case "joined": return new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime();
        case "last_active": return 0;
        default: return 0;
      }
    });
    return list;
  }, [members, searchQ, roleFilter, deptFilter, statusFilter, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => m.status === "active").length;
    const inactive = total - active;
    const with2fa = members.filter(m => m.two_factor).length;
    const byRole = ROLE_TEMPLATES.map(t => ({
      ...t,
      count: members.filter(m => m.role === t.id).length,
    })).filter(t => t.count > 0);
    const byDept = DEPARTMENTS.map(d => ({
      ...d,
      count: members.filter(m => m.department === d.value).length,
    })).filter(d => d.count > 0);
    return { total, active, inactive, with2fa, byRole, byDept };
  }, [members]);

  const handleCreateUser = useCallback(async () => {
    if (!createForm.name || !createForm.email) return;
    setCreating(true);
    await new Promise(r => setTimeout(r, 1000));
    const newMember: Member = {
      id: `m-${Date.now()}`,
      user_id: `u-${Date.now()}`,
      role: createForm.role,
      department: createForm.department,
      display_name: createForm.name,
      status: "active",
      email: createForm.email,
      joined_at: new Date().toISOString().slice(0, 10),
      last_active: "Just now",
      login_count: 0,
      two_factor: false,
      branch_access: [],
    };
    setMembers(prev => [newMember, ...prev]);
    setCreating(false);
    setShowCreateForm(false);
    setCreateForm({ name: "", email: "", department: "", role: "viewer", jobTitle: "", password: "" });
    showToast(ar ? "تم إنشاء المستخدم ✓" : "User created ✓");
  }, [createForm, ar]);

  const handleUpdateMember = useCallback((updated: Member) => {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m));
    setSelectedMember(null);
    showToast(ar ? "تم التحديث ✓" : "Updated ✓");
  }, [ar]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={24} className="mx-auto text-brand-ink animate-spin" />
          <p className="text-caption text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-foreground text-background text-body font-medium shadow-lg flex items-center gap-2">
          <Check size={14} />{toast}
        </div>
      )}

      {/* Header */}
      <div className="px-6 md:px-8 pt-6 pb-5 border-b border-border/40" style={{ background: "linear-gradient(160deg, hsl(var(--muted)/0.3) 0%, hsl(var(--background)) 60%)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-heading font-semibold" style={{ fontFamily: "var(--app-font-display)", letterSpacing: "-0.02em" }}>
              {ar ? "إدارة المستخدمين والصلاحيات" : "Users & Access Control"}
            </h1>
            <p className="text-caption text-muted-foreground mt-0.5">
              {ar ? "إدارة الفريق وصلاحيات الوصول والأمان" : "Manage team, permissions, and security"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowInviteModal(true)} className={btnPrimary}>
              <Send size={13} /> {ar ? "دعوة مستخدم" : "Invite User"}
            </button>
            <button onClick={() => setShowCreateForm(!showCreateForm)} className={btnSecondary}>
              <UserPlus size={12} /> {ar ? "إنشاء مباشر" : "Create Directly"}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border/40">
            <Users size={12} className="text-muted-foreground" />
            <span className="text-micro font-medium">{stats.total}</span>
            <span className="text-micro text-muted-foreground">{ar ? "مستخدم" : "users"}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/60">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-micro font-medium text-success">{stats.active}</span>
            <span className="text-micro text-success">{ar ? "نشط" : "active"}</span>
          </div>
          {stats.inactive > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border/40">
              <span className="text-micro font-medium">{stats.inactive}</span>
              <span className="text-micro text-muted-foreground">{ar ? "غير نشط" : "inactive"}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
            <Fingerprint size={12} className="text-brand-ink" />
            <span className="text-micro font-medium text-brand-ink">{stats.with2fa}</span>
            <span className="text-micro text-brand-ink/70">2FA</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/30">
            <Send size={12} className="text-warning" />
            <span className="text-micro font-medium text-warning">{invites.filter(i => i.status === "pending").length}</span>
            <span className="text-micro text-warning">{ar ? "بانتظار" : "pending"}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {([
            { id: "dashboard" as Tab, en: "Overview", ar: "نظرة عامة", icon: BarChart3 },
            { id: "members" as Tab, en: "Members", ar: "الأعضاء", icon: Users },
            { id: "invites" as Tab, en: "Invitations", ar: "الدعوات", icon: Send },
            { id: "roles" as Tab, en: "Roles", ar: "الأدوار", icon: Shield },
            { id: "audit" as Tab, en: "Audit Log", ar: "سجل المراجعة", icon: History },
          ]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3.5 py-2 rounded-lg text-micro font-medium flex items-center gap-1.5 transition-all ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`}>
              <t.icon size={12} />{ar ? t.ar : t.en}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 md:px-8 py-5">
        <AnimatePresence mode="wait">

          {/* ═══ DASHBOARD ═══ */}
          {tab === "dashboard" && (
            <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Role Distribution */}
              <div>
                <h3 className="text-body font-semibold mb-3">{ar ? "توزيع الأدوار" : "Role Distribution"}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {stats.byRole.map(r => (
                    <div key={r.id} className="p-3 rounded-xl border border-border/40 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => { setRoleFilter(r.id); setTab("members"); }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-micro px-2 py-0.5 rounded-full font-semibold ${r.color}`}>{ar ? r.ar : r.en}</span>
                        <span className="text-title font-bold" style={{ fontFamily: "var(--app-font-display)" }}>{r.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${(r.count / stats.total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Department Distribution */}
              <div>
                <h3 className="text-body font-semibold mb-3">{ar ? "الأقسام" : "Departments"}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {stats.byDept.map(d => (
                    <div key={d.value} className="p-3 rounded-xl border border-border/40 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => { setDeptFilter(d.value); setTab("members"); }}>
                      <div className="flex items-center justify-between">
                        <span className="text-micro font-medium truncate">{ar ? d.ar : d.en}</span>
                        <span className="text-body-lg font-bold" style={{ fontFamily: "var(--app-font-display)" }}>{d.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="text-body font-semibold mb-3">{ar ? "آخر النشاطات" : "Recent Activity"}</h3>
                <div className="space-y-2">
                  {[
                    { user: "Nurse Khalid Al-Ruwais", action: ar ? "سجّل الدخول من جهاز الفرز" : "signed in at the triage station", time: ar ? "منذ ٥ دقائق" : "5 min ago", icon: Key, color: "text-info" },
                    { user: "Dr. Huda Al-Qarni", action: ar ? "تحققت من ١٢ عملية صرف دواء" : "verified 12 dispenses", time: ar ? "منذ ساعتين" : "2 hours ago", icon: ShieldCheck, color: "text-success" },
                    { user: "Dr. Faisal Al-Harthy", action: ar ? "وقّع تقرير عملية" : "signed an operation note", time: ar ? "منذ ٣ ساعات" : "3 hours ago", icon: Edit3, color: "text-warning" },
                    { user: "System Administrator", action: ar ? "عدّل صلاحيات د. مها الصانع" : "changed permissions for Dr. Maha Al-Sanea", time: ar ? "أمس" : "Yesterday", icon: Shield, color: "text-chart-4" },
                  ].map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className={`w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center ${entry.color}`}>
                        <entry.icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-micro"><span className="font-medium">{entry.user}</span> <span className="text-muted-foreground">{entry.action}</span></p>
                      </div>
                      <span className="text-micro text-muted-foreground shrink-0">{entry.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ MEMBERS ═══ */}
          {tab === "members" && (
            <motion.div key="members" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Inline Create Form */}
              <AnimatePresence>
                {showCreateForm && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-5">
                    <div className="p-5 rounded-xl border border-border/40 bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-body font-semibold">{ar ? "إنشاء مستخدم جديد" : "Create New User"}</h3>
                        <button onClick={() => setShowCreateForm(false)}><X size={14} className="text-muted-foreground" /></button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className={labelCls}>{ar ? "الاسم" : "Name"} *</label>
                          <input value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder={ar ? "الاسم الكامل" : "Full name"} />
                        </div>
                        <div>
                          <label className={labelCls}>{ar ? "الإيميل" : "Email"} *</label>
                          <input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} className={inputCls} placeholder="name@alobour.sa" />
                        </div>
                        <div>
                          <label className={labelCls}>{ar ? "القسم" : "Department"}</label>
                          <select value={createForm.department} onChange={e => setCreateForm(p => ({ ...p, department: e.target.value }))} className={inputCls + " appearance-none cursor-pointer"}>
                            <option value="">{ar ? "اختر..." : "Select..."}</option>
                            {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{ar ? d.ar : d.en}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>{ar ? "الدور" : "Role"}</label>
                          <select value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))} className={inputCls + " appearance-none cursor-pointer"}>
                            {ROLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{ar ? t.ar : t.en}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={handleCreateUser} disabled={creating || !createForm.name || !createForm.email} className={btnPrimary + " px-5"}>
                          {creating ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                          {ar ? "إنشاء" : "Create"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} className={inputCls + " pl-9 h-9"} placeholder={ar ? "بحث بالاسم، الإيميل، الهاتف..." : "Search name, email, phone..."} />
                </div>
                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-micro appearance-none cursor-pointer">
                  <option value="all">{ar ? "كل الأدوار" : "All Roles"}</option>
                  {ROLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{ar ? t.ar : t.en}</option>)}
                </select>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="h-9 px-2 rounded-lg border border-border bg-background text-micro appearance-none cursor-pointer">
                  <option value="all">{ar ? "كل الأقسام" : "All Departments"}</option>
                  {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{ar ? d.ar : d.en}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="h-9 px-2 rounded-lg border border-border bg-background text-micro appearance-none cursor-pointer">
                  <option value="all">{ar ? "الكل" : "All Status"}</option>
                  <option value="active">{ar ? "نشط" : "Active"}</option>
                  <option value="inactive">{ar ? "غير نشط" : "Inactive"}</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="h-9 px-2 rounded-lg border border-border bg-background text-micro appearance-none cursor-pointer">
                  <option value="name">{ar ? "الاسم" : "Name"}</option>
                  <option value="role">{ar ? "الدور" : "Role"}</option>
                  <option value="joined">{ar ? "تاريخ الانضمام" : "Join Date"}</option>
                </select>
                <div className="flex border border-border rounded-lg overflow-hidden">
                  <button onClick={() => setViewMode("list")} className={`w-8 h-9 flex items-center justify-center ${viewMode === "list" ? "bg-primary/10 text-brand-ink" : "text-muted-foreground hover:bg-muted"}`}><List size={13} /></button>
                  <button onClick={() => setViewMode("grid")} className={`w-8 h-9 flex items-center justify-center ${viewMode === "grid" ? "bg-primary/10 text-brand-ink" : "text-muted-foreground hover:bg-muted"}`}><Grid3X3 size={13} /></button>
                </div>
              </div>

              <p className="text-micro text-muted-foreground mb-3">{filteredMembers.length} {ar ? "نتيجة" : "results"}</p>

              {/* Member List */}
              {viewMode === "list" ? (
                <div className="space-y-2">
                  {filteredMembers.map(m => {
                    const tmpl = ROLE_TEMPLATES.find(t => t.id === m.role) || ROLE_TEMPLATES[ROLE_TEMPLATES.length - 1];
                    const dept = DEPARTMENTS.find(d => d.value === m.department);
                    const perms = m.permissions ? countPermissions(m.permissions) : countPermissions(tmpl.permissions);
                    return (
                      <div key={m.id} className="flex items-center gap-4 p-3.5 rounded-xl border border-border/40 hover:shadow-sm hover:border-border/60 transition-all cursor-pointer group" onClick={() => setSelectedMember(m)}>
                        <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-body font-semibold text-brand-ink shrink-0">
                          {(m.display_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-body font-medium">{m.display_name}</span>
                            <span className={`text-micro px-2 py-0.5 rounded-full font-medium ${tmpl.color}`}>{ar ? tmpl.ar : tmpl.en}</span>
                            <div className={`w-2 h-2 rounded-full ${m.status === "active" ? "bg-success" : "bg-muted"}`} />
                            {m.two_factor && <Fingerprint size={10} className="text-brand-ink" />}
                          </div>
                          <div className="flex items-center gap-3 text-micro text-muted-foreground">
                            {m.email && <span className="flex items-center gap-1"><Mail size={9} />{m.email}</span>}
                            {dept && <span className="flex items-center gap-1"><Building2 size={9} />{ar ? dept.ar : dept.en}</span>}
                            {m.last_active && <span className="flex items-center gap-1"><Clock size={9} />{m.last_active}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-micro font-medium">{perms} {ar ? "صلاحية" : "perms"}</p>
                          <p className="text-micro text-muted-foreground">{m.login_count || 0} {ar ? "دخول" : "logins"}</p>
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredMembers.map(m => {
                    const tmpl = ROLE_TEMPLATES.find(t => t.id === m.role) || ROLE_TEMPLATES[ROLE_TEMPLATES.length - 1];
                    const dept = DEPARTMENTS.find(d => d.value === m.department);
                    return (
                      <div key={m.id} className="p-4 rounded-xl border border-border/40 hover:shadow-sm hover:border-border/60 transition-all cursor-pointer" onClick={() => setSelectedMember(m)}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center text-body font-semibold text-brand-ink">
                            {(m.display_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-caption font-medium truncate">{m.display_name}</p>
                            <span className={`text-micro px-1.5 py-0.5 rounded-full font-medium ${tmpl.color}`}>{ar ? tmpl.ar : tmpl.en}</span>
                          </div>
                        </div>
                        <div className="space-y-1 text-micro text-muted-foreground">
                          {m.email && <p className="truncate">{m.email}</p>}
                          {dept && <p>{ar ? dept.ar : dept.en}</p>}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                          <div className={`w-2 h-2 rounded-full ${m.status === "active" ? "bg-success" : "bg-muted"}`} />
                          <span className="text-micro text-muted-foreground">{m.last_active}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ INVITES ═══ */}
          {tab === "invites" && (
            <motion.div key="invites" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-body font-semibold">{ar ? "الدعوات المعلقة" : "Pending Invitations"}</h3>
                <button onClick={() => setShowInviteModal(true)} className={btnPrimary + " text-micro px-3 py-1.5"}>
                  <Send size={11} /> {ar ? "دعوة جديدة" : "New Invite"}
                </button>
              </div>
              <div className="space-y-2">
                {invites.map(inv => {
                  const tmpl = ROLE_TEMPLATES.find(t => t.id === inv.role);
                  const statusColor = inv.status === "pending" ? "bg-warning/15 text-warning" : inv.status === "accepted" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
                  return (
                    <div key={inv.id} className="flex items-center gap-4 p-3.5 rounded-xl border border-border/40">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-body font-semibold text-muted-foreground">
                        <Mail size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-body font-medium">{inv.name || inv.email}</span>
                          <span className={`text-micro px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{inv.status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-micro text-muted-foreground">
                          <span>{inv.email}</span>
                          {tmpl && <span className="flex items-center gap-1"><Shield size={9} />{ar ? tmpl.ar : tmpl.en}</span>}
                          <span className="flex items-center gap-1"><Clock size={9} />{inv.sent_at}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button className="h-7 px-2.5 rounded-lg border border-border/60 text-micro font-medium hover:bg-muted transition-colors flex items-center gap-1">
                          <RefreshCw size={10} /> {ar ? "إعادة" : "Resend"}
                        </button>
                        <button className="h-7 px-2.5 rounded-lg border border-destructive/30 text-destructive text-micro font-medium hover:bg-destructive/10 transition-colors">
                          {ar ? "إلغاء" : "Revoke"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {invites.length === 0 && (
                  <div className="text-center py-12">
                    <Send size={24} className="mx-auto text-muted-foreground/20 mb-2" />
                    <p className="text-caption text-muted-foreground">{ar ? "لا توجد دعوات معلقة" : "No pending invitations"}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ ROLES ═══ */}
          {tab === "roles" && (
            <motion.div key="roles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h3 className="text-body font-semibold mb-3">{ar ? "قوالب الأدوار" : "Role Templates"}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {ROLE_TEMPLATES.map(t => {
                  const count = members.filter(m => m.role === t.id).length;
                  const dangerCount = countDangerousPermissions(t.permissions);
                  return (
                    <div key={t.id} className="p-4 rounded-xl border border-border/40 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-micro px-2 py-0.5 rounded-full font-semibold ${t.color}`}>{ar ? t.ar : t.en}</span>
                        <span className="text-title font-bold" style={{ fontFamily: "var(--app-font-display)" }}>{count}</span>
                      </div>
                      <p className="text-micro text-muted-foreground mb-3">{ar ? t.descriptionAr : t.description}</p>
                      <div className="flex items-center justify-between text-micro text-muted-foreground mb-2">
                        <span>{countPermissions(t.permissions)} {ar ? "صلاحية" : "perms"}</span>
                        {dangerCount > 0 && <span className="text-destructive flex items-center gap-0.5"><AlertTriangle size={8} />{dangerCount}</span>}
                      </div>
                      <div className="h-1 rounded-full bg-muted/60 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${(countPermissions(t.permissions) / MAX_TEMPLATE_PERMS) * 100}%` }} />
                      </div>
                      {t.risk === "high" && (
                        <span className="text-micro text-destructive flex items-center gap-0.5 mt-2">
                          <ShieldAlert size={8} /> {ar ? "خطر عالي" : "High risk"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Custom Role */}
              <div className="mt-5 p-4 rounded-xl border border-dashed border-border/60 text-center">
                <p className="text-micro text-muted-foreground mb-2">{ar ? "أو أنشئ دور مخصص" : "Or create a custom role"}</p>
                <button className={btnPrimary + " text-micro px-4 py-1.5"}>
                  <Plus size={11} /> {ar ? "دور مخصص" : "Custom Role"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ AUDIT LOG ═══ */}
          {tab === "audit" && (
            <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-body font-semibold">{ar ? "سجل مراجعة الصلاحيات" : "Permission Audit Log"}</h3>
                <button className={btnSecondary}><Download size={11} /> {ar ? "تصدير" : "Export"}</button>
              </div>
              <div className="space-y-0">
                {[
                  { time: "Today, 2:15 PM", user: "System Administrator", action: ar ? "تغيير الدور" : "Changed role", target: "Dr. Rakan Al-Shammari", detail: ar ? "مشاهد ← طبيب مقيم" : "viewer → resident", icon: Shield, color: "text-chart-4" },
                  { time: "Today, 11:30 AM", user: "Dr. Hala Al-Rasheed", action: ar ? "إضافة صلاحية" : "Added permission", target: "Dr. Huda Al-Qarni", detail: ar ? "دعم القرار السريري: تجاوز التنبيه" : "cdss: override", icon: Plus, color: "text-success" },
                  { time: "Yesterday, 4:20 PM", user: "System Administrator", action: ar ? "إنهاء جلسة" : "Revoked session", target: "Nurse Aisha Al-Dakhil", detail: ar ? "إنهاء جلسة جهاز الجناح اللوحي" : "Ward tablet session terminated", icon: LogOut, color: "text-destructive" },
                  { time: "Yesterday, 9:00 AM", user: "System Administrator", action: ar ? "إنشاء مستخدم" : "Created user", target: "Munira Al-Ajmi", detail: ar ? "الدور: موظف استقبال، القسم: الإدارة" : "Role: receptionist, Department: Administration", icon: UserPlus, color: "text-info" },
                  { time: "Aug 24, 3:45 PM", user: "System Administrator", action: ar ? "فرض التحقق بخطوتين" : "Enforced 2FA", target: "Noura Al-Mansouri", detail: ar ? "الوصول للمطالبات يتطلب التحقق بخطوتين" : "Claims access now requires 2FA", icon: Fingerprint, color: "text-warning" },
                  { time: "Aug 22, 10:15 AM", user: "System Administrator", action: ar ? "تغيير القسم" : "Changed department", target: "Nurse Sara Bin Ali", detail: ar ? "الطوارئ ← الجراحة العامة" : "Emergency → General Surgery", icon: Building2, color: "text-info" },
                  { time: "Aug 21, 2:30 PM", user: "Dr. Hala Al-Rasheed", action: ar ? "إرسال دعوة" : "Sent invitation", target: "r.suwailem@alobour.sa", detail: ar ? "الدور: طبيب، القسم: الأطفال" : "Role: physician, Department: Paediatrics", icon: Send, color: "text-brand-ink" },
                  { time: "Aug 20, 11:00 AM", user: "System Administrator", action: ar ? "تعليق الوصف الطبي" : "Suspended prescribing", target: "Dr. Maha Al-Sanea", detail: ar ? "انتهاء الترخيص — التجديد لدى الهيئة" : "Licence lapsed — renewal with SCFHS", icon: Ban, color: "text-destructive" },
                ].map((entry, i) => (
                  <div key={i} className="flex gap-3 relative py-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center ${entry.color}`}>
                        <entry.icon size={12} />
                      </div>
                      {i < 7 && <div className="w-px flex-1 bg-border/40 my-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-micro font-medium">{entry.action} <span className="text-brand-ink">{entry.target}</span></span>
                        <span className="text-micro text-muted-foreground">{entry.time}</span>
                      </div>
                      <p className="text-micro text-muted-foreground">{entry.detail}</p>
                      <p className="text-micro text-muted-foreground/60 mt-0.5">{ar ? "بواسطة" : "by"} {entry.user}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drawers */}
      {selectedMember && (
        <UserDetailDrawer
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={handleUpdateMember}
        />
      )}
      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onInvited={() => { showToast(ar ? "تم إرسال الدعوات ✓" : "Invitations sent ✓"); }}
        />
      )}
    </div>
  );
}
