-- Payroll portal simplification: pay periods no longer require a facility.
-- Run this migration in the Supabase SQL Editor for the connected project.

ALTER TABLE public.pay_periods
  ALTER COLUMN facility_id DROP NOT NULL;

-- With facility_id NULL, the old facility-based unique key may allow duplicate
-- nurse/week rows. This partial index enforces one facility-free pay period
-- per nurse and week.
CREATE UNIQUE INDEX IF NOT EXISTS pay_periods_candidate_week_no_facility_uidx
  ON public.pay_periods (candidate_id, week_label)
  WHERE facility_id IS NULL;
