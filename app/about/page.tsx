"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Info, Mail, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useSmartCareAuth } from "../components/auth-provider";

type GuidePage = {
  title: string;
  path: string;
  moduleKey?: string;
  group: string;
  description: string;
  howTo: string;
  related: string[];
};

const pages: GuidePage[] = [
  {title:"Overview",path:"/",moduleKey:"overview",group:"Start here",description:"A quick view of asset health, alerts, maintenance, projects, and operational priorities.",howTo:"Review the summary cards first, then open a card or record to investigate the items that need attention.",related:["Assets","Maintenance","Projects"]},
  {title:"Project Dashboard",path:"/project-dashboard",moduleKey:"project_dashboard",group:"Projects & delivery",description:"Executive project health, schedule, KPI, workload, risk, and delivery analysis.",howTo:"Select a project, review its health indicators and charts, then use the drill-downs to find delayed or off-track work.",related:["Projects","Tasks, Activities & KPIs","Risks & Issues"]},
  {title:"Projects",path:"/projects",moduleKey:"projects",group:"Projects & delivery",description:"The central register for projects, sub-projects, budgets, status, ownership, and closure.",howTo:"Open a project to review its details. Authorized users can create projects, allocate budgets, manage hierarchy, and close completed work.",related:["Sub-projects","Project Budgets","Project Dashboard"]},
  {title:"Sub-projects",path:"/sub-projects",moduleKey:"sub_projects",group:"Projects & delivery",description:"A focused view of child projects and how they roll up to their parent project.",howTo:"Use it to navigate project hierarchy and confirm delegated budgets, owners, and delivery status.",related:["Projects","Project Budgets","Project Dashboard"]},
  {title:"Project Budgets",path:"/project-budgets",moduleKey:"project_budgets",group:"Finance",description:"Budget requests, allocation, commitment, spending, and available balance by project.",howTo:"Select a project, inspect its available balance, and submit or review budget requests according to your permission level.",related:["Projects","Payment Requests","Customer Invoicing"]},
  {title:"Tasks, Activities & KPIs",path:"/tasks",moduleKey:"project_tasks",group:"Projects & delivery",description:"Plan and track assignments, project activities, measurable goals, KPIs, and progress updates.",howTo:"Filter by project or status, open an item for its timeline, then add progress, evidence, assignments, or responses when permitted.",related:["Project Dashboard","Risks & Issues","Reports"]},
  {title:"Risks & Issues",path:"/risks",moduleKey:"project_risks",group:"Projects & delivery",description:"Register, assess, assign, mitigate, and monitor project risks and active issues.",howTo:"Add a risk or issue, choose severity and owner, set mitigation actions, then update progress until it can be closed.",related:["Projects","Tasks, Activities & KPIs","Project Dashboard"]},
  {title:"Assets",path:"/assets",moduleKey:"assets",group:"Assets & operations",description:"The complete equipment and asset register with identity, location, condition, ownership, and financial details.",howTo:"Search or filter the register, open an asset for its passport and history, or create and update records if authorized.",related:["Archived Assets","Maintenance","Depreciation"]},
  {title:"Archived Assets",path:"/assets/archived",moduleKey:"assets",group:"Assets & operations",description:"A separate register for retired or archived assets that are no longer active.",howTo:"Use search and filters to find historical equipment and review its retained record without mixing it with active assets.",related:["Assets","Audit Logs","Reports"]},
  {title:"Maintenance",path:"/maintenance",moduleKey:"maintenance",group:"Assets & operations",description:"Preventive maintenance schedules, upcoming work, overdue service, and equipment care planning.",howTo:"Review due items, open the linked asset, and coordinate the required work through a work order.",related:["Assets","Work Orders","Spare Parts"]},
  {title:"Work Orders",path:"/work-orders",moduleKey:"work_orders",group:"Assets & operations",description:"Create, assign, prioritize, and complete corrective or preventive maintenance jobs.",howTo:"Open or create a work order, assign a technician and due date, record the work performed, then update its status.",related:["Maintenance","Assets","Inventory"]},
  {title:"Inventory",path:"/inventory",moduleKey:"inventory",group:"Assets & operations",description:"Stock levels, item locations, reorder points, costs, and consumable availability.",howTo:"Search by item or SKU, review low-stock indicators, and update quantities through the permitted stock workflow.",related:["Spare Parts","Procurement","Work Orders"]},
  {title:"Spare Parts",path:"/spare-parts",moduleKey:"spare_parts",group:"Assets & operations",description:"A focused inventory view for replacement parts used by assets and maintenance teams.",howTo:"Find compatible parts, check availability and reorder levels, then connect the required part to maintenance activity.",related:["Inventory","Maintenance","Work Orders"]},
  {title:"Depreciation",path:"/depreciation",moduleKey:"depreciation",group:"Finance",description:"Asset cost, accumulated depreciation, remaining book value, and useful-life reporting.",howTo:"Filter the asset register and review calculated values for finance checks and reporting.",related:["Assets","Reports","Project Budgets"]},
  {title:"Purchase Requests",path:"/purchase-requests",moduleKey:"purchase_requests",group:"Purchasing",description:"The starting point for requesting equipment, goods, or services and obtaining approval.",howTo:"Create a request with project, budget, item, and justification details; then follow its approval status before procurement begins.",related:["Procurement","Order Progress","Project Budgets"]},
  {title:"Procurement",path:"/procurement",moduleKey:"procurement",group:"Purchasing",description:"Convert approved purchase requests into controlled purchase orders and receive purchased items.",howTo:"Open an approved request, complete supplier and commercial details, obtain approval, then record receipt and condition.",related:["Purchase Requests","Order Progress","Assets"]},
  {title:"Order Progress",path:"/order-progress",moduleKey:"order_progress",group:"Purchasing",description:"Track purchasing and delivery progress from approval through arrival.",howTo:"Search by reference, update supplier, tracking, expected delivery, status, and progress percentage as the order moves.",related:["Purchase Requests","Procurement","Inventory"]},
  {title:"Payment Requests",path:"/finance/payments",moduleKey:"finance_payments",group:"Finance",description:"Request, review, approve, and record payments with a controlled finance trail.",howTo:"Submit payment evidence and project details, follow the review stages, and mark an approved payment paid when authorized.",related:["Project Budgets","Procurement","Audit Logs"]},
  {title:"Customer Invoicing",path:"/finance/invoicing",moduleKey:"finance_invoicing",group:"Finance",description:"Prepare customer invoice requests, review and issue invoices, then track sending and receipt.",howTo:"Create an invoice request against a project, complete review and issue steps, and update delivery or collection status.",related:["Projects","Project Budgets","Reports"]},
  {title:"Reports",path:"/reports",moduleKey:"reports",group:"Insights & tools",description:"Generate operational, asset, maintenance, project, finance, task, and KPI reports.",howTo:"Choose a report and filters, review the results, then export in the available format for sharing or analysis.",related:["Project Dashboard","Assets","Tasks, Activities & KPIs"]},
  {title:"Imports",path:"/imports",moduleKey:"imports",group:"Insights & tools",description:"Bulk-create or update supported records from controlled spreadsheet templates.",howTo:"Download the correct template, complete its required columns, upload it, review validation issues, and confirm the import.",related:["Bulk Upload","Assets","Users"]},
  {title:"Bulk Upload",path:"/bulk-upload",moduleKey:"bulk_upload",group:"Insights & tools",description:"A direct route to the system's spreadsheet import workflow.",howTo:"Prepare data with the provided template and validate the preview carefully before committing any records.",related:["Imports","Assets","Users"]},
  {title:"AI Assistant",path:"/ai-assistant",moduleKey:"ai_assistant",group:"Insights & tools",description:"A guided assistant for asking questions and getting help with SmartCare information and workflows.",howTo:"Describe what you need in plain language and include the relevant project, asset, or process for a more useful response.",related:["Reports","Overview","Integrations"]},
  {title:"Integrations",path:"/integrations",moduleKey:"integrations",group:"Insights & tools",description:"View and manage connections between SmartCare and external services or data gateways.",howTo:"Review connection health and configuration. Only authorized administrators should change integration settings.",related:["AI Assistant","Audit Logs","Access Control"]},
  {title:"Lab Calendar",path:"/lab-calendar",moduleKey:"lab_calendar",group:"Assets & operations",description:"Calendar-oriented access to scheduled lab and maintenance activity.",howTo:"Use the date view to understand upcoming work and coordinate resources, then open the related maintenance item.",related:["Maintenance","Work Orders","Tasks, Activities & KPIs"]},
  {title:"Locations",path:"/locations",moduleKey:"locations",group:"Administration",description:"The shared location list used by assets, deliveries, projects, and operations.",howTo:"Review active locations or, when authorized, add and deactivate location records to keep selections consistent.",related:["Assets","Projects","Order Progress"]},
  {title:"Users",path:"/users",moduleKey:"users",group:"Administration",description:"Manage SmartCare user profiles, roles, project assignments, account status, and imports.",howTo:"Find or create a user, assign the correct role and projects, then use Access Control for detailed module permissions.",related:["Access Control","My Profile","Audit Logs"]},
  {title:"Access Control",path:"/access-control",moduleKey:"access_control",group:"Administration",description:"Control which modules users can view and what actions they can perform.",howTo:"Choose a user, review module and project access, then grant only the permissions required for that person's role.",related:["Users","Audit Logs","My Profile"]},
  {title:"Audit Logs",path:"/audit-logs",moduleKey:"audit_logs",group:"Administration",description:"A traceable history of sign-ins, page views, and important user or business actions.",howTo:"Filter by user, action, page, or date to investigate activity and support governance reviews.",related:["Users","Access Control","Integrations"]},
  {title:"My Profile",path:"/profile",group:"Your account",description:"Your account details, role, department, contact information, and effective permissions.",howTo:"Confirm your personal information and review what your account is allowed to access. Contact an administrator for changes.",related:["Access Control","Users","About & Help"]},
  {title:"About & Help",path:"/about",group:"Your account",description:"This complete, plain-language guide to SmartCare pages and connected workflows.",howTo:"Search by a page, action, or topic; read the instructions; then select any card or related link to open that page.",related:["Overview","My Profile","AI Assistant"]},
];

