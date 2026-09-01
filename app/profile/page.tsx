"use client";

import { BadgeCheck, Camera, KeyRound, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
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
  const [phone,setPhone]=useState(""),[address,setAddress]=useState(""),[avatarUrl,setAvatarUrl]=useState("");
  const [profileSaving,setProfileSaving]=useState(false),[profileMessage,setProfileMessage]=useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "permissions") setTab("permissions");
  }, []);
  useEffect(()=>{if(user){setPhone(user.phone||"");setAddress(user.address||"");setAvatarUrl(user.avatarUrl||"")}},[user]);
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

  async function uploadAvatar(file:File){if(!user)return;setProfileMessage("");if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setProfileMessage("Choose a JPG, PNG or WebP image.");return}if(file.size>2*1024*1024){setProfileMessage("Profile pictures must be 2 MB or smaller.");return}setProfileSaving(true);const extension=file.type.split("/")[1].replace("jpeg","jpg"),path=`${user.id}/avatar.${extension}`;const supabase=createClient();const{error}=await supabase.storage.from("profile-avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(error){setProfileSaving(false);setProfileMessage(error.message);return}const{data}=supabase.storage.from("profile-avatars").getPublicUrl(path);setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);setProfileSaving(false);setProfileMessage("Picture uploaded. Save your profile to confirm the change.")}
  async function saveProfile(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setProfileSaving(true);setProfileMessage("");const response=await fetch("/api/users/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({phone,address,avatarUrl})});const data=await response.json() as {error?:string};setProfileSaving(false);setProfileMessage(response.ok?"Your profile details were saved.":data.error||"Unable to update profile.")}

  const initials = user.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <main className="dashboard-main section-page profile-page">
    <section className="page-heading"><div><p className="eyebrow">Account center</p><h1>My Profile</h1><p className="page-subtitle">Your SmartCare account, assigned role and active system permissions.</p></div><span className="pilot-badge"><BadgeCheck size={16}/> {isLocalPreview ? "Localhost preview" : "Verified account"}</span></section>
    <section className="profile-layout">
      <article className="profile-card"><div className="profile-avatar">{avatarUrl?<img src={avatarUrl} alt={`${user.name} profile`}/>:initials}</div><label className="profile-photo-button"><Camera size={14}/> Upload picture<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];if(file)void uploadAvatar(file)}}/></label><div><h2>{user.name}</h2><p>{user.jobTitle || "SmartCare user"}</p><span className="table-status healthy">{user.role}</span></div><dl><div><dt><Mail size={15}/> Email</dt><dd>{user.email}</dd></div><div><dt><Phone size={15}/> Contact</dt><dd>{phone || "Not added"}</dd></div><div><dt><MapPin size={15}/> Address</dt><dd>{address || "Not added"}</dd></div><div><dt><UserRound size={15}/> Department</dt><dd>{user.department || "Not added"}</dd></div></dl></article>
      <article className="detail-section">
        <div className="section-title"><h2>Account access</h2><div className="mini-tabs"><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Summary</button><button className={tab === "permissions" ? "active" : ""} onClick={() => setTab("permissions")}>My Permissions</button><button className={tab === "password" ? "active" : ""} onClick={() => setTab("password")}>Change Password</button></div></div>
        {tab === "profile" && <div className="profile-summary-content"><div className="profile-summary"><ShieldCheck size={28}/><div><h3>{user.jobTitle||user.role.replaceAll("_"," ")}</h3><p>{user.roleSummary||`Your role is ${user.role.replaceAll("_"," ")} in ${user.department||"the organization"}. Your assigned permissions determine the modules and actions available to you.`}</p><small>This role summary is managed by HR and will be editable by HR in a later update.</small></div></div><form className="profile-details-form" onSubmit={saveProfile}><h3>Personal contact details</h3><p>You can update your own phone number, address and profile picture. Role, department and job title remain organization-managed.</p><label>Contact number<input type="tel" maxLength={40} value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+974 ..."/></label><label>Address<textarea rows={3} maxLength={300} value={address} onChange={event=>setAddress(event.target.value)} placeholder="Building, street, area, city"/></label>{profileMessage&&<p className="form-success">{profileMessage}</p>}<button className="button primary" disabled={profileSaving}><Save size={16}/>{profileSaving?"Saving…":"Save profile"}</button></form></div>}
        {tab === "permissions" && <div className="responsive-table"><table><thead><tr><th>Module</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th><th>Approve</th></tr></thead><tbody>{modules.filter((module) => module.enabled).map((module) => { const permission = permissions.find((item) => item.moduleKey === module.key); return <tr key={module.key}><td><strong>{module.title}</strong><small>{module.path}</small></td><td>{permission?.canView ? "✓" : "—"}</td><td>{permission?.canCreate ? "✓" : "—"}</td><td>{permission?.canEdit ? "✓" : "—"}</td><td>{permission?.canDelete ? "✓" : "—"}</td><td>{permission?.canApprove ? "✓" : "—"}</td></tr>; })}</tbody></table>{!allowed.length && <p className="empty-row">No modules are assigned yet.</p>}</div>}
        {tab === "password" && <div className="profile-password-panel"><div className="profile-password-intro"><div><h3>Change your password</h3><p>Enter your current password to confirm your identity, then choose a secure new password for your SmartCare account.</p></div></div><form onSubmit={changePassword}><label>Current password<PasswordInput autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)}/></label><label>New password<PasswordInput autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)}/><small>Use at least 8 characters.</small></label><label>Confirm new password<PasswordInput autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label>{passwordError && <p className="form-error">{passwordError}</p>}{passwordSuccess && <p className="form-success">{passwordSuccess}</p>}<button className="button primary profile-password-submit" disabled={passwordSaving}><KeyRound size={17}/>{passwordSaving ? "Changing password…" : "Change password"}</button></form></div>}
      </article>
    </section>
    <footer className="profile-credit">Ibtechar SmartCare V5_01_31826 · Developed by Seif Khlif</footer>
  </main>;
}
