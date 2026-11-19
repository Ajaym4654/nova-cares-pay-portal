-- Nova Cares Pay Portal: initial schema
-- Review and apply in a dedicated Supabase project. Never expose service_role keys in browser code.
create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin', 'admin', 'nurse');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  login_id text not null unique,
  email text not null unique,
  full_name text not null,
  phone text,
  role public.app_role not null default 'nurse',
  recruiter_id uuid,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recruiters (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.profiles add constraint profiles_recruiter_fk foreign key (recruiter_id) references public.recruiters(id) on delete set null;

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name, city, state)
);

create table public.candidate_facilities (
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (candidate_id, facility_id)
);

create table public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  week_label text not null,
  period_start date,
  period_end date,
  pay_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (candidate_id, facility_id, week_label),
  foreign key (candidate_id, facility_id) references public.candidate_facilities(candidate_id, facility_id) on delete cascade
);

create table public.paystub_documents (
  id uuid primary key default gen_random_uuid(),
  pay_period_id uuid not null references public.pay_periods(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  facility_id uuid not null references public.facilities(id) on delete restrict,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  description text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (candidate_id, facility_id) references public.candidate_facilities(candidate_id, facility_id) on delete cascade
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.login_activity (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('login_success','login_failed','logout','password_reset')),
  ip_address inet,
  user_agent text,
  approximate_location text,
  created_at timestamptz not null default now()
);

create index pay_periods_candidate_facility_idx on public.pay_periods(candidate_id, facility_id, period_start desc);
create index documents_candidate_idx on public.paystub_documents(candidate_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index login_activity_user_idx on public.login_activity(user_id, created_at desc);

-- Security-definer helpers avoid recursive RLS checks against profiles.
create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and is_active = true $$;

create or replace function public.is_admin_or_super()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() in ('admin','super_admin'), false) $$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() = 'super_admin', false) $$;

create or replace function public.is_assigned_candidate(candidate uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.candidate_facilities cf where cf.candidate_id = candidate and cf.candidate_id = auth.uid()) $$;

alter table public.profiles enable row level security;
alter table public.recruiters enable row level security;
alter table public.facilities enable row level security;
alter table public.candidate_facilities enable row level security;
alter table public.pay_periods enable row level security;
alter table public.paystub_documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.login_activity enable row level security;

create policy "profiles read own or management" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin_or_super());
create policy "super admins manage profiles" on public.profiles for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "management manage recruiters" on public.recruiters for all to authenticated
using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "users read recruiters assigned to them" on public.recruiters for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.recruiter_id = recruiters.id));

create policy "management manage facilities" on public.facilities for all to authenticated
using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "nurses read assigned facilities" on public.facilities for select to authenticated
using (exists (select 1 from public.candidate_facilities cf where cf.candidate_id = auth.uid() and cf.facility_id = facilities.id));

create policy "management manage assignments" on public.candidate_facilities for all to authenticated
using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "nurses read own assignments" on public.candidate_facilities for select to authenticated
using (candidate_id = auth.uid());

create policy "management manage pay periods" on public.pay_periods for all to authenticated
using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "nurses read own pay periods" on public.pay_periods for select to authenticated
using (candidate_id = auth.uid());

create policy "management manage documents" on public.paystub_documents for all to authenticated
using (public.is_admin_or_super()) with check (public.is_admin_or_super());
create policy "nurses read own documents" on public.paystub_documents for select to authenticated
using (candidate_id = auth.uid());

create policy "users read own notifications" on public.notifications for select to authenticated
using (recipient_id = auth.uid());
create policy "users update own notifications" on public.notifications for update to authenticated
using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "management create notifications" on public.notifications for insert to authenticated
with check (public.is_admin_or_super());

create policy "super admins read audit logs" on public.audit_logs for select to authenticated
using (public.is_super_admin());
create policy "management create audit logs" on public.audit_logs for insert to authenticated
with check (public.is_admin_or_super() and actor_id = auth.uid());

create policy "super admins read login activity" on public.login_activity for select to authenticated
using (public.is_super_admin());
create policy "users read own login activity" on public.login_activity for select to authenticated
using (user_id = auth.uid());

-- Create this bucket as private in Storage. File path convention:
-- <candidate_uuid>/<facility_uuid>/<pay_period_uuid>/<filename>
-- These policies restrict nurse reads to their own candidate UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paystubs', 'paystubs', false, 20971520,
  array['application/pdf','image/jpeg','image/png','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "management upload paystub files" on storage.objects for insert to authenticated
with check (bucket_id = 'paystubs' and public.is_admin_or_super());
create policy "management update paystub files" on storage.objects for update to authenticated
using (bucket_id = 'paystubs' and public.is_admin_or_super())
with check (bucket_id = 'paystubs' and public.is_admin_or_super());
create policy "management delete paystub files" on storage.objects for delete to authenticated
using (bucket_id = 'paystubs' and public.is_admin_or_super());
create policy "nurses read own paystub files" on storage.objects for select to authenticated
using (bucket_id = 'paystubs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bootstrap the first Super Admin only through a trusted server-side process.
-- Never allow public users to select their own role during sign-up.
