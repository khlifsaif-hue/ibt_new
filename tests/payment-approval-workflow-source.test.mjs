import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const engine=fs.readFileSync(new URL("../app/lib/approval-engine.ts",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../app/finance/payments/page.tsx",import.meta.url),"utf8");

test("payment requests progress from Finance review through CEO final approval",()=>{
  assert.match(engine,/FINANCE_CEO_PAYMENT_V1/);
  assert.match(engine,/FINANCE_REVIEW[\s\S]*CEO_APPROVAL/);
  assert.match(engine,/CEO_REVIEW/);
  assert.match(engine,/APPROVED_FOR_PAYMENT/);
  assert.match(page,/Requester → Finance review → CEO approval → Ready for Payment → Paid/);
});

test("each payment decision notifies all workflow parties",()=>{
  assert.match(engine,/notifyPaymentDecisionParties/);
  assert.match(engine,/recipientsForFinancePermission\("payment_review"\)/);
  assert.match(engine,/recipientsForFinancePermission\("payment_final_approve"\)/);
  assert.match(engine,/steps\|\|\[\]\)\.map\(row=>String\(row\.decided_by/);
  assert.match(engine,/Payment request approved by Finance — CEO decision required/);
  assert.match(engine,/Payment request approved by CEO — ready for payment/);
  assert.match(engine,/type==="PAYMENT_REQUEST"\)await notifyPaymentDecisionParties\(id[\s\S]*decisionTitle,decisionMessage/);
});
