import {createClient} from "./supabase/server";
import {insertNotifications,recipientsForFinancePermission,recalculateProjectFinancials,type UserRecord} from "./database";
import {userCanFinance} from "./finance-permissions";

function fail(error:any){if(error)throw new Error(error.message||"Payment request operation failed")}
function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0}

export async function listPaymentRequests(actor:UserRecord,projectId?:string){
 const supabase=await createClient();
 let query=supabase.from("payment_requests")
  .select("*,projects(name),requester:profiles!payment_requests_requested_by_fkey(full_name)")
  .order("created_at",{ascending:false});
 if(projectId)query=query.eq("project_id",projectId);
 if(!await userCanFinance(actor,"view_all_finance"))query=query.eq("requested_by",actor.id);
 const{data,error}=await query;fail(error);
 const ids=(data||[]).map(r=>String(r.id));
 const{data:flows,error:flowError}=ids.length?await supabase.from("approval_workflows").select("id,entity_id,status,current_step_order,approval_steps(*)").eq("entity_type","PAYMENT_REQUEST").in("entity_id",ids):{data:[],error:null} as any;
 fail(flowError);
 const byEntity=new Map((flows||[]).map((f:any)=>[String(f.entity_id),f]));
 return(data||[]).map((r:any)=>({
   id:String(r.id),requestNumber:r.request_number||"",projectId:String(r.project_id),projectName:Array.isArray(r.projects)?r.projects[0]?.name:r.projects?.name||"",
   requestedBy:String(r.requested_by),requesterName:Array.isArray(r.requester)?r.requester[0]?.full_name:r.requester?.full_name||"",
   payeeName:r.payee_name,payeeReference:r.payee_reference||"",amount:num(r.amount),currency:r.currency,purpose:r.purpose,details:r.details||"",dueDate:r.due_date,
   invoiceReference:r.invoice_reference||"",currentStatus:r.current_status,paymentReference:r.payment_reference||"",paidAt:r.paid_at,
   purchaseOrderId:r.purchase_order_id||null,purchaseRequestId:r.purchase_request_id||null,createdAt:r.created_at,workflow:byEntity.get(String(r.id))||null
 }));
}

export async function createPaymentRequest(input:Record<string,unknown>,actor:UserRecord){
 if(!await userCanFinance(actor,"payment_request"))throw new Error("Payment-request permission required");
 const projectId=String(input.projectId||"");if(!projectId)throw new Error("Project is required");
 const amount=num(input.amount);if(amount<=0)throw new Error("Amount must be greater than zero");
 const payeeName=String(input.payeeName||"").trim(),purpose=String(input.purpose||"").trim();
 if(!payeeName||!purpose)throw new Error("Payee and purpose are required");
 const supabase=await createClient();
 const requestNumber=`PAY-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
 const{data,error}=await supabase.from("payment_requests").insert({
  request_number:requestNumber,project_id:projectId,requested_by:actor.id,payee_name:payeeName,payee_reference:String(input.payeeReference||"")||null,
  amount,currency:String(input.currency||"QAR").toUpperCase(),purpose,details:String(input.details||""),due_date:String(input.dueDate||"")||null,
  invoice_reference:String(input.invoiceReference||"")||null,purchase_request_id:String(input.purchaseRequestId||"")||null,purchase_order_id:String(input.purchaseOrderId||"")||null,current_status:"DRAFT"
 }).select().single();fail(error);
 const reviewers=(await recipientsForFinancePermission("payment_review")).filter(id=>id!==actor.id);
 await insertNotifications(reviewers,"payment_request",String(data.id),"New payment request created",`${requestNumber} · ${payeeName} · ${String(input.currency||"QAR").toUpperCase()} ${amount.toLocaleString()} · created by ${actor.name}.`);
 return data;
}

export async function markPaymentPaid(id:string,input:Record<string,unknown>,actor:UserRecord){
 if(!await userCanFinance(actor,"payment_mark_paid"))throw new Error("Mark-paid permission required");
 const paymentReference=String(input.paymentReference||"").trim();if(!paymentReference)throw new Error("Payment reference is required");
 const supabase=await createClient();
 const{data:current,error:readError}=await supabase.from("payment_requests").select("*").eq("id",id).maybeSingle();fail(readError);
 if(!current)throw new Error("Payment request not found");
 if(current.current_status!=="APPROVED_FOR_PAYMENT")throw new Error("Only a CEO-approved payment can be marked Paid");
 const{data,error}=await supabase.from("payment_requests").update({
  current_status:"PAID",payment_reference:paymentReference,paid_at:new Date().toISOString(),paid_by:actor.id
 }).eq("id",id).eq("current_status","APPROVED_FOR_PAYMENT").select().single();fail(error);
 await recalculateProjectFinancials(String(current.project_id));
 await insertNotifications([String(current.requested_by)],"payment_request",id,"Payment request paid",`${String(current.request_number||id)} was marked paid by ${actor.name}. Reference: ${paymentReference}.`);
 return data;
}
