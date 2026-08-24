"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { PasswordInput } from "../../components/password-input";

type InviteState = "checking" | "ready" | "saving" | "success" | "invalid";

export default function InvitePasswordForm() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<InviteState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function verifyInviteSession() {
      if (searchParams.get("error")) {
        if (!cancelled) setState("invalid");
        return;
      }
      const { data, error: userError } = await createClient().auth.getUser();
      if (cancelled) return;
      if (userError || !data.user) {
        setState("invalid");
        return;
      }
      setState("ready");
    }
    void verifyInviteSession();
    return () => { cancelled = true; };
  }, [searchParams]);

  async function activate(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Use at least 12 characters for your password.");
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Include uppercase, lowercase, a number, and a symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setState("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setState("ready");
      return;
    }

    // First-time setup is complete. End the temporary invite session so the
    // user explicitly signs in with the password they just created.
    await supabase.auth.signOut();
    setState("success");
  }

  if (state === "checking") {
    return (
      <main className="auth-screen"><section className="auth-card">
        <img src="/ibtechar-main-logo.png" alt="Ibtechar" />
        <p className="eyebrow">Secure invitation</p>
        <h1>Preparing your account…</h1>
      </section></main>
    );
  }

  if (state === "invalid") {
    return (
      <main className="auth-screen"><section className="auth-card">
        <img src="/ibtechar-main-logo.png" alt="Ibtechar" />
        <p className="eyebrow">Secure invitation</p>
        <h1>Invitation link unavailable</h1>
        <p>This invitation is invalid, expired, or has already been used. Ask a SmartCare administrator to send a new invitation.</p>
        <a className="button primary full" href="/">Go to sign in</a>
      </section></main>
    );
  }

  if (state === "success") {
    return (
      <main className="auth-screen"><section className="auth-card">
        <img src="/ibtechar-main-logo.png" alt="Ibtechar" />
        <p className="eyebrow">Account activated</p>
        <h1>Your password is ready</h1>
        <p>Your SmartCare account has been activated. Sign in using your email address and the password you just created.</p>
        <a className="button primary full" href="/">Continue to sign in</a>
      </section></main>
    );
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <img src="/ibtechar-main-logo.png" alt="Ibtechar" />
        <p className="eyebrow">Welcome to SmartCare</p>
        <h1>Create your password</h1>
        <p>Your invitation was verified. Create a strong password to activate your account.</p>
        <form onSubmit={activate}>
          <label>
            New password
            <PasswordInput minLength={12} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label>
            Confirm password
            <PasswordInput minLength={12} required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </label>
          <small>Minimum 12 characters with uppercase, lowercase, number, and symbol.</small>
          {error && <p className="form-error">{error}</p>}
          <button className="button primary full" disabled={state === "saving"}>
            {state === "saving" ? "Activating…" : "Activate account"}
          </button>
        </form>
      </section>
    </main>
  );
}
