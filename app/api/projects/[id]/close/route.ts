import {closeProject,getProject,getProjectClosureReadiness,reopenProject} from "../../../../lib/database";
import {getSmartCareActor,hasProjectPermission} from "../../../../lib/auth-server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
 const{id}=await params,project=await getProject(id);if(!project)return Response.json({error:"Project not found"},{status:404});
 if(!await hasProjectPermission(request,project.name,"view"))return Response.json({error:"Project access required"},{status:403});
 return Response.json(await getProjectClosureReadiness(id));
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
 const{id}=await params,project=await getProject(id);if(!project)return Response.json({error:"Project not found"},{status:404});
 if(!await hasProjectPermission(request,project.name,"approve")&&!["ADMIN","CEO"].includes(actor.role))return Response.json({error:"Project approval access required"},{status:403});
 const body=await request.json().catch(()=>({})) as Record<string,unknown>;
 if(body.action==="reopen")return Response.json({project:await reopenProject(id)});
 return Response.json({project:await closeProject(id,actor,String(body.closureNote||""))});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to change project status"},{status:400})}
}
