import { getSmartCareActor } from "../../lib/auth-server";
import { listApprovalWorkflows, startApprovalWorkflow } from "../../lib/approval-engine";

export async function GET(request:Request){
  try{
    const actor=await getSmartCareActor(request); if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const url=new URL(request.url); const status=url.searchParams.get("status")||undefined; const mine=url.searchParams.get("mine")==="1";
    return Response.json({workflows:await listApprovalWorkflows(actor,{status,mine})});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load approvals"},{status:500})}
}

export async function POST(request:Request){
  try{
    const actor=await getSmartCareActor(request); if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const body=await request.json() as Record<string,unknown>;
    const workflow=await startApprovalWorkflow(String(body.entityType||""),String(body.entityId||""),actor);
    return Response.json({workflow},{status:201});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to submit request for approval"},{status:400})}
}
