"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(String(props.defaultValue ?? ""));
  const password = props.value === undefined ? uncontrolledValue : String(props.value ?? "");
  const score = password ? [password.length >= 8, password.length >= 12, /[a-z]/.test(password) && /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length : 0;
  const labels = ["Enter a password", "Very weak", "Weak", "Fair", "Strong", "Very strong"];
  return <span className="password-input">
    <span className="password-control">
      <input {...props} type={visible ? "text" : "password"} onChange={(event) => { setUncontrolledValue(event.target.value); props.onChange?.(event); }}/>
      <button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
        {visible ? <EyeOff size={17}/> : <Eye size={17}/>}<span>{visible ? "Hide" : "Show"}</span>
      </button>
    </span>
    <span className={`password-strength score-${score}`} aria-live="polite"><span className="password-strength-track"><i/></span><small>Password strength: <strong>{labels[score]}</strong></small></span>
  </span>;
}
