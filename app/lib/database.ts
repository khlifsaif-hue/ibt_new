// @ts-nocheck
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { AssetRecord } from "./demo-data";

export const USER_ROLES = ["CEO", "ADMIN", "PROJECT_MANAGER", "MANAGER", "FINANCE", "TECHNICIAN", "STAFF", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const MODULE_ACTIONS = ["view", "create", "edit", "delete", "approve"] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

export type UserRecord = {
  id: string; name: string; email: string; role: UserRole; department: string;
  jobTitle: string; phone: string; active: boolean; projectIds: string[];
  projectNames: string[]; createdAt: string; updatedAt: string;
};
export type UserWriteInput = Omit<UserRecord, "id" | "projectIds" | "projectNames" | "createdAt" | "updatedAt"> & { projectIds?: string[] };
export type ModuleRecord = { key: string; title: string; path: string; enabled: boolean; sortOrder: number };
export type UserPermissionRecord = { userId: string; moduleKey: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean };
export type ProjectAccessRecord = { userId: string; projectId: string; projectName: string; canView: boolean; canCreate: boolean; canEdit: boolean; canApprove: boolean };
export type LocationRecord = { id: number; name: string; projectId: string | null; projectName?: string; active: boolean };
export type PurchaseOrderRecord = { id: string; date: string; supplier: string; equipment: string; equipmentType: "Asset" | "Consumable"; budgetBranch: string; project: string; location: string; quantity: number; unitPrice: number; total: number; status: string; assetCreated: boolean; purchaseRequestId?: string; approvedBy?: string; approvedAt?: string; receivedAt?: string; receivedCondition?: string; receivedManufacturer?: string; receivedModel?: string; receivedSerialNumber?: string; receivedWarrantyUntil?: string };
export type ProjectExpenseRecord = { id: string; projectId: string; projectName: string; budgetBranch: string; expenseType: string; description: string; amount: number; incurredOn: string; status: string; assetId: string | null; createdBy: string | null };
export type ProjectTaskRecord = { id: string; projectId: string; projectName: string; title: string; description: string; priority: "High" | "Medium" | "Normal"; assigneeUserId: string; assigneeName: string; assignedByUserId: string | null; assignedByName: string | null; dueDate: string; status: string; deferReason: string | null; responseNote: string | null; respondedAt: string | null; createdAt: string };
export type OrderProgressRecord = { id: string; purchaseRequestId: string; purchaseOrderId: string | null; projectId: string; project: string; requestedBy: string | null; requestedByName: string; responsibleUserId: string | null; responsibleUserName: string; itemName: string; description: string; quantity: number; supplier: string; progressPercentage: number; status: string; expectedDeliveryDate: string | null; actualDeliveryDate: string | null; trackingReference: string; createdAt: string; updatedAt: string; updatedBy: string | null; updatedByName: string; updates: OrderProgressUpdateRecord[] };
export type OrderProgressUpdateRecord = { id: number; previousPercentage: number; newPercentage: number; previousStatus: string; newStatus: string; previousExpectedDeliveryDate: string | null; newExpectedDeliveryDate: string | null; previousActualDeliveryDate: string | null; newActualDeliveryDate: string | null; previousSupplier: string; newSupplier: string; previousTrackingReference: string; newTrackingReference: string; note: string; createdBy: string | null; createdByName: string; createdAt: string };
export type AssetImportIssue = { rowNumber: number; assetId: string; message: string };
export type AssetImportPreview = { rowNumber: number; assetId: string; assetName: string; action: "create" | "update"; errors: string[] };

type Row = Record<string, unknown>;
type ImportRow = Record<string, unknown>;

function fail(error: { message?: string } | null, fallback = "Supabase operation failed") {
  if (error) throw new Error(error.message || fallback);
}
function text(value: unknown, fallback = "") { return value == null ? fallback : String(value); }
function num(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback; }
function relName(value: unknown) {
  if (Array.isArray(value)) return text((value[0] as Row | undefined)?.name ?? (value[0] as Row | undefined)?.full_name);
  return text((value as Row | null)?.name ?? (value as Row | null)?.full_name);
}
function oneRelation(value: unknown): Row | undefined {
  if (Array.isArray(value)) return value[0] as Row | undefined;
  return value && typeof value === "object" ? value as Row : undefined;
}
export function isPlatformAdministrator(role?: string) { return role === "CEO" || role === "ADMIN"; }
export function canViewMoney(role?: string) { return isPlatformAdministrator(role) || role === "PROJECT_MANAGER" || role === "FINANCE"; }
const PROFILE_SELECT = "*,roles(name),user_project_access(project_id,projects(name))";
function userProjectsFromRow(row: Row) {
  const accessRows = Array.isArray(row.user_project_access) ? row.user_project_access as Row[] : [];
  return {
    projectIds: accessRows.map((access) => text(access.project_id)).filter(Boolean),
    projectNames: accessRows.map((access) => relName(access.projects)).filter(Boolean),
  };
}
function userFromRow(row: Row): UserRecord {
  const projects = userProjectsFromRow(row);
  return {
    id: text(row.id), name: text(row.full_name), email: text(row.email),
    role: (relName(row.roles) || text(row.role) || "VIEWER") as UserRole,
    department: text(row.department), jobTitle: text(row.job_title), phone: text(row.phone),
    active: row.active !== false, projectIds: projects.projectIds, projectNames: projects.projectNames,
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}
async function attachParentProjectNames(rows: Row[]) {
  if (!rows.length) return rows;
  const parentIds = [...new Set(rows.map(row => text(row.parent_project_id)).filter(Boolean))];
  if (!parentIds.length) return rows.map(row => ({ ...row, parent_project_name: "" }));
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("id,name").in("id", parentIds);
  fail(error);
  const names = new Map((data || []).map(row => [text(row.id), text(row.name)]));
  return rows.map(row => ({
    ...row,
    parent_project_name: text(row.parent_project_id) ? (names.get(text(row.parent_project_id)) || "") : "",
  }));
}

async function attachProjectRollups(rows: Row[]) {
  if (!rows.length) return rows;
  const supabase = await createClient();
  const ids = rows.map(row => text(row.id)).filter(Boolean);
  const { data: financeRows, error } = await supabase
    .from("project_financial_rollup")
    .select("*")
    .in("project_id", ids);
  fail(error);
  const byProject = new Map((financeRows || []).map(row => [text(row.project_id), row as Row]));
  return rows.map(row => ({ ...row, project_financial_rollup: byProject.get(text(row.id)) || null }));
}

function projectFromRow(row: Row) {
  const finance = oneRelation(row.project_financial_rollup) || oneRelation(row.project_financials);
  
  return {
    id: text(row.id), name: text(row.name), manager: text(row.manager),
    approvedBudget: num(finance?.approved_budget), committed: num(finance?.committed), spent: num(finance?.spent),
    directCommitted: num(finance?.direct_committed ?? finance?.committed),
    directSpent: num(finance?.direct_spent ?? finance?.spent),
    availableBudget: num(finance?.available_budget, num(finance?.approved_budget)-num(finance?.committed)-num(finance?.spent)),
    unallocatedBudget: num(finance?.unallocated_budget, num(finance?.approved_budget)),
    allocatedToChildren: num(finance?.allocated_to_children),
    childCount: num(finance?.child_count),
    financialVisible: Boolean(finance),
    status: text(row.status, "Active"), assets: num(row.asset_count), imageData: row.image_url || null,
    parentProjectId: row.parent_project_id ? text(row.parent_project_id) : null,
    parentProjectName: text(row.parent_project_name),
    projectCode: text(row.project_code),
    closedAt: row.closed_at ? text(row.closed_at) : null,
    closureNote: text(row.closure_note),
    isSubProject: Boolean(row.parent_project_id),
  };
}
function assetFromRow(row: Row): AssetRecord {
  const finance = oneRelation(row.asset_financials);
     return {
    id: text(row.id), name: text(row.name), manufacturer: text(row.manufacturer), model: text(row.model),
    serialNumber: text(row.serial_number), category: text(row.category), location: text(row.location),
    installedOn: text(row.installed_on), warrantyUntil: text(row.warranty_until), status: text(row.status),
    tone: text(row.tone, "healthy") as AssetRecord["tone"], health: num(row.health, 100), uptime: num(row.uptime),
    metricLabel: text(row.metric_label), metric: text(row.metric), maintenanceLabel: text(row.maintenance_label),
    maintenance: text(row.maintenance), dataSource: text(row.data_source), connectivity: text(row.connectivity),
    lastSeen: text(row.last_seen), owner: text(row.owner), project: relName(row.projects) || text(row.project),
    acquisitionCost: num(finance?.acquisition_cost), residualValue: num(finance?.residual_value), usefulLifeYears: num(finance?.useful_life_years, 5),
    purchaseDate: text(finance?.purchase_date), imageData: text(row.image_url) || undefined,
    insured: Boolean(finance?.insured), openBox: Boolean(finance?.open_box), damagePercent: num(finance?.damage_percent),
    financialVisible: Boolean(finance),
    warningCount: num(row.warning_count),
    quantity: Math.max(1, num(row.quantity, 1)), notes: text(row.notes), sourceLink: text(row.source_link), purchaseOrderId: text(row.purchase_order_id) || undefined,
  };
}
async function signedUrls(bucket: string, rows: Row[], pathKey = "image_path") {
  const paths = rows.map((row) => text(row[pathKey])).filter(Boolean);
  if (!paths.length) return rows;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
  const byPath = new Map((data || []).map((item) => [item.path, item.signedUrl]));
  return rows.map((row) => ({ ...row, image_url: byPath.get(text(row[pathKey])) || null }));
}

export async function listUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).order("full_name");
  fail(error); return (data || []).map((row) => userFromRow(row as Row));
}
export async function listRoleNames() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("name").order("name");
  fail(error); return (data || []).map((row) => text(row.name)).filter(Boolean);
}
export async function findUserByEmail(email: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).ilike("email", email).maybeSingle();
  fail(error); return data ? userFromRow(data as Row) : undefined;
}
export async function findUserById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", id).maybeSingle();
  fail(error); return data ? userFromRow(data as Row) : undefined;
}
async function roleId(role: UserRole) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("id").eq("name", role).single();
  fail(error); if (!data) throw new Error(`Role '${role}' was not found.`); return data.id as number;
}
function defaultProjectAccess(role: UserRole) {
  return {
    can_view: true,
    can_create: !["VIEWER"].includes(role),
    can_edit: ["CEO", "ADMIN", "PROJECT_MANAGER", "MANAGER", "FINANCE", "TECHNICIAN"].includes(role),
    can_approve: ["CEO", "ADMIN", "PROJECT_MANAGER", "FINANCE"].includes(role),
  };
}
async function replaceUserProjectAccess(userId: string, projectIds: string[], role: UserRole, client = createAdminClient()) {
  const ids = [...new Set(projectIds.map(String).map((id) => id.trim()).filter(Boolean))];
  if (ids.length) {
    const { data: validProjects, error: projectError } = await client.from("projects").select("id").in("id", ids);
    fail(projectError);
    if ((validProjects || []).length !== ids.length) throw new Error("One or more selected projects do not exist.");
  }
  const { error: deleteError } = await client.from("user_project_access").delete().eq("user_id", userId);
  fail(deleteError);
  if (!ids.length) return;
  const defaults = defaultProjectAccess(role);
  const { error } = await client.from("user_project_access").insert(ids.map((projectId) => ({ user_id: userId, project_id: projectId, ...defaults })));
  fail(error);
}
export async function createUser(input: UserWriteInput, requestOrigin?: string) {
  const admin = createAdminClient();
  const siteUrl = (requestOrigin || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const inviteCallback = siteUrl ? `${siteUrl}/auth/callback?next=/auth/invite` : undefined;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.name },
    ...(inviteCallback ? { redirectTo: inviteCallback } : {}),
  });
  fail(error); if (!data.user) throw new Error("Supabase did not create the invited user.");
  const { error: profileError } = await admin.from("profiles").upsert({
    id: data.user.id, email: input.email.toLowerCase(), full_name: input.name, department: input.department,
    job_title: input.jobTitle, phone: input.phone || "", active: input.active, role_id: await roleId(input.role),
  });
  fail(profileError); await seedPermissionsForUser(data.user.id, input.role, admin);
  await replaceUserProjectAccess(data.user.id, input.projectIds || [], input.role, admin);
  const { data: profile, error: readError } = await admin.from("profiles").select(PROFILE_SELECT).eq("id", data.user.id).single();
  fail(readError); return userFromRow(profile as Row);
}
export async function setUserActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ active }).eq("id", id).select(PROFILE_SELECT).single();
  fail(error);
  if (!data) throw new Error("User not found");
  return userFromRow(data as Row);
}

