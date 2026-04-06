"use client";

/**
 * Landing page — Garden Voice edition.
 *
 * Hero: address input → instant property intelligence.
 * How it works: address → walk → garden speaks.
 * Example conversation with the garden.
 * Score badge + earnings preview.
 * B2B partner section.
 * No pricing. Everything free.
 */

import { useState, FormEvent, useCallback } from "react";
import {
  Sprout,
  TreePine,
  MapPin,
  MessageCircle,
  Sparkles,
  Building2,
  Shield,
  Code2,
  ArrowRight,
  Search,
  Footprints,
  BrainCircuit,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

interface PropertyIntelligence {
  address: string;
  lot_acres: number;
  canopy_percent: number;
  estimated_trees: number;
  climate_zone: string;
  soil_type: string;
  sun_orientation: string;
  narrative: string;
}

/* ── Mock data for demo (until /intelligence/address endpoint) */

const DEMO_RESULT: PropertyIntelligence = {
  address: "108 Buena Vista Way, Carrboro, NC 27510",
  lot_acres: 0.47,
  canopy_percent: 38,
  estimated_trees: 15,
  climate_zone: "7b",
  soil_type: "Clay loam",
  sun_orientation: "South-facing front",
  narrative:
    "I can see your trees from satellite but I don't know what they are yet. Walk your yard for 10 minutes and I'll identify your plants, map your garden's structure, and start answering your questions.",
};

/* ── Conversation example ───────────────────────────────────── */

const CONVERSATION = [
  {
    role: "user" as const,
    text: "What's missing in my garden?",
  },
  {
    role: "garden" as const,
    text: 'You have good species diversity but no groundcover layer. Your east bed has strong understory — beautyberry, ninebark, foamflower — but the west side is mostly bare. Three native shrubs on the west side would push your score from 54 to mid-60s.',
  },
  {
    role: "user" as const,
    text: "I'm at the nursery. What do I need?",
  },
  {
    role: "garden" as const,
    text: "Three things would have the biggest impact:\n1. Virginia sweetspire for the west fence — handles afternoon sun\n2. Christmas fern as groundcover under it — evergreen, no maintenance\n3. One more understory tree — dogwood or fringe tree between the oaks",
  },
];

/* ── B2B partners ───────────────────────────────────────────── */

const PARTNERS = [
  {
    icon: TreePine,
    title: "Nurseries",
    tagline: "Know what your customer needs before they ask",
    desc: "Personalized recommendations at point of sale. Customer walks in, you know their yard needs native understory shrubs for part shade.",
  },
  {
    icon: Building2,
    title: "Real Estate",
    tagline: "The score every listing is missing",
    desc: "YardScore on Zillow, Redfin, MLS. Buyers search by ecological health. Sellers invest in improving their score.",
  },
  {
    icon: Shield,
    title: "Landscapers",
    tagline: "Arrive already knowing the yard",
    desc: "Species, structure, light, terrain — before the site visit. Your quotes are more accurate, your work plans are better.",
  },
  {
    icon: Code2,
    title: "Developers",
    tagline: "Build on the garden knowledge layer",
    desc: "MCP resource server + REST API. Your AI assistant asks the garden a question. The garden answers from real observation data.",
  },
];

/* ── Component ──────────────────────────────────────────────── */

export default function LandingPage() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<PropertyIntelligence | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLookup = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!address.trim()) return;
      setLoading(true);

      // TODO: replace with POST /intelligence/address when backend ready
      // For now, show demo result after a brief delay to simulate lookup
      await new Promise((r) => setTimeout(r, 1200));
      setResult({ ...DEMO_RESULT, address: address.trim() });
      setLoading(false);
    },
    [address],
  );

  return (
    <div className="min-h-screen bg-forest-950 text-white">
      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Sprout className="h-5 w-5 text-forest-300" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            YardScore
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/login"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Sign In
          </a>
          <a
            href="/login"
            className="btn-primary hidden !px-5 !py-2.5 !text-sm sm:inline-flex"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-12 lg:pb-24 lg:pt-20">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Your garden has
            <br />
            <span className="text-forest-300">a voice.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
            Walk your yard. It learns. It speaks. Nurseries, realtors, and AI
            assistants listen. You earn.
          </p>
        </div>

        {/* Address input */}
        <form onSubmit={handleLookup} className="mt-10 max-w-lg">
          <label className="section-label mb-3 block">
            What&apos;s your address?
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="108 Buena Vista Way, Carrboro NC"
                className="address-input !pl-12"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary !rounded-2xl !px-6 !py-0 disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse-gentle">Looking...</span>
              ) : (
                <>
                  <span className="hidden sm:inline">Wake Up My Yard</span>
                  <ArrowRight className="h-5 w-5 sm:hidden" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* ── Results reveal ────────────────────────────── */}
        {result && (
          <div className="mt-8 animate-slide-up">
            <div className="card !p-0 overflow-hidden">
              {/* Map placeholder — satellite with boundary overlay */}
              <div className="relative h-48 bg-forest-900 sm:h-64">
                <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                  <MapPin className="mr-2 h-5 w-5" />
                  <span className="text-sm">
                    Satellite view loading for {result.address}
                  </span>
                </div>
                {/* TODO: Replace with actual satellite map + boundary + buildings */}
              </div>

              <div className="p-6">
                <h3 className="text-lg font-semibold text-white">
                  {result.address}
                </h3>

                {/* Stats grid */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    {
                      value: `${result.lot_acres} acres`,
                      label: "Lot size",
                    },
                    {
                      value: `${result.canopy_percent}%`,
                      label: "Canopy coverage",
                    },
                    {
                      value: `~${result.estimated_trees}`,
                      label: "Trees detected",
                    },
                    {
                      value: `Zone ${result.climate_zone}`,
                      label: "Climate zone",
                    },
                    { value: result.soil_type, label: "Soil type" },
                    {
                      value: result.sun_orientation,
                      label: "Sun orientation",
                    },
                  ].map((s) => (
                    <div key={s.label} className="stat-card">
                      <p className="stat-value !text-lg">{s.value}</p>
                      <p className="stat-label">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Garden's first words */}
                <div className="garden-voice mt-6">{result.narrative}</div>

                {/* CTA */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a href="/login" className="btn-primary">
                    Download the App — Free
                  </a>
                  <p className="self-center text-xs text-zinc-500">
                    Everything free. No Pro tier. No paywall. Your garden earns
                    for you.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="section-label mb-8">How it works</p>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              icon: Search,
              title: "Enter your address",
              desc: "Your yard already knows its shape, soil, trees, and sun — all from free public data.",
            },
            {
              step: "2",
              icon: Footprints,
              title: "Walk your yard",
              desc: "Camera open. Just walk. The system captures everything automatically — plants, light, elevation, heading.",
            },
            {
              step: "3",
              icon: BrainCircuit,
              title: "Your garden speaks",
              desc: "Ask it anything. It answers from real observation data. Nurseries and realtors listen. You earn.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="card">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600/15 text-forest-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-forest-300/60">
                  Step {item.step}
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Example conversation ─────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="section-label mb-3">The garden speaks</p>
        <h2 className="mb-8 font-display text-3xl font-bold text-white">
          Ask your garden anything
        </h2>

        <div className="mx-auto max-w-2xl space-y-4">
          {CONVERSATION.map((msg, i) => (
            <div
              key={i}
              className={
                msg.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              {msg.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-forest-600/20 px-4 py-3 text-sm text-zinc-200">
                  {msg.text}
                </div>
              ) : (
                <div className="garden-voice max-w-[90%] !rounded-2xl !rounded-bl-md whitespace-pre-line">
                  {msg.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Score badge ──────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="card flex flex-col items-center !p-10 text-center sm:!p-14">
          <div className="score-badge !px-10 !py-5 !text-4xl">78</div>
          <p className="mt-3 text-sm text-zinc-400">YardScore</p>
          <h3 className="mt-4 font-display text-2xl font-bold text-white">
            Your score on every listing
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">
            Like WalkScore for walkability — but for ecological health. Your
            YardScore appears on real estate listings, neighborhood pages, and
            anywhere your garden&apos;s reputation matters.
          </p>
        </div>
      </section>

      {/* ── Earnings preview ─────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="section-label mb-3">Your garden earns</p>
        <h2 className="mb-8 font-display text-3xl font-bold text-white">
          You walk. Your garden learns. You earn.
        </h2>

        <div className="card mx-auto max-w-md !bg-forest-900/50 !p-6 font-mono text-sm">
          <p className="mb-3 text-xs font-sans font-medium text-zinc-400">
            Garden Earnings — April 2027
          </p>
          <div className="space-y-2">
            {[
              { source: "Nursery queries", count: 12, amount: "$1.44" },
              {
                source: "Real estate listing views",
                count: 89,
                amount: "$1.78",
              },
              { source: "Landscaper pre-visit", count: 1, amount: "$2.00" },
              { source: "AI assistant queries", count: 23, amount: "$0.46" },
            ].map((row) => (
              <div
                key={row.source}
                className="flex items-center justify-between"
              >
                <span className="text-zinc-400">{row.source}</span>
                <span className="earnings-value !text-sm">{row.amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="font-sans text-xs text-zinc-400">
              Monthly total
            </span>
            <span className="earnings-value">$5.68</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Every commercial query against your garden data generates a
          micro-payment. Walk more → richer data → more queries → your garden
          earns more.
        </p>
      </section>

      {/* ── For businesses ───────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="section-label mb-3">For businesses</p>
        <h2 className="mb-8 font-display text-3xl font-bold text-white">
          Your customers&apos; gardens can talk to your systems
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {PARTNERS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="card">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600/15 text-forest-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  {p.title}
                </h3>
                <p className="mt-1 text-sm font-medium text-forest-300/80">
                  {p.tagline}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="card !border-forest-600/15 !bg-forest-600/5 !p-8 text-center sm:!p-14">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Your garden has a voice.
            <br />
            <span className="text-forest-300">Let it speak.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-300">
            Free to use. Free to walk. Free to ask. Your garden earns for you
            from every commercial query. The person who creates the value never
            pays for it.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="/login" className="btn-primary">
              Wake Up My Yard
            </a>
            <a href="#how" className="btn-secondary">
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="text-zinc-400">YardScore</span> by DrewHenry
          </span>
          <div className="flex gap-6">
            <a href="/login" className="hover:text-zinc-400">
              Sign In
            </a>
            <span>Species ID by Pl@ntNet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
