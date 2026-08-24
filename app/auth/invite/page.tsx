import { Suspense } from "react";
import InvitePasswordForm from "./invite-password-form";

function InviteFallback() {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <img src="/ibtechar-main-logo.png" alt="Ibtechar" />
        <p>Preparing your SmartCare account…</p>
      </section>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<InviteFallback />}>
      <InvitePasswordForm />
    </Suspense>
  );
}
