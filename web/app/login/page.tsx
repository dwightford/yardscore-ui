"use client";

/**
 * /login — sign in with 6-digit email code or Google.
 *
 * Honors `?mode=register` for legacy links (routes to /register copy without
 * changing URL). Dedicated account creation now lives at /register.
 */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import EmailCodeAuthForm from "../components/EmailCodeAuthForm";

function LoginInner() {
  const params = useSearchParams();
  const mode = params.get("mode") === "register" ? "register" : "signin";
  return <EmailCodeAuthForm mode={mode} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07110c]" />}>
      <LoginInner />
    </Suspense>
  );
}
