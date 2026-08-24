import {getSmartCareActor} from "../../lib/auth-server";
import {issueCustomerInvoice,listCustomerInvoices} from "../../lib/customer-invoicing";

export async function GET(request:Request){
  try{
    const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const projectId=new URL(request.url).searchParams.get("projectId")||undefined;
    return Response.json({invoices:await listCustomerInvoices(actor,projectId)});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load customer invoices"},{status:400})}
}
export async function POST(request:Request){
  try{
    const actor=await getSmartCareActor(request);if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    return Response.json({invoice:await issueCustomerInvoice(await request.json(),actor)},{status:201});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to issue customer invoice"},{status:400})}
}
