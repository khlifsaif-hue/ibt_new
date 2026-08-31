import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const authProvider = fs.readFileSync(new URL("../app/components/auth-provider.tsx", import.meta.url), "utf8");
const inviteForm = fs.readFileSync(new URL("../app/auth/invite/invite-password-form.tsx", import.meta.url), "utf8");
const database = fs.readFileSync(new URL("../app/lib/database.ts", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("new accounts retain the first-login password requirement through invitation activation", () => {
  assert.match(database, /first_login_required:\s*true/);
  assert.match(inviteForm, /updateUser\(\{ password, data: \{ first_login_required: true \} \}\)/);
});

test("first normal login requires current and distinct new passwords", () => {
  assert.match(authProvider, /signInWithPassword\(\{email:user\.email,password:currentPassword\}\)/);
  assert.match(authProvider, /currentPassword===newPassword/);
  assert.match(authProvider, /first_login_required:false/);
});

test("the app is locked and blurred while the first-login dialog is open", () => {
  assert.match(authProvider, /firstLoginRequired\?"app-content-locked"/);
  assert.match(styles, /\.first-login-overlay\{[^}]*backdrop-filter:blur/);
  assert.match(styles, /\.app-content-locked\{[^}]*filter:blur\([^)]*\)[^}]*pointer-events:none/);
});
