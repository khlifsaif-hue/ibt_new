import { deleteUser, updateUser, USER_ROLES } from "../../../lib/database";
import { getSmartCareActor, hasSmartCarePermission } from "../../../lib/auth-server";

export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  try{const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Authentication required"},{status:401});if(actor.role!=="ADMIN"&&!await hasSmartCarePermission(request,"users","edit"))return Response.json({error:"User-edit permission required"},{status:403});const {id}=await context.params;const body=await request.json() as Record<string,unknown>;delete body.active;if(body.role&&!USER_ROLES.includes(String(body.role) as (typeof USER_ROLES)[number]))return Response.json({error:"Invalid role"},{status:400});const user=await updateUser(id,body as Parameters<typeof updateUser>[1]);return Response.json({user});}catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to update user"},{status:400})}
}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){if(!await hasSmartCarePermission(request,"users","delete"))return Response.json({error:"User-delete permission required"},{status:403});const {id}=await context.params;return await deleteUser(id)?new Response(null,{status:204}):Response.json({error:"User not found"},{status:404});}
