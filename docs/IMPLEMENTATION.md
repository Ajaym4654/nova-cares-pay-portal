# Implementation milestones

## Confirmed requirements
- Agency: Nova Cares Staffing LLC
- Approximately 500 nurse accounts initially
- Weekly paystub folders under each assigned facility
- Indefinite retention unless an authorized user deletes a record
- One login page; roles: super_admin, admin, nurse
- Admin creates nurses and manually issues credentials
- Super Admin creates admins and nurses
- Admin cannot create or manage other admins

## Security design
- Supabase Auth owns password hashes and sessions.
- The profiles table stores role and account metadata, never plaintext passwords.
- RLS enforces per-user candidate document access.
- Paystub storage is private; files are delivered using short-lived signed URLs after authorization.
- Privileged account creation and role changes run server-side only.
- Audit events record actor, action, target and timestamp. IP/device metadata should be collected only with an appropriate privacy notice and retention policy.

## First milestone
Responsive login page and deployment scaffold. Authentication is intentionally inactive until the owner configures Supabase and applies the reviewed schema/policies.
