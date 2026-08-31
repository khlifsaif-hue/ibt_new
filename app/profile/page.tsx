"use client";

import { BadgeCheck, KeyRound, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSmartCareAuth } from "../components/auth-provider";
import { createClient } from "../lib/supabase/client";
import { PasswordInput } from "../components/password-input";

export default function ProfilePage() {
  const { user, modules, permissions, isLocalPreview } = useSmartCareAuth();
  const [tab, setTab] = useState<"profile" | "permissions" | "password">("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "permissions") setTab("permissions");
  }, []);
  const allowed = useMemo(() => permissions.filter((item) => item.canView), [permissions]);
  if (!user) return null;

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    const email = user?.email;
    if (!email) return setPasswordError("Your authenticated email could not be verified.");
    if (!currentPassword) return setPasswordError("Current password is required.");
    if (newPassword.length < 8) return setPasswordError("New password must contain at least 8 characters.");
    if (newPassword !== confirmPassword) return setPasswordError("New passwords do not match.");
    if (currentPassword === newPassword) return setPasswordError("Choose a new password that is different from your current password.");

    setPasswordSaving(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPasswordSaving(false);
      setPasswordError("Current password is incorrect.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSuccess("Your password has been changed successfully.");
  }

  const initials = user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <main className="dashboard-main section-page profile-page">
    <section className="page-heading"><div><p className="eyebrow">Account center</p><h1>My Profile</h1><p className="page-subtitle">Your SmartCare account, assigned role and active system permissions.</p></div><span className="pilot-badge"><BadgeCheck size={16}/> {isLocalPreview ? "Localhost preview" : "Verified account"}</span></section>
    <section className="profile-layout">
      <article className="profile-card"><div className="profile-avatar">{initials}</div><div><h2>{user.name}</h2><p>{user.jobTitle || "SmartCare user"}</p><span className="table-status healthy">{user.role}</span></div><dl><div><dt><Mail size={15}/> Email</dt><dd>{user.email}</dd></div><div><dt><Phone size={15}/> Contact</dt><dd>{user.phone || "Not added"}</dd></div><div><dt><UserRound size={15}/> Department</dt><dd>{user.department || "Not added"}</dd></div></dl></article>
      <article className="detail-section">
        <div className="section-title"><h2>Account access</h2><div className="mini-tabs"><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Summary</button><button className={tab === "permissions" ? "active" : ""} onClick={() => setTab("permissions")}>My Permissions</button><button className={tab === "password" ? "active" : ""} onClick={() => setTab("password")}>Change Password</button></div></div>
        {tab === "profile" && <div className="profile-summary"><ShieldCheck size={28}/><div><h3>Role-based access is active</h3><p>Your sidebar and permitted actions are selected from the role and module permissions assigned by Admin or Manager.</p>{isLocalPreview && <small>Localhost mode: use the account menu → Switch User to test another user safely.</small>}</div></div>}
        {tab === "permissions" && <div className="responsive-table"><table><thead><tr><th>Module</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th><th>Approve</th></tr></thead><tbody>{modules.filter((module) => module.enabled).map((module) => { const permission = permissions.find((item) => item.moduleKey === module.key); return <tr key={module.key}><td><strong>{module.title}</strong><small>{module.path}</small></td><td>{permission?.canView ? "✓" : "—"}</td><td>{permission?.canCreate ? "✓" : "—"}</td><td>{permission?.canEdit ? "✓" : "—"}</td><td>{permission?.canDelete ? "✓" : "—"}</td><td>{permission?.canApprove ? "✓" : "—"}</td></tr>; })}</tbody></table>{!allowed.length && <p className="empty-row">No modules are assigned yet.</p>}</div>}
        {tab === "password" && <div className="profile-password-panel"><div className="profile-password-intro"><KeyRound size={28}/><div><h3>Change your password</h3><p>Enter your current password to confirm your identity, then choose a new password.</p></div></div><form onSubmit={changePassword}><label>Current password<PasswordInput autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></label><label>New password<PasswordInput autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><small>Use at least 8 characters.</small></label><label>Confirm new password<PasswordInput autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>{passwordError && <p className="form-error">{passwordError}</p>}{passwordSuccess && <p className="form-success">{passwordSuccess}</p>}<button className="button primary" disabled={passwordSaving}>{passwordSaving ? "Changing password…" : "Change password"}</button></form></div>}
      </article>
    </section>
    <footer className="profile-credit">Ibtechar SmartCare V5_01_31826 · Developed by Seif Khlif</footer>
  </main>;
}
