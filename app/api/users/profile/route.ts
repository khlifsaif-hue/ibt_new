import { findUserById, listModules, listUserPermissions } from "../../../lib/database";
import { createClient } from "../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();

  if (authError || !data.user) {
    return Response.json(
      { code: "AUTH_SESSION_MISSING", error: "Your sign-in session is missing or expired. Please sign in again." },
      { status: 401 },
    );
  }

  try {
    const user = await findUserById(data.user.id);
    if (!user) {
      return Response.json(
        {
          code: "PROFILE_NOT_FOUND",
          error: `Authentication succeeded, but ${data.user.email ?? "this account"} has no SmartCare profile in this Supabase project.`,
        },
        { status: 404 },
      );
    }
    if (!user.active) {
      return Response.json(
        { code: "PROFILE_INACTIVE", error: "This SmartCare account is disabled. Contact an administrator." },
        { status: 403 },
      );
    }

    const [modules, permissions] = await Promise.all([
      listModules(),
      listUserPermissions(user.id),
    ]);
    return Response.json({ user, modules, permissions });
  } catch (error) {
    console.error("SmartCare profile lookup failed", {
      authUserId: data.user.id,
      message: error instanceof Error ? error.message : "Unknown profile lookup error",
    });
    return Response.json(
      {
        code: "PROFILE_LOOKUP_FAILED",
        error: "SmartCare could not read your profile or permissions. Check the database schema and RLS policies.",
      },
      { status: 500 },
    );
  }
}
