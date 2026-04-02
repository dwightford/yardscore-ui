"use client";

/**
 * Landing page — v2.
 *
 * Leads with the Structure Browser value prop, not the scanner demo.
 * Shows signal examples, readiness concept, outcome profiles.
 * Early access email capture.
 */

import { useState, useEffect, FormEvent } from "react";
import { Sprout, Layers, Sun, Target, Lightbulb, MessageCircle } from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Ecosystem Structure Browser",
    desc: "See your yard organized by ecological layer — canopy, understory, shrub, ground cover. Every plant counted, classified, and tracked.",
  },
  {
    icon: Sun,
    title: "Light Observation",
    desc: "Record light conditions across your yard at different times and seasons. Planting recommendations grounded in measured reality.",
  },
  {
    icon: Target,
    title: "Derived Signals",
    desc: "Ecological health, invasive pressure, structural diversity, seasonal color — computed from your real observations.",
  },
  {
    icon: Lightbulb,
    title: "Insight Readiness",
    desc: "The system tells you what it knows, what it doesn't know yet, and what observation would unlock the next insight.",
  },
  {
    icon: MessageCircle,
    title: "Interpretive Voice",
    desc: "A thoughtful guide, not a data dump. YardScore explains why signals matter and what to do about them.",
  },
];

const OUTCOMES = [
  { name: "Ecological Recovery", desc: "Maximize native species, remove invasives, rebuild habitat layers." },
  { name: "Visual Design", desc: "Rhythm, massing, focal moments, palette cohesion." },
  { name: "Four-Season Interest", desc: "Bloom, foliage, berry, and bark across every month." },
  { name: "Pollinator Support", desc: "Host plants, bloom sequence, nesting habitat." },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [stats, setStats] = useState<{ properties: number; species: number; scans: number; plants: number } | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("submitting");
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), phone: "", propertyType: "" }),
      });
      setState(res.ok ? "success" : "error");
    } catch { setState("error"); }
  }

  return (
    <div className="min-h-screen bg-[#07110c] text-white">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Sprout className="h-5 w-5 text-lime-300" />
          </div>
          <span className="text-lg font-semibold tracking-tight">YardScore</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign In</a>
          <a href="/login" className="hidden sm:inline-flex rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200">
            Get Started
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
            Understand your yard.<br />
            <span className="text-lime-300">Know what to do next.</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed max-w-xl">
            Walk your property. Point your phone at plants. YardScore builds a persistent ecological model — species census, structural layers, light conditions, derived signals — and tells you exactly what to improve.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a href="/login" className="inline-flex items-center justify-center rounded-full bg-lime-300 px-8 py-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-200">
              Start Scanning — Free
            </a>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: stats.properties, label: "properties scanned" },
              { value: stats.species, label: "species identified" },
              { value: stats.plants, label: "plants observed" },
              { value: stats.scans, label: "scan sessions" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-2xl font-bold text-lime-300">{s.value}</p>
                <p className="text-xs text-zinc-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs font-medium uppercase tracking-widest text-lime-300/70 mb-4">How it works</p>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { step: "1", title: "Walk & Scan", desc: "Point your phone at plants. GPS + species ID builds your yard model automatically." },
            { step: "2", title: "Record Light", desc: "Quick light readings at different times and seasons. 10 seconds each." },
            { step: "3", title: "Get Insights", desc: "Signals, structure, readiness, recommendations — all shaped to your goals." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
              <div className="w-8 h-8 rounded-lg bg-lime-300/10 flex items-center justify-center text-lime-300 text-sm font-bold mb-3">
                {item.step}
              </div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-white mb-8">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <Icon className="h-5 w-5 text-lime-300 mb-3" />
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Outcome profiles */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-white mb-2">Tell YardScore what you care about</h2>
        <p className="text-sm text-zinc-400 mb-8">Same yard, different goals. Recommendations adapt to your priorities.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {OUTCOMES.map((o) => (
            <div key={o.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white">{o.name}</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{o.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-lime-300/15 bg-lime-300/5 p-8 sm:p-12 text-center">
          <h2 className="text-3xl font-bold text-white">
            Your yard is an ecosystem.<br />Understand it.
          </h2>
          <p className="mt-4 text-zinc-300 max-w-lg mx-auto">
            Free to scan. Free to score. Works on any phone. Takes 10-20 minutes to build your first census.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/login" className="inline-flex items-center justify-center rounded-full bg-lime-300 px-10 py-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-200">
              Start Scanning
            </a>
          </div>

          {/* Email capture */}
          <div className="mt-8 max-w-md mx-auto">
            <p className="text-xs text-zinc-500 mb-3">Or get notified about updates:</p>
            {state === "success" ? (
              <p className="text-sm font-medium text-lime-300">You&apos;re on the list.</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-lime-300/50"
                />
                <button type="submit" disabled={state === "submitting"}
                  className="h-10 px-5 rounded-lg bg-white/10 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50">
                  {state === "submitting" ? "..." : "Notify"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span><span className="text-zinc-400">YardScore</span> by DrewHenry</span>
          <div className="flex gap-6">
            <span>Species ID by Pl@ntNet</span>
            <span>Wildlife data from Doug Tallamy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
