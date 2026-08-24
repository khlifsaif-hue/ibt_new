import { getSmartCareActor, hasProjectPermission, hasSmartCarePermission } from "../../../lib/auth-server";
import { getOrderProgress, updateOrderProgress } from "../../../lib/database";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await getOrderProgress(id);
  if (!item) return Response.json({ error: "Order Progress item not found" }, { status: 404 });
  if (!await hasProjectPermission(request, item.project, "view") && item.requestedBy !== actor.id && item.responsibleUserId !== actor.id) return Response.json({ error: "Project access required" }, { status: 403 });
  return Response.json({ item });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const current = await getOrderProgress(id);
  if (!current) return Response.json({ error: "Order Progress item not found" }, { status: 404 });
  if (!await hasSmartCarePermission(request, "order_progress", "edit") && current.requestedBy !== actor.id && current.responsibleUserId !== actor.id) return Response.json({ error: "Order Progress update permission required" }, { status: 403 });
  try {
    const item = await updateOrderProgress(id, await request.json(), actor);
    return Response.json({ item });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update Order Progress" }, { status: 400 });
  }
}
