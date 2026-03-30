"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
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

      if (r.ok && data.sent) {
        setStep("code");
      } else {
        setError(data.detail || data.reason || "Could not send code. Are you on the early access list?");
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
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen bg-[#07110c] flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-lime-300/10 border border-lime-300/20 flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Sign in to YardScore</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {step === "code" ? "Check your email for the code" : "We'll email you a 6-digit code"}
          </p>
        </div>

        {/* Step 1: Email */}
        {step === "email" && (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" required autoFocus
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
            />
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-300">{error}</p>
                {error.includes("early access") && (
                  <a href="/#access" className="text-xs text-lime-300 hover:underline mt-1 block">→ Request early access</a>
                )}
              </div>
            )}
            <button type="submit" disabled={!email.trim()}
              className="w-full h-12 bg-lime-300 text-zinc-950 font-semibold rounded-xl text-sm hover:bg-lime-200 transition-colors disabled:opacity-50">
              Continue with Email
            </button>
          </form>
        )}

        {/* Step 2: Code */}
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
              Sign In
            </button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="w-full text-xs text-zinc-500 hover:text-zinc-300">
              ← Use a different email
            </button>
          </form>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-zinc-400">Sending...</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back to YardScore</a>
        </div>
      </div>
    </div>
  );
}
