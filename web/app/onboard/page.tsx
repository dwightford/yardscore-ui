"use client";

/**
 * /onboard — authenticated first-property setup.
 *
 * Auth-gated. Truthfully resolves yard state, claims via the canonical
 * POST /places/resolve path (one canonical owner per address), and falls
 * back to a server-backed request-access flow on 409.
 *
 * Canon: yardscore-landing-state-and-access-request-v1. No fake preview
 * data in real claim/access flows — we use POST /intelligence/address
 * when available and a truthful minimal preview otherwise.
 */

import { useState, useEffect, FormEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sprout, Search, MapPin, TreePine, Droplets, Sun, Mountain } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface PropertyIntelligence {
  address: string;
  lat: number;
  lng: number;
  lot_acres?: number | null;
  canopy_percent?: number | null;
  estimated_tree_count?: number | null;
  climate_zone?: string | null;
  soil_type?: string | null;
  sun_orientation?: string | null;
  elevation_ft?: number | null;
  narrative?: string | null;
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
  const intent = (searchParams.get("intent") ?? "claim") as "claim" | "request_access";

  const [step, setStep] = useState<"address" | "preview" | "creating">(
    prefill ? "preview" : "address",
  );
  const [address, setAddress] = useState(prefill);
  const [intel, setIntel] = useState<PropertyIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvingExisting, setResolvingExisting] = useState(true);

  // Hard auth gate.
  useEffect(() => {
    if (status === "loading") return;
    if (!token) {
      const q = new URLSearchParams();
      if (prefill) q.set("address", prefill);
      if (intent !== "claim") q.set("intent", intent);
      const next = `/onboard${q.toString() ? `?${q.toString()}` : ""}`;
      router.replace(`/login?mode=signin&next=${encodeURIComponent(next)}`);
    }
  }, [status, token, prefill, intent, router]);

  // Short-circuit: if user already owns/has access to this address, jump home.
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
        } else if (units.length > 0 && intent === "claim") {
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
  }, [token, prefill, intent, router]);

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
      // Real public address intelligence. Unauthenticated route; safe without a token.
      const r = await fetch(`${API}/intelligence/address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: a }),
      });
      if (r.ok) {
        const data = (await r.json()) as PropertyIntelligence;
        setIntel(data);
        setStep("preview");
      } else if (r.status === 404) {
        setError("We couldn't find that address. Double-check and try again.");
      } else {
        // Truthful minimal preview: just the address the user typed, no fake stats.
        setIntel({ address: a, lat: 0, lng: 0 });
        setStep("preview");
      }
    } catch {
      setIntel({ address: a, lat: 0, lng: 0 });
      setStep("preview");
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

  // Claim via POST /places/resolve (canonical). On 409 → record a real
  // server-backed request-access row via POST /land_units/{id}/claim.
  const handleClaim = useCallback(async () => {
    if (!token || !intel) return;
    setStep("creating");
    setError(null);
    try {
      const r = await fetch(`${API}/places/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat: intel.lat,
          lon: intel.lng,
          address: intel.address,
        }),
      });

      if (r.ok) {
        const data = await r.json();
        const id = data.land_unit_id;
        if (id) {
          router.push(`/property/${id}`);
          return;
        }
      }

      if (r.status === 409) {
        // Canonical owner exists — record a real request-access row.
        const detail = await r.json().catch(() => null);
        const existingId = detail?.detail?.land_unit_id || detail?.land_unit_id;
        if (existingId) {
          const claimRes = await fetch(`${API}/land_units/${existingId}/claim`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          });
          if (claimRes.ok) {
            router.push(`/property/${existingId}`);
            return;
          }
        }
        setError("This yard is already owned. We couldn't record your request — try again.");
        setStep("preview");
        return;
      }

      setError("Couldn't claim this yard. Try again.");
      setStep("preview");
    } catch {
      setError("Couldn't claim this yard. Try again.");
      setStep("preview");
    }
  }, [token, intel, router]);

  // Explicit request-access path (intent=request_access from landing).
  const handleRequestAccess = handleClaim;

  if (status === "loading" || !token || resolvingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-forest-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-300/30 border-t-forest-300" />
      </div>
    );
  }

  const primaryLabel = intent === "request_access" ? "Request access" : "Claim this yard";
  const primaryHint =
    intent === "request_access"
      ? "The owner will be notified. You'll see your access update here once they approve."
      : "You'll be the owner. You can invite household members later.";

  const hasRichIntel = !!(intel && (intel.lat !== 0 || intel.lng !== 0));

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
              {loading ? <span className="animate-pulse-gentle">Finding your yard...</span> : "Find my yard"}
            </button>
          </form>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {step === "preview" && intel && (
        <div className="animate-slide-up flex-1">
          <p className="section-label mb-2 mt-4">Your yard</p>
          <h2 className="text-lg font-semibold text-white">{intel.address}</h2>

          {hasRichIntel ? (
            <>
              <div className="card mt-4 !p-0 overflow-hidden">
                <div className="relative flex h-44 items-center justify-center bg-forest-900">
                  <MapPin className="mr-2 h-5 w-5 text-zinc-600" />
                  <span className="text-sm text-zinc-600">
                    {intel.lat.toFixed(4)}, {intel.lng.toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {intel.estimated_tree_count != null && intel.canopy_percent != null && (
                  <div className="stat-card flex items-start gap-3">
                    <TreePine className="mt-0.5 h-4 w-4 flex-none text-forest-300/60" />
                    <div>
                      <p className="text-sm font-medium text-white">~{intel.estimated_tree_count} trees</p>
                      <p className="stat-label">{intel.canopy_percent}% canopy</p>
                    </div>
                  </div>
                )}
                {intel.soil_type && (
                  <div className="stat-card flex items-start gap-3">
                    <Droplets className="mt-0.5 h-4 w-4 flex-none text-forest-300/60" />
                    <div>
                      <p className="text-sm font-medium text-white">{intel.soil_type}</p>
                      {intel.climate_zone && <p className="stat-label">Zone {intel.climate_zone}</p>}
                    </div>
                  </div>
                )}
                {intel.sun_orientation && intel.lot_acres != null && (
                  <div className="stat-card flex items-start gap-3">
                    <Sun className="mt-0.5 h-4 w-4 flex-none text-forest-300/60" />
                    <div>
                      <p className="text-sm font-medium text-white">{intel.sun_orientation}</p>
                      <p className="stat-label">{intel.lot_acres} acres</p>
                    </div>
                  </div>
                )}
                {intel.elevation_ft != null && (
                  <div className="stat-card flex items-start gap-3">
                    <Mountain className="mt-0.5 h-4 w-4 flex-none text-forest-300/60" />
                    <div>
                      <p className="text-sm font-medium text-white">{intel.elevation_ft} ft</p>
                      <p className="stat-label">Elevation</p>
                    </div>
                  </div>
                )}
              </div>

              {intel.narrative && <div className="garden-voice mt-6">{intel.narrative}</div>}
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-zinc-300">
                We don&apos;t have a rich pre-walk preview for this address yet. You can
                still proceed — we&apos;ll build the yard&apos;s memory as you walk it.
              </p>
            </div>
          )}

          <button
            onClick={intent === "request_access" ? handleRequestAccess : handleClaim}
            className="btn-primary mt-6 w-full"
          >
            <Sprout className="mr-2 h-4 w-4" />
            {primaryLabel}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-600">{primaryHint}</p>

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
          <p className="text-sm text-zinc-400">
            {intent === "request_access" ? "Sending request..." : "Setting up your yard..."}
          </p>
        </div>
      )}
    </div>
  );
}
