"use client";

/**
 * Landing page — v2 upgrade splash.
 *
 * YardScore is undergoing a major product upgrade.
 * This page explains what's happening, captures emails
 * for notification, and optionally shows a founder note.
 *
 * Replaces the persona-targeted landing page during the
 * upgrade window. The old landing page will be rebuilt
 * around the Structure Browser when v2 ships.
 */

import { useState, FormEvent } from "react";
import { Sprout } from "lucide-react";

const CHANGES = [
  {
    title: "Ecosystem Structure Browser",
    desc: "Browse your yard by ecological layer — canopy, understory, shrub, ground cover. See species counts, native vs invasive grouping, and confidence levels for every observation.",
  },
  {
    title: "Derived Signals",
    desc: "Ecological health, stewardship priorities, seasonal color, design composition — computed from your real observations, not generic advice.",
  },
  {
    title: "Outcome Profiles",
    desc: "Tell YardScore what you care about — ecological recovery, visual design, pollinator support, four-season interest — and get recommendations shaped to your goals.",
  },
  {
    title: "Light as a First-Class Observation",
    desc: "Dedicated light scanning across time of day and season. Your planting recommendations will be grounded in measured conditions, not guesses.",
  },
  {
    title: "Insight Readiness Engine",
    desc: "The system tells you what it knows, what it doesn't know yet, and what observation would unlock the next insight. Every scan makes the model smarter.",
  },
  {
    title: "A More Human Voice",
    desc: "Interpretive coaching instead of data dumps. YardScore explains why a signal matters, what to do about it, and how it connects to your goals.",
  },
];

export default function UpgradeSplash() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
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
        body: JSON.stringify({ email: email.trim(), phone: "", propertyType: "v2-upgrade-notify" }),
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

  return (
    <div className="min-h-screen bg-[#07110c] text-white">
      {/* Nav — minimal */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Sprout className="h-5 w-5 text-lime-300" />
          </div>
          <span className="text-lg font-semibold tracking-tight">YardScore</span>
        </div>
        <span className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Upgrading</span>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-12 pb-10 lg:pt-20">
        <div className="max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-lime-300/70 mb-4">
            Product Upgrade in Progress
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl leading-tight">
            YardScore is becoming<br />
            <span className="text-lime-300">something bigger.</span>
          </h1>
          <p className="mt-6 text-base text-zinc-300 leading-relaxed">
            We&apos;re upgrading from a scan-and-score tool to a full property intelligence system — one that helps you understand what matters in your yard, what&apos;s missing, what to do next, and what you unlock by observing more.
          </p>
          <p className="mt-4 text-sm text-zinc-500 leading-relaxed">
            This is a real upgrade, not a cosmetic pass. The data model, the signal engine, the recommendation system, and the interpretation layer are all being rebuilt. We&apos;re taking the system offline briefly so nothing is half-finished when you use it.
          </p>
        </div>
      </section>

      {/* What's changing */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-lg font-bold text-white mb-6">What&apos;s coming in v2</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CHANGES.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Notify form */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-2xl border border-lime-300/15 bg-lime-300/5 p-8 sm:p-10">
          <h2 className="text-xl font-bold text-white">
            Get notified when v2 is live.
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Your existing data is safe. When the upgrade is done, you&apos;ll pick up right where you left off — with a much better system underneath.
          </p>

          {state === "success" ? (
            <p className="mt-6 text-sm font-medium text-lime-300">
              You&apos;re on the list. We&apos;ll email you when v2 is ready.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-lime-300/50"
              />
              <button
                type="submit"
                disabled={state === "submitting"}
                className="h-12 px-8 rounded-xl bg-lime-300 text-sm font-bold text-zinc-950 transition hover:bg-lime-200 disabled:opacity-50 whitespace-nowrap"
              >
                {state === "submitting" ? "Joining..." : "Notify Me"}
              </button>
            </form>
          )}
          {state === "error" && (
            <p className="mt-3 text-sm text-red-300">{errorMsg}</p>
          )}
        </div>
      </section>

      {/* Founder note */}
      <section className="mx-auto max-w-3xl px-6 py-10 pb-16">
        <div className="border-t border-white/[0.06] pt-8">
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">From the founder</p>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">
            YardScore started as a way to point your phone at a plant and learn something. What we heard from early users was that the ecological interpretation — the &ldquo;why this matters&rdquo; — was the real value. So we&apos;re building that into the core of the product. The scanner was capture. The real product is understanding.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            — Dwight
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span><span className="text-zinc-400">YardScore</span> by DrewHenry</span>
          <span>Your data is safe. The upgrade changes the system, not your observations.</span>
        </div>
      </footer>
    </div>
  );
}
