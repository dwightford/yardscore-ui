"use client";

import { useState, FormEvent } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export default function EarlyAccessForm({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong." }));
        throw new Error(data.error || "Something went wrong.");
      }
      setState("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <p
        className={`text-sm font-medium ${
          variant === "dark" ? "text-green-200" : "text-green-700"
        }`}
      >
        You&apos;re on the list! We&apos;ll let you know when YardScore is ready.
      </p>
    );
  }

  const isDark = variant === "dark";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={`flex-1 px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#52b788] ${
            isDark
              ? "bg-white/10 border border-white/20 text-white placeholder-white/50"
              : "bg-white border border-gray-300 text-gray-800 placeholder-gray-400"
          }`}
        />
        <button
          type="submit"
          disabled={state === "submitting"}
          className={`px-6 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
            isDark
              ? "bg-white text-[#2d6a4f] hover:bg-gray-100"
              : "bg-[#2d6a4f] text-white hover:bg-[#1b4332]"
          }`}
        >
          {state === "submitting" ? "Joining..." : "Join the List"}
        </button>
      </div>
      {state === "error" && (
        <p className={`text-sm mt-2 ${isDark ? "text-red-300" : "text-red-600"}`}>
          {errorMsg}
        </p>
      )}
    </form>
  );
}