export async function setUserPassword(id: string, password: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  fail(error, "Unable to set new password");
}

export async function updateUser(id: string, input: Partial<UserWriteInput>) {
  // Normal SmartCare user administration is database authorization, not Auth identity administration.
  // Use the signed-in administrator session so RLS remains the enforcement layer.
  const supabase = await createClient();
  const current = await findUserById(id); if (!current) throw new Error("User not found");
  const next = { ...current, ...input };
  const normalizedEmail = next.email.trim().toLowerCase();
  const emailChanged = normalizedEmail !== current.email.trim().toLowerCase();

  // A login-email change must also update the Supabase Auth identity. Do this only when the
  // email truly changed; ordinary profile/role/project edits must never require the secret key.
  if (emailChanged) {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(id, { email: normalizedEmail });
    fail(authError, "Unable to update login email");
  }

  const { error } = await supabase.from("profiles").update({
    full_name: next.name, email: normalizedEmail, department: next.department,
    job_title: next.jobTitle, phone: next.phone || "", role_id: await roleId(next.role),
  }).eq("id", id);
  fail(error);

  if (input.role) await seedPermissionsForUser(id, next.role, supabase);
  if (input.role || input.projectIds) await replaceUserProjectAccess(id, input.projectIds || current.projectIds, next.role, supabase);

  const { data, error: readError } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", id).single();
  fail(readError); return userFromRow(data as Row);
}
export async function deleteUser(id: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id); fail(error); return true;
}

async function seedPermissionsForUser(userId: string, role: UserRole, client = createAdminClient()) {
  const { data, error } = await client.from("app_modules").select("module_key"); fail(error);
  const tech = new Set(["overview","projects","project_dashboard","assets","maintenance","work_orders","order_progress","inventory","ai_assistant","reports","project_tasks"]);
  const projectManager = new Set(["overview","projects","project_budgets","project_dashboard","assets","maintenance","work_orders","order_progress","lab_calendar","purchase_requests","spare_parts","reports","project_tasks","project_risks"]);
  const finance = new Set(["overview","projects","project_budgets","project_dashboard","purchase_requests","procurement","order_progress","depreciation","reports"]);
  const staff = new Set(["overview","projects","project_dashboard","assets","purchase_requests","order_progress","ai_assistant","reports","project_tasks"]);
  const viewer = new Set(["overview","projects","project_dashboard","assets","order_progress","reports"]);
  const rows = (data || []).map(({ module_key }) => {
    const full = isPlatformAdministrator(role);
    const canView = full || (role === "PROJECT_MANAGER" && projectManager.has(module_key)) || (role === "MANAGER" && projectManager.has(module_key)) || (role === "TECHNICIAN" && tech.has(module_key)) || (role === "FINANCE" && finance.has(module_key)) || (role === "STAFF" && staff.has(module_key)) || (role === "VIEWER" && viewer.has(module_key));
    const canWrite = full || (["PROJECT_MANAGER","MANAGER"].includes(role) && ["project_dashboard","assets","maintenance","work_orders","order_progress","purchase_requests","project_tasks","project_risks"].includes(module_key)) || (role === "TECHNICIAN" && ["assets","maintenance","work_orders","order_progress","inventory","project_tasks"].includes(module_key)) || (role === "FINANCE" && ["projects","purchase_requests","procurement","order_progress"].includes(module_key)) || (role === "STAFF" && ["purchase_requests","order_progress","project_tasks"].includes(module_key));
    return { user_id: userId, module_key, can_view: canView, can_create: canWrite, can_edit: canWrite, can_delete: full || (["PROJECT_MANAGER","MANAGER"].includes(role) && ["project_tasks","project_risks"].includes(module_key)), can_approve: full || (["PROJECT_MANAGER","FINANCE"].includes(role) && ["purchase_requests","project_tasks"].includes(module_key)) };
  });
  if (rows.length) fail((await client.from("user_permissions").upsert(rows)).error);
}
export async function importUsers(rows: Row[]) {
  let created = 0, updated = 0, skipped = 0;
  for (const raw of rows) {
    const lower = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]+/g, ""), value]));
    const name = text(lower.name || lower.fullname || `${text(lower.firstname)} ${text(lower.lastname)}`).trim();
    const email = text(lower.email || lower.emailaddress || lower.primaryemail).trim().toLowerCase();
    if (!name || !email) { skipped++; continue; }
    const existing = await findUserByEmail(email);
    if (existing) { await updateUser(existing.id, { name, phone: text(lower.phone || lower.mobile) || existing.phone, department: text(lower.department) || existing.department, jobTitle: text(lower.jobtitle || lower.title) || existing.jobTitle }); updated++; }
    else { await createUser({ name, email, phone: text(lower.phone || lower.mobile), department: text(lower.department), jobTitle: text(lower.jobtitle || lower.title), role: "VIEWER", active: true, projectIds: [] }); created++; }
  }
  return { created, updated, skipped };
}

export async function listModules() {
  const supabase = await createClient(); const { data, error } = await supabase.from("app_modules").select("*").order("sort_order"); fail(error);
  return (data || []).map((row) => ({ key: row.module_key, title: row.title, path: row.path, enabled: row.enabled, sortOrder: row.sort_order })) as ModuleRecord[];
}
export async function upsertModule(input: ModuleRecord) {
  const supabase = await createClient(); const { data, error } = await supabase.from("app_modules").upsert({ module_key: input.key, title: input.title, path: input.path, enabled: input.enabled, sort_order: input.sortOrder }).select().single(); fail(error);
  return { key: data.module_key, title: data.title, path: data.path, enabled: data.enabled, sortOrder: data.sort_order } as ModuleRecord;
}
export async function setModuleEnabled(key: string, enabled: boolean) { const supabase = await createClient(); const { error, count } = await supabase.from("app_modules").update({ enabled }, { count: "exact" }).eq("module_key", key); fail(error); return Boolean(count); }
export async function setModuleOrder(key: string, sortOrder: number) { const supabase = await createClient(); const { error, count } = await supabase.from("app_modules").update({ sort_order: sortOrder }, { count: "exact" }).eq("module_key", key); fail(error); return Boolean(count); }
export async function listUserPermissions(userId: string) {
  const supabase = await createClient(); const { data, error } = await supabase.from("user_permissions").select("*").eq("user_id", userId).order("module_key"); fail(error);
  return (data || []).map((row) => ({ userId: row.user_id, moduleKey: row.module_key, canView: row.can_view, canCreate: row.can_create, canEdit: row.can_edit, canDelete: row.can_delete, canApprove: row.can_approve })) as UserPermissionRecord[];
}
export async function setUserPermission(userId: string, moduleKey: string, input: Partial<UserPermissionRecord>) {
  const supabase = await createClient(); const row = { user_id: userId, module_key: moduleKey, can_view: Boolean(input.canView), can_create: Boolean(input.canCreate), can_edit: Boolean(input.canEdit), can_delete: Boolean(input.canDelete), can_approve: Boolean(input.canApprove) };
  const { error } = await supabase.from("user_permissions").upsert(row); fail(error); return { userId, moduleKey, canView: row.can_view, canCreate: row.can_create, canEdit: row.can_edit, canDelete: row.can_delete, canApprove: row.can_approve };
}
export async function userCan(userId: string, moduleKey: string, action: ModuleAction) {
  const supabase = await createClient(); const column = { view: "can_view", create: "can_create", edit: "can_edit", delete: "can_delete", approve: "can_approve" }[action];
  const { data, error } = await supabase.from("user_permissions").select(column).eq("user_id", userId).eq("module_key", moduleKey).maybeSingle(); fail(error); return Boolean(data?.[column as keyof typeof data]);
}
export async function listUserProjectAccess(userId: string) {
  const supabase = await createClient(); const { data, error } = await supabase.from("user_project_access").select("*,projects(name)").eq("user_id", userId); fail(error);
  return (data || []).map((row) => ({ userId: row.user_id, projectId: row.project_id, projectName: relName(row.projects), canView: row.can_view, canCreate: row.can_create, canEdit: row.can_edit, canApprove: row.can_approve })) as ProjectAccessRecord[];
}
export async function setUserProjectAccess(userId: string, projectId: string, input: Partial<ProjectAccessRecord>) {
  const row = { user_id: userId, project_id: projectId, can_view: Boolean(input.canView), can_create: Boolean(input.canCreate), can_edit: Boolean(input.canEdit), can_approve: Boolean(input.canApprove) };
  const supabase = await createClient(); const { error } = await supabase.from("user_project_access").upsert(row); fail(error); return { canView: row.can_view, canCreate: row.can_create, canEdit: row.can_edit, canApprove: row.can_approve };
}
export async function userProjectCan(userId: string, projectName: string, action: "view" | "create" | "edit" | "approve" = "view") {
  const supabase = await createClient(); const { data: project, error: projectError } = await supabase.from("projects").select("id").ilike("name", projectName).maybeSingle(); fail(projectError); if (!project) return false;
  const column = { view: "can_view", create: "can_create", edit: "can_edit", approve: "can_approve" }[action];
  const { data, error } = await supabase.from("user_project_access").select(column).eq("user_id", userId).eq("project_id", project.id).maybeSingle(); fail(error); return Boolean(data?.[column as keyof typeof data]);
}


export async function listProjectOptionsForUser(user: Pick<UserRecord, "id" | "role">) {
  const projects=await listProjectsForUser(user);
  return projects.map(project=>({id:project.id,name:project.name,parentProjectId:project.parentProjectId,parentProjectName:project.parentProjectName,isSubProject:project.isSubProject,status:project.status}));
}

export async function listProjects() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects")
    .select("*,assets(count)")
    .order("name");
  fail(error);
  const withCounts = (data || []).map(row => ({
    ...row,
    asset_count: Array.isArray(row.assets) ? num(row.assets[0]?.count) : 0,
  })) as Row[];
  const withParents = await attachParentProjectNames(withCounts);
  const withFinance = await attachProjectRollups(withParents);
  const rows = await signedUrls("asset-images", withFinance);
  return rows.map(projectFromRow);
}

