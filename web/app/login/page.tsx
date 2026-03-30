"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");

    try {
      const result = await signIn("resend", {
        email: email.trim(),
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "AccessDenied") {
          setError("This email isn't on the early access list yet. Request access from the homepage.");
        } else {
          setError("Something went wrong. Try again.");
        }
        setLoading(false);
      } else {
        // Redirect to check-email page
        window.location.href = "/login/check-email";
      }
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
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
          <p className="text-sm text-zinc-400 mt-1">We&apos;ll email you a magic link</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-300">{error}</p>
              {error.includes("early access") && (
                <a href="/#access" className="text-xs text-lime-300 hover:underline mt-1 block">
                  → Request early access
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full h-12 bg-lime-300 text-zinc-950 font-semibold rounded-xl text-sm hover:bg-lime-200 transition-colors disabled:opacity-50"
          >
            {loading ? "Sending link..." : "Continue with Email"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Back to YardScore
          </a>
        </div>
      </div>
    </div>
  );
}
