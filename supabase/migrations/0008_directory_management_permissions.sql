-- Portal UI permissions for managing facility and recruiter directories.
-- Existing RLS policies continue to restrict these operations to active Admin/Super Admin users.
grant select, insert, update, delete on table public.facilities to authenticated;
grant select, insert, update, delete on table public.recruiters to authenticated;
