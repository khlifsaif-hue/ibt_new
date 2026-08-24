# SmartCare V5.8.3 — Backend/Frontend Relation Audit

## Result
Sub-project module verdict: KEEP.

## Corrections
- Removed PostgREST self-relationship embedding for `projects -> projects`.
- Parent project names are now resolved server-side with a separate `projects(id,name)` lookup.
- Finance roll-up remains a separate server-side query and merge.
- `/api/projects/[id]` now authenticates, checks project access, and always returns JSON errors.
- Verified frontend calls for Projects, Sub-projects, Project Dashboard, closure, Payments and Approval APIs.

## Important runtime dependency
- Migration `202608240004_project_hierarchy_budget_accounting.sql` must be applied successfully in Supabase.
- PostgREST schema cache may need a few seconds/reload after applying migrations.
