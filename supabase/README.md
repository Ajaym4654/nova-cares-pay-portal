# Supabase setup

1. Create a dedicated Supabase project for Nova Cares Pay Portal.
2. Run the SQL migration in this folder only after reviewing it.
3. Enable email/password authentication.
4. Configure a private Storage bucket named `paystubs`.
5. Add the project URL and publishable/anon key to the frontend configuration.
6. Bootstrap the first Super Admin using a trusted server-side process; never allow public self-registration or a client-side role selector.

Do not upload real payroll documents until the RLS policies and Storage policies have been tested with at least two separate nurse accounts and an admin account.
