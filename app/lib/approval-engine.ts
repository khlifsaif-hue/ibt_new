import { createClient } from "./supabase/server";
import {insertNotifications,recipientsForFinancePermission,recalculateProjectFinancials,type UserRecord} from "./database";
import { userCanFinance, type FinancePermissionKey } from "./finance-permissions";

type EntityType = "BUDGET_REQUEST" | "PAYMENT_REQUEST" | "CUSTOMER_INVOICE_REQUEST";
type ApprovalAction = "APPROVE" | "REJECT" | "REQUEST_MODIFICATION" | "RESUBMIT" | "CANCEL";
type Row = Record<string, unknown>;

type WorkflowDefinition = {
  workflowKey: string;
  table: "budget_requests" | "payment_requests" | "customer_invoice_requests";
  reviewStatus: string;
  finalStatus: string;
  steps: Array<{ key:string; title:string; role:"FINANCE"|"CEO" }>;
};

const DEFINITIONS: Record<EntityType, WorkflowDefinition> = {
  BUDGET_REQUEST: {
    workflowKey: "FINANCE_CEO_BUDGET_V1",
    table: "budget_requests",
    reviewStatus: "FINANCE_REVIEW",
    finalStatus: "APPROVED",
    steps: [
      { key:"FINANCE_REVIEW", title:"Finance Manager Review", role:"FINANCE" },
      { key:"CEO_APPROVAL", title:"CEO Final Approval", role:"CEO" },
    ],
  },
  PAYMENT_REQUEST: {
    workflowKey: "FINANCE_CEO_PAYMENT_V1",
    table: "payment_requests",
    reviewStatus: "FINANCE_REVIEW",
    finalStatus: "APPROVED_FOR_PAYMENT",
    steps: [
      { key:"FINANCE_REVIEW", title:"Finance Manager Review", role:"FINANCE" },
      { key:"CEO_APPROVAL", title:"CEO Final Approval", role:"CEO" },
    ],
  },
  CUSTOMER_INVOICE_REQUEST: {
    workflowKey: "FINANCE_INVOICE_REVIEW_V1",
    table: "customer_invoice_requests",
    reviewStatus: "FINANCE_REVIEW",
    finalStatus: "READY_TO_INVOICE",
    steps: [
      { key:"FINANCE_REVIEW", title:"Finance Manager Review", role:"FINANCE" },
    ],
  },
};

function fail(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Approval workflow operation failed");
}
function permissionForStep(type: EntityType, stepKey: string): FinancePermissionKey {
  if (type === "BUDGET_REQUEST")
    return stepKey === "FINANCE_REVIEW" ? "budget_review" : "budget_final_approve";
  if (type === "PAYMENT_REQUEST")
    return stepKey === "FINANCE_REVIEW" ? "payment_review" : "payment_final_approve";
  return "invoice_review";
}

function entityType(value:string): EntityType {
  if (!(value in DEFINITIONS)) throw new Error("Unsupported approval entity type");
  return value as EntityType;
}

function notificationType(type:EntityType){return type.toLowerCase()}
function requestLabel(type:EntityType){return type==="PAYMENT_REQUEST"?"Payment request":type==="BUDGET_REQUEST"?"Budget request":"Customer invoice request"}
async function notifyPermission(type:EntityType,entityId:string,permission:FinancePermissionKey,title:string,message:string,excludeId?:string){const recipients=(await recipientsForFinancePermission(permission)).filter(id=>id!==excludeId);await insertNotifications(recipients,notificationType(type),entityId,title,message)}

async function getEntity(type:EntityType,id:string) {
  const supabase=await createClient();
  const def=DEFINITIONS[type];
  const {data,error}=await supabase.from(def.table).select("id,project_id,requested_by,current_status").eq("id",id).maybeSingle();
  fail(error); if(!data) throw new Error("Request not found"); return data as Row;
}

async function setEntityStatus(type:EntityType,id:string,status:string) {
  const supabase=await createClient();
  const {data,error}=await supabase.from(DEFINITIONS[type].table).update({current_status:status}).eq("id",id).select("project_id").maybeSingle();
  fail(error);
  if(type==="PAYMENT_REQUEST"&&data?.project_id)await recalculateProjectFinancials(String(data.project_id));
}

