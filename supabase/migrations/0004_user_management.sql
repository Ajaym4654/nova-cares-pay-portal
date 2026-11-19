-- User Management permissions. RLS remains the authorization boundary.
-- Super Admin policies from 0001 allow full profile management.
-- Admin policies from 0002 allow nurse-only profile operations.
grant select, insert, update, delete on table public.profiles to authenticated;
