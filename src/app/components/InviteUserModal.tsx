/**
 * Invite User Modal — invite a new teammate by email with a role
 * and department picker.
 * دعوة مستخدم — دعوة عضو جديد بالبريد الإلكتروني مع تحديد الدور والقسم
 */

import { useState } from "react";
import { Send, Loader2, Shield } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/platform/ui/primitives/dialog";
import { btnPrimary, btnGhost, inputCls, labelCls } from "@/platform/ui";
import { DEPARTMENTS } from "@/platform/lib/access-control";
import { ROLE_TEMPLATES, countPermissions, getTemplateById } from "@/platform/lib/permissions";

interface InviteUserModalProps {
  onClose: () => void;
  onInvited: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteUserModal({ onClose, onInvited }: InviteUserModalProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("viewer");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = getTemplateById(role);
  const emailValid = EMAIL_RE.test(email.trim());

  async function handleSend() {
    if (!emailValid) {
      setError(ar ? "أدخل بريدًا إلكترونيًا صحيحًا" : "Enter a valid email address");
      return;
    }
    setError(null);
    setSending(true);
    // No backend wiring exists for invitations yet (the page keeps a static
    // demo list) — simulate the round trip the same way the page's own
    // "create user" flow does, then hand control back to the caller.
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    onInvited();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(next: boolean) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{ar ? "دعوة مستخدم جديد" : "Invite a New User"}</DialogTitle>
          <DialogDescription>
            {ar
              ? "أرسل دعوة عبر البريد الإلكتروني لينضم المستخدم إلى مساحة العمل بالدور المحدد."
              : "Send an email invite so the user can join the workspace with the selected role."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>{ar ? "البريد الإلكتروني" : "Email"} *</label>
            <input
              type="email"
              value={email}
              autoFocus
              onChange={e => { setEmail(e.target.value); setError(null); }}
              className={inputCls}
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label className={labelCls}>{ar ? "الاسم (اختياري)" : "Name (optional)"}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              placeholder={ar ? "الاسم الكامل" : "Full name"}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{ar ? "القسم" : "Department"}</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
                <option value="">{ar ? "بدون قسم" : "No department"}</option>
                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{ar ? d.ar : d.en}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{ar ? "الدور" : "Role"}</label>
              <select value={role} onChange={e => setRole(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
                {ROLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{ar ? t.ar : t.en}</option>)}
              </select>
            </div>
          </div>
          {template && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 text-micro text-muted-foreground">
              <Shield size={12} className="shrink-0" />
              <span className="flex-1">{ar ? template.descriptionAr : template.description}</span>
              <span className="shrink-0">{countPermissions(template.permissions)} {ar ? "صلاحية" : "perms"}</span>
            </div>
          )}
          {error && <p className="text-micro text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <button type="button" onClick={onClose} className={btnGhost}>{ar ? "إلغاء" : "Cancel"}</button>
          <button type="button" onClick={handleSend} disabled={sending || !email} className={btnPrimary}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {ar ? "إرسال الدعوة" : "Send Invite"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