export async function listProjectsForUser(user: Pick<UserRecord, "id" | "role">) {
  if (isPlatformAdministrator(user.role)) return listProjects();
  const supabase = await createClient();
  const [{data:accessRows,error:accessError},{data:projectRows,error:projectError}] = await Promise.all([
    supabase.from("user_project_access").select("project_id").eq("user_id",user.id).eq("can_view",true),
    supabase.from("projects").select("id,parent_project_id")
  ]);
  fail(accessError); fail(projectError);
  const allowed = new Set((accessRows || []).map(row => text(row.project_id)).filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of projectRows || []) {
      const id = text(row.id), parent = text(row.parent_project_id);
      if (parent && allowed.has(parent) && !allowed.has(id)) {
        allowed.add(id);
        changed = true;
      }
    }
  }
  if (!allowed.size) return [];
  const {data,error} = await supabase.from("projects")
    .select("*,assets(count)")
    .in("id",[...allowed]).order("name");
  fail(error);
  const withCounts = (data || []).map(row => ({
    ...row,
    asset_count: Array.isArray(row.assets) ? num(row.assets[0]?.count) : 0,
  })) as Row[];
  const withParents = await attachParentProjectNames(withCounts);
  const withFinance = await attachProjectRollups(withParents);
  const rows = await signedUrls("asset-images", withFinance);
  return rows.map(projectFromRow);
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const {data,error} = await supabase.from("projects")
    .select("*,assets(count)")
    .eq("id",id).maybeSingle();
  fail(error);
  if (!data) return undefined;
  const base = [{
    ...data,
    asset_count: Array.isArray(data.assets) ? num(data.assets[0]?.count) : 0,
  } as Row];
  const [withParent] = await attachParentProjectNames(base);
  const [withFinance] = await attachProjectRollups([withParent]);
  const [row] = await signedUrls("asset-images", [withFinance]);
  return projectFromRow(row);
}
export async function createProject(input:{name:string;manager:string;approvedBudget:number;parentProjectId?:string|null;projectCode?:string}){
  const id=crypto.randomUUID(),supabase=await createClient(),parentProjectId=text(input.parentProjectId)||null;
  if(parentProjectId){
    const parent=await getProject(parentProjectId);
    if(!parent)throw new Error("Parent project was not found.");
    if(text(parent.status).toLowerCase()==="closed")throw new Error("A closed project cannot receive a new sub-project.");
    const {data:siblings,error:siblingError}=await supabase.from("projects").select("id,project_financials(approved_budget)").eq("parent_project_id",parentProjectId);
    fail(siblingError);
    const allocated=(siblings||[]).reduce((sum,row)=>sum+num(oneRelation(row.project_financials)?.approved_budget),0);
    if(allocated+input.approvedBudget>parent.approvedBudget)
      throw new Error(`Sub-project allocation exceeds parent budget. Remaining allocatable budget: ${Math.max(0,parent.approvedBudget-allocated).toFixed(2)} QAR.`);
  }
  const {data,error}=await supabase.from("projects").insert({id,name:input.name,manager:input.manager,parent_project_id:parentProjectId,project_code:text(input.projectCode)||null}).select().single();
  fail(error);
  fail((await supabase.from("project_financials").insert({project_id:id,approved_budget:input.approvedBudget})).error);
  fail((await supabase.from("budget_branches").insert(["Marketing","Equipment","Consumables","Call-off"].map(name=>({project_id:id,name})))).error);
  return getProject(id);
}
export async function updateProject(id: string, input: Row) {
  const current = await getProject(id); if (!current) return undefined;
  const update: Row = { name: text(input.name, current.name), manager: text(input.manager, current.manager), status: text(input.status, current.status) }; if(Object.hasOwn(input,"projectCode"))update.project_code=text(input.projectCode)||null; if(Object.hasOwn(input,"parentProjectId"))update.parent_project_id=text(input.parentProjectId)||null;
  if (input.imagePath) update.image_path = text(input.imagePath);
  const supabase = await createClient(); const { data, error } = await supabase.from("projects").update(update).eq("id", id).select().single(); fail(error);
  if(input.approvedBudget != null)fail((await supabase.from("project_financials").upsert({project_id:id,approved_budget:num(input.approvedBudget),committed:current.committed,spent:current.spent})).error);
  return projectFromRow({...data,project_financials:{approved_budget:input.approvedBudget == null?current.approvedBudget:num(input.approvedBudget),committed:current.committed,spent:current.spent}} as Row);
}

export async function listAssets(includeImages=true) {
  const supabase = await createClient(); const { data, error } = await supabase.from("assets").select("*,projects(name),asset_financials(*),alerts(count)").is("deleted_at",null).order("name"); fail(error);
  const baseRows=(data || []).map((row) => ({ ...row, warning_count: Array.isArray(row.alerts) ? num(row.alerts[0]?.count) : 0 })) as Row[];
  const rows = includeImages?await signedUrls("asset-images",baseRows):baseRows;
  return rows.map(assetFromRow);
}
export async function findAsset(id: string) {
  const supabase = await createClient(); const { data, error } = await supabase.from("assets").select("*,projects(name),asset_financials(*),alerts(count)").eq("id", id).is("deleted_at",null).maybeSingle(); fail(error); if (!data) return undefined;
  const [row] = await signedUrls("asset-images", [{ ...data, warning_count: Array.isArray(data.alerts) ? num(data.alerts[0]?.count) : 0 } as Row]); return assetFromRow(row);
}
async function projectIdByName(project: string) {
  const supabase = await createClient(); const { data, error } = await supabase.from("projects").select("id").ilike("name", project).maybeSingle(); fail(error);
  if (!data) throw new Error(`Project '${project}' does not exist in SmartCare.`); return data.id as string;
}
function importedCondition(status?: string) {
  const normalized = text(status).trim().toUpperCase();
  if (/POOR|TO FIX|DAMAGED|BROKEN|OUT OF SERVICE/.test(normalized)) return { tone: "warning" as const, health: 35 };
  if (/NEW|NOT OPENED/.test(normalized)) return { tone: "healthy" as const, health: 100 };
  if (/GOOD|OPERATIONAL|ACTIVE/.test(normalized)) return { tone: "healthy" as const, health: 90 };
  return { tone: "due" as const, health: 70 };
}
function assetInsert(input: Partial<AssetRecord> & Pick<AssetRecord, "name" | "category">, id = `AST-${Date.now().toString().slice(-8)}`) {
  const today = new Date().toISOString().slice(0, 10);
  const condition = importedCondition(input.status);
  return { id, name: input.name, manufacturer: input.manufacturer || "To be confirmed", model: input.model || "To be confirmed", serial_number: input.serialNumber || "Pending", category: input.category, location: input.location || "IBTECHAR_STORE", quantity: Math.max(1,num(input.quantity,1)), notes: input.notes || "", source_link: input.sourceLink || "", installed_on: input.installedOn || today, warranty_until: input.warrantyUntil || null, status: input.status || "Setup required", tone: input.tone || condition.tone, health: input.health ?? condition.health, uptime: input.uptime ?? 0, metric_label: input.metricLabel || "Monitoring", metric: input.metric || "Pending", maintenance_label: input.maintenanceLabel || "Baseline inspection", maintenance: input.maintenance || "Required", data_source: input.dataSource || "Manual entry", connectivity: input.connectivity || "Not connected", last_seen: null, owner: input.owner || "Technical Services", image_path: undefined };
}
function assetFinance(input:Partial<AssetRecord>,assetId:string,projectId:string){const today=new Date().toISOString().slice(0,10);return{asset_id:assetId,project_id:projectId,acquisition_cost:num(input.acquisitionCost),residual_value:num(input.residualValue),useful_life_years:num(input.usefulLifeYears,5),purchase_date:input.purchaseDate||today,insured:Boolean(input.insured),open_box:Boolean(input.openBox),damage_percent:num(input.damagePercent)}}
export async function createAsset(input: Partial<AssetRecord> & Pick<AssetRecord, "name" | "category">) {
  const projectId=await projectIdByName(input.project || "Ibtechar"),row = { ...assetInsert(input), project_id: projectId };
  const supabase = await createClient(); const { data, error } = await supabase.from("assets").insert(row).select("*,projects(name)").single(); fail(error);const finance=assetFinance(input,row.id,projectId);fail((await supabase.from("asset_financials").insert(finance)).error);return assetFromRow({...data,asset_financials:finance} as Row);
}
export async function updateAsset(id: string, input: Row) {
  const current = await findAsset(id); if (!current) return undefined;
  const next = { ...current, ...input } as unknown as AssetRecord & { imagePath?: string };
  const normalizedStatus=text(next.status);const statusTone=normalizedStatus==="Operational"?"healthy":normalizedStatus==="Out of service"?"warning":normalizedStatus==="Awaiting commissioning"||normalizedStatus==="Maintenance due"?"due":text(next.tone,"healthy");
  const row: Row = { name: next.name, manufacturer: next.manufacturer, model: next.model, serial_number: next.serialNumber, category: next.category, location: next.location, quantity: Math.max(1,num(next.quantity,1)), notes: next.notes || "", source_link: next.sourceLink || "", installed_on: next.installedOn || null, warranty_until: next.warrantyUntil || null, status: normalizedStatus, tone: statusTone, health: next.health, owner: next.owner, project_id: await projectIdByName(next.project) };
  if (next.imagePath) row.image_path = next.imagePath;
  const supabase = await createClient(); const { data, error } = await supabase.from("assets").update(row).eq("id", id).select("*,projects(name)").single(); fail(error);const finance=assetFinance(next,id,row.project_id as string);if(current.financialVisible)fail((await supabase.from("asset_financials").upsert(finance)).error);await recalculateProjectFinancials(row.project_id as string); return assetFromRow({...data,asset_financials:current.financialVisible?finance:undefined} as Row);
}

export async function archiveAsset(id:string,deletedBy:string){
  const supabase=await createClient();
  const {data,error}=await supabase.from("assets").update({deleted_at:new Date().toISOString(),deleted_by:deletedBy}).eq("id",id).is("deleted_at",null).select("id").maybeSingle();
  fail(error);return Boolean(data);
}

export async function listArchivedAssets(){
  const supabase=await createClient();
  const{data,error}=await supabase.from("assets").select("*,projects(name),asset_financials(*)").not("deleted_at","is",null).order("deleted_at",{ascending:false});
  fail(error);
  const userIds=[...new Set((data||[]).map(row=>text(row.deleted_by)).filter(Boolean))];
  const profiles=userIds.length?await supabase.from("profiles").select("id,full_name").in("id",userIds):{data:[],error:null};
  fail(profiles.error);const names=new Map((profiles.data||[]).map(row=>[text(row.id),text(row.full_name)]));
  return(data||[]).map(row=>({...assetFromRow(row as Row),deletedAt:text(row.deleted_at),deletedBy:names.get(text(row.deleted_by))||"Administrator"}));
}

export async function restoreAsset(id:string){
  const supabase=await createClient();
  const{data,error}=await supabase.from("assets").update({deleted_at:null,deleted_by:null}).eq("id",id).not("deleted_at","is",null).select("id").maybeSingle();
  fail(error);return Boolean(data);
}

export async function archivedAssetBundle(id:string){
  const supabase=await createClient();
  const raw=await supabase.from("assets").select("*,projects(name),asset_financials(*)").eq("id",id).not("deleted_at","is",null).maybeSingle();fail(raw.error);if(!raw.data)return undefined;
  const[tasks,orders,events,diagnostics]=await Promise.all([supabase.from("maintenance_tasks").select("*,work_orders(id)").eq("asset_id",id),supabase.from("work_orders").select("*,assets(name,model)").eq("asset_id",id),supabase.from("service_events").select("*").eq("asset_id",id).order("performed_at"),supabase.from("diagnostic_sessions").select("id,observed_symptom,result_json,created_at").eq("asset_id",id).order("created_at")]);fail(tasks.error);fail(orders.error);fail(events.error);fail(diagnostics.error);
  let purchaseOrder=null;if(raw.data.purchase_order_id){const po=await supabase.from("purchase_orders").select("id,po_date,supplier,equipment,total,status,received_at,received_condition").eq("id",raw.data.purchase_order_id).maybeSingle();fail(po.error);purchaseOrder=po.data;}
  let deletedBy="Administrator";if(raw.data.deleted_by){const profile=await supabase.from("profiles").select("full_name").eq("id",raw.data.deleted_by).maybeSingle();fail(profile.error);deletedBy=text(profile.data?.full_name,"Administrator");}
  return{asset:{...assetFromRow(raw.data as Row),deletedAt:text(raw.data.deleted_at),deletedBy},purchaseOrder,tasks:tasks.data||[],orders:(orders.data||[]).map(row=>workOrderFromRow(row as Row)),events:events.data||[],diagnostics:diagnostics.data||[]};
}

