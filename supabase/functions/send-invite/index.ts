// send-invite — emails a workspace invitation link.
//
// Called from the browser (InviteModal) via supabase.functions.invoke,
// so CORS headers + OPTIONS handler are required.
//
// Delivery ladder:
//   1. RESEND_API_KEY secret set → send via Resend (production path)
//   2. else → supabase.auth.admin.inviteUserByEmail (built-in mailer,
//      ~2 emails/hour, fine for testing; fails if the user already exists)
//   3. both unavailable/failed → { sent: false } and the modal shows the
//      copyable invite link instead. The link always works regardless.
//
// Deploy: paste into Dashboard → Edge Functions → New function "send-invite".
// Optional secrets: RESEND_API_KEY, RESEND_FROM (e.g. "Bumblebee <team@yourdomain.com>").

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emailHtml(opts: {
  workspaceName: string;
  inviterName: string;
  role: string;
  link: string;
}): string {
  const { workspaceName, inviterName, role, link } = opts;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F9F7F4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F7F4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;border:1px solid #e8e5df;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <div style="font-size:20px;letter-spacing:0.08em;color:#2D3139;font-weight:600;">Bumblebee</div>
        </td></tr>
        <tr><td style="padding:16px 32px 0;text-align:center;">
          <div style="font-size:17px;color:#2D3139;font-weight:600;">You're invited to ${workspaceName}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:10px;line-height:1.6;">
            ${inviterName} invited you to join <b>${workspaceName}</b> on Bumblebee
            as <b>${role}</b>.<br/>Click below to accept — it takes a minute.
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#2D3139;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 28px;border-radius:12px;">Accept invitation</a>
        </td></tr>
        <tr><td style="padding:0 32px 28px;text-align:center;">
          <div style="font-size:11px;color:#9ca3af;line-height:1.6;">
            This invitation expires in 7 days.<br/>
            If the button doesn't work, copy this link:<br/>
            <span style="color:#6b7280;word-break:break-all;">${link}</span>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { invitation_id } = await req.json();
    if (!invitation_id) return json({ error: "invitation_id required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authorization: read the invitation AS THE CALLER (RLS lets only
    // workspace members see invitations) — outsiders get not_found.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: inv, error: invErr } = await callerClient
      .from("workspace_invitations")
      .select("id, email, role, token, status, workspace_id, invited_by")
      .eq("id", invitation_id)
      .maybeSingle();
    if (invErr) return json({ error: invErr.message }, 500);
    if (!inv) return json({ error: "not_found" }, 404);
    if (inv.status !== "pending") return json({ error: "not_pending" }, 400);

    // Service client for lookups + admin invite.
    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: ws }, { data: inviter }] = await Promise.all([
      admin.from("workspaces").select("name").eq("id", inv.workspace_id).maybeSingle(),
      inv.invited_by
        ? admin.from("profiles").select("full_name, email").eq("id", inv.invited_by).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const workspaceName = ws?.name ?? "a Bumblebee workspace";
    const inviterName = inviter?.full_name || inviter?.email || "A teammate";

    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "";
    const link = `${origin}/invite/${inv.token}`;

    // ── 1) Resend ──────────────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const from = Deno.env.get("RESEND_FROM") || "Bumblebee <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [inv.email],
          subject: `You're invited to ${workspaceName} on Bumblebee`,
          html: emailHtml({ workspaceName, inviterName, role: inv.role, link }),
        }),
      });
      if (res.ok) return json({ sent: true, channel: "resend", link });
      const detail = await res.text();
      console.error("[send-invite] Resend failed:", detail);
      // fall through to link-only
    }

    // ── No email provider → link-only ──────────────────────
    // The Supabase built-in mailer is deliberately NOT used: it silently
    // drops mail, reports false success, and sends its own email whose
    // links point at the Auth "Site URL" with an auth token — NOT our
    // /invite/<token> accept page. That produced broken links. Returning
    // sent:false makes the modal surface the correct copyable link, which
    // always works. Set RESEND_API_KEY (with a verified domain) to enable
    // real email delivery.
    return json({ sent: false, reason: "no_email_provider", link });
  } catch (e) {
    console.error("[send-invite] error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
