-- ============================================================
-- Bumblebee — Fix: handle_new_user trigger + profiles RLS
--
-- Run this in Supabase SQL Editor.
--
-- Fixes two bugs that cause "Database error saving new user":
--   1. handle_new_user() missing SET search_path = public
--   2. profiles_insert RLS policy blocks trigger (auth.uid() = null
--      at signup time — no session exists yet when the trigger fires)
-- ============================================================


-- ── 1. Recreate the trigger function with correct search_path ──
--
-- SECURITY DEFINER makes the function run as its owner (postgres).
-- SET search_path = public ensures it can resolve "profiles" even
-- when called from the auth schema trigger context.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ── 2. Recreate the trigger (idempotent) ──────────────────────

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── 3. Fix profiles RLS INSERT policy ─────────────────────────
--
-- Old policy: with check (id = auth.uid())
--   → Fails for trigger inserts because auth.uid() = null at signup time.
--
-- New policy: with check (true)
--   → Allows any insert. Safe because:
--     a) profiles.id is a FK → auth.users(id): only valid auth UIDs accepted.
--     b) The SECURITY DEFINER trigger controls who inserts on signup.
--     c) WorkspaceSetup upserts the same row with the authenticated user's
--        own ID — still safe in practice.
--   Reads and updates still enforce auth.uid() = id.

drop policy if exists "profiles_insert" on public.profiles;

create policy "profiles_insert" on public.profiles
  for insert with check (true);


-- ── 4. Ensure authenticated role has table-level INSERT grant ──
--
-- Needed if the fix-grants migration hasn't been run yet.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.organizations,
  public.people,
  public.work_items,
  public.deals,
  public.invoices,
  public.payments,
  public.expenses,
  public.resources,
  public.activity_events
to authenticated;

grant select on public.profiles to anon;


-- ── DONE ──────────────────────────────────────────────────────
-- Verify: sign up a new email/password user.
-- Supabase Auth should create the auth.users row,
-- the trigger fires and inserts into public.profiles,
-- user lands on WorkspaceSetup to create their workspace.
-- ============================================================
