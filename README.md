# Nova Cares Pay Portal

A secure employee payroll and document portal for Nova Cares Staffing LLC.

## Planned roles
- **Super Admin:** full system administration and audit access.
- **Admin:** candidate, facility, recruiter and paystub management.
- **Nurse/Candidate:** access only to their own assigned facilities and documents.

## Stack
- HTML, CSS and vanilla JavaScript
- Supabase Auth, PostgreSQL and private Storage
- Netlify hosting and serverless functions

## Current status
Project foundation is being built. The login UI and deployment structure are the first milestone. Real authentication and document access require a configured Supabase project and the SQL/security setup in `supabase/`.

## Local preview
Open `index.html` in a browser for the interface preview. For Supabase sign-in, configure the project URL and anon key in `js/config.js` (never put a service-role key in frontend code).

## Deployment
Connect this repository to Netlify. Publish directory: `.`. Add the Supabase project URL and anon key as site environment variables if/when the app is switched to environment-based configuration.

## Security
Paystubs must remain in private storage. Database Row Level Security and server-side authorization are required before uploading real employee documents. Do not use real payroll records until the security policies have been reviewed and tested.
