import {getSmartCareActor} from "../../../../lib/auth-server";
import {markPaymentPaid} from "../../../../lib/payment-requests";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
 const{id}=await params;return Response.json({payment:await markPaymentPaid(id,await request.json(),actor)});}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to mark payment paid"},{status:400})}
}