const importAliases: Record<string,string> = { assetid:"asset_id",asset_id:"asset_id",id_number_code_number:"asset_id",code_number:"asset_id",assetname:"asset_name",asset_name:"asset_name",item_name:"asset_name",serialnumber:"serial_number",serial_number:"serial_number",model_number:"model",qty:"quantity",quantity:"quantity",where_to_find:"location",notes_storage_container:"notes",link:"source_link",purchasedate:"purchase_date",purchase_date:"purchase_date",acquisitioncostqar:"acquisition_cost_qar",acquisition_cost_qar:"acquisition_cost_qar",residualvalueqar:"residual_value_qar",residual_value_qar:"residual_value_qar",usefullifeyears:"useful_life_years",useful_life_years:"useful_life_years",warrantyuntil:"warranty_until",warranty_until:"warranty_until" };
function importKey(key: string) { const clean = key.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""); return importAliases[clean] || clean; }
function importValue(value: unknown) { return value == null ? "" : String(value).trim(); }
function importNumber(value: unknown) { return num(importValue(value).replace(/[^0-9.-]/g,"")); }
function importDate(value: unknown) { const raw=importValue(value); if(!raw)return ""; if(/^\d+(\.\d+)?$/.test(raw)){const date=new Date((Number(raw)-25569)*86400000);return Number.isNaN(date.getTime())?"":date.toISOString().slice(0,10);}const date=new Date(raw);return Number.isNaN(date.getTime())?raw:date.toISOString().slice(0,10); }
function normalizeImportRow(row: ImportRow) { return Object.fromEntries(Object.entries(row).map(([key,value]) => [importKey(key),value])); }
export async function previewAssetImport(rows: ImportRow[]): Promise<AssetImportPreview[]> {
  const [assets, projects] = await Promise.all([listAssets(false), listProjects()]); const assetIds = new Set(assets.map((asset) => asset.id.toLowerCase())); const projectNames = new Set(projects.map((project) => project.name.toLowerCase())); const seen = new Set<string>();
  return rows.map((raw,index) => { const row=normalizeImportRow(raw), assetId=importValue(row.asset_id), assetName=importValue(row.asset_name), errors:string[]=[]; if(!assetId)errors.push("asset_id is required");else if(seen.has(assetId.toLowerCase()))errors.push("Duplicate asset_id within this workbook");else seen.add(assetId.toLowerCase()); if(!assetName)errors.push("asset_name is required"); if(!importValue(row.project))errors.push("project is required");else if(!projectNames.has(importValue(row.project).toLowerCase()))errors.push(`Project '${importValue(row.project)}' does not exist in SmartCare`); if(!importValue(row.category))errors.push("category is required"); if(importValue(row.quantity)&&importNumber(row.quantity)<=0)errors.push("quantity must be greater than zero"); if(importValue(row.useful_life_years)&&importNumber(row.useful_life_years)<=0)errors.push("useful_life_years must be greater than zero"); return {rowNumber:index+2,assetId,assetName,action:assetIds.has(assetId.toLowerCase())?"update":"create",errors}; });
}
export async function importAssets(rows: ImportRow[], sourceFileName: string, _createdBy = "SmartCare user") {
  const preview = await previewAssetImport(rows); let created=0,updated=0; const issues:AssetImportIssue[]=[];
  for (let index=0; index<rows.length; index++) { const item=preview[index]; if(item.errors.length){item.errors.forEach(message=>issues.push({rowNumber:item.rowNumber,assetId:item.assetId,message}));continue;} const row=normalizeImportRow(rows[index]); const existing=await findAsset(item.assetId); const input = { name:importValue(row.asset_name), category:importValue(row.category), project:importValue(row.project), manufacturer:importValue(row.manufacturer)||existing?.manufacturer, model:importValue(row.model)||existing?.model, serialNumber:importValue(row.serial_number)||existing?.serialNumber, location:importValue(row.location)||existing?.location, quantity:importNumber(row.quantity)||existing?.quantity||1, notes:importValue(row.notes)||existing?.notes, sourceLink:importValue(row.source_link)||existing?.sourceLink, status:importValue(row.status)||existing?.status, installedOn:importDate(row.installed_on)||importDate(row.purchase_date)||existing?.installedOn, warrantyUntil:importDate(row.warranty_until)||existing?.warrantyUntil, owner:importValue(row.owner)||existing?.owner, acquisitionCost:importNumber(row.acquisition_cost_qar)||existing?.acquisitionCost, residualValue:importNumber(row.residual_value_qar)||existing?.residualValue, usefulLifeYears:importNumber(row.useful_life_years)||existing?.usefulLifeYears, purchaseDate:importDate(row.purchase_date)||existing?.purchaseDate } as Partial<AssetRecord> & Pick<AssetRecord,"name"|"category">; if(existing){await updateAsset(existing.id,input as Row);updated++;}else{const projectId=await projectIdByName(importValue(row.project)),insert={...assetInsert(input,item.assetId),project_id:projectId,data_source:"Excel bulk import"},supabase=await createClient();fail((await supabase.from("assets").insert(insert)).error);fail((await supabase.from("asset_financials").insert(assetFinance(input,item.assetId,projectId))).error);created++;} }
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); await supabase.from("asset_import_batches").insert({source_file_name:sourceFileName,total_rows:rows.length,created_count:created,updated_count:updated,rejected_count:new Set(issues.map(i=>i.rowNumber)).size,created_by:user?.id||null});
  return {created,updated,rejected:new Set(issues.map(i=>i.rowNumber)).size,issues,preview};
}

export async function listLocations(activeOnly = true) {
  const supabase=await createClient(); let query=supabase.from("locations").select("*,projects(name)").order("name"); if(activeOnly)query=query.eq("active",true); const {data,error}=await query;fail(error);
  return (data||[]).map(row=>({id:row.id,name:row.name,projectId:row.project_id,projectName:relName(row.projects),active:row.active})) as LocationRecord[];
}
export async function createLocation(input:Row){const name=text(input.name).trim();if(!name)throw new Error("Location name is required");const supabase=await createClient();const{data,error}=await supabase.from("locations").insert({name,project_id:text(input.projectId)||null,active:input.active!==false}).select().single();fail(error);return {id:data.id,name:data.name,projectId:data.project_id,active:data.active};}
export async function updateLocation(id:number,input:Row){const supabase=await createClient();const{data,error}=await supabase.from("locations").update({name:input.name,project_id:text(input.projectId)||null,active:input.active!==false}).eq("id",id).select().maybeSingle();fail(error);return data?{id:data.id,name:data.name,projectId:data.project_id,active:data.active}:undefined;}

export async function listParts(){const supabase=await createClient();const{data,error}=await supabase.from("spare_parts").select("*").order("name");fail(error);return(data||[]).map(row=>({sku:row.sku,name:row.name,category:row.category,onHand:row.on_hand,reorderPoint:row.reorder_point,unitCost:num(row.unit_cost),location:row.location,linkedAssets:row.linked_assets}));}
export async function createPart(input:Row){const sku=text(input.sku).trim();if(!sku)throw new Error("SKU is required");const supabase=await createClient();const{data,error}=await supabase.from("spare_parts").insert({sku,name:text(input.name),category:text(input.category,"Other"),on_hand:num(input.onHand),reorder_point:num(input.reorderPoint),unit_cost:num(input.unitCost),location:text(input.location),linked_assets:text(input.linkedAssets)}).select().single();fail(error);return{sku:data.sku,name:data.name,category:data.category,onHand:data.on_hand,reorderPoint:data.reorder_point,unitCost:num(data.unit_cost),location:data.location,linkedAssets:data.linked_assets};}
export async function updatePart(sku:string,input:Row){const supabase=await createClient();const{data,error}=await supabase.from("spare_parts").update({name:input.name,category:input.category,on_hand:num(input.onHand),reorder_point:num(input.reorderPoint),unit_cost:num(input.unitCost),location:text(input.location),linked_assets:text(input.linkedAssets)}).eq("sku",sku).select().maybeSingle();fail(error);return data?{sku:data.sku,name:data.name,category:data.category,onHand:data.on_hand,reorderPoint:data.reorder_point,unitCost:num(data.unit_cost),location:data.location,linkedAssets:data.linked_assets}:undefined;}
export async function deletePart(sku:string){const supabase=await createClient();const{error,count}=await supabase.from("spare_parts").delete({count:"exact"}).eq("sku",sku);fail(error);return Boolean(count);}

async function recipientsForRoles(roles:string[]){const admin=createAdminClient();const{data,error}=await admin.from("profiles").select("id,roles!inner(name)").eq("active",true).in("roles.name",roles);fail(error);return(data||[]).map(row=>row.id);}

function poFromRow(row:Row):PurchaseOrderRecord{return{id:text(row.id),date:text(row.po_date),supplier:text(row.supplier),equipment:text(row.equipment),equipmentType:text(row.equipment_type)==="Consumable"?"Consumable":"Asset",budgetBranch:text(row.budget_branch),project:relName(row.projects),location:text(row.location),quantity:num(row.quantity,1),unitPrice:num(row.unit_price),total:num(row.total),status:text(row.status),assetCreated:Boolean(row.asset_created),purchaseRequestId:text(row.purchase_request_id),approvedBy:relName(row.approved_by_profile),approvedAt:text(row.approved_at),receivedAt:text(row.received_at),receivedCondition:text(row.received_condition),receivedManufacturer:text(row.received_manufacturer),receivedModel:text(row.received_model),receivedSerialNumber:text(row.received_serial_number),receivedWarrantyUntil:text(row.received_warranty_until)};}
export async function listPurchaseOrders(){const supabase=await createClient();const{data,error}=await supabase.from("purchase_orders").select("*,projects(name),approved_by_profile:profiles!purchase_orders_approved_by_fkey(full_name)").order("po_date",{ascending:false});fail(error);return(data||[]).map(row=>poFromRow(row as Row));}
export async function createPurchaseOrder(input:Row){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();const equipmentType=text(input.equipmentType)==="Consumable"?"Consumable":"Asset";const quantity=Math.max(1,num(input.quantity,1)),unitPrice=num(input.unitPrice);const id=text(input.id)||`IBT-PO-${Date.now().toString().slice(-7)}`,projectId=await projectIdByName(text(input.project));const{data,error}=await supabase.from("purchase_orders").insert({id,project_id:projectId,po_date:text(input.date)||new Date().toISOString().slice(0,10),supplier:text(input.supplier,"To be confirmed"),equipment:text(input.equipment),equipment_type:equipmentType,budget_branch:text(input.budgetBranch,equipmentType==="Asset"?"Equipment":"Consumables"),location:text(input.location),quantity,unit_price:unitPrice,status:"Review",purchase_request_id:text(input.purchaseRequestId)||null,created_by:user?.id||null}).select("*,projects(name),approved_by_profile:profiles!purchase_orders_approved_by_fkey(full_name)").single();fail(error);await insertNotifications(await recipientsForRoles(["FINANCE"]),"purchase_order",id,"Purchase order submitted for finance review",`${id} · ${text(input.equipment)} · ${text(input.project)} · QAR ${(quantity*unitPrice).toLocaleString()}.`);await recalculateProjectFinancials(projectId);return poFromRow(data as Row);}

async function createAssetsFromReceivedPo(order:PurchaseOrderRecord){
  if(order.equipmentType!=="Asset"||order.assetCreated||!order.receivedAt)return [];
  const supabase=await createClient(),projectId=await projectIdByName(order.project);
  const inputs=Array.from({length:order.quantity},(_,index)=>{
    const id=`AST-${order.id.replace(/[^A-Z0-9]/gi,"").slice(-6)}-${String(index+1).padStart(2,"0")}`;
    const input={name:order.quantity>1?`${order.equipment} #${index+1}`:order.equipment,category:/3d printer/i.test(order.equipment)?"FDM 3D Printer":"Procured Asset",project:order.project,location:order.location,manufacturer:order.receivedManufacturer||"To be confirmed",model:order.receivedModel||"To be confirmed",serialNumber:order.quantity===1?(order.receivedSerialNumber||"Pending"):(order.receivedSerialNumber?`${order.receivedSerialNumber}-${index+1}`:"Pending"),installedOn:order.receivedAt,warrantyUntil:order.receivedWarrantyUntil,acquisitionCost:order.unitPrice,residualValue:0,usefulLifeYears:5,purchaseDate:order.receivedAt,status:"Operational",health:100};
    return{id,input,row:{...assetInsert(input,id),project_id:projectId,purchase_order_id:order.id,status:"Operational",tone:"healthy",health:100}};
  });
  fail((await supabase.from("assets").upsert(inputs.map(x=>x.row),{onConflict:"id",ignoreDuplicates:true})).error);
  fail((await supabase.from("asset_financials").upsert(inputs.map(x=>assetFinance(x.input,x.id,projectId)),{onConflict:"asset_id"})).error);
  fail((await supabase.from("purchase_orders").update({asset_created:true}).eq("id",order.id)).error);
  for(const x of inputs){await supabase.from("service_events").upsert({id:`EVT-${x.id}-RECEIVED`,asset_id:x.id,type:"Asset Registered",title:"Equipment received and asset registered",performed_by:"Procurement / Technical Services",performed_at:`${order.receivedAt}T12:00:00Z`,notes:`Received from ${order.supplier} via ${order.id}. Condition: ${order.receivedCondition||"Not recorded"}.`},{onConflict:"id"});}
  return inputs.map(x=>x.id);
}

