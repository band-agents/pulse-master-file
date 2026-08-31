/**
 * User Detail Drawer — view and edit one workspace member's role,
 * department, status and granular module permissions.
 * لوحة تفاصيل المستخدم — عرض وتعديل الدور والقسم والحالة والصلاحيات
 */

import { useState } from "react";
import { Fingerprint, Mail, ShieldAlert, RotateCcw, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";
import { Drawer, Field, FieldGrid, btnPrimary, btnGhost, inputCls, labelCls } from "@/platform/ui";
import { DEPARTMENTS } from "@/platform/lib/access-control";
import {
  MODULES, PERMISSION_LABELS, ROLE_TEMPLATES, type PermissionMap, type PermissionAction,
  hasPermission, countPermissions, countDangerousPermissions, getTemplateById,
} from "@/platform/lib/permissions";

const ACTIONS = Object.keys(PERMISSION_LABELS) as PermissionAction[];

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

interface UserDetailDrawerProps {
  member: Member;
  onClose: () => void;
  onSave: (updated: Member) => void;
}

export function UserDetailDrawer({ member, onClose, onSave }: UserDetailDrawerProps) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [role, setRole] = useState(member.role);
  const [department, setDepartment] = useState(member.department ?? "");
  const [status, setStatus] = useState(member.status);
  const [permissions, setPermissions] = useState<PermissionMap>(
    member.permissions ?? getTemplateById(member.role)?.permissions ?? {}
  );
  const [customized, setCustomized] = useState(!!member.permissions);

  const template = ROLE_TEMPLATES.find(t => t.id === role) ?? ROLE_TEMPLATES[ROLE_TEMPLATES.length - 1];

  function handleRoleChange(next: string) {
    setRole(next);
    if (!customized) {
      setPermissions(getTemplateById(next)?.permissions ?? {});
    }
  }

  function togglePermission(moduleKey: string, action: PermissionAction) {
    setCustomized(true);
    setPermissions(prev => {
      const current = prev[moduleKey] ?? [];
      const next = current.includes(action) ? current.filter(a => a !== action) : [...current, action];
      return { ...prev, [moduleKey]: next };
    });
  }

  function resetToTemplate() {
    setPermissions(getTemplateById(role)?.permissions ?? {});
    setCustomized(false);
  }

  function handleSave() {
    onSave({
      ...member,
      role,
      department: department || undefined,
      status,
      permissions: customized ? permissions : undefined,
    });
  }

  const permCount = countPermissions(permissions);
  const dangerCount = countDangerousPermissions(permissions);
  const name = member.display_name || member.email || (ar ? "مستخدم" : "User");

  return (
    <Drawer
      open
      onClose={onClose}
      title={name}
      titleAr={name}
      subtitle={
        <div className="flex items-center gap-2 flex-wrap">
          {member.email && <span className="inline-flex items-center gap-1"><Mail size={10} />{member.email}</span>}
          <span className={`px-2 py-0.5 rounded-full font-medium ${template.color}`}>{ar ? template.ar : template.en}</span>
        </div>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost}>{ar ? "إلغاء" : "Cancel"}</button>
          <button type="button" onClick={handleSave} className={btnPrimary}>
            <CheckCircle2 size={14} />{ar ? "حفظ" : "Save"}
          </button>
        </>
      }
      width={580}
    >
      {/* Identity / activity */}
      <FieldGrid>
        <Field label="Phone" labelAr="الهاتف">{member.phone}</Field>
        <Field label="Joined" labelAr="تاريخ الانضمام">{member.joined_at}</Field>
        <Field label="Last Active" labelAr="آخر نشاط">{member.last_active}</Field>
        <Field label="Logins" labelAr="مرات الدخول">{member.login_count ?? 0}</Field>
      </FieldGrid>

      {/* Role / department */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{ar ? "الدور" : "Role"}</label>
          <select value={role} onChange={e => handleRoleChange(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
            {ROLE_TEMPLATES.map(t => <option key={t.id} value={t.id}>{ar ? t.ar : t.en}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{ar ? "القسم" : "Department"}</label>
          <select value={department} onChange={e => setDepartment(e.target.value)} className={`${inputCls} appearance-none cursor-pointer`}>
            <option value="">{ar ? "بدون قسم" : "No department"}</option>
            {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{ar ? d.ar : d.en}</option>)}
          </select>
        </div>
      </div>

      {/* Status */}
      <div>
        <label className={labelCls}>{ar ? "الحالة" : "Status"}</label>
        <div className="flex gap-2">
          <button
            type="button" onClick={() => setStatus("active")}
            className={`flex-1 h-9 rounded-xl text-body font-medium border transition-colors ${
              status === "active" ? "bg-success/10 border-success/30 text-success" : "border-border/60 text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {ar ? "نشط" : "Active"}
          </button>
          <button
            type="button" onClick={() => setStatus("inactive")}
            className={`flex-1 h-9 rounded-xl text-body font-medium border transition-colors ${
              status === "inactive" ? "bg-muted border-border text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {ar ? "غير نشط" : "Inactive"}
          </button>
        </div>
      </div>

      {/* Security / access */}
      <FieldGrid>
        <Field label="Two-Factor" labelAr="التحقق بخطوتين">
          <span className={`inline-flex items-center gap-1 ${member.two_factor ? "text-success" : "text-muted-foreground"}`}>
            <Fingerprint size={12} />{member.two_factor ? (ar ? "مفعّل" : "Enabled") : (ar ? "غير مفعّل" : "Disabled")}
          </span>
        </Field>
        <Field label="Branch Access" labelAr="صلاحية الفروع">
          {member.branch_access && member.branch_access.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {member.branch_access.map(b => (
                <span key={b} className="text-micro px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{b}</span>
              ))}
            </div>
          ) : (ar ? "كل الفروع" : "All branches")}
        </Field>
      </FieldGrid>

      {/* Permissions matrix */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h3 className="text-body font-semibold">{ar ? "الصلاحيات" : "Permissions"}</h3>
          <div className="flex items-center gap-2 text-micro text-muted-foreground">
            <span>{permCount} {ar ? "صلاحية" : "perms"}</span>
            {dangerCount > 0 && (
              <span className="text-destructive flex items-center gap-0.5"><ShieldAlert size={10} />{dangerCount}</span>
            )}
            {customized && (
              <button type="button" onClick={resetToTemplate} className="flex items-center gap-1 text-brand-ink hover:underline">
                <RotateCcw size={10} />{ar ? "إعادة ضبط" : "Reset to role"}
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <table className="w-full text-micro border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30">
                <th className="text-start px-2.5 py-2 font-medium text-muted-foreground whitespace-nowrap">{ar ? "الوحدة" : "Module"}</th>
                {ACTIONS.map(a => (
                  <th key={a} className="px-1.5 py-2 font-medium text-muted-foreground text-center whitespace-nowrap">
                    {ar ? PERMISSION_LABELS[a].ar : PERMISSION_LABELS[a].en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(m => (
                <tr key={m.key} className="border-b border-border/20 last:border-0">
                  <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{ar ? m.ar : m.en}</td>
                  {ACTIONS.map(a => (
                    <td key={a} className="px-1.5 py-1.5 text-center">
                      {m.permissions.includes(a) ? (
                        <input
                          type="checkbox"
                          checked={hasPermission(permissions, m.key, a)}
                          onChange={() => togglePermission(m.key, a)}
                          className="w-3.5 h-3.5 rounded accent-brand-ink cursor-pointer"
                        />
                      ) : (
                        <span className="text-muted-foreground/20">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Drawer>
  );
}