export async function startApprovalWorkflow(typeValue:string, entityId:string, actor:UserRecord) {
  const type=entityType(typeValue); const def=DEFINITIONS[type]; const entity=await getEntity(type,entityId);
  const submitPermission: FinancePermissionKey =
    type === "BUDGET_REQUEST" ? "budget_request" :
    type === "PAYMENT_REQUEST" ? "payment_request" : "invoice_request";
  if (!await userCanFinance(actor, submitPermission))
    throw new Error("You do not have permission to submit this finance request");
  if(entity.requested_by!==actor.id && actor.role!=="ADMIN") throw new Error("Only the requester can submit this request");
  if(!["DRAFT","MODIFICATION_REQUIRED"].includes(String(entity.current_status))) throw new Error("This request cannot be submitted from its current status");
  const supabase=await createClient();
  const existing=await supabase.from("approval_workflows").select("id,status").eq("entity_type",type).eq("entity_id",entityId).maybeSingle(); fail(existing.error);
  if(existing.data) {
    if(entity.current_status!=="MODIFICATION_REQUIRED") throw new Error("An approval workflow already exists for this request");
    return resubmitApprovalWorkflow(String(existing.data.id),actor,"Resubmitted after requested modifications");
  }
  const {data:workflow,error}=await supabase.from("approval_workflows").insert({entity_type:type,entity_id:entityId,project_id:entity.project_id,workflow_key:def.workflowKey,status:"IN_PROGRESS",current_step_order:1,submitted_by:actor.id}).select().single(); fail(error);
  const steps=def.steps.map((s,index)=>({workflow_id:workflow.id,step_order:index+1,step_key:s.key,title:s.title,approver_role:s.role,status:index===0?"ACTIVE":"PENDING"}));
  fail((await supabase.from("approval_steps").insert(steps)).error);
  fail((await supabase.from("approval_events").insert({workflow_id:workflow.id,actor_id:actor.id,action:"SUBMIT",from_status:String(entity.current_status),to_status:def.reviewStatus,comment:"Submitted for approval"})).error);
  await setEntityStatus(type,entityId,def.reviewStatus);
  const firstStep=def.steps[0];
  await notifyPermission(type,entityId,permissionForStep(type,firstStep.key),`${requestLabel(type)} awaiting ${firstStep.title}`,`${requestLabel(type)} ${entityId} was submitted by ${actor.name}.`,actor.id);
  return getApprovalWorkflow(String(workflow.id));
}

export async function getApprovalWorkflow(id:string) {
  const supabase=await createClient();
  const {data,error}=await supabase.from("approval_workflows").select("*,approval_steps(*),approval_events(*)").eq("id",id).maybeSingle(); fail(error); return data;
}

export async function listApprovalWorkflows(actor:UserRecord, filters:{status?:string;mine?:boolean}={}) {
  const supabase=await createClient();
  let query=supabase.from("approval_workflows").select("*,approval_steps(*)").order("created_at",{ascending:false});
  if(filters.status) query=query.eq("status",filters.status);
  if(filters.mine) query=query.eq("submitted_by",actor.id);
  const {data,error}=await query; fail(error); return data||[];
}

