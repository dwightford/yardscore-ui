"use client";

/**
 * /onboard — Address-based property setup (Mobile-first)
 *
 * The easiest possible start:
 * 1. Enter address → system fetches property context
 * 2. See your yard's pre-walk intelligence
 * 3. Tap "Walk Your Yard" to begin
 *
 * No paywall. No complexity. The garden wakes up from an address.
 */

import { useState, FormEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sprout, Search, MapPin, ArrowRight, TreePine, Droplets, Sun, Mountain } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface YardIntelligence {
  lot_acres: number;
  canopy_percent: number;
  estimated_trees: number;
  climate_zone: string;
  soil_type: string;
  sun_orientation: string;
  elevation_ft: number;
  narrative: string;
}

export default function OnboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const token = (session as any)?.apiToken as string | undefined;

  const [step, setStep] = useState<"address" | "preview" | "creating">("address");
  const [address, setAddress] = useState("");
  const [intel, setIntel] = useState<YardIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // TODO: replace with POST /intelligence/address when backend ready
      // For now, simulate the lookup with realistic demo data
      await new Promise((r) => setTimeout(r, 1500));

      setIntel({
        lot_acres: 0.47,
        canopy_percent: 38,
        estimated_trees: 15,
        climate_zone: "7b",
        soil_type: "Clay loam",
        sun_orientation: "South-facing front",
        elevation_ft: 505,
        narrative: "I can see your trees from satellite but I don't know what they are yet. Walk your yard for 10 minutes and I'll identify your plants, map your garden's structure, and start answering your questions.",
      });
      setStep("preview");
    } catch {
      setError("Couldn't look up that address. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const handleCreateProperty = useCallback(async () => {
    if (!token) return;
    setStep("creating");

    try {
      // TODO: Use POST /places/resolve with the geocoded address
      // For now, create via existing endpoint
      const res = await fetch(`${API}/land_units`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: address.split(",")[0]?.trim() || "My Yard",
          address: address.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const id = data.id || data.land_unit_id;
        if (id) {
          router.push(`/property/${id}`);
          return;
        }
      }
      setError("Couldn't create property. Please try again.");
      setStep("preview");
    } catch {
      setError("Couldn't create property. Please try again.");
      setStep("preview");
    }
  }, [token, address, router]);

  return (
    <div className="flex min-h-screen flex-col bg-forest-950 px-5 pb-20">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center gap-2.5 pt-6 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-forest-300/20 bg-forest-300/10">
          <Sprout className="h-4 w-4 text-forest-300" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white">YardScore</span>
      </div>

      {/* ── Step 1: Address entry ───────────────────── */}
      {step === "address" && (
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="font-display text-3xl font-bold leading-tight text-white">
            What&apos;s your
            <br />
            <span className="text-forest-300">address?</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            We&apos;ll find your yard and show you what we already know — before you take a single step.
          </p>

          <form onSubmit={handleLookup} className="mt-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="108 Buena Vista Way, Carrboro NC"
                autoFocus
                className="address-input !pl-12"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse-gentle">Finding your yard...</span>
              ) : (
                "Find My Yard"
              )}
            </button>
          </form>

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}

          <p className="mt-6 text-center text-xs text-zinc-600">
            Everything free. No Pro tier. No paywall.
          </p>
        </div>
      )}

      {/* ── Step 2: Pre-walk yard preview ────────────── */}
      {step === "preview" && intel && (
        <div className="animate-slide-up flex-1">
          <p className="section-label mb-2 mt-4">Your yard</p>
          <h2 className="text-lg font-semibold text-white">{address}</h2>

          {/* Map placeholder */}
          <div className="card mt-4 !p-0 overflow-hidden">
            <div className="relative flex h-44 items-center justify-center bg-forest-900">
              <MapPin className="mr-2 h-5 w-5 text-zinc-600" />
              <span className="text-sm text-zinc-600">Satellite view loading...</span>
              {/* TODO: Replace with actual satellite + boundary + buildings */}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { icon: TreePine, value: `~${intel.estimated_trees} trees`, label: `${intel.canopy_percent}% canopy` },
              { icon: Droplets, value: intel.soil_type, label: `Zone ${intel.climate_zone}` },
              { icon: Sun, value: intel.sun_orientation, label: `${intel.lot_acres} acres` },
              { icon: Mountain, value: `${intel.elevation_ft} ft`, label: "Elevation" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="stat-card flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 flex-none text-forest-300/60" />
                  <div>
                    <p className="text-sm font-medium text-white">{s.value}</p>
                    <p className="stat-label">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Garden's first words */}
          <div className="garden-voice mt-6">
            {intel.narrative}
          </div>

          {/* Walk CTA */}
          <button
            onClick={handleCreateProperty}
            className="btn-primary mt-6 w-full"
          >
            <Sprout className="mr-2 h-4 w-4" />
            Walk Your Yard
          </button>

          <p className="mt-3 text-center text-xs text-zinc-600">
            10 minutes. Just walk. The system captures everything automatically.
          </p>

          {/* Go back */}
          <button
            onClick={() => { setStep("address"); setIntel(null); }}
            className="mt-4 w-full text-center text-xs text-zinc-500"
          >
            ← Different address
          </button>
        </div>
      )}

      {/* ── Creating property ───────────────────────── */}
      {step === "creating" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest-300 border-t-transparent" />
          <p className="text-sm text-zinc-400">Setting up your yard...</p>
        </div>
      )}
    </div>
  );
}
