import {createClient} from "./supabase/server";
import type {UserRecord} from "./database";
import {userCanFinance} from "./finance-permissions";

function fail(error:any){if(error)throw new Error(error.message||"Customer invoicing operation failed")}
function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0}
function txt(value:unknown){return value==null?"":String(value)}

export async function listInvoiceRequests(actor:UserRecord,projectId?:string){
  const supabase=await createClient();
  let query=supabase.from("customer_invoice_requests")
    .select("*,projects(name),requester:profiles!customer_invoice_requests_requested_by_fkey(full_name)")
    .order("created_at",{ascending:false});
  if(projectId)query=query.eq("project_id",projectId);
  if(!await userCanFinance(actor,"view_all_finance"))query=query.eq("requested_by",actor.id);
  const{data,error}=await query;fail(error);

  const ids=(data||[]).map((row:any)=>String(row.id));
  const{data:flows,error:flowError}=ids.length
    ? await supabase.from("approval_workflows").select("id,entity_id,status,current_step_order,approval_steps(*)").eq("entity_type","CUSTOMER_INVOICE_REQUEST").in("entity_id",ids)
    : {data:[],error:null} as any;
  fail(flowError);
  const flowByEntity=new Map((flows||[]).map((f:any)=>[String(f.entity_id),f]));

  return(data||[]).map((row:any)=>({
    id:String(row.id),
    requestNumber:txt(row.request_number),
    projectId:String(row.project_id),
    projectName:Array.isArray(row.projects)?txt(row.projects[0]?.name):txt(row.projects?.name),
    requestedBy:String(row.requested_by),
    requesterName:Array.isArray(row.requester)?txt(row.requester[0]?.full_name):txt(row.requester?.full_name),
    customerName:txt(row.customer_name),
    contractReference:txt(row.contract_reference),
    milestoneReference:txt(row.milestone_reference),
    milestoneDescription:txt(row.milestone_description),
    requestedAmount:num(row.requested_amount),
    currency:txt(row.currency)||"QAR",
    expectedInvoiceDate:row.expected_invoice_date||null,
    currentStatus:txt(row.current_status),
    createdAt:row.created_at,
    workflow:flowByEntity.get(String(row.id))||null
  }));
}

