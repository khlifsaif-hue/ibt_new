import { getSmartCareActor } from "../../lib/auth-server";
import { createClient } from "../../lib/supabase/server";

const colors=["#0050c2","#0b9f9d","#ed9518","#ef6346"];
const text=(value:unknown,fallback="")=>value==null?fallback:String(value);
const num=(value:unknown,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
const relName=(value:unknown)=>{if(Array.isArray(value))return text((value[0] as {name?:unknown}|undefined)?.name);return text((value as {name?:unknown}|null)?.name)};

export async function GET(){
  try{
    const actor=await getSmartCareActor();
    if(!actor)return Response.json({error:"Unauthorized"},{status:401});
    const supabase=await createClient();
    const [assetStatsResult,assetCardsResult,workOrderStatusResult,recentOrdersResult]=await Promise.all([
      supabase.from("assets").select("tone,uptime,projects(name),alerts(count)").is("deleted_at",null),
      supabase.from("assets").select("id,name,category,status,tone,health,uptime,metric_label,metric,maintenance_label,maintenance,data_source,projects(name)").is("deleted_at",null).order("name").limit(12),
      supabase.from("work_orders").select("status"),
      supabase.from("work_orders").select("id,title,status").order("created_at",{ascending:false}).limit(5),
    ]);
    for(const result of [assetStatsResult,assetCardsResult,workOrderStatusResult,recentOrdersResult])if(result.error)throw result.error;
    const statRows=assetStatsResult.data||[];
    const orderStatuses=(workOrderStatusResult.data||[]).map(row=>text(row.status));
    const assetCount=statRows.length;
    const warnings=statRows.filter(row=>text(row.tone)==="warning"||(Array.isArray(row.alerts)&&num(row.alerts[0]?.count)>0)).length;
    const averageUptime=assetCount?Math.round(statRows.reduce((sum,row)=>sum+num(row.uptime),0)/assetCount):0;
    const openWorkOrders=orderStatuses.filter(status=>!["Completed","Complete","Cancelled"].includes(status)).length;
    const projectCounts=new Map<string,number>();
    for(const row of statRows){const name=relName(row.projects)||"Unassigned";projectCounts.set(name,(projectCounts.get(name)||0)+1)}
    const projects=[...projectCounts.entries()].map(([label,value],index)=>({label,value,color:colors[index%colors.length]}));
    const health=[
      {label:"Healthy",value:statRows.filter(row=>text(row.tone)==="healthy").length,color:"#0b9f9d"},
      {label:"Maintenance due",value:statRows.filter(row=>text(row.tone)==="due").length,color:"#ed9518"},
      {label:"Warning",value:statRows.filter(row=>text(row.tone)==="warning").length,color:"#ef6346"},
    ];
    const maintenance=[
      {label:"Complete",value:orderStatuses.filter(status=>["Completed","Complete"].includes(status)).length,color:"#0b9f9d"},
      {label:"Overdue",value:orderStatuses.filter(status=>status.toLowerCase().includes("overdue")).length,color:"#ef6346"},
      {label:"In process",value:orderStatuses.filter(status=>["Open","In progress","In Process","Scheduled"].includes(status)).length,color:"#0050c2"},
    ];
    const assets=(assetCardsResult.data||[]).map(row=>({
      id:text(row.id),name:text(row.name),category:text(row.category),status:text(row.status),tone:text(row.tone,"healthy"),health:num(row.health),uptime:num(row.uptime),
      metricLabel:text(row.metric_label,"Monitoring"),metric:text(row.metric,"Pending"),maintenanceLabel:text(row.maintenance_label,"Maintenance"),maintenance:text(row.maintenance,"Pending"),
      dataSource:text(row.data_source,"Database"),project:relName(row.projects),manufacturer:"",model:"",serialNumber:"",location:"",quantity:1,notes:"",sourceLink:"",installedOn:"",warrantyUntil:"",owner:"",imageData:null,
    }));
    return Response.json({assets,workOrders:recentOrdersResult.data||[],stats:{assetCount,warnings,openWorkOrders,averageUptime},charts:{projects,health,maintenance}},{headers:{"Cache-Control":"private, max-age=15, stale-while-revalidate=45"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load dashboard"},{status:500})}
}
