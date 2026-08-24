import { archivedAssetBundle, listArchivedAssets, restoreAsset } from "../../../lib/database";
import { getSmartCareActor } from "../../../lib/auth-server";

async function admin(){const actor=await getSmartCareActor();return actor?.active&&actor.role==="ADMIN"?actor:null;}

export async function GET(request:Request){try{if(!await admin())return Response.json({error:"Admin access required"},{status:403});const id=new URL(request.url).searchParams.get("id");if(id){const bundle=await archivedAssetBundle(id);return bundle?Response.json(bundle):Response.json({error:"Archived asset not found"},{status:404});}return Response.json({assets:await listArchivedAssets()});}catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load archived assets"},{status:400});}}

export async function POST(request:Request){try{if(!await admin())return Response.json({error:"Admin access required"},{status:403});const body=await request.json() as {id?:unknown;confirmation?:unknown};const id=String(body.id||"");if(!id||String(body.confirmation||"").trim()!==id)return Response.json({error:"Type the Asset ID to confirm restoration"},{status:400});return await restoreAsset(id)?Response.json({restored:true,id}):Response.json({error:"Archived asset not found"},{status:404});}catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to restore asset"},{status:400});}}
