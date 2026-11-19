-- Complete first-login password setup without allowing users to edit their own role/profile fields.
create or replace function public.complete_password_setup()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set must_change_password = false,
      updated_at = now()
  where id = auth.uid()
    and is_active = true
    and must_change_password = true;

  if not found then
    if exists (select 1 from public.profiles where id = auth.uid() and is_active = true and must_change_password = false) then
      return;
    end if;
    raise exception 'Active portal profile not found';
  end if;
end;
$$;

revoke all on function public.complete_password_setup() from public, anon;
grant execute on function public.complete_password_setup() to authenticated;
