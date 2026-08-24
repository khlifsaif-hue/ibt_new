# SmartCare V5.6 — Gap #3 Finance Permissions & Segregation of Duties

## Purpose
Separate finance duties so a user can be permitted to request, review, finally approve, pay, issue, or close finance records independently.

## Permission groups
- View all finance
- Budget: request / Finance review / CEO final approval
- Payment: request / Finance review / CEO final approval / mark paid
- Customer invoice: request / Finance review / issue / mark sent / mark received

## Default role seed
- ADMIN: full finance administration
- CEO: visibility + final Budget/Payment approval
- FINANCE: visibility + Finance review + payment processing + invoicing operations
- PROJECT_MANAGER: budget/payment requests + customer invoice request
- MANAGER / STAFF / TECHNICIAN: budget/payment request
- VIEWER: no finance action by default

Admin can override these permissions per user in Access Control.

## Segregation of duties
A non-Admin user cannot approve a workflow they submitted themselves.

## Enforcement
The approval engine checks the granular finance permission server-side. UI visibility alone is not treated as security.

## Migration
Apply:
`supabase/migrations/202608240003_finance_permissions_sod.sql`
after the V5.4 and V5.5 migrations.
