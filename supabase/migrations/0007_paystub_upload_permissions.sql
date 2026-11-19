-- Allow authenticated administrators to create pay periods and paystub metadata.
-- RLS policies remain responsible for restricting writes to active Admin/Super Admin users.
grant select, insert on table public.pay_periods to authenticated;
grant select, insert on table public.candidate_facilities to authenticated;
grant select, insert on table public.paystub_documents to authenticated;

-- A pay period represents one nurse + facility + week and should have one uploaded document.
create unique index if not exists paystub_documents_one_per_period
on public.paystub_documents(pay_period_id);
