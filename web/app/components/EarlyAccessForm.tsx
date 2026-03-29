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
    <form onSubmit={handleSubmit} className="grid w-full gap-4">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className={`h-14 w-full rounded-2xl px-4 text-sm outline-none ${
          isDark
            ? "border border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
            : "border border-gray-300 bg-white text-gray-800 placeholder:text-gray-400"
        }`}
      />
      <input
        type="text"
        value={propertyType}
        onChange={(e) => setPropertyType(e.target.value)}
        placeholder="What kind of property are you scanning?"
        className={`h-14 w-full rounded-2xl px-4 text-sm outline-none ${
          isDark
            ? "border border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
            : "border border-gray-300 bg-white text-gray-800 placeholder:text-gray-400"
        }`}
      />
      <button
        type="submit"
        disabled={state === "submitting"}
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-lime-300 text-sm font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:opacity-60"
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
