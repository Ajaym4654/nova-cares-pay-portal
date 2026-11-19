-- Grant authenticated users the SQL privileges needed to read their RLS-filtered portal data.
-- Row Level Security remains enabled and continues to decide which rows each user can see.
grant select on table
  public.candidate_facilities,
  public.facilities,
  public.pay_periods,
  public.paystub_documents
to authenticated;
