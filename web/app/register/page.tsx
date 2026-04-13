"use client";

/**
 * /register — canonical account creation surface.
 *
 * Per site-map-and-route-truth-v1: /register is "Account creation only."
 * The underlying flow is the same 6-digit email-code path used by /login;
 * we render the shared form in register mode so the URL is truthful.
 */

import { Suspense } from "react";
import EmailCodeAuthForm from "../components/EmailCodeAuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07110c]" />}>
      <EmailCodeAuthForm mode="register" />
    </Suspense>
  );
}
