-- Follow-up policies: allow Admins to manage nurse profiles, never Admin/Super Admin roles.
create policy "admins create nurse profiles" on public.profiles
for insert to authenticated
with check (
  public.current_role() = 'admin'
  and role = 'nurse'
  and created_by = auth.uid()
);

create policy "admins update nurse profiles" on public.profiles
for update to authenticated
using (public.current_role() = 'admin' and role = 'nurse')
with check (public.current_role() = 'admin' and role = 'nurse');

create policy "admins delete nurse profiles" on public.profiles
for delete to authenticated
using (public.current_role() = 'admin' and role = 'nurse');

create policy "management read paystub files" on storage.objects
for select to authenticated
using (bucket_id = 'paystubs' and public.is_admin_or_super());

-- Admin account creation and all auth.users provisioning must still happen through a trusted
-- Edge Function using service-role credentials stored only as server secrets. That function
-- must enforce: super_admin may create admin/nurse; admin may create nurse only.
