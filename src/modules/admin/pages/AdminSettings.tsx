/**
 * AdminSettings — Comprehensive User Profile & Workspace Settings
 * إعدادات المستخدم والمساحة
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { getSupabaseClient } from "@/platform/lib/supabase";
import { DEPARTMENTS } from "@/platform/lib/access-control";
import {
  Settings, Building2, Globe, Users, Boxes, Factory, Truck,
  ShoppingCart, BarChart3, DollarSign, Shield, Save, Loader2,
  CheckCircle2, ChevronRight, Eye, User, Mail, Phone, Camera,
  Lock, Key, Smartphone, Monitor, LogOut, Trash2, AlertTriangle,
  Bell, Palette, Clock, MapPin, Link as LinkIcon, Image, X,
  Check, EyeOff, Fingerprint, Globe2, Languages, Sun, Moon,
  Bookmark, Star, CreditCard, Zap, ExternalLink, Copy, RefreshCw,
  ShieldCheck, ShieldAlert, Upload, Edit3, Hash, FileText,
} from "lucide-react";

const inputCls = "w-full h-10 px-3.5 rounded-xl border border-border/60 bg-background text-body focus:outline-none focus:ring-2 focus:ring-brand-ink/20 transition";
const labelCls = "text-micro font-medium text-muted-foreground mb-1 block";
const cardCls = "bg-background border border-border/40 rounded-xl";

type Tab = "profile" | "preferences" | "security" | "hospital" | "modules" | "notifications";

const CURRENCIES = [
  { code: "EGP", label: "EGP — جنيه مصري" },
  { code: "SAR", label: "SAR — ريال سعودي" },
  { code: "AED", label: "AED — درهم إماراتي" },
  { code: "USD", label: "USD — دولار أمريكي" },
  { code: "EUR", label: "EUR — يورو" },
  { code: "GBP", label: "GBP — جنيه إسترليني" },
  { code: "KWD", label: "KWD — دينار كويتي" },
  { code: "QAR", label: "QAR — ريال قطري" },
];

const LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "ar", label: "العربية", flag: "🇪🇬" },
  { value: "ar-en", label: "عربي + English", flag: "🌍" },
];

const TIMEZONES = [
  { value: "Africa/Cairo", label: "Cairo (UTC+2)" },
  { value: "Asia/Riyadh", label: "Riyadh (UTC+3)" },
  { value: "Asia/Dubai", label: "Dubai (UTC+4)" },
  { value: "Asia/Kuwait", label: "Kuwait (UTC+3)" },
  { value: "Europe/London", label: "London (UTC+0)" },
  { value: "America/New_York", label: "New York (UTC-5)" },
];

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const TIME_FORMATS = [
  { value: "12h", label: "12h (AM/PM)" },
  { value: "24h", label: "24h" },
];

const MODULES_LIST = [
  { key: "hr", en: "HR & Workforce", ar: "الموارد البشرية", icon: Users },
  { key: "inventory", en: "Inventory & Stock", ar: "المخزن والخامات", icon: Boxes },
  { key: "purchasing", en: "Purchasing", ar: "المشتريات", icon: ShoppingCart },
  { key: "production", en: "Production Planning", ar: "تخطيط الإنتاج", icon: Factory },
  { key: "delivery", en: "Delivery & Installation", ar: "التوصيل والتركيب", icon: Truck },
  { key: "analytics", en: "Analytics & Reports", ar: "التحليلات والتقارير", icon: BarChart3 },
  { key: "finance", en: "Finance & Invoicing", ar: "الحسابات والفواتير", icon: DollarSign },
  { key: "quality", en: "Quality Control", ar: "مراقبة الجودة", icon: Shield },
  { key: "pos", en: "Point of Sale", ar: "نقطة البيع", icon: CreditCard },
];

const NOTIFICATION_TYPES = [
  { key: "orders", en: "New Orders", ar: "طلبات جديدة" },
  { key: "production", en: "Production Updates", ar: "تحديثات الإنتاج" },
  { key: "finance", en: "Payment Received", ar: "دفعة مستلمة" },
  { key: "inventory", en: "Low Stock Alerts", ar: "تنبيهات المخزون" },
  { key: "quality", en: "QC Issues", ar: "مشاكل الجودة" },
  { key: "delivery", en: "Delivery Status", ar: "حالة التوصيل" },
  { key: "team", en: "Team Activity", ar: "نشاط الفريق" },
  { key: "system", en: "System Updates", ar: "تحديثات النظام" },
];

const MOCK_SESSIONS = [
  { id: "s1", device: "MacBook Pro", browser: "Chrome 126", ip: "192.168.1.45", location: "Cairo, Egypt", last_active: "Just now", current: true },
  { id: "s2", device: "iPhone 15", browser: "Safari Mobile", ip: "192.168.1.78", location: "Cairo, Egypt", last_active: "2 hours ago", current: false },
  { id: "s3", device: "Windows Desktop", browser: "Firefox 128", ip: "10.0.0.12", location: "Alexandria, Egypt", last_active: "3 days ago", current: false },
];

export default function AdminSettings() {
  const { lang, setLang } = useLanguage();
  const { user, workspace, refreshWorkspace, signOut } = useAuth();
  const ar = lang === "ar";
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Profile state
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || "Admin User");
  const [email, setEmail] = useState(user?.email || "admin@bumblebee.app");
  const [phone, setPhone] = useState(user?.user_metadata?.phone || "+20 100 000 0001");
  const [bio, setBio] = useState(user?.user_metadata?.bio || "");
  const [jobTitle, setJobTitle] = useState(user?.user_metadata?.job_title || "Founder & CEO");
  const [department, setDepartment] = useState(user?.user_metadata?.department || "administration");
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || "");
  const [timezone, setTimezone] = useState(user?.user_metadata?.timezone || "Africa/Cairo");
  const [dateFormat, setDateFormat] = useState(user?.user_metadata?.date_format || "DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState(user?.user_metadata?.time_format || "24h");

  // Preferences state
  const ws = workspace?.settings as Record<string, unknown> | undefined;
  const [currency, setCurrency] = useState((ws?.currency as string) || "EGP");
  const [language, setLanguage] = useState((ws?.language as string) || "ar-en");
  const [enabledModules, setEnabledModules] = useState<Set<string>>(
    new Set((ws?.enabled_modules as string[]) || [])
  );

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    orders: true, production: true, finance: true, inventory: true,
    quality: true, delivery: true, team: true, system: false,
  });
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const role = workspace?.role;
  const canEdit = role === "owner" || role === "admin";

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  function toggleModule(key: string) {
    setEnabledModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleNotification(key: string) {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSaveProfile() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    showToast(ar ? "تم حفظ الملف الشخصي ✓" : "Profile saved ✓");
  }

  async function handleSaveSettings() {
    if (!workspace) return;
    setSaving(true);
    try {
      const sb = getSupabaseClient();
      if (sb) {
        const settings = {
          ...(ws || {}),
          currency,
          language,
          enabled_modules: Array.from(enabledModules),
        };
        await (sb.from("workspaces") as any).update({ settings }).eq("id", workspace.id);
        await refreshWorkspace();
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      showToast(ar ? "تم حفظ الإعدادات ✓" : "Settings saved ✓");
    } catch {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    setCurrentPassword("");
    setNewPassword("");
    showToast(ar ? "تم تغيير كلمة المرور ✓" : "Password changed ✓");
  }

  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  const userInitials = fullName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const TABS: { key: Tab; icon: React.ElementType; en: string; ar: string }[] = [
    { key: "profile", icon: User, en: "Profile", ar: "الملف الشخصي" },
    { key: "preferences", icon: Palette, en: "Preferences", ar: "التفضيلات" },
    { key: "security", icon: Shield, en: "Security", ar: "الأمان" },
    { key: "hospital", icon: Building2, en: "Hospital", ar: "المستشفى" },
    { key: "modules", icon: Eye, en: "Modules", ar: "الأقسام" },
    { key: "notifications", icon: Bell, en: "Notifications", ar: "الإشعارات" },
  ];

  return (
    <div className="min-h-full">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-foreground text-background text-body font-medium shadow-lg flex items-center gap-2">
          <Check size={14} />{toast}
        </div>
      )}

      <div className="px-6 md:px-8 pt-6 pb-5 border-b border-border/40" style={{ background: "linear-gradient(160deg, hsl(var(--muted)/0.3) 0%, hsl(var(--background)) 60%)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-heading font-semibold" style={{ fontFamily: "var(--app-font-display)" }}>
              {ar ? "الإعدادات" : "Settings"}
            </h1>
            <p className="text-caption text-muted-foreground mt-0.5">
              {ar ? "إدارة ملفك الشخصي وتفضيلاتك" : "Manage your profile and preferences"}
            </p>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-micro font-medium whitespace-nowrap transition-all ${
                  tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}>
                <Icon size={12} />{ar ? t.ar : t.en}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 md:px-8 py-6 max-w-[800px]">
        <AnimatePresence mode="wait">

          {/* ═══ PROFILE TAB ═══ */}
          {tab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-brand-ink text-heading font-bold overflow-hidden">
                    {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : userInitials}
                  </div>
                  <button onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={18} className="text-white" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>
                <div>
                  <p className="text-body-lg font-semibold">{fullName}</p>
                  <p className="text-caption text-muted-foreground">{jobTitle}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-micro px-2 py-0.5 rounded-full bg-primary/10 text-brand-ink font-medium capitalize">{role}</span>
                    <span className="text-micro px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium capitalize">{workspace?.plan} plan</span>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><User size={13} /> {ar ? "المعلومات الأساسية" : "Basic Information"}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{ar ? "الاسم الكامل" : "Full Name"} *</label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "البريد الإلكتروني" : "Email"}</label>
                    <input value={email} disabled className={inputCls + " opacity-60"} />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "الهاتف" : "Phone"}</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+20 ..." />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "المسمى الوظيفي" : "Job Title"}</label>
                    <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "القسم" : "Department"}</label>
                    <select value={department} onChange={e => setDepartment(e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                      {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{ar ? d.ar : d.en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "المنطقة الزمنية" : "Timezone"}</label>
                    <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                      {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{ar ? "نبذة شخصية" : "Bio"}</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    className={inputCls + " resize-none"} placeholder={ar ? "about yourself..." : "Tell us about yourself..."} />
                </div>
              </div>

              {/* Social Links */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><LinkIcon size={13} /> {ar ? "روابط التواصل" : "Social Links"}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>LinkedIn</label>
                    <input className={inputCls} placeholder="linkedin.com/in/..." />
                  </div>
                  <div>
                    <label className={labelCls}>Twitter / X</label>
                    <input className={inputCls} placeholder="@username" />
                  </div>
                  <div>
                    <label className={labelCls}>Instagram</label>
                    <input className={inputCls} placeholder="@username" />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "الموقع الإلكتروني" : "Website"}</label>
                    <input className={inputCls} placeholder="https://..." />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-caption font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الملف الشخصي" : "Save Profile")}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ PREFERENCES TAB ═══ */}
          {tab === "preferences" && (
            <motion.div key="prefs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Appearance */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Palette size={13} /> {ar ? "المظهر" : "Appearance"}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {["light", "dark", "system"].map(theme => (
                    <button key={theme}
                      className="p-4 rounded-xl border-2 border-border/30 text-center hover:border-primary/40 transition-all">
                      {theme === "light" ? <Sun size={20} className="mx-auto mb-2 text-warning" /> :
                       theme === "dark" ? <Moon size={20} className="mx-auto mb-2 text-chart-4" /> :
                       <Monitor size={20} className="mx-auto mb-2 text-info" />}
                      <p className="text-caption font-medium capitalize">{theme}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language & Region */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Globe size={13} /> {ar ? "اللغة والمنطقة" : "Language & Region"}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{ar ? "اللغة" : "Language"}</label>
                    <select value={language} onChange={e => setLanguage(e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.flag} {l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "العملة" : "Currency"}</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "المنطقة الزمنية" : "Timezone"}</label>
                    <select value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                      {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "تنسيق التاريخ" : "Date Format"}</label>
                    <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                      {DATE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{ar ? "تنسيق الوقت" : "Time Format"}</label>
                  <div className="flex gap-2">
                    {TIME_FORMATS.map(f => (
                      <button key={f.value} onClick={() => setTimeFormat(f.value)}
                        className={`flex-1 h-10 rounded-xl border-2 text-caption font-medium transition-all ${
                          timeFormat === f.value ? "border-primary bg-primary/5 text-brand-ink" : "border-border/40 text-muted-foreground hover:border-border"
                        }`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar Preferences */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Settings size={13} /> {ar ? "تفضيلات الواجهة" : "Interface"}</h3>
                <div className="space-y-3">
                  {[
                    { labelEn: "Compact sidebar", labelAr: "شريط جانبي مضغوط" },
                    { labelEn: "Show breadcrumbs", labelAr: "إظهار مسار التنقل" },
                    { labelEn: "Recent pages in sidebar", labelAr: "الصفحات الأخيرة في الشريط" },
                    { labelEn: "Command bar on ⌘K", labelAr: "شريط الأوامر على ⌘K" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-caption text-foreground">{ar ? item.labelAr : item.labelEn}</span>
                      <div className="w-9 h-5 rounded-full bg-primary cursor-pointer transition-colors">
                        <div className="w-4 h-4 rounded-full bg-white shadow-sm translate-x-4.5 transition-transform mt-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSaveSettings} disabled={saving}
                  className="h-10 px-6 rounded-xl bg-primary text-primary-foreground text-caption font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {ar ? "حفظ التفضيلات" : "Save Preferences"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ SECURITY TAB ═══ */}
          {tab === "security" && (
            <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Change Password */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Lock size={13} /> {ar ? "تغيير كلمة المرور" : "Change Password"}</h3>
                <div>
                  <label className={labelCls}>{ar ? "كلمة المرور الحالية" : "Current Password"}</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputCls + " pr-10"} />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{ar ? "كلمة المرور الجديدة" : "New Password"}</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} />
                </div>
                <button onClick={handleChangePassword} disabled={!currentPassword || !newPassword || saving}
                  className="h-9 px-4 rounded-xl bg-foreground text-background text-caption font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
                  {ar ? "تغيير كلمة المرور" : "Update Password"}
                </button>
              </div>

              {/* Two-Factor */}
              <div className={`${cardCls} p-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${twoFactor ? "bg-success/10" : "bg-muted"}`}>
                      <Fingerprint size={18} className={twoFactor ? "text-success" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <p className="text-body font-medium">{ar ? "المصادقة الثنائية" : "Two-Factor Authentication"}</p>
                      <p className="text-micro text-muted-foreground">{ar ? "طبقة حماية إضافية للحساب" : "Extra layer of account protection"}</p>
                    </div>
                  </div>
                  <button onClick={() => setTwoFactor(!twoFactor)}
                    className={`w-11 h-6 rounded-full transition-colors ${twoFactor ? "bg-success" : "bg-muted"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${twoFactor ? "translate-x-5.5" : "translate-x-0.5"} mt-0.5`} />
                  </button>
                </div>
              </div>

              {/* Active Sessions */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-body font-semibold flex items-center gap-2"><Monitor size={13} /> {ar ? "الجلسات النشطة" : "Active Sessions"}</h3>
                  <span className="text-micro text-muted-foreground">{MOCK_SESSIONS.length} {ar ? "أجهزة" : "devices"}</span>
                </div>
                {MOCK_SESSIONS.map(s => (
                  <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.current ? "border-primary/30 bg-primary/5" : "border-border/40"}`}>
                    {s.device.includes("iPhone") ? <Smartphone size={16} className="text-muted-foreground shrink-0" /> : <Monitor size={16} className="text-muted-foreground shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-caption font-medium">{s.device}</p>
                      <p className="text-micro text-muted-foreground">{s.browser} • {s.ip} • {s.location}</p>
                    </div>
                    {s.current ? (
                      <span className="text-micro px-2 py-0.5 rounded-full bg-success/10 text-success">{ar ? "الحالية" : "Current"}</span>
                    ) : (
                      <button className="text-micro text-destructive hover:underline">{ar ? "إنهاء" : "Revoke"}</button>
                    )}
                  </div>
                ))}
                <button className="w-full h-9 rounded-lg border border-destructive/30 text-destructive text-micro font-medium hover:bg-destructive/10 transition-colors flex items-center justify-center gap-1.5">
                  <LogOut size={12} /> {ar ? "إنهاء جميع الجلسات الأخرى" : "Revoke All Other Sessions"}
                </button>
              </div>

              {/* Danger Zone */}
              <div className={`${cardCls} p-5 border-destructive/30 bg-destructive/30 space-y-3`}>
                <h3 className="text-caption font-semibold text-destructive flex items-center gap-1.5"><AlertTriangle size={12} /> {ar ? "منطقة الخطر" : "Danger Zone"}</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-caption font-medium">{ar ? "حذف الحساب" : "Delete Account"}</p>
                    <p className="text-micro text-muted-foreground">{ar ? "حذف الحساب وجميع البيانات" : "Permanently delete your account and all data"}</p>
                  </div>
                  <button className="h-8 px-3 rounded-lg border border-destructive/30 text-destructive text-micro font-medium hover:bg-destructive/10 transition-colors">
                    {ar ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ HOSPITAL TAB ═══ */}
          {tab === "hospital" && (
            <motion.div key="hospital" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Building2 size={13} /> {ar ? "بيانات المستشفى" : "Hospital Details"}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{ar ? "اسم المستشفى" : "Hospital Name"}</label>
                    <input defaultValue={(ws?.company_name as string) || ""} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "نوع النشاط" : "Business Type"}</label>
                    <input defaultValue={(ws?.business_type as string) || ""} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "البلد" : "Country"}</label>
                    <input defaultValue={(ws?.country as string) || ""} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>{ar ? "المدينة" : "City"}</label>
                    <input defaultValue={(ws?.city as string) || ""} className={inputCls} />
                  </div>
                </div>
              </div>
              <div className={`${cardCls} p-4`}>
                <p className="text-micro text-muted-foreground space-y-0.5">
                  <span className="block">ID: {workspace?.id || "—"}</span>
                  <span className="block">Slug: {workspace?.slug || "—"}</span>
                  <span className="block">Plan: {workspace?.plan || "—"}</span>
                  <span className="block">Role: {role || "—"}</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══ MODULES TAB ═══ */}
          {tab === "modules" && (
            <motion.div key="modules" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <p className="text-caption text-muted-foreground mb-3">{ar ? "اختار الأقسام اللي عايز تظهر" : "Choose which modules appear in the sidebar"}</p>
              {MODULES_LIST.map(mod => {
                const Icon = mod.icon;
                const enabled = enabledModules.has(mod.key);
                return (
                  <button key={mod.key} onClick={() => toggleModule(mod.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      enabled ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-border"
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${enabled ? "bg-primary/10" : "bg-muted/50"}`}>
                      <Icon size={14} className={enabled ? "text-brand-ink" : "text-muted-foreground"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-caption font-medium ${enabled ? "text-brand-ink" : "text-foreground"}`}>{ar ? mod.ar : mod.en}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${enabled ? "bg-primary" : "border border-border/60"}`}>
                      {enabled && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}

          {/* ═══ NOTIFICATIONS TAB ═══ */}
          {tab === "notifications" && (
            <motion.div key="notif" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Channels */}
              <div className={`${cardCls} p-5 space-y-4`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Bell size={13} /> {ar ? "قنوات الإشعارات" : "Notification Channels"}</h3>
                {[
                  { key: "email", label: "Email", labelAr: "البريد الإلكتروني", state: emailNotifications, set: setEmailNotifications, icon: Mail },
                  { key: "push", label: "Push Notifications", labelAr: "إشعارات فورية", state: pushNotifications, set: setPushNotifications, icon: Smartphone },
                  { key: "digest", label: "Daily Digest", labelAr: "ملخص يومي", state: dailyDigest, set: setDailyDigest, icon: FileText },
                ].map(ch => (
                  <div key={ch.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <ch.icon size={14} className="text-muted-foreground" />
                      <span className="text-caption">{ar ? ch.labelAr : ch.label}</span>
                    </div>
                    <button onClick={() => ch.set(!ch.state)}
                      className={`w-9 h-5 rounded-full transition-colors ${ch.state ? "bg-primary" : "bg-muted"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${ch.state ? "translate-x-4.5" : "translate-x-0.5"} mt-0.5`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Notification Types */}
              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="text-body font-semibold flex items-center gap-2"><Zap size={13} /> {ar ? "أنواع الإشعارات" : "Notification Types"}</h3>
                {NOTIFICATION_TYPES.map(nt => (
                  <div key={nt.key} className="flex items-center justify-between">
                    <span className="text-caption">{ar ? nt.ar : nt.en}</span>
                    <button onClick={() => toggleNotification(nt.key)}
                      className={`w-9 h-5 rounded-full transition-colors ${notifications[nt.key] ? "bg-primary" : "bg-muted"}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${notifications[nt.key] ? "translate-x-4.5" : "translate-x-0.5"} mt-0.5`} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
