import { getSmartCareActor } from "../../lib/auth-server";
import { getFinancePermissions, setFinancePermissions } from "../../lib/finance-permissions";

function isAdmin(role?: string) { return role === "ADMIN"; }

export async function GET(request: Request) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  const userId = new URL(request.url).searchParams.get("userId") || actor.id;
  if (userId !== actor.id && !isAdmin(actor.role))
    return Response.json({ error: "Admin permission required" }, { status: 403 });
  try {
    return Response.json({ permissions: await getFinancePermissions(userId) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load finance permissions" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const actor = await getSmartCareActor(request);
  if (!actor) return Response.json({ error: "Authentication required" }, { status: 401 });
  if (!isAdmin(actor.role))
    return Response.json({ error: "Only Admin can change finance permissions" }, { status: 403 });
  try {
    const body = await request.json();
    const userId = String(body.userId || "");
    if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });
    const permissions = await setFinancePermissions(userId, body);
    return Response.json({ permissions });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save finance permissions" }, { status: 400 });
  }
}
