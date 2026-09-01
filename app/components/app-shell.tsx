"use client";

import {
  AlertTriangle, Bell, Box, ChevronDown, ClipboardList, Database, FileBarChart, HelpCircle, Home, Info,
  Landmark, LayoutDashboard, LogOut, Menu, Package, Pencil, RadioTower, ShieldCheck, ShoppingCart, Sparkles, Target, Trash2, Truck, Upload, UserCircle2, UsersRound, WalletCards, Wrench, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSmartCareAuth } from "./auth-provider";

const iconByKey:Record<string,typeof Home>={overview:Home,assets:Box,projects:WalletCards,project_dashboard:LayoutDashboard,purchase_requests:ClipboardList,procurement:ShoppingCart,order_progress:Truck,inventory:Package,depreciation:Landmark,imports:Upload,maintenance:Wrench,work_orders:ClipboardList,ai_assistant:Sparkles,integrations:RadioTower,reports:FileBarChart,users:UsersRound,access_control:ShieldCheck,audit_logs:Database,project_tasks:Target,project_risks:AlertTriangle};
const modulePath=(key:string,path:string)=>{
  const mapped:Record<string,string>={
    overview:"/",
    project_risks:"/risks",
    project_tasks:"/tasks",
    project_budgets:"/projects",
    spare_parts:"/inventory",
    bulk_upload:"/imports",
    lab_calendar:"/maintenance",
  };
  return mapped[key] || path;
};
const departmentByModule:Record<string,string>={
  overview:"Executive & Overview",reports:"Executive & Overview",
  projects:"Project Management",sub_projects:"Project Management",project_dashboard:"Project Management",project_tasks:"Project Management",project_risks:"Project Management",
  purchase_requests:"Procurement & Supply Chain",procurement:"Procurement & Supply Chain",order_progress:"Procurement & Supply Chain",inventory:"Procurement & Supply Chain",
  assets:"Assets & Operations",locations:"Assets & Operations",maintenance:"Assets & Operations",work_orders:"Assets & Operations",depreciation:"Assets & Operations",
  finance_invoicing:"Finance",finance_payments:"Finance",project_budgets:"Finance",
  ai_assistant:"Technology & Administration",integrations:"Technology & Administration",imports:"Technology & Administration",audit_logs:"Technology & Administration",
  users:"IT & Access Management",access_control:"IT & Access Management",
  about:"Help & Support",
};
const customDepartment="My Modules";
const departmentOrder=["Executive & Overview","Project Management","Procurement & Supply Chain","Assets & Operations","Finance","Technology & Administration","IT & Access Management",customDepartment,"Help & Support"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"notifications" | "account" | null>(null);
  const [expandedDepartment,setExpandedDepartment]=useState<string|null>(null);
  const [departmentSequence,setDepartmentSequence]=useState(departmentOrder);
  const [draggedDepartment,setDraggedDepartment]=useState<string|null>(null);
  const [dragOverDepartment,setDragOverDepartment]=useState<string|null>(null);
  const [draggedModuleKey,setDraggedModuleKey]=useState<string|null>(null);
  const [draggedCustomModuleKey,setDraggedCustomModuleKey]=useState<string|null>(null);
  const [customModuleKeys,setCustomModuleKeys]=useState<string[]>([]);
  const [customDepartmentName,setCustomDepartmentName]=useState(customDepartment);
  const [notices,setNotices]=useState<{id:number;entityType:string;entityId:string;title:string;message:string;readAt:string|null;createdAt:string;link:string}[]>([]);
  const topbarRef = useRef<HTMLElement>(null);
  const lastAuditedPage=useRef("");
  const notificationRequest=useRef<Promise<void>|null>(null),lastNotificationLoad=useRef(0);
  const {user,modules,can,logout}=useSmartCareAuth();
  const router=useRouter();
  const navItems=useMemo(()=>[...modules.filter(m=>m.key!=="about"&&m.enabled&&can(m.key,"view")).map(m=>({key:m.key,href:modulePath(m.key,m.path),label:m.title,icon:iconByKey[m.key]||LayoutDashboard})),{key:"about",href:"/about",label:"About & Help",icon:Info}],[modules,can]);
  const navGroups=useMemo(()=>departmentSequence.map(department=>department===customDepartment?{department,items:customModuleKeys.map(key=>navItems.find(item=>item.key===key)).filter((item):item is typeof navItems[number]=>Boolean(item)),custom:true}:{department,items:navItems.filter(item=>(departmentByModule[item.key]||"Technology & Administration")===department),custom:false}).filter(group=>group.custom||group.items.length),[navItems,departmentSequence,customModuleKeys]);
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem("smartcare-department-order")||"[]") as string[];if(saved.length){const valid=saved.filter(item=>departmentOrder.includes(item));const missing=departmentOrder.filter(item=>!valid.includes(item));setDepartmentSequence([...valid,...missing])}const savedModules=JSON.parse(localStorage.getItem("smartcare-custom-modules")||"[]") as string[];if(Array.isArray(savedModules))setCustomModuleKeys(savedModules);const savedName=localStorage.getItem("smartcare-custom-category-name")?.trim();if(savedName)setCustomDepartmentName(savedName)}catch{}},[]);
  function moveDepartment(target:string){if(!draggedDepartment||draggedDepartment===target)return;setDepartmentSequence(current=>{const next=current.filter(item=>item!==draggedDepartment);next.splice(next.indexOf(target),0,draggedDepartment);localStorage.setItem("smartcare-department-order",JSON.stringify(next));return next});setDragOverDepartment(null)}
  function addCustomModule(){if(!draggedModuleKey)return;setCustomModuleKeys(current=>{if(current.includes(draggedModuleKey))return current;const next=[...current,draggedModuleKey];localStorage.setItem("smartcare-custom-modules",JSON.stringify(next));return next});setExpandedDepartment(customDepartment);setDraggedModuleKey(null)}
  function removeCustomModule(){if(!draggedCustomModuleKey)return;setCustomModuleKeys(current=>{const next=current.filter(key=>key!==draggedCustomModuleKey);localStorage.setItem("smartcare-custom-modules",JSON.stringify(next));return next});setDraggedCustomModuleKey(null);setDraggedModuleKey(null)}
  function renameCustomDepartment(){const next=window.prompt("Name your custom module category",customDepartmentName)?.trim();if(!next)return;setCustomDepartmentName(next.slice(0,32));localStorage.setItem("smartcare-custom-category-name",next.slice(0,32))}
  useEffect(()=>{const activeGroup=navGroups.find(group=>group.items.some(item=>item.href==="/"?pathname==="/":pathname===item.href||pathname.startsWith(`${item.href}/`)));if(activeGroup)setExpandedDepartment(activeGroup.department)},[pathname,navGroups]);
  async function refreshNotifications(force=false){if(!user)return;if(!force&&Date.now()-lastNotificationLoad.current<30000)return;if(notificationRequest.current)return notificationRequest.current;const task=(async()=>{const r=await fetch("/api/notifications");if(r.ok){const d=await r.json() as {notifications?:typeof notices};setNotices(d.notifications||[]);lastNotificationLoad.current=Date.now()}})();notificationRequest.current=task;try{await task}finally{if(notificationRequest.current===task)notificationRequest.current=null}}
  useEffect(()=>{lastNotificationLoad.current=0;const initial=window.setTimeout(()=>refreshNotifications().catch(()=>{}),1500);const timer=window.setInterval(()=>refreshNotifications().catch(()=>{}),300000);const visible=()=>{if(document.visibilityState==="visible")refreshNotifications().catch(()=>{})};document.addEventListener("visibilitychange",visible);return()=>{window.clearTimeout(initial);window.clearInterval(timer);document.removeEventListener("visibilitychange",visible)}},[user]);
  async function openNotification(notice:typeof notices[number]){setActiveMenu(null);setNotices(current=>current.map(n=>n.id===notice.id?{...n,readAt:n.readAt||new Date().toISOString()}:n));await fetch("/api/notifications",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:notice.id})}).catch(()=>{});router.push(notice.link);}
  function toggleMenu(menu: "notifications" | "account") { setActiveMenu(current => current === menu ? null : menu); }
  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (topbarRef.current && !topbarRef.current.contains(event.target as Node)) setActiveMenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setActiveMenu(null); }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOnOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, []);
  useEffect(() => { setActiveMenu(null); }, [pathname]);
  useEffect(()=>{if(!user)return;const key=`${user.id}:${pathname}`;if(lastAuditedPage.current===key)return;lastAuditedPage.current=key;void fetch("/api/audit-logs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({actionType:"PAGE_VIEW",pagePath:pathname})}).catch(()=>{})},[pathname,user]);
  const currentModule=modules.find(m=>{const path=modulePath(m.key,m.path);return path==="/"?pathname==="/":pathname===path||pathname.startsWith(`${path}/`)});
  const allowed=!currentModule||can(currentModule.key,"view");
  const initials=(user?.name||"SmartCare User").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
  const unreadCount=notices.filter(notice=>!notice.readAt).length;
  const supportHref=`mailto:saif@ibtechar.com?subject=${encodeURIComponent(`SmartCare help request — ${pathname}`)}&body=${encodeURIComponent(`Hello Admin,\n\nI need help with this SmartCare page: ${pathname}\n\nMy question or issue:\n\n\nWhat I was trying to do:\n\n\nUser: ${user?.name||"SmartCare User"}\nEmail: ${user?.email||"Not available"}\nRole: ${user?.role||"Not available"}\nSystem version: V5_01_31826`)}`;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand-mark">
          <span className="brand-symbol"><img src="/ibtechar-main-logo.png" alt="Ibtechar SmartCare" width={164} height={72}/></span>
          <button className="mobile-nav-close" type="button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20}/></button>
        </div>
        <nav className="side-nav" aria-label="Primary navigation" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
          {navGroups.map(group=>{const expanded=expandedDepartment===group.department;const groupId=`nav-${group.department.replaceAll(" ","-").toLowerCase()}`;const groupActive=group.items.some(item=>item.href==="/"?pathname==="/":pathname===item.href||pathname.startsWith(`${item.href}/`));return <section className={`nav-department ${expanded?"expanded":""} ${groupActive?"has-active":""} ${group.custom?"custom-department":""} ${draggedDepartment===group.department?"dragging":""} ${dragOverDepartment===group.department?"drag-over":""}`} key={group.department} onDragOver={event=>{event.preventDefault();if(group.custom&&draggedModuleKey)return;if(draggedDepartment!==group.department)setDragOverDepartment(group.department)}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setDragOverDepartment(null)}} onDrop={event=>{event.preventDefault();if(group.custom&&draggedModuleKey)addCustomModule();else moveDepartment(group.department)}}><button className="nav-department-toggle" type="button" draggable aria-expanded={expanded} aria-controls={groupId} title={group.custom?"Drag to reorder · Double-click to rename · Drop modules here":"Drag to reorder category"} onDoubleClick={event=>{if(group.custom){event.preventDefault();renameCustomDepartment()}}} onDragStart={event=>{setDraggedDepartment(group.department);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",group.department)}} onDragEnd={()=>{setDraggedDepartment(null);setDragOverDepartment(null)}} onClick={()=>setExpandedDepartment(current=>current===group.department?null:group.department)}><span>{group.custom?customDepartmentName:group.department}</span>{group.custom&&<Pencil className="custom-category-pencil" size={11}/>}<small>{group.items.length}</small><ChevronDown size={14}/></button><div className="nav-department-items" id={groupId} aria-hidden={!expanded}>{group.custom&&!group.items.length&&<p className="custom-modules-empty">Drag modules here</p>}{group.items.map(({ href, label, icon: Icon,key }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return <Link href={href} draggable onDragStart={event=>{event.stopPropagation();setDraggedModuleKey(key);if(group.custom)setDraggedCustomModuleKey(key);event.dataTransfer.effectAllowed=group.custom?"move":"copy";event.dataTransfer.setData("text/plain",key)}} onDragEnd={()=>{setDraggedModuleKey(null);setDraggedCustomModuleKey(null)}} tabIndex={expanded?0:-1} className={`nav-item ${active ? "active" : ""}`} key={href} onClick={() => { setActiveMenu(null); setMobileNav(false); }}><Icon size={20} strokeWidth={1.8}/><span>{label}</span></Link>;
          })}</div></section>})}
          {draggedCustomModuleKey&&<div className="custom-module-remove" onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move"}} onDrop={event=>{event.preventDefault();removeCustomModule()}}><Trash2 size={16}/><span>Drop here to remove</span></div>}
        </nav>
        <div className="system-state"><span className="online-dot"/><div><strong>System online</strong><small>All gateways connected</small></div></div>
        <div className="platform-credit"><strong>Ibtechar SmartCare V5_01_31826</strong><small>Developed by Seif Khlif</small></div>
      </aside>
      {mobileNav && <button className="nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}

      <div className="main-area">
        <header className="topbar" ref={topbarRef}>
          <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={22}/></button>
          <div className="notification-wrap"><button className="icon-button notification-button" type="button" aria-label={unreadCount?`Notifications, ${unreadCount} unread`:"Notifications"} aria-expanded={activeMenu === "notifications"} onClick={()=>{toggleMenu("notifications");refreshNotifications().catch(()=>{})}}><Bell size={20}/>{unreadCount>0&&<span className="notification-count">{unreadCount>99?"99+":unreadCount}</span>}</button>{activeMenu === "notifications"&&<div className="notification-popover"><strong>Notifications</strong>{notices.slice(0,12).map(n=><button type="button" className={n.readAt?"read":"unread"} key={n.id} onClick={()=>openNotification(n)}><b>{n.title}</b><small>{n.message}</small><time>{new Date(n.createdAt).toLocaleString()}</time></button>)}{!notices.length&&<small>No new notifications.</small>}</div>}</div>
          <div className="account-wrap"><button className="profile-button" type="button" onClick={()=>toggleMenu("account")} aria-expanded={activeMenu === "account"}><span>{user?.avatarUrl?<img src={user.avatarUrl} alt=""/>:initials}</span><div><strong>{user?.name||"SmartCare User"}</strong><small>{user?.jobTitle||user?.department||"SmartCare"}</small></div><ChevronDown size={15}/></button>{activeMenu === "account"&&<div className="account-popover"><div className="account-summary"><span>{user?.avatarUrl?<img src={user.avatarUrl} alt=""/>:initials}</span><div><strong>{user?.name}</strong><small>{user?.email}</small><em>{user?.role}</em></div></div><button type="button" onClick={()=>{setActiveMenu(null);router.push("/profile")}}><UserCircle2 size={16}/> My Profile</button><button type="button" onClick={()=>{setActiveMenu(null);router.push("/profile?tab=permissions")}}><ShieldCheck size={16}/> My Permissions</button><a className="account-support" href={supportHref} onClick={()=>setActiveMenu(null)}><HelpCircle size={16}/> Ask Admin</a><button type="button" className="account-signout" onClick={async()=>{setActiveMenu(null);await logout();router.push("/")}}><LogOut size={16}/>Sign out</button></div>}</div>
        </header>
        {allowed?children:<main className="dashboard-main section-page"><section className="empty-state"><h1>Access restricted</h1><p>Your SmartCare role does not have permission to view this module. Ask an Admin or Manager to update your access.</p></section></main>}
      </div>
    </div>
  );
}
