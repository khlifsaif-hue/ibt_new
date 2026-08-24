import { createClient } from "./supabase/server";
import type { UserRecord } from "./database";

export const FINANCE_PERMISSION_KEYS = [
  "view_all_finance",
  "budget_request",
  "budget_review",
  "budget_final_approve",
  "payment_request",
  "payment_review",
  "payment_final_approve",
  "payment_mark_paid",
  "invoice_request",
  "invoice_review",
  "invoice_issue",
  "invoice_mark_sent",
  "invoice_mark_received",
] as const;

export type FinancePermissionKey = (typeof FINANCE_PERMISSION_KEYS)[number];

export type FinancePermissions = {
  userId: string;
  canViewAllFinance: boolean;
  canBudgetRequest: boolean;
  canBudgetReview: boolean;
  canBudgetFinalApprove: boolean;
  canPaymentRequest: boolean;
  canPaymentReview: boolean;
  canPaymentFinalApprove: boolean;
  canPaymentMarkPaid: boolean;
  canInvoiceRequest: boolean;
  canInvoiceReview: boolean;
  canInvoiceIssue: boolean;
  canInvoiceMarkSent: boolean;
  canInvoiceMarkReceived: boolean;
};

const COLUMN_BY_KEY: Record<FinancePermissionKey, string> = {
  view_all_finance: "can_view_all_finance",
  budget_request: "can_budget_request",
  budget_review: "can_budget_review",
  budget_final_approve: "can_budget_final_approve",
  payment_request: "can_payment_request",
  payment_review: "can_payment_review",
  payment_final_approve: "can_payment_final_approve",
  payment_mark_paid: "can_payment_mark_paid",
  invoice_request: "can_invoice_request",
  invoice_review: "can_invoice_review",
  invoice_issue: "can_invoice_issue",
  invoice_mark_sent: "can_invoice_mark_sent",
  invoice_mark_received: "can_invoice_mark_received",
};

function mapRow(row: any, userId: string): FinancePermissions {
  return {
    userId,
    canViewAllFinance: Boolean(row?.can_view_all_finance),
    canBudgetRequest: Boolean(row?.can_budget_request),
    canBudgetReview: Boolean(row?.can_budget_review),
    canBudgetFinalApprove: Boolean(row?.can_budget_final_approve),
    canPaymentRequest: Boolean(row?.can_payment_request),
    canPaymentReview: Boolean(row?.can_payment_review),
    canPaymentFinalApprove: Boolean(row?.can_payment_final_approve),
    canPaymentMarkPaid: Boolean(row?.can_payment_mark_paid),
    canInvoiceRequest: Boolean(row?.can_invoice_request),
    canInvoiceReview: Boolean(row?.can_invoice_review),
    canInvoiceIssue: Boolean(row?.can_invoice_issue),
    canInvoiceMarkSent: Boolean(row?.can_invoice_mark_sent),
    canInvoiceMarkReceived: Boolean(row?.can_invoice_mark_received),
  };
}

export async function getFinancePermissions(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_user_permissions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapRow(data, userId);
}

export async function setFinancePermissions(userId: string, input: Partial<FinancePermissions>) {
  const supabase = await createClient();
  const row = {
    user_id: userId,
    can_view_all_finance: Boolean(input.canViewAllFinance),
    can_budget_request: Boolean(input.canBudgetRequest),
    can_budget_review: Boolean(input.canBudgetReview),
    can_budget_final_approve: Boolean(input.canBudgetFinalApprove),
    can_payment_request: Boolean(input.canPaymentRequest),
    can_payment_review: Boolean(input.canPaymentReview),
    can_payment_final_approve: Boolean(input.canPaymentFinalApprove),
    can_payment_mark_paid: Boolean(input.canPaymentMarkPaid),
    can_invoice_request: Boolean(input.canInvoiceRequest),
    can_invoice_review: Boolean(input.canInvoiceReview),
    can_invoice_issue: Boolean(input.canInvoiceIssue),
    can_invoice_mark_sent: Boolean(input.canInvoiceMarkSent),
    can_invoice_mark_received: Boolean(input.canInvoiceMarkReceived),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("finance_user_permissions")
    .upsert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data, userId);
}

export async function userCanFinance(user: Pick<UserRecord, "id" | "role">, key: FinancePermissionKey) {
  // Platform Admin remains emergency full-access to prevent administrative lockout.
  if (user.role === "ADMIN") return true;
  const supabase = await createClient();
  const column = COLUMN_BY_KEY[key];
  const { data, error } = await supabase
    .from("finance_user_permissions")
    .select(column)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.[column as keyof typeof data]);
}
