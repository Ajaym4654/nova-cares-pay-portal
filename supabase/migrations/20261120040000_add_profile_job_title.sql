-- Store the employee designation separately from the system access role.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text;
