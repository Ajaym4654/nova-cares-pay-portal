-- Allow active Admin and Super Admin users to edit and delete uploaded paystub records.
grant update, delete on table public.pay_periods to authenticated;
grant update, delete on table public.paystub_documents to authenticated;

-- Existing management policies from the initial schema restrict these mutations
-- to public.is_admin_or_super() (active Admin / Super Admin roles).
