import { createProject, listProjectOptionsForUser, listProjectsForUser } from "../../lib/database";
import { getSmartCareActor, hasSmartCarePermission } from "../../lib/auth-server";

export async function GET(request:Request){
  try{
    const actor=await getSmartCareActor(request);
    if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const compact=new URL(request.url).searchParams.get("compact")==="1";
    const projects=compact?await listProjectOptionsForUser(actor):await listProjectsForUser(actor);
    return Response.json({projects},{headers:compact?{"Cache-Control":"private, max-age=30"}:undefined});
  }catch(error){
    console.error("GET /api/projects failed",error);
    return Response.json({error:error instanceof Error?error.message:"Unable to load projects"},{status:500});
  }
}

export async function POST(request:Request){
  try{
    if(!await hasSmartCarePermission(request,"projects","create"))
      return Response.json({error:"Project-create permission required"},{status:403});
    const body=await request.json() as Record<string,unknown>;
    const name=String(body.name||"").trim();
    if(!name)return Response.json({error:"Project name is required"},{status:400});
    const project=await createProject({
      name,
      manager:String(body.manager||"Projects Office"),
      approvedBudget:Number(body.approvedBudget||0),
      parentProjectId:String(body.parentProjectId||"")||null,
      projectCode:String(body.projectCode||"")
    });
    return Response.json({project},{status:201});
  }catch(error){
    console.error("POST /api/projects failed",error);
    return Response.json({error:error instanceof Error?error.message:"Unable to create project"},{status:400});
  }
}
