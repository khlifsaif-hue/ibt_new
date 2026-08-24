import { archiveAsset, assetBundle, updateAsset } from "../../../lib/database";
import { getSmartCareActor, hasProjectPermission, hasSmartCarePermission } from "../../../lib/auth-server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const actor=await getSmartCareActor();
    if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const bundle = await assetBundle(id);
    const asset = bundle.asset;
    if (!asset) return Response.json({ error: "Asset not found" }, { status: 404 });
    if(!await hasProjectPermission(_request,asset.project,"view"))return Response.json({error:"Project access required"},{status:403});
    return Response.json(bundle);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load asset" }, { status: 500 });
  }
}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){try{if(!await hasSmartCarePermission(request,"assets","edit"))return Response.json({error:"Asset-edit permission required"},{status:403});const actor=await getSmartCareActor(request);if(!actor?.active)return Response.json({error:"Authentication required"},{status:401});const {id}=await context.params;const current=(await assetBundle(id)).asset;if(!current||!await hasProjectPermission(request,current.project,"edit"))return Response.json({error:"Project access required"},{status:403});const body=await request.json() as Record<string,unknown>;if(actor.role!=="ADMIN"){const allowed=new Set(["location","status","tone","health","warrantyUntil","insured","notes"]);for(const key of Object.keys(body))if(!allowed.has(key))delete body[key];}const asset=await updateAsset(id,body);return asset?Response.json({asset}):Response.json({error:"Asset not found"},{status:404});}catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to update asset"},{status:400})}}

export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  try{
    const actor=await getSmartCareActor(request);
    if(!actor?.active)return Response.json({error:"Authentication required"},{status:401});
    if(actor.role!=="ADMIN")return Response.json({error:"Only an ADMIN can archive an asset"},{status:403});
    const{id}=await context.params;
    const current=(await assetBundle(id)).asset;
    if(!current)return Response.json({error:"Asset not found or already archived"},{status:404});
    if(!await hasProjectPermission(request,current.project,"edit"))return Response.json({error:"Project access required"},{status:403});
    const body=await request.json().catch(()=>({})) as {confirmation?:unknown};
    if(String(body.confirmation||"").trim()!==id)return Response.json({error:`Type the Asset ID '${id}' to confirm`},{status:400});
    const archived=await archiveAsset(id,actor.id);
    return archived?Response.json({archived:true,id,historyPreserved:true}):Response.json({error:"Asset not found or already archived"},{status:404});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:"Unable to archive asset"},{status:400});
  }
}
