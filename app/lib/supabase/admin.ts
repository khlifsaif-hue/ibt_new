import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required for Auth user administration.");
  }
  const { url } = supabaseConfig();
  return createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
