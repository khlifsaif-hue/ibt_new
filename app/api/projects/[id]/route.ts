import { getProject, updateProject } from "../../../lib/database";
import { getSmartCareActor, hasProjectPermission, hasSmartCarePermission } from "../../../lib/auth-server";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await getSmartCareActor(request);
    if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const {id}=await params;
    const project=await getProject(id);
    if(!project)return Response.json({error:"Project not found"},{status:404});
    if(!await hasProjectPermission(request,project.name,"view"))
      return Response.json({error:"Project access required"},{status:403});
    return Response.json({project});
  }catch(error){
    console.error("GET /api/projects/[id] failed",error);
    return Response.json({error:error instanceof Error?error.message:"Unable to load project"},{status:500});
  }
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const actor=await getSmartCareActor(request);
    if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const {id}=await params,current=await getProject(id);
    if(!current)return Response.json({error:"Project not found"},{status:404});
    if(!await hasProjectPermission(request,current.name,"edit"))
      return Response.json({error:"Project-edit access required"},{status:403});
    const body=await request.json() as Record<string,unknown>;
    if(Object.hasOwn(body,"approvedBudget")){
      if(!["CEO","ADMIN","FINANCE","PROJECT_MANAGER"].includes(actor.role))
        return Response.json({error:"Only CEO, Admin, Finance or the assigned Project Manager can edit the budget."},{status:403});
      const approvedBudget=Number(body.approvedBudget);
      if(!Number.isFinite(approvedBudget)||approvedBudget<0)
        return Response.json({error:"Approved budget must be a valid non-negative amount."},{status:400});
      return Response.json({project:await updateProject(id,{approvedBudget})});
    }
    if(!await hasSmartCarePermission(request,"projects","edit"))
      return Response.json({error:"Project-edit permission required"},{status:403});
    return Response.json({project:await updateProject(id,body)});
  }catch(error){
    console.error("PATCH /api/projects/[id] failed",error);
    return Response.json({error:error instanceof Error?error.message:"Unable to update project"},{status:400});
  }
}