export async function actOnApprovalWorkflow(id:string, actor:UserRecord, action:ApprovalAction, comment="") {
  if(action==="RESUBMIT") return resubmitApprovalWorkflow(id,actor,comment);
  const supabase=await createClient();
  const {data:workflow,error}=await supabase.from("approval_workflows").select("*").eq("id",id).maybeSingle(); fail(error); if(!workflow) throw new Error("Approval workflow not found");
  if(workflow.status!=="IN_PROGRESS") throw new Error("This workflow is not awaiting approval");
  const type=entityType(String(workflow.entity_type)); const def=DEFINITIONS[type];
  const {data:step,error:stepError}=await supabase.from("approval_steps").select("*").eq("workflow_id",id).eq("step_order",workflow.current_step_order).eq("status","ACTIVE").maybeSingle(); fail(stepError); if(!step) throw new Error("No active approval step found");
  const requiredPermission = permissionForStep(type, String(step.step_key));
if (!await userCanFinance(actor, requiredPermission))
  throw new Error("You do not have permission to perform this finance approval step");
if (String(workflow.submitted_by) === actor.id && actor.role !== "ADMIN")
  throw new Error("Segregation of duties: you cannot approve your own request");
  const note=comment.trim();
  if((action==="REJECT"||action==="REQUEST_MODIFICATION") && note.length<3) throw new Error("A comment is required for rejection or modification requests");
  if(action==="CANCEL") throw new Error("Only the requester can cancel; cancellation will be added with request lifecycle controls");

  if(action==="REJECT" || action==="REQUEST_MODIFICATION") {
    const nextWorkflowStatus=action==="REJECT"?"REJECTED":"MODIFICATION_REQUIRED";
    const nextEntityStatus=action==="REJECT"?"REJECTED":"MODIFICATION_REQUIRED";
    const claimed=await supabase.from("approval_steps").update({status:action==="REJECT"?"REJECTED":"MODIFICATION_REQUIRED",decided_by:actor.id,decision_comment:note,decided_at:new Date().toISOString()}).eq("id",step.id).eq("status","ACTIVE").select("id").maybeSingle(); fail(claimed.error); if(!claimed.data) throw new Error("This approval step was already processed");
    fail((await supabase.from("approval_workflows").update({status:nextWorkflowStatus,current_step_order:null,completed_at:action==="REJECT"?new Date().toISOString():null}).eq("id",id)).error);
    fail((await supabase.from("approval_events").insert({workflow_id:id,step_id:step.id,actor_id:actor.id,action,from_status:"IN_PROGRESS",to_status:nextWorkflowStatus,comment:note})).error);
    await setEntityStatus(type,String(workflow.entity_id),nextEntityStatus);
    await insertNotifications([String(workflow.submitted_by)],notificationType(type),String(workflow.entity_id),`${requestLabel(type)} ${action==="REJECT"?"rejected":"needs modification"}`,`${actor.name}: ${note}`);
    return getApprovalWorkflow(id);
  }

  if(action!=="APPROVE") throw new Error("Unsupported approval action");
  const claimed=await supabase.from("approval_steps").update({status:"APPROVED",decided_by:actor.id,decision_comment:note,decided_at:new Date().toISOString()}).eq("id",step.id).eq("status","ACTIVE").select("id").maybeSingle(); fail(claimed.error); if(!claimed.data) throw new Error("This approval step was already processed");
  const nextOrder=Number(step.step_order)+1;
  const {data:nextStep,error:nextError}=await supabase.from("approval_steps").select("*").eq("workflow_id",id).eq("step_order",nextOrder).maybeSingle(); fail(nextError);
  if(nextStep) {
    fail((await supabase.from("approval_steps").update({status:"ACTIVE"}).eq("id",nextStep.id)).error);
    fail((await supabase.from("approval_workflows").update({current_step_order:nextOrder}).eq("id",id)).error);
    fail((await supabase.from("approval_events").insert({workflow_id:id,step_id:step.id,actor_id:actor.id,action:"APPROVE",from_status:"IN_PROGRESS",to_status:"IN_PROGRESS",comment:note})).error);
    await setEntityStatus(type,String(workflow.entity_id),String(nextStep.step_key)==="CEO_APPROVAL"?"CEO_REVIEW":def.reviewStatus);
    await notifyPermission(type,String(workflow.entity_id),permissionForStep(type,String(nextStep.step_key)),`${requestLabel(type)} awaiting ${String(nextStep.title)}`,`${actor.name} approved the previous step. Your approval is now required.`,actor.id);
  } else {
    fail((await supabase.from("approval_workflows").update({status:"APPROVED",current_step_order:null,completed_at:new Date().toISOString()}).eq("id",id)).error);
    fail((await supabase.from("approval_events").insert({workflow_id:id,step_id:step.id,actor_id:actor.id,action:"APPROVE",from_status:"IN_PROGRESS",to_status:"APPROVED",comment:note})).error);
    await setEntityStatus(type,String(workflow.entity_id),def.finalStatus);
    await insertNotifications([String(workflow.submitted_by)],notificationType(type),String(workflow.entity_id),`${requestLabel(type)} approved`,`${actor.name} completed the final approval.`);
    if(type==="PAYMENT_REQUEST")await notifyPermission(type,String(workflow.entity_id),"payment_mark_paid",`${requestLabel(type)} ready for payment`,`Final approval is complete. Record the payment when processed.`,actor.id);
    if(type==="CUSTOMER_INVOICE_REQUEST")await notifyPermission(type,String(workflow.entity_id),"invoice_issue",`${requestLabel(type)} ready to invoice`,`Finance review is complete. The customer invoice can now be issued.`,actor.id);
  }
  return getApprovalWorkflow(id);
}

export async function resubmitApprovalWorkflow(id:string, actor:UserRecord, comment="") {
  const supabase=await createClient();
  const {data:workflow,error}=await supabase.from("approval_workflows").select("*").eq("id",id).maybeSingle(); fail(error); if(!workflow) throw new Error("Approval workflow not found");
  if(workflow.status!=="MODIFICATION_REQUIRED") throw new Error("Only a workflow awaiting modification can be resubmitted");
  if(workflow.submitted_by!==actor.id && actor.role!=="ADMIN") throw new Error("Only the requester can resubmit this workflow");
  const type=entityType(String(workflow.entity_type)); const def=DEFINITIONS[type];
  fail((await supabase.from("approval_steps").update({status:"PENDING",decided_by:null,decision_comment:"",decided_at:null}).eq("workflow_id",id)).error);
  const {data:firstStep,error:firstError}=await supabase.from("approval_steps").select("id").eq("workflow_id",id).eq("step_order",1).single(); fail(firstError); if(!firstStep) throw new Error("Approval workflow has no first step");
  fail((await supabase.from("approval_steps").update({status:"ACTIVE"}).eq("id",firstStep.id)).error);
  fail((await supabase.from("approval_workflows").update({status:"IN_PROGRESS",current_step_order:1,completed_at:null,submitted_at:new Date().toISOString()}).eq("id",id)).error);
  fail((await supabase.from("approval_events").insert({workflow_id:id,actor_id:actor.id,action:"RESUBMIT",from_status:"MODIFICATION_REQUIRED",to_status:"IN_PROGRESS",comment:comment.trim()||"Resubmitted after modifications"})).error);
  await setEntityStatus(type,String(workflow.entity_id),def.reviewStatus);
  const firstDefinition=def.steps[0];
  await notifyPermission(type,String(workflow.entity_id),permissionForStep(type,firstDefinition.key),`${requestLabel(type)} resubmitted`,`${actor.name} resubmitted the request after making the requested changes.`,actor.id);
  return getApprovalWorkflow(id);
}
