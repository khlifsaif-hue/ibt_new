import { getSmartCareActor } from "../../../lib/auth-server";
import { actOnApprovalWorkflow, getApprovalWorkflow } from "../../../lib/approval-engine";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});const{id}=await params;const workflow=await getApprovalWorkflow(id);return workflow?Response.json({workflow}):Response.json({error:"Not found"},{status:404});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load approval"},{status:500})}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});const{id}=await params;const body=await request.json() as Record<string,unknown>;const action=String(body.action||"") as "APPROVE"|"REJECT"|"REQUEST_MODIFICATION"|"RESUBMIT"|"CANCEL";const workflow=await actOnApprovalWorkflow(id,actor,action,String(body.comment||""));return Response.json({workflow});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to update approval"},{status:400})}
}
