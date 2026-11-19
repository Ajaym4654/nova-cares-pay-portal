-- One-time permissions for the admin directory and paystub upload screens.
-- RLS remains enabled and continues to restrict rows and writes to active Admin/Super Admin users.

-- Facilities and recruiter directory management.
grant select, insert, update, delete on table public.facilities to authenticated;
grant select, insert, update, delete on table public.recruiters to authenticated;

-- Paystub upload workflow (safe to repeat if migration 0007 was already applied).
grant select, insert on table public.pay_periods to authenticated;
grant select, insert on table public.candidate_facilities to authenticated;
grant select, insert on table public.paystub_documents to authenticated;

create unique index if not exists paystub_documents_one_per_period
on public.paystub_documents(pay_period_id);
