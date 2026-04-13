"use client";

/**
 * Landing page — auth-first entry.
 *
 * Primary actions (always visible): Create account, Sign in, Try demo.
 * Address lookup resolves yard state (available / owned / already yours) but
 * never creates a claim. Every claim/walk CTA routes through /login with
 * address + intent preserved so the flow resumes after the 6-digit code.
 */

import { useState, FormEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Sprout,
  TreePine,
  MapPin,
  Building2,
  Shield,
  Code2,
  ArrowRight,
  Search,
  Footprints,
  BrainCircuit,
  LogIn,
  UserPlus,
  PlayCircle,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type YardState =
  | { kind: "available"; address: string }
  | { kind: "owned_by_other"; address: string }
  | { kind: "yours"; address: string; landUnitId: string };

const CONVERSATION = [
  { role: "user" as const, text: "What's missing in my garden?" },
  {
    role: "garden" as const,
    text:
      "You have good species diversity but no groundcover layer. Your east bed has strong understory — beautyberry, ninebark, foamflower — but the west side is mostly bare. Three native shrubs on the west side would push your score from 54 to mid-60s.",
  },
];

const PARTNERS = [
  { icon: TreePine, title: "Nurseries", tagline: "Know what your customer needs before they ask" },
  { icon: Building2, title: "Real Estate", tagline: "The score every listing is missing" },
  { icon: Shield, title: "Landscapers", tagline: "Arrive already knowing the yard" },
  { icon: Code2, title: "Developers", tagline: "Build on the garden knowledge layer" },
];

function authHref(mode: "register" | "signin", address?: string, intent?: string) {
  const params = new URLSearchParams();
  if (mode === "register") params.set("mode", "register");
  if (address) params.set("address", address);
  if (intent) params.set("intent", intent);
  params.set("next", "/onboard" + (address ? `?address=${encodeURIComponent(address)}` : ""));
  return `/login?${params.toString()}`;
}

export default function LandingPage() {
  const { data: session } = useSession();
  const isAuthed = !!(session as any)?.apiToken;

  const [address, setAddress] = useState("");
  const [yard, setYard] = useState<YardState | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleLookup = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const a = address.trim();
      if (!a) return;
      setLoading(true);
      setLookupError(null);
      setYard(null);

      try {
        // Anonymous-safe state resolver. Returns yard state without claiming.
        // If the backend isn't wired yet, default to "available" so the CTAs
        // still make the auth gate explicit.
        const token = (session as any)?.apiToken as string | undefined;
        const res = await fetch(`${API}/places/resolve-state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ address: a }),
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          if (data.state === "yours" && data.land_unit_id) {
            setYard({ kind: "yours", address: a, landUnitId: data.land_unit_id });
          } else if (data.state === "owned") {
            setYard({ kind: "owned_by_other", address: a });
          } else {
            setYard({ kind: "available", address: a });
          }
        } else {
          // Conservative fallback: assume available and require auth to claim.
          setYard({ kind: "available", address: a });
        }
      } catch {
        setLookupError("Couldn't look up that address. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [address, session],
  );

  return (
    <div className="min-h-screen bg-forest-950 text-white">
      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Sprout className="h-5 w-5 text-forest-300" />
          </div>
          <span className="text-lg font-semibold tracking-tight">YardScore</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/login?mode=signin"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-300 transition-colors hover:text-white"
          >
            <LogIn className="h-4 w-4" /> Sign in
          </a>
          <a
            href="/register"
            className="btn-primary hidden !px-4 !py-2 !text-sm sm:inline-flex"
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Create account
          </a>
          <a
            href="/demo"
            className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-white/10 sm:inline-flex"
          >
            <PlayCircle className="h-4 w-4" /> Try demo
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

        {/* Primary actions — mobile-visible trio */}
        <div className="mt-8 grid gap-3 sm:hidden">
          <a href="/register" className="btn-primary justify-center">
            <UserPlus className="mr-2 h-4 w-4" /> Create account
          </a>
          <a
            href="/login?mode=signin"
            className="btn-secondary justify-center"
          >
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </a>
          <a
            href="/demo"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200"
          >
            <PlayCircle className="h-4 w-4" /> Try demo
          </a>
        </div>

        {/* Address lookup — anonymous-safe state resolver only */}
        <form onSubmit={handleLookup} className="mt-10 max-w-lg">
          <label className="section-label mb-3 block">
            Curious about your address?
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
                  <span className="hidden sm:inline">Check this yard</span>
                  <ArrowRight className="h-5 w-5 sm:hidden" />
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            We&apos;ll tell you what we know about this address. We never claim it
            for you — claiming requires an account.
          </p>
          {lookupError && (
            <p className="mt-3 text-sm text-red-400">{lookupError}</p>
          )}
        </form>

        {/* ── Yard state result ─────────────────────────── */}
        {yard && (
          <div className="mt-8 animate-slide-up">
            <div className="card !p-0 overflow-hidden">
              <div className="relative h-40 bg-forest-900">
                <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                  <MapPin className="mr-2 h-5 w-5" />
                  <span className="text-sm">{yard.address}</span>
                </div>
              </div>

              <div className="p-6">
                {yard.kind === "available" && (
                  <>
                    <h3 className="text-lg font-semibold text-white">
                      This yard is available.
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      No one has claimed this address yet. Create an account or
                      sign in to claim it. We&apos;ll keep this address with you
                      through the 6-digit code.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={authHref("register", yard.address, "claim")}
                        className="btn-primary"
                      >
                        <UserPlus className="mr-2 h-4 w-4" /> Create account to claim
                      </a>
                      <a
                        href={authHref("signin", yard.address, "claim")}
                        className="btn-secondary"
                      >
                        <LogIn className="mr-2 h-4 w-4" /> Sign in to claim
                      </a>
                    </div>
                  </>
                )}

                {yard.kind === "owned_by_other" && (
                  <>
                    <h3 className="text-lg font-semibold text-white">
                      This yard is already owned.
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      Someone has already claimed this address. You can sign in
                      to request access — the current owner will be notified.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={authHref("signin", yard.address, "request_access")}
                        className="btn-primary"
                      >
                        <LogIn className="mr-2 h-4 w-4" /> Sign in to request access
                      </a>
                    </div>
                  </>
                )}

                {yard.kind === "yours" && (
                  <>
                    <h3 className="text-lg font-semibold text-white">
                      This is your yard.
                    </h3>
                    <p className="mt-2 text-sm text-zinc-400">
                      You already have access. Open it from your property home.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <a
                        href={
                          isAuthed
                            ? `/property/${yard.landUnitId}`
                            : `/login?mode=signin&next=${encodeURIComponent(
                                `/property/${yard.landUnitId}`,
                              )}`
                        }
                        className="btn-primary"
                      >
                        Open your yard <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </div>
                  </>
                )}
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
            { step: "1", icon: Search, title: "Enter your address", desc: "Your yard already knows its shape, soil, trees, and sun — all from free public data." },
            { step: "2", icon: Footprints, title: "Walk your yard", desc: "Camera open. Just walk. The system captures everything automatically — plants, light, elevation, heading." },
            { step: "3", icon: BrainCircuit, title: "Your garden speaks", desc: "Ask it anything. It answers from real observation data. Nurseries and realtors listen. You earn." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="card">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-forest-600/15 text-forest-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-forest-300/60">Step {item.step}</p>
                <h3 className="mt-1 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.desc}</p>
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
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
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
                <h3 className="text-base font-semibold text-white">{p.title}</h3>
                <p className="mt-1 text-sm font-medium text-forest-300/80">{p.tagline}</p>
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
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="/register" className="btn-primary">
              <UserPlus className="mr-2 h-4 w-4" /> Create account
            </a>
            <a href="/login?mode=signin" className="btn-secondary">
              <LogIn className="mr-2 h-4 w-4" /> Sign in
            </a>
            <a
              href="/demo"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200 hover:bg-white/10"
            >
              <PlayCircle className="h-4 w-4" /> Try demo
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span><span className="text-zinc-400">YardScore</span> by DrewHenry</span>
          <div className="flex gap-6">
            <a href="/login?mode=signin" className="hover:text-zinc-400">Sign in</a>
            <a href="/register" className="hover:text-zinc-400">Create account</a>
            <span>
              Build {process.env.NEXT_PUBLIC_BUILD_SHA || "dev"}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
