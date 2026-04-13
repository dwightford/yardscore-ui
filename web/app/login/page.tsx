"use client";

/**
 * /login — 6-digit email code auth (+ Google one-tap).
 *
 * Auth continuity: preserves `next`, `address`, and `intent` across the
 * code flow so the user lands exactly where they were. Default post-auth
 * destination is `/dashboard` (which redirects to the user's property).
 *
 * `?mode=register|signin` tunes the headline copy only — the underlying
 * flow is the same 6-digit code (allowlist-gated).
 */

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function LoginInner() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") === "register" ? "register" : "signin") as
    | "register"
    | "signin";
  const nextRaw = searchParams.get("next") ?? "/dashboard";
  const address = searchParams.get("address") ?? "";
  const intent = searchParams.get("intent") ?? "";

  // Preserve address + intent on the post-auth destination.
  function buildNext(): string {
    try {
      // Only allow relative paths; block open redirects.
      if (!nextRaw.startsWith("/")) return "/dashboard";
      const url = new URL(nextRaw, "http://x");
      if (address && !url.searchParams.has("address")) {
        url.searchParams.set("address", address);
      }
      if (intent && !url.searchParams.has("intent")) {
        url.searchParams.set("intent", intent);
      }
      return url.pathname + (url.search || "");
    } catch {
      return "/dashboard";
    }
  }

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code" | "loading">("email");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("loading");
    setError("");
    try {
      const r = await fetch(`${API}/auth/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await r.json();
      if (r.ok && data.sent) setStep("code");
      else {
        setError(
          data.detail ||
            data.reason ||
            "Could not send code. Are you on the early access list?",
        );
        setStep("email");
      }
    } catch {
      setError("Network error. Try again.");
      setStep("email");
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setStep("loading");
    setError("");

    const result = await signIn("magic-link", {
      email: email.trim(),
      token: code.trim(),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid or expired code. Try again.");
      setStep("code");
    } else {
      window.location.href = buildNext();
    }
  }

  const title =
    mode === "register" ? "Create your YardScore account" : "Sign in to YardScore";
  const subtitle =
    step === "code"
      ? "Check your email for the code"
      : mode === "register"
        ? "We'll email you a 6-digit code to finish creating your account."
        : "We'll email you a 6-digit code to sign you in.";

  return (
    <div className="min-h-screen bg-[#07110c] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-lime-300/10 border border-lime-300/20 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
          {address && intent === "claim" && (
            <p className="mt-3 rounded-lg bg-lime-300/5 border border-lime-300/20 px-3 py-2 text-xs text-lime-200">
              You&apos;ll claim <span className="font-medium">{address}</span> after you sign in.
            </p>
          )}
          {address && intent === "request_access" && (
            <p className="mt-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-zinc-300">
              You&apos;ll request access to <span className="font-medium">{address}</span> after you sign in.
            </p>
          )}
        </div>

        {step === "email" && (
          <div className="space-y-4">
            <button
              onClick={() => signIn("google", { callbackUrl: buildNext() })}
              className="w-full h-12 bg-white rounded-xl text-zinc-900 font-semibold text-sm hover:bg-zinc-100 transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={handleRequestCode} className="space-y-4">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required
                className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
              />
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                  <p className="text-sm text-red-300">{error}</p>
                  {error.includes("early access") && (
                    <a href="/#access" className="text-xs text-lime-300 hover:underline mt-1 block">Request early access</a>
                  )}
                </div>
              )}
              <button type="submit" disabled={!email.trim()}
                className="w-full h-12 bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm hover:bg-white/15 transition-colors disabled:opacity-50">
                Email me a code
              </button>
            </form>
          </div>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-xs text-zinc-400 text-center">
              Code sent to <span className="text-white font-medium">{email}</span>
            </p>
            <input
              type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" required autoFocus maxLength={6}
              className="w-full h-14 rounded-xl bg-white/5 border border-white/10 px-4 text-center text-2xl font-mono text-white tracking-[0.5em] placeholder:text-zinc-600 focus:outline-none focus:border-lime-300/50"
            />
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
            <button type="submit" disabled={code.length < 6}
              className="w-full h-12 bg-lime-300 text-zinc-950 font-semibold rounded-xl text-sm hover:bg-lime-200 transition-colors disabled:opacity-50">
              {mode === "register" ? "Create account" : "Sign in"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300">
              ← Use a different email
            </button>
          </form>
        )}

        {step === "loading" && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-zinc-400">Sending...</p>
          </div>
        )}

        <div className="mt-8 text-center space-y-2">
          {mode === "signin" ? (
            <a
              href={`/login?mode=register${nextRaw !== "/dashboard" ? `&next=${encodeURIComponent(nextRaw)}` : ""}${address ? `&address=${encodeURIComponent(address)}` : ""}${intent ? `&intent=${encodeURIComponent(intent)}` : ""}`}
              className="block text-xs text-zinc-400 hover:text-zinc-200"
            >
              New here? Create an account →
            </a>
          ) : (
            <a
              href={`/login?mode=signin${nextRaw !== "/dashboard" ? `&next=${encodeURIComponent(nextRaw)}` : ""}${address ? `&address=${encodeURIComponent(address)}` : ""}${intent ? `&intent=${encodeURIComponent(intent)}` : ""}`}
              className="block text-xs text-zinc-400 hover:text-zinc-200"
            >
              Already have an account? Sign in →
            </a>
          )}
          <a href="/" className="block text-xs text-zinc-500 hover:text-zinc-300">
            ← Back to YardScore
          </a>
          <p className="text-[10px] text-zinc-600 pt-2">
            Build {process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07110c]" />}>
      <LoginInner />
    </Suspense>
  );
}
