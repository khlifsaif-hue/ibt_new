import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }
  const errorDestination = destination === "/auth/invite" ? "/auth/invite" : "/auth/reset-password";
  return NextResponse.redirect(new URL(`${errorDestination}?error=invalid_or_expired_link`, url.origin));
}
