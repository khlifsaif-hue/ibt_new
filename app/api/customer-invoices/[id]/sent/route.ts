import {getSmartCareActor} from "../../../../lib/auth-server";
import {markInvoiceSent} from "../../../../lib/customer-invoicing";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});const{id}=await params;return Response.json({invoice:await markInvoiceSent(id,await request.json().catch(()=>({})),actor)});}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to mark invoice sent"},{status:400})}
}
