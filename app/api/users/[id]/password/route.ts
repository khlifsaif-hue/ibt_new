import { setUserPassword } from "../../../../lib/database";
import { getSmartCareActor } from "../../../../lib/auth-server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getSmartCareActor(request);
    if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
    if (actor.role !== "ADMIN") return Response.json({ error: "Admin access required" }, { status: 403 });

    const body = await request.json() as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) return Response.json({ error: "Password must contain at least 8 characters." }, { status: 400 });

    const { id } = await context.params;
    await setUserPassword(id, password);
    return Response.json({ updated: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to set new password" }, { status: 400 });
  }
}
