-- Ensure activity tables exist before applying grants and RLS policies.
-- These definitions match the portal's initial schema and are safe to re-run.
create table if not exists public.login_activity (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('login_success','login_failed','logout','password_reset')),
  ip_address inet,
  user_agent text,
  approximate_location text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.login_activity enable row level security;
alter table public.audit_logs enable row level security;

-- Only active Admins and Super Admins may read management activity.
grant select on table public.login_activity, public.audit_logs to authenticated;

drop policy if exists "management read login activity" on public.login_activity;
create policy "management read login activity" on public.login_activity
for select to authenticated
using (public.is_admin_or_super());

drop policy if exists "management read audit logs" on public.audit_logs;
create policy "management read audit logs" on public.audit_logs
for select to authenticated
using (public.is_admin_or_super());

create index if not exists login_activity_user_idx on public.login_activity(user_id, created_at desc);
create index if not exists login_activity_created_idx on public.login_activity(created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs(actor_id, created_at desc);
