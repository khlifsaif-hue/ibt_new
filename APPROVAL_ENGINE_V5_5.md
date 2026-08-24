# SmartCare V5.5 — Gap #2 Universal Approval Engine

## Added
- Generic `approval_workflows` table: one workflow per business request.
- Ordered `approval_steps`: Finance → CEO or Finance-only depending on request type.
- Append-only `approval_events`: records submit/approve/reject/modification/resubmit evidence.
- RLS for requester/project/Finance/CEO/Admin visibility.
- Reusable server engine in `app/lib/approval-engine.ts`.
- `/api/approvals` to submit/list workflows.
- `/api/approvals/[id]` to inspect and act on a workflow.

## Current workflow definitions
- Budget Request: Finance Manager → CEO → APPROVED.
- Payment Request: Finance Manager → CEO → APPROVED_FOR_PAYMENT.
- Customer Invoice Request: Finance Manager → READY_TO_INVOICE.

## Supported decisions
- Approve
- Reject (comment required)
- Request modification (comment required)
- Resubmit by requester

## Intentionally deferred
- Fine-grained Finance permissions (Gap #3).
- Budget math/commitment postings (Gap #4).
- Payment processing/Paid action (Gap #5).
- Customer invoice issue/send lifecycle (Gap #6).
- Notification/email delivery (Gap #8).

Apply migrations in order, including `202608240002_universal_approval_engine.sql`.
