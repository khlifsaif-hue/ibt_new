# SmartCare V5.7 — Sub-project hierarchy + Gap #4 budget control

A sub-project is stored in the normal `projects` table with `parent_project_id`, so all existing project-linked functions work without duplicate systems.

## Sub-project controls
- own approved allocation
- expenses and actual spend
- purchase commitments
- payment request commitments
- tasks, activities, KPIs and milestones
- risks/issues
- assets
- close/reopen lifecycle

## Roll-up
Parent project committed and spent values include descendants. Child allocations do not increase the main project's approved budget, preventing portfolio double counting.

## Closure
Closure is blocked while the project has open child projects, PRs, POs, payment requests, tasks/activities/KPIs, risks/issues, or unpaid customer invoices.

## Migration
Apply `202608240004_project_hierarchy_budget_accounting.sql` after V5.4–V5.6 migrations.
