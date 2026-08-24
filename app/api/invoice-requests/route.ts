import {getSmartCareActor,hasProjectPermission} from "../../lib/auth-server";
import {createInvoiceRequest,listInvoiceRequests} from "../../lib/customer-invoicing";

export async function GET(request:Request){
  try{
    const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const projectId=new URL(request.url).searchParams.get("projectId")||undefined;
    return Response.json({requests:await listInvoiceRequests(actor,projectId)});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load invoice requests"},{status:400})}
}
export async function POST(request:Request){
  try{
    const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const body=await request.json() as Record<string,unknown>,projectId=String(body.projectId||"");
    const{getProject}=await import("../../lib/database");const project=await getProject(projectId) as {name:string;status:string}|undefined;
    if(!project||project.status==="Closed")return Response.json({error:"Select an active project/sub-project"},{status:400});
    if(!await hasProjectPermission(request,project.name,"create"))return Response.json({error:"Project-create access required"},{status:403});
    return Response.json({request:await createInvoiceRequest(body,actor)},{status:201});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to create invoice request"},{status:400})}
}
