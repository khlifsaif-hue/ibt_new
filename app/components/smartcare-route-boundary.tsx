"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./app-shell";
import { AuthGate, SmartCareAuthProvider } from "./auth-provider";

/**
 * Password recovery and first-time invitation setup begin before the user enters
 * the normal SmartCare shell. Keep these routes outside AuthGate so their
 * secure Supabase sessions can display password setup directly.
 */
export function SmartCareRouteBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/auth/reset-password" || pathname === "/auth/invite") {
    return <>{children}</>;
  }

  return (
    <SmartCareAuthProvider>
      <AuthGate>
        <AppShell>{children}</AppShell>
      </AuthGate>
    </SmartCareAuthProvider>
  );
}