export async function createInvoiceRequest(input:Record<string,unknown>,actor:UserRecord){
  if(!await userCanFinance(actor,"invoice_request"))throw new Error("Invoice-request permission required");
  const projectId=txt(input.projectId);
  const customerName=txt(input.customerName).trim();
  const milestoneDescription=txt(input.milestoneDescription).trim();
  const amount=num(input.requestedAmount);
  if(!projectId||!customerName||!milestoneDescription)throw new Error("Project, customer and milestone/delivery description are required");
  if(amount<=0)throw new Error("Requested invoice amount must be greater than zero");
  const supabase=await createClient();
  const requestNumber=`INVREQ-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const{data,error}=await supabase.from("customer_invoice_requests").insert({
    request_number:requestNumber,
    project_id:projectId,
    requested_by:actor.id,
    customer_name:customerName,
    contract_reference:txt(input.contractReference)||null,
    milestone_reference:txt(input.milestoneReference)||null,
    milestone_description:milestoneDescription,
    requested_amount:amount,
    currency:(txt(input.currency)||"QAR").toUpperCase(),
    expected_invoice_date:txt(input.expectedInvoiceDate)||null,
    current_status:"DRAFT"
  }).select().single();
  fail(error);return data;
}

export async function listCustomerInvoices(actor:UserRecord,projectId?:string){
  const supabase=await createClient();
  let query=supabase.from("customer_invoices")
    .select("*,projects(name)")
    .order("created_at",{ascending:false});
  if(projectId)query=query.eq("project_id",projectId);
  if(!await userCanFinance(actor,"view_all_finance")){
    // Project-scoped visibility remains subject to RLS; no broad finance expansion here.
  }
  const{data,error}=await query;fail(error);
  const today=new Date();today.setHours(0,0,0,0);
  return(data||[]).map((row:any)=>{
    const due=row.due_date?new Date(`${row.due_date}T00:00:00`):null;
    let effective=txt(row.status);
    if(!["PAID","CANCELLED","DRAFT"].includes(effective)&&due){
      const diff=Math.ceil((due.getTime()-today.getTime())/86400000);
      if(diff<0)effective="OVERDUE";
      else if(diff<=7)effective="DUE_SOON";
      else if(["ISSUED","SENT"].includes(effective))effective="OUTSTANDING";
    }
    return{
      id:String(row.id),invoiceRequestId:row.invoice_request_id?String(row.invoice_request_id):null,
      projectId:String(row.project_id),
      projectName:Array.isArray(row.projects)?txt(row.projects[0]?.name):txt(row.projects?.name),
      customerName:txt(row.customer_name),invoiceNumber:txt(row.invoice_number),
      invoiceDate:row.invoice_date||null,dueDate:row.due_date||null,amount:num(row.amount),
      currency:txt(row.currency)||"QAR",status:effective,storedStatus:txt(row.status),
      sentAt:row.sent_at||null,receivedAmount:num(row.received_amount),receivedDate:row.received_date||null,
      paymentReference:txt(row.payment_reference),createdAt:row.created_at
    };
  });
}

export async function issueCustomerInvoice(input:Record<string,unknown>,actor:UserRecord){
  if(!await userCanFinance(actor,"invoice_issue"))throw new Error("Invoice-issue permission required");
  const requestId=txt(input.invoiceRequestId);
  const invoiceNumber=txt(input.invoiceNumber).trim();
  const invoiceDate=txt(input.invoiceDate);
  const dueDate=txt(input.dueDate);
  if(!requestId||!invoiceNumber||!invoiceDate||!dueDate)throw new Error("Invoice request, invoice number, invoice date and due date are required");
  const supabase=await createClient();
  const{data:req,error:reqError}=await supabase.from("customer_invoice_requests").select("*").eq("id",requestId).maybeSingle();
  fail(reqError);if(!req)throw new Error("Invoice request not found");
  if(req.current_status!=="READY_TO_INVOICE")throw new Error("Finance can issue an invoice only after the invoice request is approved");
  const{data,error}=await supabase.from("customer_invoices").insert({
    invoice_request_id:req.id,project_id:req.project_id,funding_source_id:req.funding_source_id,
    customer_name:req.customer_name,invoice_number:invoiceNumber,invoice_date:invoiceDate,due_date:dueDate,
    amount:req.requested_amount,currency:req.currency,status:"ISSUED",issued_by:actor.id
  }).select().single();
  fail(error);
  fail((await supabase.from("customer_invoice_requests").update({current_status:"INVOICED"}).eq("id",req.id)).error);
  return data;
}

export async function markInvoiceSent(id:string,input:Record<string,unknown>,actor:UserRecord){
  if(!await userCanFinance(actor,"invoice_mark_sent"))throw new Error("Mark-sent permission required");
  const supabase=await createClient();
  const{data,error}=await supabase.from("customer_invoices").update({
    status:"SENT",sent_at:new Date().toISOString()
  }).eq("id",id).in("status",["ISSUED","SENT","OUTSTANDING","DUE_SOON","OVERDUE"]).select().single();
  fail(error);return data;
}

export async function recordInvoiceReceipt(id:string,input:Record<string,unknown>,actor:UserRecord){
  if(!await userCanFinance(actor,"invoice_mark_received"))throw new Error("Record-receipt permission required");
  const amount=num(input.receivedAmount),reference=txt(input.paymentReference).trim(),receivedDate=txt(input.receivedDate)||new Date().toISOString().slice(0,10);
  if(amount<=0||!reference)throw new Error("Received amount and payment reference are required");
  const supabase=await createClient();
  const{data:current,error:readError}=await supabase.from("customer_invoices").select("*").eq("id",id).maybeSingle();
  fail(readError);if(!current)throw new Error("Customer invoice not found");
  const total=num(current.amount),newReceived=Math.min(total,num(current.received_amount)+amount);
  const status=newReceived>=total?"PAID":"PARTIALLY_PAID";
  const{data,error}=await supabase.from("customer_invoices").update({
    received_amount:newReceived,received_date:receivedDate,payment_reference:reference,status
  }).eq("id",id).select().single();
  fail(error);return data;
}
