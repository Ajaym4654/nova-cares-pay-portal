-- Repair management access to login activity and audit logs.
-- Only active Admins and Super Admins may read these security records.
grant select on table public.login_activity, public.audit_logs to authenticated;

drop policy if exists "management read login activity" on public.login_activity;
create policy "management read login activity" on public.login_activity
for select to authenticated
using (public.is_admin_or_super());

drop policy if exists "management read audit logs" on public.audit_logs;
create policy "management read audit logs" on public.audit_logs
for select to authenticated
using (public.is_admin_or_super());

create index if not exists login_activity_created_idx on public.login_activity(created_at desc);
create index if not exists audit_logs_actor_created_idx on public.audit_logs(actor_id,created_at desc);
