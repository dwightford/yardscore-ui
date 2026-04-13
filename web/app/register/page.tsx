"use client";

/**
 * /register — canonical account-creation URL.
 *
 * Per site-map-and-route-truth-v1: `/register` is "Account creation only."
 * The underlying flow is the shared 6-digit email-code auth at /login, so
 * this route is a thin redirect that pins `mode=register` and forwards
 * any `next` / `address` / `intent` query params.
 */

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const q = new URLSearchParams();
    q.set("mode", "register");
    const pass = ["next", "address", "intent"] as const;
    for (const k of pass) {
      const v = params.get(k);
      if (v) q.set(k, v);
    }
    router.replace(`/login?${q.toString()}`);
  }, [router, params]);

  return (
    <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-lime-300/30 border-t-lime-300 rounded-full animate-spin" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07110c]" />}>
      <RegisterRedirect />
    </Suspense>
  );
}
