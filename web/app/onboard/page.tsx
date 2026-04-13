"use client";

/**
 * /onboard — authenticated first-property setup.
 *
 * Auth-gated (middleware + explicit guard). If the user already owns or
 * has access to the resolved address, they go straight to /property/[id]
 * — no re-ask, no claim loop. If they land here with ?address=<x> from
 * the landing page, we prefill and skip straight to preview.
 */

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sprout, Search, MapPin, TreePine, Droplets, Sun, Mountain } from "lucide-react";

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

interface LandUnit {
  id: string;
  name?: string | null;
  address?: string | null;
}

export default function OnboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (session as any)?.apiToken as string | undefined;

  const prefill = searchParams.get("address") ?? "";

  const [step, setStep] = useState<"address" | "preview" | "creating">(
    prefill ? "preview" : "address",
  );
  const [address, setAddress] = useState(prefill);
  const [intel, setIntel] = useState<YardIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingExisting, setResolvingExisting] = useState(true);

  // Hard auth gate — middleware should catch this, but belt + suspenders.
  useEffect(() => {
    if (status === "loading") return;
    if (!token) {
      const next = `/onboard${prefill ? `?address=${encodeURIComponent(prefill)}` : ""}`;
      router.replace(`/login?mode=signin&next=${encodeURIComponent(next)}`);
    }
  }, [status, token, prefill, router]);

  // Short-circuit the claim loop: if the user already has a property whose
  // address matches the one they came in with, jump straight to its home.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch(token, `${API}/land_units`);
        if (!res.ok) {
          if (!cancelled) setResolvingExisting(false);
          return;
        }
        const data = await res.json();
        const units: LandUnit[] = Array.isArray(data) ? data : data.land_units ?? [];

        if (prefill) {
          const match = units.find((u) =>
            (u.address ?? "").toLowerCase().startsWith(prefill.toLowerCase().split(",")[0]),
          );
          if (match) {
            if (!cancelled) router.replace(`/property/${match.id}`);
            return;
          }
        } else if (units.length > 0) {
          // User already owns a property and landed on /onboard bare —
          // they don't need to onboard again.
          if (!cancelled) router.replace(`/property/${units[0].id}`);
          return;
        }
      } catch {
        /* fall through */
      }
      if (!cancelled) setResolvingExisting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [token, prefill, router]);

  // Kick off the lookup automatically if we arrived with a prefilled address.
  useEffect(() => {
    if (step === "preview" && prefill && !intel && !loading && !resolvingExisting && token) {
      void runLookup(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, prefill, resolvingExisting, token]);

  const runLookup = useCallback(async (a: string) => {
    setLoading(true);
    setError(null);
    try {
      // TODO: wire POST /intelligence/address. Demo data until then.
      await new Promise((r) => setTimeout(r, 800));
      setIntel({
        lot_acres: 0.47,
        canopy_percent: 38,
        estimated_trees: 15,
        climate_zone: "7b",
        soil_type: "Clay loam",
        sun_orientation: "South-facing front",
        elevation_ft: 505,
        narrative:
          "I can see your trees from satellite but I don't know what they are yet. Walk your yard and I'll identify your plants.",
      });
      setStep("preview");
    } catch {
      setError("Couldn't look up that address. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLookup = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const a = address.trim();
      if (!a) return;
      await runLookup(a);
    },
    [address, runLookup],
  );

  const handleClaim = useCallback(async () => {
    if (!token) return;
    setStep("creating");
    try {
      const res = await fetch(`${API}/land_units`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      setError("Couldn't claim this yard. Try again.");
      setStep("preview");
    } catch {
      setError("Couldn't claim this yard. Try again.");
      setStep("preview");
    }
  }, [token, address, router]);

  if (status === "loading" || !token || resolvingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-forest-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-300/30 border-t-forest-300" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-forest-950 px-5 pb-20">
      <div className="flex items-center gap-2.5 pt-6 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-forest-300/20 bg-forest-300/10">
          <Sprout className="h-4 w-4 text-forest-300" />
        </div>
        <span className="text-base font-semibold tracking-tight text-white">YardScore</span>
      </div>

      {step === "address" && (
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="font-display text-3xl font-bold leading-tight text-white">
            What&apos;s your
            <br />
            <span className="text-forest-300">address?</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            We&apos;ll find your yard and show you what we already know.
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
                "Find my yard"
              )}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {step === "preview" && intel && (
        <div className="animate-slide-up flex-1">
          <p className="section-label mb-2 mt-4">Your yard</p>
          <h2 className="text-lg font-semibold text-white">{address}</h2>

          <div className="card mt-4 !p-0 overflow-hidden">
            <div className="relative flex h-44 items-center justify-center bg-forest-900">
              <MapPin className="mr-2 h-5 w-5 text-zinc-600" />
              <span className="text-sm text-zinc-600">Satellite view loading...</span>
            </div>
          </div>

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

          <div className="garden-voice mt-6">{intel.narrative}</div>

          <button onClick={handleClaim} className="btn-primary mt-6 w-full">
            <Sprout className="mr-2 h-4 w-4" />
            Claim this yard
          </button>
          <p className="mt-3 text-center text-xs text-zinc-600">
            You&apos;ll be the owner. You can invite household members later.
          </p>

          <button
            onClick={() => {
              setStep("address");
              setIntel(null);
            }}
            className="mt-4 w-full text-center text-xs text-zinc-500"
          >
            ← Different address
          </button>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {step === "creating" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-forest-300 border-t-transparent" />
          <p className="text-sm text-zinc-400">Setting up your yard...</p>
        </div>
      )}
    </div>
  );
}
