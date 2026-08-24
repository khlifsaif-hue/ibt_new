import { listOrderProgress } from "../../lib/database";
import { getSmartCareActor } from "../../lib/auth-server";

export async function GET() {
  const actor = await getSmartCareActor();
  if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ items: await listOrderProgress() });
}
