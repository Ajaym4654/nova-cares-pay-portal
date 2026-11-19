-- Payroll portal simplification: uploaded paystub documents no longer require a facility.
-- Run this migration in the Supabase SQL Editor for the connected project.

ALTER TABLE public.paystub_documents
  ALTER COLUMN facility_id DROP NOT NULL;
