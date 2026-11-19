-- Security hardening before any real payroll data is added.
-- Apply after 0001_initial_schema.sql and 0002_admin_candidate_permissions.sql.

-- Audit and login activity must be written by trusted server-side code only.
drop policy if exists "management create audit logs" on public.audit_logs;
revoke insert, update, delete on table public.audit_logs from anon, authenticated;

-- Audit records are append-only, including for privileged application roles.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Audit records cannot be modified or deleted';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
before update or delete on public.audit_logs
for each row execute function public.prevent_audit_log_mutation();

-- Ensure helper functions have a fixed search path and are not callable by anonymous users.
alter function public.current_role() set search_path = public, pg_temp;
alter function public.is_admin_or_super() set search_path = public, pg_temp;
alter function public.is_super_admin() set search_path = public, pg_temp;
alter function public.is_assigned_candidate(uuid) set search_path = public, pg_temp;

revoke execute on function public.current_role() from public, anon;
revoke execute on function public.is_admin_or_super() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.is_assigned_candidate(uuid) from public, anon;

grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin_or_super() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_assigned_candidate(uuid) to authenticated;

-- Do not allow a browser session to write login events directly.
revoke insert, update, delete on table public.login_activity from anon, authenticated;

-- No anonymous access to payroll data tables.
revoke all on table public.profiles, public.recruiters, public.facilities,
  public.candidate_facilities, public.pay_periods, public.paystub_documents,
  public.notifications, public.audit_logs, public.login_activity
from anon;

-- The service role and trusted Edge Functions will handle account provisioning,
-- login telemetry, audit events, signed document URLs, and privileged mutations.
