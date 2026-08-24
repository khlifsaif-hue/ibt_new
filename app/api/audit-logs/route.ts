import { getSmartCareActor } from "../../lib/auth-server";
import { createAdminClient } from "../../lib/supabase/admin";
import { createClient } from "../../lib/supabase/server";

const ACTIONS = ["SIGN_IN","PAGE_VIEW","INSERT","UPDATE","DELETE"] as const;

export async function GET(request: Request) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (actor.role !== "ADMIN") return Response.json({ error: "Admin access required" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "";
    const action = url.searchParams.get("action") || "";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = 15;
    const offset = (page - 1) * pageSize;
    if (action && !ACTIONS.includes(action as (typeof ACTIONS)[number])) return Response.json({ error: "Invalid action type" }, { status: 400 });
    const admin = createAdminClient();
    let query = admin.from("audit_logs").select("id,occurred_at,actor_user_id,action_type,table_name,record_id,page_path,old_data,new_data,metadata", { count: "exact" }).order("occurred_at", { ascending: false });
    if (userId) query = query.eq("actor_user_id", userId);
    if (action) query = query.eq("action_type", action);
    if (from) query = query.gte("occurred_at", `${from}T00:00:00.000Z`);
    if (to) query = query.lte("occurred_at", `${to}T23:59:59.999Z`);
    query = query.range(offset, offset + pageSize - 1);
    const [{ data: logs, error, count }, { data: users, error: usersError }] = await Promise.all([query, admin.from("profiles").select("id,full_name,email").order("full_name")]);
    if (error) throw error;
    if (usersError) throw usersError;
    const names = new Map((users || []).map((user) => [user.id, user.full_name || user.email]));
    return Response.json({
      logs: (logs || []).map((log) => ({ id: log.id, occurredAt: log.occurred_at, actorUserId: log.actor_user_id, actorName: names.get(log.actor_user_id) || "System", actionType: log.action_type, tableName: log.table_name, recordId: log.record_id, pagePath: log.page_path, oldData: log.old_data, newData: log.new_data, metadata: log.metadata })),
      users: (users || []).map((user) => ({ id: user.id, name: user.full_name || user.email })),
      actions: ACTIONS,
      pagination: { page, pageSize, total: count || 0, totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)) },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load audit logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = await request.json() as { actionType?: unknown; pagePath?: unknown };
    const actionType = String(body.actionType || "");
    if (!(["SIGN_IN","PAGE_VIEW"] as string[]).includes(actionType)) return Response.json({ error: "Invalid audit event" }, { status: 400 });
    const pagePath = actionType === "PAGE_VIEW" ? String(body.pagePath || "").slice(0, 500) : "";
    if (actionType === "PAGE_VIEW" && !pagePath.startsWith("/")) return Response.json({ error: "Invalid page path" }, { status: 400 });
    const metadata = actionType === "SIGN_IN" ? { method: "password", userAgent: (request.headers.get("user-agent") || "").slice(0, 300) } : {};
    const supabase = await createClient();
    const { error } = await supabase.from("audit_logs").insert({ actor_user_id: actor.id, action_type: actionType, page_path: pagePath || null, metadata });
    if (error) throw error;
    return Response.json({ logged: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to record audit event" }, { status: 400 });
  }
}
