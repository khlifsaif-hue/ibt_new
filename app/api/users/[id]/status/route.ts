import { setUserActive } from "../../../../lib/database";
import { getSmartCareActor, hasSmartCarePermission } from "../../../../lib/auth-server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await hasSmartCarePermission(request, "users", "edit")) {
      return Response.json({ error: "User-edit permission required" }, { status: 403 });
    }
    const actor = await getSmartCareActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    const { id } = await context.params;
    if (id === actor.id) {
      return Response.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }
    const body = await request.json() as { active?: unknown };
    if (typeof body.active !== "boolean") {
      return Response.json({ error: "Active status must be true or false." }, { status: 400 });
    }
    const user = await setUserActive(id, body.active);
    return Response.json({ user });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to change user status" }, { status: 400 });
  }
}
