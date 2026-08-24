# SmartCare Invitation Flow

This version separates first-time user invitation from password recovery.

## New-user flow
1. Admin creates a user in SmartCare.
2. The server calls Supabase `inviteUserByEmail()`.
3. The invitation redirects through `/auth/callback?next=/auth/invite`.
4. The callback exchanges the Supabase code for a secure cookie session.
5. `/auth/invite` verifies that session and asks the user to create a password.
6. SmartCare updates the password using the authenticated Supabase session.
7. The temporary session is signed out and the user is sent to normal sign-in.

## Supabase URL configuration
Add the app URLs used for callback redirects to Supabase Authentication URL Configuration. For local development, allow the localhost callback URL used by the app. For production, allow the production SmartCare callback URL.

No passwords are stored in SmartCare profile tables.
