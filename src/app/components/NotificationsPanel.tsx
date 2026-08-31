/**
 * NotificationsPanel — Dropdown notifications panel
 * لوحة الإشعارات
 */

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { useLanguage } from "@/app/context/LanguageContext";
import { getSupabaseClient } from "@/platform/lib/supabase";
import { useLocation } from "wouter";
import {
  Bell, X, CheckCircle2, AlertTriangle, ShoppingCart, Factory,
  Truck, DollarSign, Users, Package, Clock, Check,
} from "lucide-react";

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string | null; // null = broadcast to workspace
  type: string; // order_created, approval_needed, stock_low, production_update, etc.
  title: string;
  body: string;
  status: "unread" | "read" | "action_required";
  link?: string;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  order_created: ShoppingCart,
  approval_needed: AlertTriangle,
  stock_low: Package,
  production_update: Factory,
  delivery_scheduled: Truck,
  payment_received: DollarSign,
  user_joined: Users,
  release_approved: CheckCircle2,
  release_rejected: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  approval_needed: "text-warning bg-warning/10",
  stock_low: "text-destructive bg-destructive/10",
  release_rejected: "text-destructive bg-destructive/10",
  release_approved: "text-success bg-success/10",
  payment_received: "text-success bg-success/10",
  default: "text-brand-ink bg-primary/10",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: Props) {
  const { lang } = useLanguage();
  const { workspace } = useAuth();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const isAr = lang === "ar";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  // Fetch notifications
  useEffect(() => {
    if (!open || !workspace) return;
    setLoading(true);
    const sb = getSupabaseClient();
    if (!sb) { setLoading(false); return; }

    sb.from("notifications")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setNotifications((data as Notification[]) || []);
        setLoading(false);
      });
  }, [open, workspace]);

  async function markRead(id: string) {
    const sb = getSupabaseClient();
    if (!sb) return;
    await (sb.from("notifications") as any).update({ status: "read" }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "read" } : n));
  }

  async function markAllRead() {
    if (!workspace) return;
    const sb = getSupabaseClient();
    if (!sb) return;
    await (sb.from("notifications") as any).update({ status: "read" }).eq("workspace_id", workspace.id).eq("status", "unread");
    setNotifications(prev => prev.map(n => ({ ...n, status: "read" })));
  }

  function handleClick(n: Notification) {
    markRead(n.id);
    if (n.link) { navigate(n.link); onClose(); }
  }

  const unreadCount = notifications.filter(n => n.status === "unread").length;

  if (!open) return null;

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isAr ? "الآن" : "now";
    if (mins < 60) return `${mins}${isAr ? " د" : "m"}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${isAr ? " س" : "h"}`;
    const days = Math.floor(hrs / 24);
    return `${days}${isAr ? " ي" : "d"}`;
  }

  return (
    <div ref={panelRef}
      className="absolute top-12 end-0 w-[360px] max-h-[480px] bg-background border border-border/60 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-muted-foreground" />
          <span className="text-body font-semibold">{isAr ? "الإشعارات" : "Notifications"}</span>
          {unreadCount > 0 && (
            <span className="text-micro px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-micro text-brand-ink hover:underline px-2">
              {isAr ? "قراءة الكل" : "Mark all read"}
            </button>
          )}
          <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-muted transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-caption text-muted-foreground">
            <Clock size={13} className="animate-spin mr-2" /> {isAr ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell size={20} className="mb-2 opacity-30" />
            <p className="text-caption">{isAr ? "مفيش إشعارات" : "No notifications yet"}</p>
          </div>
        ) : (
          notifications.map(n => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            const colorCls = TYPE_COLORS[n.type] || TYPE_COLORS.default;
            return (
              <button key={n.id} onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors border-b border-border/20 ${n.status === "unread" ? "bg-primary/[0.02]" : ""}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorCls}`}>
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-caption font-medium truncate ${n.status === "unread" ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                    {n.status === "unread" && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-micro text-muted-foreground/70 line-clamp-2 mt-0.5">{n.body}</p>
                  <p className="text-micro text-muted-foreground/40 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Unread count hook for the bell badge */
export function useUnreadCount(): number {
  const { workspace } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!workspace) return;
    const sb = getSupabaseClient();
    if (!sb) return;

    sb.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("status", "unread")
      .then(({ count: c }) => setCount(c || 0));

    // Realtime subscription
    const channel = sb.channel("notifications-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `workspace_id=eq.${workspace.id}` }, () => {
        sb.from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .eq("status", "unread")
          .then(({ count: c }) => setCount(c || 0));
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [workspace]);

  return count;
}
