"use client";

import { useState, FormEvent } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export default function EarlyAccessForm({
  variant = "light",
}: {
  variant?: "light" | "dark";
}) {
  const [email, setEmail] = useState("");
  const [propertyType, setPropertyType] = useState("");
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
        body: JSON.stringify({ email: email.trim(), propertyType: propertyType.trim() }),
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
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className={`w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#86efac] ${
          isDark
            ? "bg-white/[0.06] border border-white/10 text-white placeholder-white/40"
            : "bg-white border border-gray-300 text-gray-800 placeholder-gray-400"
        }`}
      />
      <input
        type="text"
        value={propertyType}
        onChange={(e) => setPropertyType(e.target.value)}
        placeholder="What kind of property are you scanning?"
        className={`w-full px-4 py-3.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#86efac] ${
          isDark
            ? "bg-white/[0.06] border border-white/10 text-white placeholder-white/40"
            : "bg-white border border-gray-300 text-gray-800 placeholder-gray-400"
        }`}
      />
      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full px-6 py-3.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 bg-[#86efac] text-[#0d1f17] hover:bg-[#a7f3d0]"
      >
        {state === "submitting" ? "Joining..." : "Join the List"}
      </button>
      {state === "error" && (
        <p className={`text-sm ${isDark ? "text-red-300" : "text-red-600"}`}>
          {errorMsg}
        </p>
      )}
    </form>
  );
}
