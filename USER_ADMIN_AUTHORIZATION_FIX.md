# SmartCare User Administration Authorization Fix

## Corrected behavior
- ADMIN can edit SmartCare profile fields without invoking the Supabase Auth Admin API.
- Name, role, department, job title, phone, project assignments and seeded module permissions use the signed-in server Supabase client and existing RLS admin policies.
- Active/Disabled status remains isolated in `/api/users/[id]/status` and is not changed through generic profile edits.
- Editing a user no longer requires `SUPABASE_SECRET_KEY` merely because the form contains an email field.
- The Supabase Auth Admin client is created only when the normalized login email actually changes.
- Login-email changes still update Supabase Auth and therefore intentionally require server Auth-admin configuration.

## Security model
- Supabase Auth: identity/login.
- `profiles`: SmartCare profile and active status.
- `roles`, `user_permissions`, `user_project_access`: application authorization.
- RLS: database enforcement.

This avoids coupling routine SmartCare administration to the service secret while preserving identity consistency for real login-email changes.
