# SmartCare V5.4 — Gap #1 Finance Data Model

This version establishes the finance data foundation requested for project-based budget requests, payment requests, and customer invoicing. It is intentionally additive: existing Procurement, Purchase Request, Project Budget, and Expense logic remains intact.

## Added entities

- `funding_sources` — client/internal/grant/other source master data and contract value.
- `project_funding_sources` — many-to-many link between projects and their sources of funding, with one optional primary source.
- `budget_requests` — requester/project/amount/purpose/status foundation for the Budget Request workflow.
- `payment_requests` — payment request plus links to an approved budget request, purchase request, and/or PO. `APPROVED_FOR_PAYMENT` and `PAID` are separate states.
- `customer_invoice_requests` — Project Manager request to Finance to issue a customer invoice.
- `customer_invoices` — invoice number/date/due date/status/receipts for operational accounts-receivable visibility.
- `financial_documents` — common metadata layer for supporting documents stored in Supabase Storage.
- `project_expenses.payment_request_id` — traceability from actual project expense back to the payment request that caused it.

## Deliberately deferred

Gap #1 does **not** hard-code Finance Manager -> CEO approvals. The tables expose workflow statuses, but Gap #2 will add the reusable approval engine and immutable transition history. Gap #3 will then replace baseline role-level RLS with granular finance permissions.

## Safety / compatibility

- Existing tables are not deleted or renamed.
- Existing `project_financials`, `purchase_requests`, `purchase_orders`, and `project_expenses` continue to work.
- All new finance tables have RLS enabled from creation.
- Sensitive data is initially limited to CEO/Admin/Finance, project-access users, and request owners as appropriate.
- Actual files remain in Supabase Storage; `financial_documents` stores metadata/path only.

## Apply

Apply the new migration using your normal Supabase migration process. The migration file is:

`supabase/migrations/202608240001_finance_foundation_data_model.sql`

Do not manually recreate the tables from the dashboard if the migration is being used.
