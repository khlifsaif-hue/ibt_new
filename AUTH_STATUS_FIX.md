# SmartCare Authentication Status Fix

## Changed
- Added a dedicated `PATCH /api/users/[id]/status` endpoint for Activate/Deactivate.
- Activation status now updates `public.profiles.active` through the signed-in server Supabase client and RLS.
- Activate/Deactivate no longer calls the Supabase Auth Admin API and therefore does not require `SUPABASE_SECRET_KEY` for this action.
- Added explicit Activate/Deactivate actions in User Management.
- Removed the Active checkbox from the edit-user form so normal profile editing cannot accidentally toggle account status.
- Prevented self-deactivation.
- Centralized inactive-user rejection in `getSmartCareActor()`, so inactive profiles are treated as unauthorized throughout protected SmartCare APIs.

## Intentionally unchanged
`SUPABASE_SECRET_KEY` is still required for genuine Supabase Auth administration, including:
- inviting a new Auth user,
- deleting an Auth user,
- changing the Supabase Auth email through the current full-edit flow.

This separation is intentional: SmartCare access status belongs to `profiles.active`; Supabase Auth identity administration remains privileged.
