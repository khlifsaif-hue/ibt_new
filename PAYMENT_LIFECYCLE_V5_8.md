# SmartCare V5.8 — Gap #5 Payment Lifecycle

Payment requests now have an operational UI and lifecycle:
DRAFT → FINANCE_REVIEW → CEO_REVIEW → APPROVED_FOR_PAYMENT → PAID.

- Requester creates a draft against a main project or sub-project.
- Submission uses the Universal Approval Engine.
- Finance review and CEO final approval use granular V5.6 permissions.
- Finance can mark an approved payment as Paid with a required payment reference.
- Project/sub-project financials refresh when payment status changes.
- `APPROVED_FOR_PAYMENT` contributes to committed value.
- `PAID` contributes to actual spend when it is a standalone payment not already represented by a PO/expense.