export async function updatePurchaseOrder(id:string,input:Row,approvedBy?:string){const current=(await listPurchaseOrders()).find(order=>order.id===id);if(!current)return undefined;const next={...current,...input};const supabase=await createClient();const quantity=Math.max(1,num(next.quantity)),unitPrice=num(next.unitPrice);const requestedStatus=text(input.status);const status=["Review","Approved","Rejected"].includes(requestedStatus)?requestedStatus:current.status;const approvalFields=status==="Approved"&&current.status!=="Approved"?{approved_by:approvedBy||null,approved_at:new Date().toISOString()}:(status==="Rejected"?{approved_by:null,approved_at:null}:{});const{data,error}=await supabase.from("purchase_orders").update({po_date:next.date,supplier:next.supplier,equipment:next.equipment,equipment_type:next.equipmentType,budget_branch:next.budgetBranch,project_id:await projectIdByName(next.project),location:next.location,quantity,unit_price:unitPrice,status,...approvalFields}).eq("id",id).select("*,projects(name),approved_by_profile:profiles!purchase_orders_approved_by_fkey(full_name)").single();fail(error);const order=poFromRow(data as Row);if(text(next.equipment).trim()&&text(next.equipment).trim()!==current.equipment.trim())fail((await supabase.from("assets").update({name:text(next.equipment).trim()}).eq("purchase_order_id",id)).error);if(data.purchase_request_id)await supabase.from("purchase_requests").update({status:status==="Approved"?"PO approved — awaiting receipt":status==="Rejected"?"PO rejected":"PO in review"}).eq("id",data.purchase_request_id);if(data.purchase_request_id)await syncOrderProgressByRequest(data.purchase_request_id,{purchaseOrderId:id,itemName:text(next.equipment).trim(),supplier:order.supplier,status:status==="Approved"?"PO Issued":status==="Rejected"?"Rejected":"Under Review"});await notifyProject(data.project_id,"purchase_order",id,`Purchase order ${status.toLowerCase()}`,`${id} is ${status.toLowerCase()}.`);await recalculateProjectFinancials(data.project_id);return order;}

export async function receivePurchaseOrder(id:string,input:Row,receivedBy?:string){
  const current=(await listPurchaseOrders()).find(order=>order.id===id);if(!current)throw new Error("PO not found");
  if(current.status!=="Approved")throw new Error("Only an approved purchase order can be received");
  if(current.equipmentType!=="Asset")throw new Error("This receiving workflow is for asset purchase orders");
  if(current.assetCreated)throw new Error("Assets have already been created for this purchase order");
    const receivedAt=text(input.receivedAt)||new Date().toISOString().slice(0,10),condition=text(input.condition,"New"),manufacturer=text(input.manufacturer),model=text(input.model),serialNumber=text(input.serialNumber),location=text(input.location||current.location),warrantyUntil=text(input.warrantyUntil);
  if(!manufacturer||!model||!serialNumber||!location)throw new Error("Manufacturer, model, serial number and location are required at receiving");
  const supabase=await createClient(),projectId=await projectIdByName(current.project);
  const{data,error}=await supabase.from("purchase_orders").update({status:condition==="Received damaged"?"Received damaged":"Received",received_at:receivedAt,received_condition:condition,received_by:receivedBy||null,received_manufacturer:manufacturer,received_model:model,received_serial_number:serialNumber,received_warranty_until:warrantyUntil||null,location}).eq("id",id).select("*,projects(name),approved_by_profile:profiles!purchase_orders_approved_by_fkey(full_name)").single();fail(error);
  const order=poFromRow(data as Row);const assetIds=await createAssetsFromReceivedPo(order);
  if(data.purchase_request_id)await supabase.from("purchase_requests").update({status:"Received — asset registered"}).eq("id",data.purchase_request_id);
  if(data.purchase_request_id)await syncOrderProgressByRequest(data.purchase_request_id,{progressPercentage:100,status:"Received",actualDeliveryDate:receivedAt,supplier:order.supplier},receivedBy);
  await notifyProject(projectId,"purchase_order",id,"Equipment received",`${order.equipment} received under ${id}; asset registered.`);await recalculateProjectFinancials(projectId);
  return{order:{...order,assetCreated:true},assetIds};
}

export async function deletePurchaseOrder(id:string){const supabase=await createClient();await supabase.from("purchase_requests").update({purchase_order_id:null}).eq("purchase_order_id",id);const{error,count}=await supabase.from("purchase_orders").delete({count:"exact"}).eq("id",id);fail(error);return Boolean(count);}

