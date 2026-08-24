# SmartCare Performance Rebuild V3_04

## Main changes
- Added `/api/dashboard` as a lightweight Overview endpoint.
- Overview no longer downloads complete Assets and Work Orders datasets before rendering.
- Dashboard requests asset statistics, 12 compact asset cards, work-order status counts, and 5 recent work orders in parallel on the server.
- Added private short-lived caching headers for lightweight dashboard/options payloads.
- Added immediate dashboard skeleton cards during the initial request.
- Assets registry no longer generates signed image URLs on the initial list request.
- Assets registry renders 24 cards initially and progressively renders more on demand.
- Maintenance, Work Orders, Reports, Depreciation, and AI Assistant use asset data without signed images where images are not required.
- Added compact project option loading (`/api/projects?compact=1`) for selector-only screens.
- Added compact user loading (`/api/users?compact=1`) for Maintenance and Work Orders, avoiding unnecessary role/project payload work.
- Deferred notification loading by 1.5 seconds so notifications do not compete with the critical page request.
- Removed the login debug console message.

## Why this should improve perceived speed
The previous Overview loaded entire Assets and Work Orders collections in the browser and then calculated KPI/chart values client-side. The new flow returns a much smaller, purpose-built dashboard payload. Large asset card lists are also no longer all mounted at once.

## Important next optimization
For very large datasets, move Assets, Work Orders, Purchase Requests, Reports, and Project Dashboard to server-side pagination/filtering rather than downloading all records. Add or verify database indexes on frequently filtered foreign keys/status/date fields after measuring Supabase query plans.

## Validation status
Source structure and modified routes were manually checked. A full `npm ci`/production build could not be completed in the execution environment because dependency installation timed out. Run locally:

```bash
npm install
npm run build
npm run dev
```

Then compare Network timings for `/api/dashboard`, `/api/assets?images=0`, `/api/users?compact=1`, and `/api/projects?compact=1`.
