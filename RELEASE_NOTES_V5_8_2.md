# SmartCare V5.8.2

## Project API / JSON loading fix
- Fixed `/api/projects` failure caused by trying to embed `project_financial_rollup` as a PostgREST relationship.
- Project rows and finance roll-up rows are now queried separately and merged server-side.
- Added JSON-safe error responses to `/api/projects`.
- Added defensive frontend response parsing so an empty API response no longer produces `Unexpected end of JSON input`.
- Preserved V5.8.1 JSX fix, sub-project hierarchy, Gap #4 budget control, and Gap #5 payment lifecycle.
