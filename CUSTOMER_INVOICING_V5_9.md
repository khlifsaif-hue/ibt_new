# SmartCare V5.9 — Gap #6 Customer Invoicing & Accounts Receivable

## Workflow
Project Manager / requester
→ Draft invoice request
→ Submit
→ Finance Manager review
→ Ready to Invoice
→ Finance issues invoice
→ Mark Sent
→ Outstanding / Due Soon / Overdue
→ Partial or full customer receipt
→ Paid

## Controls
- Project/sub-project linked.
- Closed projects cannot receive new invoice requests.
- Existing granular finance permissions are enforced server-side.
- Invoice request approval reuses the Universal Approval Engine.
- Invoice number, invoice date, due date, amount and customer are tracked.
- Partial receipts and full payment are supported.
- Due Soon and Overdue are derived from due date at read time.

## Scope
This is operational receivables control. It is not a general ledger, tax engine or bank reconciliation system.

## Migration
Apply `supabase/migrations/202608240005_customer_invoicing_module.sql`.
The core invoice tables already come from the V5.4 finance foundation migration.
