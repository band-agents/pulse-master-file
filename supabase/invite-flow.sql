-- Invite Flow Migration (Sprint B)
-- Two SECURITY DEFINER RPCs that make the /invite/<token> page work:
--   get_invitation_by_token — safe public preview (workspace name, role, email)
--   accept_invitation       — joins the signed-in user to the workspace
-- The token itself is the secret (32 random bytes, unguessable), so exposing
-- a lookup by token to anon is safe — it only reveals what the invite email
-- already contains.
-- Idempotent — safe to re-run. Paste into the Supabase dashboard SQL editor.

-- ─── Preview an invitation (anon + authenticated) ──────────
create or replace function get_invitation_by_token(invite_token text)
returns json
language plpgsql
security definer
stable
as $$
declare
  inv record;
begin
  select i.id, i.email, i.role, i.department, i.display_name,
         i.status, i.expires_at, i.workspace_id,
         w.name as workspace_name,
         coalesce(p.full_name, p.email) as inviter_name
    into inv
    from workspace_invitations i
    join workspaces w on w.id = i.workspace_id
    left join profiles p on p.id = i.invited_by
   where i.token = invite_token;

  if not found then
    return json_build_object('ok', false, 'error_code', 'not_found');
  end if;

  if inv.status = 'accepted' then
    return json_build_object('ok', false, 'error_code', 'already_accepted',
                             'workspace_name', inv.workspace_name);
  end if;

  if inv.status <> 'pending' then
    return json_build_object('ok', false, 'error_code', 'cancelled');
  end if;

  if inv.expires_at < now() then
    return json_build_object('ok', false, 'error_code', 'expired',
                             'workspace_name', inv.workspace_name);
  end if;

  return json_build_object(
    'ok', true,
    'email', inv.email,
    'role', inv.role,
    'department', inv.department,
    'display_name', inv.display_name,
    'workspace_name', inv.workspace_name,
    'inviter_name', inv.inviter_name,
    'expires_at', inv.expires_at
  );
end;
$$;

-- ─── Accept an invitation (authenticated only) ─────────────
create or replace function accept_invitation(invite_token text)
returns json
language plpgsql
security definer
as $$
declare
  inv record;
  caller_email text;
  member_role text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error_code', 'not_signed_in');
  end if;

  select i.*, w.name as workspace_name
    into inv
    from workspace_invitations i
    join workspaces w on w.id = i.workspace_id
   where i.token = invite_token;

  if not found then
    return json_build_object('ok', false, 'error_code', 'not_found');
  end if;

  if inv.status = 'accepted' then
    return json_build_object('ok', false, 'error_code', 'already_accepted',
                             'workspace_name', inv.workspace_name);
  end if;

  if inv.status <> 'pending' then
    return json_build_object('ok', false, 'error_code', 'cancelled');
  end if;

  if inv.expires_at < now() then
    update workspace_invitations set status = 'expired' where id = inv.id;
    return json_build_object('ok', false, 'error_code', 'expired',
                             'workspace_name', inv.workspace_name);
  end if;

  -- The invite must be accepted by the address it was sent to.
  caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if caller_email = '' or caller_email <> lower(trim(inv.email)) then
    return json_build_object('ok', false, 'error_code', 'email_mismatch',
                             'invited_email', inv.email);
  end if;

  -- workspace_members.role has a CHECK (owner/admin/member/viewer).
  -- Richer invite roles (e.g. manager) map to 'member' for the constraint
  -- and keep the original title in permissions for the UI / future H4 sprint.
  member_role := case
    when inv.role in ('admin', 'member', 'viewer') then inv.role
    else 'member'
  end;

  insert into workspace_members
      (workspace_id, user_id, role, department, display_name,
       permissions, status, invited_by, invited_at)
  values
      (inv.workspace_id, auth.uid(), member_role, inv.department, inv.display_name,
       coalesce(inv.permissions, '{}'::jsonb) || jsonb_build_object('invite_role', inv.role),
       'active', inv.invited_by, inv.created_at)
  on conflict (workspace_id, user_id) do nothing;

  update workspace_invitations
     set status = 'accepted', accepted_at = now()
   where id = inv.id;

  return json_build_object(
    'ok', true,
    'workspace_id', inv.workspace_id,
    'workspace_name', inv.workspace_name,
    'role', member_role
  );
end;
$$;

-- ─── Grants ────────────────────────────────────────────────
grant execute on function get_invitation_by_token(text) to anon, authenticated;
grant execute on function accept_invitation(text) to authenticated;
