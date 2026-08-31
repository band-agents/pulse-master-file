-- ============================================================
-- Bumblebee — Clean Install Schema
-- supabase/schema-clean-install.sql
--
-- Safe to run on a completely empty Supabase project.
-- Structure: CREATE first → triggers → RLS → policies.
-- Nothing is dropped before its table exists.
--
-- Before running: wipe the public schema (see SUPABASE_SETUP.md).
-- ============================================================


-- ===========================================================
-- 0. EXTENSIONS
-- ===========================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";


-- ===========================================================
-- 1. TABLES  (dependency order — parents before children)
-- ===========================================================

-- ─── profiles ─────────────────────────────────────────────
-- One row per auth user. Created automatically by trigger.
create table profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null default '',
  full_name   text        not null default '',
  avatar_url  text,
  role        text        not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── workspaces ───────────────────────────────────────────
-- Created by WorkspaceSetup onboarding (never by trigger).
create table workspaces (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,
  slug        text        not null unique,
  owner_id    uuid        not null references profiles(id) on delete restrict,
  plan        text        not null default 'free',
  settings    jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index workspaces_owner_idx on workspaces(owner_id);

-- ─── workspace_members ────────────────────────────────────
create table workspace_members (
  id            uuid        primary key default uuid_generate_v4(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  user_id       uuid        not null references profiles(id)   on delete cascade,
  role          text        not null default 'member'
                            check (role in ('owner','admin','member','viewer')),
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_workspace_idx on workspace_members(workspace_id);
create index workspace_members_user_idx      on workspace_members(user_id);

-- ─── organizations ────────────────────────────────────────
create table organizations (
  id            uuid        primary key default uuid_generate_v4(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  name_en       text        not null,
  name_ar       text,
  sector        text,
  lifecycle     text,
  health_score  integer     not null default 70
                            check (health_score between 0 and 100),
  headcount     integer,
  website       text,
  tags          text[]      not null default '{}',
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index organizations_workspace_idx on organizations(workspace_id);
create index organizations_name_idx      on organizations using gin(name_en gin_trgm_ops);

-- ─── people ───────────────────────────────────────────────
create table people (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references workspaces(id)    on delete cascade,
  organization_id uuid                 references organizations(id) on delete set null,
  name_en         text        not null,
  name_ar         text,
  email           text,
  phone           text,
  role_en         text,
  role_ar         text,
  avatar_url      text,
  tags            text[]      not null default '{}',
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index people_workspace_idx    on people(workspace_id);
create index people_org_idx          on people(organization_id);
create index people_name_trgm_idx    on people using gin(name_en gin_trgm_ops);

-- ─── work_items ───────────────────────────────────────────
-- Unified table for tasks, projects, and any actionable work.
create table work_items (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  title_en        text        not null,
  title_ar        text,
  type            text        not null default 'task'
                              check (type in ('task','project','milestone','action')),
  status          text        not null default 'todo'
                              check (status in ('todo','in_progress','review','done','blocked','cancelled')),
  priority        text        not null default 'medium'
                              check (priority in ('urgent','high','medium','low')),
  assignee_id     uuid                 references people(id) on delete set null,
  parent_id       uuid                 references work_items(id) on delete cascade,
  organization_id uuid                 references organizations(id) on delete set null,
  due_date        date,
  progress        integer     not null default 0 check (progress between 0 and 100),
  tags            text[]      not null default '{}',
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index work_items_workspace_idx on work_items(workspace_id);
create index work_items_status_idx    on work_items(workspace_id, status);
create index work_items_assignee_idx  on work_items(assignee_id);
create index work_items_parent_idx    on work_items(parent_id);

-- ─── deals ────────────────────────────────────────────────
create table deals (
  id                   uuid        primary key default uuid_generate_v4(),
  workspace_id         uuid        not null references workspaces(id)    on delete cascade,
  organization_id      uuid                 references organizations(id) on delete set null,
  title_en             text        not null,
  title_ar             text,
  value                numeric     not null default 0,
  currency             text        not null default 'SAR',
  stage                text        not null default 'lead'
                                   check (stage in ('lead','qualified','proposal','negotiation','won','lost')),
  probability          integer     not null default 0
                                   check (probability between 0 and 100),
  org_name_en          text,
  org_name_ar          text,
  contact_name_en      text,
  contact_name_ar      text,
  expected_close_date  date,
  tags                 text[]      not null default '{}',
  metadata             jsonb       not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index deals_workspace_idx on deals(workspace_id);
create index deals_stage_idx     on deals(workspace_id, stage);
create index deals_org_idx       on deals(organization_id);

-- ─── invoices ─────────────────────────────────────────────
create table invoices (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references workspaces(id)    on delete cascade,
  organization_id uuid                 references organizations(id) on delete set null,
  deal_id         uuid                 references deals(id)         on delete set null,
  number          text        not null,
  org_name_en     text        not null default '',
  org_name_ar     text,
  amount          numeric     not null default 0,
  currency        text        not null default 'SAR',
  status          text        not null default 'draft'
                              check (status in ('draft','sent','paid','overdue','cancelled')),
  due_date        date,
  paid_date       date,
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index invoices_workspace_idx on invoices(workspace_id);
create index invoices_status_idx    on invoices(workspace_id, status);

-- ─── payments ─────────────────────────────────────────────
create table payments (
  id            uuid        primary key default uuid_generate_v4(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  invoice_id    uuid                 references invoices(id)   on delete set null,
  amount        numeric     not null,
  currency      text        not null default 'SAR',
  method        text,
  status        text        not null default 'pending'
                            check (status in ('pending','completed','failed','refunded')),
  paid_at       timestamptz,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index payments_workspace_idx on payments(workspace_id);
create index payments_invoice_idx   on payments(invoice_id);

-- ─── expenses ─────────────────────────────────────────────
create table expenses (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  description_en  text        not null,
  description_ar  text,
  amount          numeric     not null,
  currency        text        not null default 'SAR',
  category        text,
  date            date,
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index expenses_workspace_idx on expenses(workspace_id);

-- ─── resources ────────────────────────────────────────────
create table resources (
  id            uuid        primary key default uuid_generate_v4(),
  workspace_id  uuid        not null references workspaces(id) on delete cascade,
  name_en       text        not null,
  name_ar       text,
  type          text        not null,
  utilization   integer     not null default 0 check (utilization between 0 and 100),
  department    text,
  skills        text[]      not null default '{}',
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index resources_workspace_idx on resources(workspace_id);

-- ─── activity_events ──────────────────────────────────────
-- Immutable log of all actions across the workspace.
create table activity_events (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references workspaces(id) on delete cascade,
  actor_id        uuid                 references profiles(id)   on delete set null,
  action          text        not null,
  entity_type     text        not null,
  entity_id       uuid        not null,
  description_en  text,
  description_ar  text,
  metadata        jsonb       not null default '{}',
  created_at      timestamptz not null default now()
  -- no updated_at: activity_events are append-only
);

create index activity_events_workspace_idx on activity_events(workspace_id);
create index activity_events_entity_idx    on activity_events(entity_type, entity_id);
create index activity_events_created_idx   on activity_events(workspace_id, created_at desc);


-- ===========================================================
-- 2. HELPER FUNCTIONS  (before triggers and policies)
-- ===========================================================

-- updated_at auto-stamp (used by trigger below)
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Workspace membership check — used by RLS policies
create or replace function is_workspace_member(ws_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id      = auth.uid()
  );
$$;

-- Workspace admin check — used by RLS delete policies
create or replace function is_workspace_admin(ws_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id
      and user_id      = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- Profile auto-creation on signup (email/password or OAuth).
-- SECURITY DEFINER runs as the function owner (postgres superuser).
-- SET search_path = public is required — without it, the trigger fires
-- from the auth schema context and cannot resolve "profiles".
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


-- ===========================================================
-- 3. TRIGGERS  (safe to create now — all tables exist above)
-- ===========================================================

-- Drop any stale version of each trigger before (re)creating it.
-- Tables exist at this point, so DROP TRIGGER is safe.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- updated_at stamps on all mutable tables
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'profiles', 'workspaces', 'workspace_members',
    'organizations', 'people', 'work_items',
    'deals', 'invoices', 'payments', 'expenses',
    'resources'
    -- activity_events intentionally excluded: append-only
  ] loop
    execute format('
      drop trigger if exists set_updated_at on %I;
      create trigger set_updated_at
        before update on %I
        for each row execute function update_updated_at();
    ', tbl, tbl);
  end loop;
end $$;


-- ===========================================================
-- 4. ROW LEVEL SECURITY
-- ===========================================================

alter table profiles           enable row level security;
alter table workspaces         enable row level security;
alter table workspace_members  enable row level security;
alter table organizations      enable row level security;
alter table people             enable row level security;
alter table work_items         enable row level security;
alter table deals              enable row level security;
alter table invoices           enable row level security;
alter table payments           enable row level security;
alter table expenses           enable row level security;
alter table resources          enable row level security;
alter table activity_events    enable row level security;


-- ─── profiles policies ────────────────────────────────────
create policy "profiles_select" on profiles
  for select using (id = auth.uid());

-- Allows the handle_new_user trigger (security definer) to insert.
-- Also allows a user to insert their own row (needed if trigger missed).
create policy "profiles_insert" on profiles
  for insert with check (id = auth.uid());

create policy "profiles_update" on profiles
  for update using (id = auth.uid());


-- ─── workspaces policies ──────────────────────────────────
-- SELECT: owner always, plus any member
create policy "workspaces_select" on workspaces
  for select using (owner_id = auth.uid() or is_workspace_member(id));

-- INSERT: any authenticated user can create a workspace they own.
--         This is what WorkspaceSetup.tsx does on first onboarding.
create policy "workspaces_insert" on workspaces
  for insert with check (auth.uid() = owner_id);

-- UPDATE: only the owner
create policy "workspaces_update" on workspaces
  for update using (owner_id = auth.uid());


-- ─── workspace_members policies ───────────────────────────
-- SELECT: any member can see who else is in their workspace
create policy "workspace_members_select" on workspace_members
  for select using (is_workspace_member(workspace_id));

-- INSERT: only the workspace owner can add new members.
--         Also allows the owner to insert their OWN first membership
--         during onboarding (the workspace insert happens first,
--         so the owner row exists before this insert fires).
create policy "workspace_members_insert" on workspace_members
  for insert with check (
    exists (
      select 1 from workspaces
      where id       = workspace_id
        and owner_id = auth.uid()
    )
  );

create policy "workspace_members_update" on workspace_members
  for update using (is_workspace_admin(workspace_id));

create policy "workspace_members_delete" on workspace_members
  for delete using (is_workspace_admin(workspace_id));


-- ─── Workspace-isolated tables (universal pattern) ────────
-- SELECT / INSERT / UPDATE: any workspace member
-- DELETE: admins and owners only
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'organizations', 'people', 'work_items',
    'deals', 'invoices', 'payments', 'expenses',
    'resources', 'activity_events'
  ] loop
    execute format('
      create policy "ws_select" on %I
        for select using (is_workspace_member(workspace_id));
      create policy "ws_insert" on %I
        for insert with check (is_workspace_member(workspace_id));
      create policy "ws_update" on %I
        for update using (is_workspace_member(workspace_id));
      create policy "ws_delete" on %I
        for delete using (is_workspace_admin(workspace_id));
    ', tbl, tbl, tbl, tbl);
  end loop;
end $$;


-- ===========================================================
-- 5. TABLE-LEVEL GRANTS
--
-- RLS policies only fire after the role has table-level access.
-- Raw SQL CREATE TABLE does NOT auto-grant to authenticated/anon,
-- so these grants are required or every request returns 42501.
-- ===========================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  profiles, workspaces, workspace_members,
  organizations, people, work_items,
  deals, invoices, payments, expenses,
  resources, activity_events
to authenticated;

-- anon role: read-only on profiles (for public lookups only)
grant select on profiles to anon;


-- ===========================================================
-- DONE
-- Verify in Supabase: Database → Tables — you should see
-- 12 tables. Authentication → Triggers → on_auth_user_created.
-- ===========================================================