const pathByTitle = new Map(pages.map(page => [page.title, page.path]));

export default function AboutPage(){
  const {can}=useSmartCareAuth();
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>{const term=query.trim().toLowerCase();return term?pages.filter(page=>[page.title,page.group,page.description,page.howTo,...page.related].some(value=>value.toLowerCase().includes(term))):pages},[query]);
  const groups=useMemo(()=>Array.from(new Set(filtered.map(page=>page.group))),[filtered]);
  return <main className="dashboard-main section-page about-page">
    <section className="about-hero">
      <div><p className="eyebrow">SmartCare user guide</p><h1>About & Help</h1><p>Understand every part of SmartCare, what you can do there, and how each page connects to the rest of your work.</p></div>
      <div className="about-version"><Info size={22}/><span><small>Current system version</small><strong>V5_01_31826</strong></span></div>
    </section>
    <section className="about-start">
      <div><Sparkles size={22}/><span><strong>New to SmartCare?</strong><small>Start at Overview, follow the items needing attention, and use this guide whenever you are unsure where to go.</small></span></div>
      <Link className="button primary" href="/"><BookOpen size={17}/> Open Overview</Link>
    </section>
    <label className="about-search"><Search size={19}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search pages, actions, or topics…" aria-label="Search the SmartCare page guide"/><span>{filtered.length} pages</span></label>
    {groups.map(group=><section className="about-section" key={group}><header><h2>{group}</h2><span>{filtered.filter(page=>page.group===group).length}</span></header><div className="about-grid">
      {filtered.filter(page=>page.group===group).map(page=>{const accessible=!page.moduleKey||can(page.moduleKey,"view");return <article className="about-card" key={page.path}>
        <Link className="about-card-main" href={page.path} aria-label={`Open ${page.title}`}>
          <div className="about-card-title"><span><CheckCircle2 size={18}/></span><h3>{page.title}</h3><ArrowRight size={18}/></div>
          <p>{page.description}</p>
          <div className="about-how"><strong>How to use it</strong><span>{page.howTo}</span></div>
        </Link>
        <footer><div><strong>Related pages</strong>{page.related.map(title=><Link href={pathByTitle.get(title)||"/about"} key={title}>{title}</Link>)}</div><a className="about-ask" href={`mailto:saif@ibtechar.com?subject=${encodeURIComponent(`SmartCare question — ${page.title}`)}&body=${encodeURIComponent(`Hello Super Admin,\n\nI need help with the ${page.title} page (${page.path}).\n\nMy question or the specific task/function I need help with:\n\n\nWhat I was trying to do:\n\n\nSystem version: V5_01_31826`)}`}><Mail size={13}/> Ask about this page</a>{!accessible&&<span className="about-access"><ShieldCheck size={13}/> Permission required</span>}</footer>
      </article>})}
    </div></section>)}
    {!filtered.length&&<section className="empty-state"><Search size={28}/><h2>No guide pages found</h2><p>Try a page name such as Assets, a task such as approvals, or a topic such as maintenance.</p><button className="button secondary" type="button" onClick={()=>setQuery("")}>Clear search</button></section>}
  </main>;
}
