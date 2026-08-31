/**
 * Hospital setup — إعداد المستشفى
 *
 * Shown once, to the first authenticated user of a new deployment, to create
 * the hospital record they will work in.
 *
 * It asks four things and nothing else. The wizard this replaced asked for an
 * industry, a company size and a set of business goals — questions a hospital
 * cannot answer and whose answers nothing downstream ever read. Everything a
 * clinical system genuinely needs to be configured is department-level, and
 * that belongs in Administration once someone is inside, not in a gate between
 * a clinician and the system.
 */

import { useState } from "react";
import { Loader2, AlertCircle, Building2, ArrowRight } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { getSupabaseClient } from "@/platform/lib/supabase";
import { Logo } from "@/app/components/Logo";
import { BRAND } from "@/platform/lib/brand";
import { serif, inputCls, labelCls, btnPrimary, cardCls } from "@/platform/ui";

const CURRENCIES = [
  { code: "EGP", en: "Egyptian pound", ar: "الجنيه المصري" },
  { code: "SAR", en: "Saudi riyal", ar: "الريال السعودي" },
  { code: "AED", en: "UAE dirham", ar: "الدرهم الإماراتي" },
  { code: "USD", en: "US dollar", ar: "الدولار الأمريكي" },
];

export default function WorkspaceSetup() {
  const { user, refreshWorkspace } = useAuth();
  const { lang, setLang } = useLanguage();
  const ar = lang === "ar";

  const [nameEn, setNameEn] = useState<string>(BRAND.name);
  const [nameAr, setNameAr] = useState<string>(BRAND.nameAr);
  const [beds, setBeds] = useState("320");
  const [currency, setCurrency] = useState("EGP");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createHospital(e: React.FormEvent) {
    e.preventDefault();
    if (!nameEn.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const sb = getSupabaseClient();
      if (!sb || !user) throw new Error(ar ? "لا يوجد اتصال بقاعدة البيانات." : "No database connection.");

      // The slug has to be unique across deployments and is never shown, so it
      // carries a timestamp rather than risking a collision on the name alone.
      const slug = `${nameEn.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}-${Date.now().toString(36)}`;

      const { data: ws, error: wsErr } = await sb
        .from("workspaces")
        .insert({
          name: nameEn.trim(),
          slug,
          owner_id: user.id,
          plan: "enterprise",
          settings: {
            hospital_name: nameEn.trim(),
            hospital_name_ar: nameAr.trim() || null,
            bed_capacity: Number(beds) || null,
            currency,
            default_language: lang,
          },
        } as never)
        .select()
        .single();
      if (wsErr) throw wsErr;

      const { error: memErr } = await sb
        .from("workspace_members")
        .insert({
          workspace_id: (ws as { id: string }).id,
          user_id: user.id,
          role: "owner",
          status: "active",
        } as never);
      if (memErr) throw memErr;

      await refreshWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={ar ? "rtl" : "ltr"}>
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border/40">
        <Logo variant="full" size={16} />
        <button
          type="button"
          onClick={() => setLang(ar ? "en" : "ar")}
          className="text-caption text-muted-foreground hover:text-foreground transition-colors"
        >
          {ar ? "English" : "العربية"}
        </button>
      </header>

      <main className="flex-1 grid place-items-center px-6 py-10">
        <div className="w-full max-w-[520px]">
          <div className="flex items-center gap-3 mb-6">
            <span className="w-10 h-10 rounded-xl bg-brand-wash text-brand-ink grid place-items-center shrink-0">
              <Building2 size={18} />
            </span>
            <div>
              <h1 className="text-heading font-semibold text-foreground" style={serif}>
                {ar ? "إعداد المستشفى" : "Set up your hospital"}
              </h1>
              <p className="text-caption text-muted-foreground mt-0.5">
                {ar
                  ? "أربعة حقول فقط. باقي الإعدادات داخل النظام."
                  : "Four fields. Everything else is configured inside the system."}
              </p>
            </div>
          </div>

          {error && (
            <div role="alert" className="mb-5 rounded-xl bg-destructive/10 px-3.5 py-3 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-destructive shrink-0 mt-0.5" />
              <p className="text-caption text-foreground/85">{error}</p>
            </div>
          )}

          <form onSubmit={createHospital} className={`${cardCls} p-5 space-y-4`}>
            <div>
              <label htmlFor="nameEn" className={labelCls}>
                {ar ? "اسم المستشفى (بالإنجليزية)" : "Hospital name (English)"}
              </label>
              <input
                id="nameEn" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                required dir="ltr" className={`${inputCls} h-11`}
                placeholder="Al-Madinah Hospital"
              />
            </div>

            <div>
              <label htmlFor="nameAr" className={labelCls}>
                {ar ? "اسم المستشفى (بالعربية)" : "Hospital name (Arabic)"}
              </label>
              <input
                id="nameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)}
                dir="rtl" className={`${inputCls} h-11`}
                placeholder="مستشفى المدينة"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="beds" className={labelCls}>
                  {ar ? "عدد الأسرة" : "Bed capacity"}
                </label>
                <input
                  id="beds" type="number" min={1} value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  dir="ltr" className={`${inputCls} h-11 tabular-nums`}
                />
              </div>
              <div>
                <label htmlFor="currency" className={labelCls}>
                  {ar ? "العملة" : "Currency"}
                </label>
                <select
                  id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className={`${inputCls} h-11`}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {ar ? c.ar : c.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" disabled={saving || !nameEn.trim()} className={`${btnPrimary} w-full h-11 mt-1`}>
              {saving
                ? <Loader2 size={15} className="animate-spin" />
                : <ArrowRight size={15} className="rtl:rotate-180" />}
              {ar ? "إنشاء المستشفى والدخول" : "Create hospital and continue"}
            </button>
          </form>

          <p className="text-micro text-muted-foreground mt-4 max-w-[52ch]">
            {ar
              ? "ستصبح مالك هذا السجل. يمكنك دعوة بقية الفريق وتحديد صلاحياتهم من إدارة النظام بعد الدخول."
              : "You become the owner of this record. Invite the rest of the team and set their access from Administration once you are inside."}
          </p>
        </div>
      </main>
    </div>
  );
}