function approvalFromRow(row:Row){return{id:num(row.id),approverId:text(row.approver_id),approverName:relName(row.approver),role:text(row.approver_role),decision:text(row.decision),signature:text(row.signature_text),signedAt:text(row.signed_at)};}
function prFromRow(row:Row){return{id:text(row.id),date:text(row.request_date),project:relName(row.project),fundingProject:relName(row.funding_project),itemName:text(row.item_name),reason:text(row.reason),budgetBranch:text(row.budget_branch),amount:num(row.amount),description:text(row.description),requester:text(row.requester),status:text(row.status),purchaseOrderId:text(row.purchase_order_id)||null,proformaInvoicePath:text(row.proforma_invoice_path)||undefined,proformaInvoiceName:text(row.proforma_invoice_name)||undefined,proformaInvoiceUrl:text(row.proforma_invoice_url)||undefined,optionalAttachmentPath:text(row.optional_attachment_path)||undefined,optionalAttachmentName:text(row.optional_attachment_name)||undefined,optionalAttachmentUrl:text(row.optional_attachment_url)||undefined,approvals:Array.isArray(row.approvals)?(row.approvals as Row[]).map(approvalFromRow):[]};}
export async function listPurchaseRequests(){const supabase=await createClient();const{data,error}=await supabase.from("purchase_requests").select("*,project:projects!purchase_requests_project_id_fkey(name),funding_project:projects!purchase_requests_funding_project_id_fkey(name)").order("request_date",{ascending:false});fail(error);const rows=data||[];const paths=[...new Set(rows.flatMap(row=>[text(row.proforma_invoice_path),text(row.optional_attachment_path)]).filter(Boolean))];const urls=new Map<string,string>();if(paths.length){const{data:signed}=await supabase.storage.from("purchase-order-pdfs").createSignedUrls(paths,3600);for(const item of signed||[])if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl)}const ids=rows.map(row=>text(row.id));const approvals=ids.length?await supabase.from("purchase_request_approvals").select("*,approver:profiles!purchase_request_approvals_approver_id_fkey(full_name)").in("purchase_request_id",ids).order("signed_at"):{data:[],error:null};fail(approvals.error);const byRequest=new Map<string,Row[]>();for(const approval of approvals.data||[]){const key=text(approval.purchase_request_id);byRequest.set(key,[...(byRequest.get(key)||[]),approval as Row]);}return rows.map(row=>prFromRow({...row,proforma_invoice_url:urls.get(text(row.proforma_invoice_path))||"",optional_attachment_url:urls.get(text(row.optional_attachment_path))||"",approvals:byRequest.get(text(row.id))||[]} as Row));}
export async function createPurchaseRequest(input:Row){const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Authentication required");const itemName=text(input.itemName).trim();if(!itemName)throw new Error("Item name is required");const id=text(input.id)||`IBT-PR-${Date.now().toString().slice(-7)}`,projectId=await projectIdByName(text(input.project)),fundingId=await projectIdByName(text(input.fundingProject||input.project));const{data,error}=await supabase.from("purchase_requests").insert({id,project_id:projectId,funding_project_id:fundingId,request_date:text(input.date)||new Date().toISOString().slice(0,10),item_name:itemName,reason:text(input.reason),budget_branch:text(input.budgetBranch,"Equipment"),amount:num(input.amount),description:text(input.description),requester:text(input.requester),requester_user_id:user.id,status:text(input.status,"Submitted"),proforma_invoice_path:text(input.proformaInvoicePath)||null,proforma_invoice_name:text(input.proformaInvoiceName)||null,optional_attachment_path:text(input.optionalAttachmentPath)||null,optional_attachment_name:text(input.optionalAttachmentName)||null}).select("*,project:projects!purchase_requests_project_id_fkey(name),funding_project:projects!purchase_requests_funding_project_id_fkey(name)").single();fail(error);await createOrderProgressForRequest(data as Row,user.id);await notifyProject(projectId,"purchase_request",id,"Purchase request awaiting PM review",`${itemName} · ${id} submitted for ${text(input.project)}. Review attachments, price and sign the approval.`);await insertNotifications(await recipientsForRoles(["FINANCE","CEO","ADMIN"]),"purchase_request",id,"Purchase request awaiting approval",`${itemName} · ${id} · QAR ${num(input.amount).toLocaleString()} · review attachments and sign.`);await recalculateProjectFinancials(projectId);return prFromRow(data as Row);}

export async function recordPurchaseRequestApproval(id:string,actor:UserRecord,decision:string,signature:string){const allowed=["PROJECT_MANAGER","CEO","FINANCE","ADMIN"];if(!allowed.includes(actor.role))throw new Error("This role cannot approve purchase requests");const request=(await listPurchaseRequests()).find(item=>item.id===id);if(!request)throw new Error("Request not found");const normalized=decision.toLowerCase();if(!["approved","rejected"].includes(normalized))throw new Error("Choose approve or reject");if(signature.trim().length<2)throw new Error("Signature is required");const supabase=await createClient();const{error}=await supabase.from("purchase_request_approvals").insert({purchase_request_id:id,approver_id:actor.id,approver_role:actor.role,decision:normalized,signature_text:signature.trim()});fail(error);const approvals=[...request.approvals,{role:actor.role,decision:normalized}];if(normalized==="rejected"){fail((await supabase.from("purchase_requests").update({status:"Rejected"}).eq("id",id)).error);await syncOrderProgressByRequest(id,{progressPercentage:0,status:"Rejected"},actor.id);}else{const pmApproved=approvals.some(item=>item.role==="PROJECT_MANAGER"&&item.decision==="approved"),financeApproved=approvals.some(item=>item.role==="FINANCE"&&item.decision==="approved");if(pmApproved&&financeApproved){await updatePurchaseRequest(id,{decision:"approved"},actor.id);}else{fail((await supabase.from("purchase_requests").update({status:"Under approval"}).eq("id",id)).error);}}return (await listPurchaseRequests()).find(item=>item.id===id);}
export async function createOrderProgressForRequest(request: Row, createdBy?: string) { const supabase=await createClient(); const projectId=text(request.project_id), itemName=text(request.item_name||request.reason||request.description,"Purchase request item"); const { data, error } = await supabase.from("order_progress").upsert({purchase_request_id:text(request.id),project_id:projectId,requested_by:text(request.requester_user_id)||createdBy||null,item_name:itemName,description:text(request.description),quantity:Math.max(1,num(request.quantity,1)),progress_percentage:0,status:"Purchase Request Created",updated_by:createdBy||null},{onConflict:"purchase_request_id"}).select("id").single(); fail(error); const progressId=text(data.id); await supabase.from("order_progress_updates").insert({order_progress_id:progressId,previous_percentage:0,new_percentage:0,previous_status:"Purchase Request Created",new_status:"Purchase Request Created",note:"Purchase Request created.",created_by:createdBy||null}); const {data:members,error:memberError}=await supabase.from("user_project_access").select("user_id").eq("project_id",projectId).eq("can_view",true); fail(memberError); const users=[text(request.requester_user_id),...(members||[]).map(row=>text(row.user_id))].filter(Boolean); await supabase.from("order_progress_users").upsert([...new Set(users)].map(user_id=>({order_progress_id:progressId,user_id,relationship_type:user_id===text(request.requester_user_id)?"requester":"project_member"})),{onConflict:"order_progress_id,user_id,relationship_type"}); return progressId; }
function orderProgressUpdateFromRow(row:Row):OrderProgressUpdateRecord{return{id:num(row.id),previousPercentage:num(row.previous_percentage),newPercentage:num(row.new_percentage),previousStatus:text(row.previous_status),newStatus:text(row.new_status),previousExpectedDeliveryDate:row.previous_expected_delivery_date?text(row.previous_expected_delivery_date):null,newExpectedDeliveryDate:row.new_expected_delivery_date?text(row.new_expected_delivery_date):null,previousActualDeliveryDate:row.previous_actual_delivery_date?text(row.previous_actual_delivery_date):null,newActualDeliveryDate:row.new_actual_delivery_date?text(row.new_actual_delivery_date):null,previousSupplier:text(row.previous_supplier),newSupplier:text(row.new_supplier),previousTrackingReference:text(row.previous_tracking_reference),newTrackingReference:text(row.new_tracking_reference),note:text(row.note),createdBy:row.created_by?text(row.created_by):null,createdByName:relName(row.created_by_profile),createdAt:text(row.created_at)};}
function orderProgressFromRow(row:Row,updates:OrderProgressUpdateRecord[]=[]):OrderProgressRecord{return{id:text(row.id),purchaseRequestId:text(row.purchase_request_id),purchaseOrderId:row.purchase_order_id?text(row.purchase_order_id):null,projectId:text(row.project_id),project:relName(row.projects),requestedBy:row.requested_by?text(row.requested_by):null,requestedByName:relName(row.requester_profile),responsibleUserId:row.responsible_user_id?text(row.responsible_user_id):null,responsibleUserName:relName(row.responsible_profile),itemName:text(row.item_name),description:text(row.description),quantity:num(row.quantity,1),supplier:text(row.supplier),progressPercentage:num(row.progress_percentage),status:text(row.status),expectedDeliveryDate:row.expected_delivery_date?text(row.expected_delivery_date):null,actualDeliveryDate:row.actual_delivery_date?text(row.actual_delivery_date):null,trackingReference:text(row.tracking_reference),createdAt:text(row.created_at),updatedAt:text(row.updated_at),updatedBy:row.updated_by?text(row.updated_by):null,updatedByName:relName(row.updated_by_profile),updates};}
const orderProgressSelect="*,projects(name),requester_profile:profiles!order_progress_requested_by_fkey(full_name),responsible_profile:profiles!order_progress_responsible_user_id_fkey(full_name),updated_by_profile:profiles!order_progress_updated_by_fkey(full_name)";
export async function listOrderProgress(){const supabase=await createClient();const{data,error}=await supabase.from("order_progress").select(orderProgressSelect).order("updated_at",{ascending:false});fail(error);return(data||[]).map(row=>orderProgressFromRow(row as Row));}
export async function getOrderProgress(id:string){const supabase=await createClient();const{data,error}=await supabase.from("order_progress").select(orderProgressSelect).eq("id",id).maybeSingle();fail(error);if(!data)return undefined;const history=await supabase.from("order_progress_updates").select("*,created_by_profile:profiles!order_progress_updates_created_by_fkey(full_name)").eq("order_progress_id",id).order("created_at",{ascending:false});fail(history.error);return orderProgressFromRow(data as Row,(history.data||[]).map(row=>orderProgressUpdateFromRow(row as Row)));}
async function notifyOrderProgressUsers(progressId:string,title:string,message:string){const admin=createAdminClient();const{data:item,error:itemError}=await admin.from("order_progress").select("project_id,requested_by,responsible_user_id").eq("id",progressId).single();fail(itemError);const{data:members,error:memberError}=await admin.from("user_project_access").select("user_id").eq("project_id",item.project_id).eq("can_view",true);fail(memberError);const users=[text(item.requested_by),text(item.responsible_user_id),...(members||[]).map(row=>text(row.user_id))].filter(Boolean);await insertNotifications([...new Set(users)],"order_progress",progressId,title,message);}
export async function updateOrderProgress(id:string,input:Row,actor:UserRecord){const current=await getOrderProgress(id);if(!current)throw new Error("Order Progress item not found");const percentage=Math.max(0,Math.min(100,Math.trunc(num(input.progressPercentage,current.progressPercentage)))),status=text(input.status,current.status),expected=input.expectedDeliveryDate===undefined?current.expectedDeliveryDate:text(input.expectedDeliveryDate)||null,actual=input.actualDeliveryDate===undefined?current.actualDeliveryDate:text(input.actualDeliveryDate)||null,supplier=text(input.supplier,current.supplier),tracking=text(input.trackingReference,current.trackingReference),responsible=input.responsibleUserId===undefined?current.responsibleUserId:text(input.responsibleUserId)||null,purchaseOrderId=input.purchaseOrderId===undefined?current.purchaseOrderId:text(input.purchaseOrderId)||null,note=text(input.note).trim();const supabase=await createClient();const{data,error}=await supabase.from("order_progress").update({purchase_order_id:purchaseOrderId,progress_percentage:percentage,status,expected_delivery_date:expected,actual_delivery_date:actual,supplier,tracking_reference:tracking,responsible_user_id:responsible,updated_by:actor.id}).eq("id",id).select(orderProgressSelect).single();fail(error);fail((await supabase.from("order_progress_updates").insert({order_progress_id:id,previous_percentage:current.progressPercentage,new_percentage:percentage,previous_status:current.status,new_status:status,previous_expected_delivery_date:current.expectedDeliveryDate,new_expected_delivery_date:expected,previous_actual_delivery_date:current.actualDeliveryDate,new_actual_delivery_date:actual,previous_supplier:current.supplier,new_supplier:supplier,previous_tracking_reference:current.trackingReference,new_tracking_reference:tracking,note,created_by:actor.id})).error);if(responsible)await supabase.from("order_progress_users").upsert({order_progress_id:id,user_id:responsible,relationship_type:"responsible"},{onConflict:"order_progress_id,user_id,relationship_type"});await notifyOrderProgressUsers(id,"Order Progress Updated",`${current.itemName} · ${current.progressPercentage}% → ${percentage}% · ${status}${note?` · ${note}`:""}`);return getOrderProgress(id);}
export async function syncOrderProgressByRequest(requestId:string,patch:Row,actorId?:string){const supabase=await createClient();const{data,error}=await supabase.from("order_progress").select("id").eq("purchase_request_id",requestId).maybeSingle();fail(error);if(!data)return;const actor=actorId?await findUserById(actorId):await findUserById((await supabase.auth.getUser()).data.user?.id||"");if(actor)await updateOrderProgress(text(data.id),patch,actor);}
async function createPurchaseOrderFromApprovedRequest(request:ReturnType<typeof prFromRow>){
  if(request.purchaseOrderId)return request.purchaseOrderId;
  const equipmentType=request.budgetBranch.toLowerCase()==="consumables"?"Consumable":"Asset";
  const order=await createPurchaseOrder({
    purchaseRequestId:request.id,project:request.project,date:request.date,
    supplier:"To be confirmed",equipment:request.itemName||request.reason||request.description||"Purchase request item",
    equipmentType,budgetBranch:request.budgetBranch||"Equipment",location:"IBTECHAR_STORE",
    quantity:1,unitPrice:request.amount,
  });
  const supabase=await createClient();
  fail((await supabase.from("purchase_requests").update({purchase_order_id:order.id,status:"Approved — PO ready for procurement"}).eq("id",request.id)).error);
  await syncOrderProgressByRequest(request.id,{purchaseOrderId:order.id,progressPercentage:10,status:"PO Issued",supplier:order.supplier});
  await notifyProject(await projectIdByName(request.project),"purchase_order",order.id,"Purchase order ready for procurement",`${order.id} was created from approved request ${request.id}.`);
  return order.id;
}
export async function updatePurchaseRequest(id:string,input:Row,approvedBy?:string){const current=(await listPurchaseRequests()).find(item=>item.id===id);if(!current)return undefined;const decision=text(input.decision).toLowerCase();const decisionStatus=decision==="approved"?"Approved":decision==="rejected"?"Rejected":text(input.status||current.status);const next={...current,...input,status:decisionStatus};const supabase=await createClient();const requestUpdate={project_id:await projectIdByName(next.project),funding_project_id:await projectIdByName(next.fundingProject),item_name:text(next.itemName).trim(),reason:next.reason,budget_branch:next.budgetBranch,amount:num(next.amount),description:next.description,requester:next.requester,status:decisionStatus,...(decision==="approved"?{approved_by:approvedBy||null,approved_at:new Date().toISOString()}:{})};const{data,error}=await supabase.from("purchase_requests").update(requestUpdate).eq("id",id).select("*,project:projects!purchase_requests_project_id_fkey(name),funding_project:projects!purchase_requests_funding_project_id_fkey(name)").single();fail(error);const saved=data as Row;let orderId=text(saved.purchase_order_id);if(decision==="approved")orderId=await createPurchaseOrderFromApprovedRequest(prFromRow(saved));await notifyProject(text(saved.project_id),"purchase_request",id,`Purchase request ${decision||"updated"}`,`${id} status changed to ${decisionStatus}.`);await recalculateProjectFinancials(text(saved.project_id));const updated=prFromRow({...saved,purchase_order_id:orderId} as Row);return{request:updated,purchaseOrderId:orderId};}

function notificationLink(type:string,id:string){if(type.includes("work_order"))return`/work-orders?open=${encodeURIComponent(id)}`;if(type==="purchase_order")return`/procurement?open=${encodeURIComponent(id)}`;if(type==="purchase_request")return`/purchase-requests?open=${encodeURIComponent(id)}`;if(type==="payment_request")return`/finance/payments?open=${encodeURIComponent(id)}`;if(type==="budget_request")return`/project-budgets?open=${encodeURIComponent(id)}`;if(type==="customer_invoice_request")return`/finance/invoicing?open=${encodeURIComponent(id)}`;if(type==="order_progress")return`/order-progress?open=${encodeURIComponent(id)}`;if(type==="project_task")return`/tasks?open=${encodeURIComponent(id)}`;if(type==="asset")return`/assets/${encodeURIComponent(id)}`;return"/";}
export async function insertNotifications(userIds:string[],entityType:string,entityId:string,title:string,message:string){const ids=[...new Set(userIds.map(String).filter(Boolean))];if(!ids.length)return;const admin=createAdminClient();fail((await admin.from("notifications").insert(ids.map(user_id=>({user_id,entity_type:entityType,entity_id:entityId,title,message})))).error);}
export async function recipientsForFinancePermission(permission:string){const columns:Record<string,string>={budget_request:"can_budget_request",budget_review:"can_budget_review",budget_final_approve:"can_budget_final_approve",payment_request:"can_payment_request",payment_review:"can_payment_review",payment_final_approve:"can_payment_final_approve",payment_mark_paid:"can_payment_mark_paid",invoice_request:"can_invoice_request",invoice_review:"can_invoice_review",invoice_issue:"can_invoice_issue"};const column=columns[permission];if(!column)throw new Error(`Unknown finance notification permission: ${permission}`);const admin=createAdminClient();const{data:permissions,error}=await admin.from("finance_user_permissions").select("user_id").eq(column,true);fail(error);const ids=(permissions||[]).map(row=>row.user_id);if(!ids.length)return[];const{data:profiles,error:profileError}=await admin.from("profiles").select("id").eq("active",true).in("id",ids);fail(profileError);return(profiles||[]).map(row=>row.id);}
async function notifyProject(projectId:string,entityType:string,entityId:string,title:string,message:string){const admin=createAdminClient();const{data,error}=await admin.from("user_project_access").select("user_id").eq("project_id",projectId).eq("can_view",true);fail(error);await insertNotifications((data||[]).map(row=>row.user_id),entityType,entityId,title,message);}
export async function listNotificationsForUser(userId:string,entityId?:string){const supabase=await createClient();let query=supabase.from("notifications").select("id,entity_type,entity_id,title,message,read_at,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(entityId?100:25);if(entityId)query=query.eq("entity_id",entityId);const{data,error}=await query;fail(error);return(data||[]).map(row=>({id:row.id,entityType:row.entity_type,entityId:row.entity_id,title:row.title,message:row.message,readAt:row.read_at,createdAt:row.created_at,link:notificationLink(row.entity_type,row.entity_id)}));}
export async function markNotificationReadForUser(id:number,userId:string){const supabase=await createClient();const{error,count}=await supabase.from("notifications").update({read_at:new Date().toISOString()},{count:"exact"}).eq("id",id).eq("user_id",userId);fail(error);return Boolean(count);}

export async function listProjectExpenses(projectName?:string){const supabase=await createClient();let query=supabase.from("project_expenses").select("*,projects(name),profiles(full_name)").order("incurred_on",{ascending:false});if(projectName){const projectId=await projectIdByName(projectName);query=query.eq("project_id",projectId);}const{data,error}=await query;fail(error);return(data||[]).map(row=>({id:row.id,projectId:row.project_id,projectName:relName(row.projects),budgetBranch:row.budget_branch,expenseType:row.expense_type,description:row.description,amount:num(row.amount),incurredOn:row.incurred_on,status:row.status,assetId:row.asset_id,createdBy:relName(row.profiles)})) as ProjectExpenseRecord[];}

export async function listProjectChildren(parentProjectId:string){
  const supabase = await createClient();
  const {data,error} = await supabase.from("projects")
    .select("*,assets(count)")
    .eq("parent_project_id",parentProjectId).order("name");
  fail(error);
  const withCounts = (data || []).map(row => ({
    ...row,
    asset_count: Array.isArray(row.assets) ? num(row.assets[0]?.count) : 0,
  })) as Row[];
  return (await attachProjectRollups(withCounts)).map(projectFromRow);
}
export async function getProjectClosureReadiness(projectId:string){
  const project=await getProject(projectId);if(!project)throw new Error("Project not found");
  const supabase=await createClient();
  const[
    {data:children,error:childrenError},{data:prs,error:prError},{data:pos,error:poError},
    {data:payments,error:paymentError},{data:items,error:itemError},{data:risks,error:riskError},
    {data:invoices,error:invoiceError}
  ]=await Promise.all([
    supabase.from("projects").select("id,status").eq("parent_project_id",projectId),
    supabase.from("purchase_requests").select("id,status").eq("funding_project_id",projectId),
    supabase.from("purchase_orders").select("id,status").eq("project_id",projectId),
    supabase.from("payment_requests").select("id,current_status").eq("project_id",projectId),
    supabase.from("trackable_items").select("id,status").eq("project_id",projectId),
    supabase.from("risk_issues").select("id,status").eq("project_id",projectId),
    supabase.from("customer_invoices").select("id,status").eq("project_id",projectId)
  ]);
  [childrenError,prError,poError,paymentError,itemError,riskError,invoiceError].forEach(error=>fail(error));
  const blockers:string[]=[];
  const count=(rows:any[],predicate:(row:any)=>boolean,label:string)=>{const n=(rows||[]).filter(predicate).length;if(n)blockers.push(`${n} ${label}`)};
  count(children||[],r=>text(r.status).toLowerCase()!=="closed","sub-project(s) are not closed");
  count(prs||[],r=>!["rejected","cancelled","completed","received"].some(s=>text(r.status).toLowerCase().includes(s)),"purchase request(s) remain open");
  count(pos||[],r=>!["rejected","cancelled","received","received damaged","delivered"].includes(text(r.status).toLowerCase()),"purchase order(s) remain open");
  count(payments||[],r=>!["PAID","REJECTED","CANCELLED"].includes(text(r.current_status)),"payment request(s) remain open");
  count(items||[],r=>!["completed","archived","cancelled"].includes(text(r.status).toLowerCase()),"task/activity/KPI item(s) remain open");
  count(risks||[],r=>!["closed","resolved","accepted"].includes(text(r.status).toLowerCase()),"risk/issue(s) remain open");
  count(invoices||[],r=>!["PAID","CANCELLED"].includes(text(r.status)),"customer invoice(s) remain unsettled");
  return{project,ready:blockers.length===0,blockers};
}

export async function closeProject(projectId:string,actor:UserRecord,closureNote:string){
  const readiness=await getProjectClosureReadiness(projectId);
  if(!readiness.ready)throw new Error(`Project cannot be closed: ${readiness.blockers.join("; ")}`);
  const supabase=await createClient();
  fail((await supabase.from("projects").update({status:"Closed",closed_at:new Date().toISOString(),closed_by:actor.id,closure_note:text(closureNote)}).eq("id",projectId)).error);
  return getProject(projectId);
}
export async function reopenProject(projectId:string){
  const supabase=await createClient();
  fail((await supabase.from("projects").update({status:"Active",closed_at:null,closed_by:null,closure_note:""}).eq("id",projectId)).error);
  return getProject(projectId);
}

export async function createProjectExpense(input:Row,actor?:UserRecord){const projectId=text(input.projectId),project=await getProject(projectId);if(!project)throw new Error("A valid project is required");const amount=num(input.amount);if(amount<=0)throw new Error("Expense amount must be greater than zero");const supabase=await createClient(),id=`EXP-${Date.now().toString().slice(-8)}`,expenseType=text(input.expenseType,"Consumable"),incurredOn=text(input.incurredOn)||new Date().toISOString().slice(0,10);let assetId:string|null=null;if(expenseType==="Asset"){const asset=await createAsset({name:text(input.assetName||input.description,"New project asset"),category:text(input.assetCategory,"Procured Asset"),project:project.name,location:text(input.location,"IBTECHAR_STORE"),acquisitionCost:amount,residualValue:num(input.residualValue),usefulLifeYears:num(input.usefulLifeYears,5),purchaseDate:incurredOn,owner:text(input.owner,"Technical Services")});assetId=asset.id;await notifyProject(projectId,"asset",asset.id,"Asset added from project expense",`${asset.name} was recorded under ${project.name}.`);}const{data,error}=await supabase.from("project_expenses").insert({id,project_id:projectId,budget_branch:text(input.budgetBranch,"Consumables"),expense_type:expenseType,description:text(input.description,expenseType),amount,incurred_on:incurredOn,status:text(input.status,"Recorded"),asset_id:assetId,created_by:actor?.id||null}).select("*,projects(name),profiles(full_name)").single();fail(error);await recalculateProjectFinancials(projectId);return{id:data.id,projectId:data.project_id,projectName:relName(data.projects),budgetBranch:data.budget_branch,expenseType:data.expense_type,description:data.description,amount:num(data.amount),incurredOn:data.incurred_on,status:data.status,assetId:data.asset_id,createdBy:relName(data.profiles)} as ProjectExpenseRecord;}

function taskFromRow(row:Row):ProjectTaskRecord{return{id:text(row.id),projectId:text(row.project_id),projectName:relName(row.projects),title:text(row.title),description:text(row.description),priority:text(row.priority,"Normal") as ProjectTaskRecord["priority"],assigneeUserId:text(row.assignee_user_id),assigneeName:relName(row.assignee),assignedByUserId:row.assigned_by_user_id?text(row.assigned_by_user_id):null,assignedByName:relName(row.assigner)||null,dueDate:text(row.due_date),status:text(row.status),deferReason:row.defer_reason?text(row.defer_reason):null,responseNote:row.response_note?text(row.response_note):null,respondedAt:row.responded_at?text(row.responded_at):null,createdAt:text(row.created_at)};}
const taskSelect="*,projects(name),assignee:profiles!project_tasks_assignee_user_id_fkey(full_name),assigner:profiles!project_tasks_assigned_by_user_id_fkey(full_name)";
export async function listProjectTasks(filters:{projectName?:string;userId?:string}={}){const supabase=await createClient();let query=supabase.from("project_tasks").select(taskSelect).order("due_date");if(filters.projectName)query=query.eq("project_id",await projectIdByName(filters.projectName));if(filters.userId)query=query.eq("assignee_user_id",filters.userId);const{data,error}=await query;fail(error);return(data||[]).map(row=>taskFromRow(row as Row));}
export async function createProjectTask(input:Row,actor:UserRecord){const projectId=text(input.projectId),assigneeUserId=text(input.assigneeUserId);if(!projectId||!assigneeUserId)throw new Error("Project and assignee are required");const project=await getProject(projectId),assignee=await findUserById(assigneeUserId);if(!project||!assignee?.active)throw new Error("Project or assignee is not available");const dueDate=text(input.dueDate);if(!dueDate)throw new Error("Due date is required");const id=`TSK-${Date.now().toString().slice(-8)}`,priority=["High","Medium","Normal"].includes(text(input.priority))?text(input.priority):"Normal",supabase=await createClient();const{data,error}=await supabase.from("project_tasks").insert({id,project_id:projectId,title:text(input.title),description:text(input.description),priority,assignee_user_id:assigneeUserId,assigned_by_user_id:actor.id,due_date:dueDate,status:"Pending"}).select(taskSelect).single();fail(error);await supabase.from("project_task_updates").insert({task_id:id,actor_user_id:actor.id,event_type:"Assigned",note:text(input.description)});await insertNotifications([assigneeUserId],"project_task",id,"New project task assigned",`${project.name} · ${text(input.title)} · due ${dueDate}.`);return taskFromRow(data as Row);}
export async function respondToProjectTask(id:string,input:Row,actor:UserRecord){const current=(await listProjectTasks()).find(task=>task.id===id);if(!current)return undefined;if(current.assigneeUserId!==actor.id&&!isPlatformAdministrator(actor.role))throw new Error("Only the assigned employee can respond to this task");const action=text(input.action),status=action==="accept"?"Accepted":action==="defer"?"Deferred":action==="complete"?"Completed":"";if(!status)throw new Error("Choose accept, defer, or complete");const note=text(input.note).trim();if(status==="Deferred"&&!note)throw new Error("A reason is required when postponing a task");const supabase=await createClient();const{data,error}=await supabase.from("project_tasks").update({status,defer_reason:status==="Deferred"?note:null,response_note:note||null,responded_at:new Date().toISOString()}).eq("id",id).select(taskSelect).single();fail(error);await supabase.from("project_task_updates").insert({task_id:id,actor_user_id:actor.id,event_type:status,note:note||null});if(current.assignedByUserId)await insertNotifications([current.assignedByUserId],"project_task",id,`Task ${status.toLowerCase()}`,`${current.assigneeName} ${status.toLowerCase()} “${current.title}”.${note?` Note: ${note}`:""}`);return taskFromRow(data as Row);}

export async function listProjectActivities(project?:string){const supabase=await createClient();let query=supabase.from("project_activities").select("*,projects(name)").order("activity_date",{ascending:false});if(project)query=query.eq("project_id",await projectIdByName(project));const{data,error}=await query;fail(error);return(data||[]).map(row=>({id:row.id,project:relName(row.projects),type:row.type,title:row.title,date:row.activity_date,quantity:row.quantity,school:row.school,status:row.status}));}
export async function createProjectActivity(input:Row){const supabase=await createClient(),id=text(input.id)||`ACT-${Date.now()}`;const{data,error}=await supabase.from("project_activities").insert({id,project_id:await projectIdByName(text(input.project)),type:text(input.type,"Workshop"),title:text(input.title),activity_date:text(input.date)||new Date().toISOString().slice(0,10),quantity:num(input.quantity,1),school:text(input.school),status:text(input.status,"Completed")}).select("*,projects(name)").single();fail(error);return{id:data.id,project:relName(data.projects),type:data.type,title:data.title,date:data.activity_date,quantity:data.quantity,school:data.school,status:data.status};}

function workOrderFromRow(row:Row){return{id:text(row.id),assetId:text(row.asset_id),maintenanceTaskId:row.maintenance_task_id?text(row.maintenance_task_id):null,diagnosticSessionId:row.diagnostic_session_id?num(row.diagnostic_session_id):null,title:text(row.title),description:text(row.description),status:text(row.status),priority:text(row.priority),assignee:text(row.assignee),dueDate:text(row.due_date),scheduledStart:text(row.scheduled_start),startedAt:row.started_at?text(row.started_at):null,cancelledAt:row.cancelled_at?text(row.cancelled_at):null,completedAt:row.completed_at?text(row.completed_at):null,completionWork:text(row.completion_work),resolution:text(row.resolution),completionTechnician:text(row.completion_technician),completionPartNote:text(row.completion_part_note),createdAt:text(row.created_at),updatedAt:text(row.updated_at),assetName:relName(row.assets),assetModel:Array.isArray(row.assets)?text((row.assets[0] as Row)?.model):text((row.assets as Row|null)?.model)};}
export async function listWorkOrders(){const supabase=await createClient();const{data,error}=await supabase.from("work_orders").select("*,assets(name,model)").order("created_at",{ascending:false});fail(error);return(data||[]).map(row=>workOrderFromRow(row as Row));}
export async function getWorkOrder(id:string){const supabase=await createClient();const{data,error}=await supabase.from("work_orders").select("*,assets(name,model)").eq("id",id).maybeSingle();fail(error);return data?workOrderFromRow(data as Row):undefined;}
async function recipientsForAssignee(assignee:string){const admin=createAdminClient();const{data,error}=await admin.from("profiles").select("id").eq("active",true).or(`full_name.ilike.${assignee},email.ilike.${assignee}`);fail(error);if(data?.length)return data.map(row=>row.id);const{data:managers,error:managerError}=await admin.from("profiles").select("id,roles!inner(name)").eq("active",true).in("roles.name",["CEO","ADMIN","PROJECT_MANAGER"]);fail(managerError);return(managers||[]).map(row=>row.id);}
export async function createWorkOrder(input:Row){const now=new Date(),stamp=now.getTime().toString().slice(-8),id=text(input.id)||`WO-${stamp}`,taskId=text(input.maintenanceTaskId)||`MT-${stamp}`,assetId=text(input.assetId),title=text(input.title),dueDate=text(input.dueDate)||now.toISOString().slice(0,10),scheduledStart=text(input.scheduledStart)||`${dueDate}T09:00:00Z`,assignee=text(input.assignee,"Unassigned"),supabase=await createClient();fail((await supabase.from("maintenance_tasks").upsert({id:taskId,asset_id:assetId,title,cadence:text(input.cadence,"One-off"),next_due:dueDate,status:"Upcoming",source:text(input.source,"Lab calendar / Work Order Control")},{onConflict:"id"})).error);const{data,error}=await supabase.from("work_orders").insert({id,asset_id:assetId,maintenance_task_id:taskId,diagnostic_session_id:input.diagnosticSessionId?num(input.diagnosticSessionId):null,title,description:text(input.description),status:"Scheduled",priority:text(input.priority,"Normal"),assignee,due_date:dueDate,scheduled_start:scheduledStart}).select("*,assets(name,model)").single();fail(error);const asset=await findAsset(assetId);await insertNotifications(await recipientsForAssignee(assignee),"work_order",id,"New maintenance task assigned",`${asset?.name||assetId} · ${title} · scheduled ${dueDate}.`);return workOrderFromRow(data as Row);}
export async function updateWorkOrder(id:string,input:Row){const current=await getWorkOrder(id);if(!current)return undefined;if((text(input.status).toLowerCase()==="completed"||input.complete===true)&&!text(input.resolution).trim())throw new Error("Resolution is required to complete a work order");const next={...current,...input},now=new Date().toISOString(),startedAt=input.start===true&&!current.startedAt?now:next.startedAt||null,isComplete=text(input.status).toLowerCase()==="completed"||input.complete===true,completedAt=isComplete?(current.completedAt||now):current.completedAt||null,cancelledAt=text(next.status).toLowerCase()==="cancelled"?(next.cancelledAt||now):null,supabase=await createClient();const status=isComplete?"Completed":text(next.status);const completion={completed_at:completedAt,completion_work:isComplete?text(input.completionWork):current.completionWork,resolution:isComplete?text(input.resolution):current.resolution,completion_technician:isComplete?text(input.completionTechnician,current.assignee):current.completionTechnician,completion_part_note:isComplete?text(input.completionPartNote):current.completionPartNote};const{data,error}=await supabase.from("work_orders").update({title:next.title,description:next.description,status,priority:next.priority,assignee:next.assignee,due_date:next.dueDate,scheduled_start:next.scheduledStart,started_at:startedAt,cancelled_at:cancelledAt,...completion}).eq("id",id).select("*,assets(name,model)").single();fail(error);if(next.maintenanceTaskId)await supabase.from("maintenance_tasks").update({title:next.title,next_due:next.dueDate,status:isComplete?"Completed":cancelledAt?"Cancelled":startedAt?"In progress":"Upcoming"}).eq("id",next.maintenanceTaskId);if(input.start===true&&!current.startedAt)await supabase.from("service_events").insert({id:`EVT-${id}-STARTED`,asset_id:current.assetId,type:"Repair Started",title:`Repair started · ${current.title}`,performed_by:next.assignee,performed_at:startedAt,notes:text(next.description)});if(isComplete){await supabase.from("service_events").upsert({id:`EVT-${id}-COMPLETED`,asset_id:current.assetId,type:"Repair Completed",title:`Repair completed · ${current.title}`,performed_by:text(input.completionTechnician,current.assignee),performed_at:completedAt,notes:`${text(input.resolution)}${text(input.completionPartNote)?` · Part/note: ${text(input.completionPartNote)}`:""}`},{onConflict:"id"});fail((await supabase.from("assets").update({status:"Operational",tone:"healthy",health:100}).eq("id",current.assetId)).error);}const order=workOrderFromRow(data as Row);await insertNotifications(await recipientsForAssignee(order.assignee),"work_order",id,`Work order ${order.status}`,`${order.assetName} · ${order.title} · ${order.status} · due ${order.dueDate}.`);return order;}

export async function cancelWorkOrder(id:string){return updateWorkOrder(id,{status:"Cancelled"});}
export async function listMaintenanceTasks(){const supabase=await createClient();const{data,error}=await supabase.from("maintenance_tasks").select("*,assets(name),work_orders(id)").order("next_due");fail(error);return(data||[]).map(row=>({id:row.id,assetId:row.asset_id,title:row.title,cadence:row.cadence,nextDue:row.next_due,status:row.status,source:row.source,workOrderId:Array.isArray(row.work_orders)?row.work_orders[0]?.id:null,assetName:relName(row.assets)}));}
export async function assetBundle(id:string){const supabase=await createClient();const[asset,tasks,orders,events,alerts,rawAsset,diagnostics]=await Promise.all([findAsset(id),supabase.from("maintenance_tasks").select("*,work_orders(id)").eq("asset_id",id),supabase.from("work_orders").select("*,assets(name,model)").eq("asset_id",id),supabase.from("service_events").select("*").eq("asset_id",id),supabase.from("alerts").select("*").eq("asset_id",id).eq("resolved",false),supabase.from("assets").select("purchase_order_id").eq("id",id).maybeSingle(),supabase.from("diagnostic_sessions").select("id,observed_symptom,result_json,created_at").eq("asset_id",id).order("created_at")]);fail(tasks.error);fail(orders.error);fail(events.error);fail(alerts.error);fail(rawAsset.error);fail(diagnostics.error);let purchaseOrder=null;if(rawAsset.data?.purchase_order_id){const po=await supabase.from("purchase_orders").select("id,po_date,supplier,equipment,total,status,received_at,received_condition,received_manufacturer,received_model,received_serial_number,received_warranty_until").eq("id",rawAsset.data.purchase_order_id).maybeSingle();fail(po.error);purchaseOrder=po.data;}return{asset:asset?{...asset,purchaseOrderId:rawAsset.data?.purchase_order_id||undefined}:asset,purchaseOrder,tasks:(tasks.data||[]).map(row=>({id:row.id,assetId:row.asset_id,title:row.title,cadence:row.cadence,nextDue:row.next_due,status:row.status,source:row.source,workOrderId:Array.isArray(row.work_orders)?row.work_orders[0]?.id:null})),orders:(orders.data||[]).map(row=>workOrderFromRow(row as Row)),events:(events.data||[]).map(row=>({id:row.id,assetId:row.asset_id,type:row.type,title:row.title,performedBy:row.performed_by,performedAt:row.performed_at,notes:row.notes})),diagnostics:(diagnostics.data||[]).map(row=>({id:row.id,symptom:row.observed_symptom,result:row.result_json,createdAt:row.created_at})),alerts:(alerts.data||[]).map(row=>({id:row.id,assetId:row.asset_id,severity:row.severity,title:row.title,message:row.message,triggeredAt:row.triggered_at}))};}

export async function recalculateProjectFinancials(projectId:string){
  const supabase=await createClient();
  const[
    {data:expenses,error:expenseError},
    {data:requests,error:requestError},
    {data:orders,error:orderError},
    {data:payments,error:paymentError}
  ]=await Promise.all([
    supabase.from("project_expenses").select("amount,payment_request_id").eq("project_id",projectId),
    supabase.from("purchase_requests").select("amount,status,purchase_order_id").eq("funding_project_id",projectId),
    supabase.from("purchase_orders").select("id,total,status").eq("project_id",projectId),
    supabase.from("payment_requests").select("id,amount,current_status,purchase_order_id").eq("project_id",projectId)
  ]);
  fail(expenseError);fail(requestError);fail(orderError);fail(paymentError);
  const expensePaymentIds=new Set((expenses||[]).map(row=>text(row.payment_request_id)).filter(Boolean));
  const spent=
    (expenses||[]).reduce((sum,row)=>sum+num(row.amount),0)+
    (orders||[]).filter(row=>["received","received damaged","delivered"].includes(text(row.status).toLowerCase())).reduce((sum,row)=>sum+num(row.total),0)+
    (payments||[]).filter(row=>text(row.current_status)==="PAID"&&!row.purchase_order_id&&!expensePaymentIds.has(text(row.id))).reduce((sum,row)=>sum+num(row.amount),0);
  const committed=
    (requests||[]).filter(row=>!row.purchase_order_id&&!["rejected","cancelled"].some(s=>text(row.status).toLowerCase().includes(s))).reduce((sum,row)=>sum+num(row.amount),0)+
    (orders||[]).filter(row=>!["rejected","received","received damaged","delivered","cancelled"].includes(text(row.status).toLowerCase())).reduce((sum,row)=>sum+num(row.total),0)+
    (payments||[]).filter(row=>["SUBMITTED","FINANCE_REVIEW","CEO_REVIEW","APPROVED_FOR_PAYMENT"].includes(text(row.current_status))&&!row.purchase_order_id).reduce((sum,row)=>sum+num(row.amount),0);
  const{data:existing,error:readError}=await supabase.from("project_financials").select("approved_budget").eq("project_id",projectId).maybeSingle();
  fail(readError);
  if(existing)fail((await supabase.from("project_financials").update({spent,committed,updated_at:new Date().toISOString()}).eq("project_id",projectId)).error);
}
export async function databaseStats(){const supabase=await createClient();const [users,assets,projects]=await Promise.all([supabase.from("profiles").select("id",{count:"exact",head:true}),supabase.from("assets").select("id",{count:"exact",head:true}),supabase.from("projects").select("id",{count:"exact",head:true})]);fail(users.error);fail(assets.error);fail(projects.error);return{users:users.count||0,assets:assets.count||0,projects:projects.count||0,tables:"Supabase",path:"PostgreSQL + RLS"};}
